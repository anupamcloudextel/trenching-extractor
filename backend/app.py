from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
import os
import tempfile
import re
from typing import Optional, List, Dict, Any

# Existing imports
from parsers import nmmc
from parsers import mcgm_application_parser

# Local DB (replaces Supabase)
import db as local_db

app = FastAPI(
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://10.28.30.56",
        "http://10.28.30.56",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    local_db.init_tables()


# -------------------------------------------------------------------
# PATHS (keep these consistent)
# -------------------------------------------------------------------
# Use project root (two levels up from this file) so local Windows
# setup and server setup both resolve paths correctly.
BASE_DIR = Path(__file__).resolve().parent.parent

ROUTES_DIR = BASE_DIR / "ROUTES"
MASTER_FILES_DIR = BASE_DIR / "master_files"

# Downloads (what you already fixed)
MASTER_BUDGET_PATH = BASE_DIR / "Master_Budget_BACKUP.xlsx"
MASTER_DN_PATH = BASE_DIR / "ROUTES/Route 45/CE_DN_MUMU25R045.xlsx"
MASTER_PO_PATH = MASTER_FILES_DIR / "master_po.xlsx"

# Route-analysis "budget DB" location (preferred)
# If you have the real old server file, keep it here:
MASTER_BUDGET_DB = MASTER_FILES_DIR / "master_budget.xlsx"

# -------------------------------------------------------------------
# HELPERS
# -------------------------------------------------------------------
def _pick_budget_file() -> Path:
    """
    Prefer master_files/master_budget.xlsx (old server-style "DB"),
    else fall back to BASE_DIR/Master_Budget_BACKUP.xlsx.
    """
    if MASTER_BUDGET_DB.exists():
        return MASTER_BUDGET_DB
    if MASTER_BUDGET_PATH.exists():
        return MASTER_BUDGET_PATH
    return MASTER_BUDGET_DB  # default (will fail with clear error)


def _normalize(s: Any) -> str:
    if s is None:
        return ""
    return str(s).strip()


def _extract_digits(s: str) -> str:
    """
    Extract a digit run from a string (used to match numeric route ids).
    Example:
      "MUM_Route_131" -> "131"
      "Route 131" -> "131"
      "131" -> "131"
    """
    s = _normalize(s)
    m = re.search(r"(\d+)", s)
    return m.group(1) if m else ""


def _read_budget_df() -> "Any":
    """
    Reads the Excel budget file using pandas (openpyxl engine).
    Your backend venv already has pandas/openpyxl per requirements.txt.
    """
    try:
        import pandas as pd
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"pandas not available in backend venv. Install backend requirements. Error: {e}",
        )

    budget_file = _pick_budget_file()
    if not budget_file.exists():
        raise HTTPException(status_code=404, detail=f"Missing budget file: {budget_file}")

    # Try common sheet names; if none work, read first sheet.
    sheet_candidates = ["MasterBudget", "masterbudget", "Sheet1", "Budget", "MASTERBUDGET"]
    last_err = None
    for sh in sheet_candidates:
        try:
            df = pd.read_excel(str(budget_file), sheet_name=sh)
            return df
        except Exception as e:
            last_err = e

    # fallback: first sheet
    try:
        df = pd.read_excel(str(budget_file), sheet_name=0)
        return df
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to read budget excel: {budget_file}. Last error: {last_err}. Final error: {e}",
        )


def _folder_route_ids_fallback() -> List[str]:
    """
    Fallback if budget file doesn't exist or doesn't have route_id_site_id.
    Extract numeric IDs from folder names.
    """
    route_ids = set()
    if ROUTES_DIR.exists():
        for p in ROUTES_DIR.glob("Route *"):
            m = re.search(r"Route\s+(\d+)", p.name, re.IGNORECASE)
            if m:
                route_ids.add(m.group(1))

        for p in ROUTES_DIR.glob("Coverage*"):
            m = re.search(r"Route\s*([0-9]+)", p.name, re.IGNORECASE)
            if m:
                route_ids.add(m.group(1))

    return sorted(route_ids, key=lambda x: int(x))


# -------------------------------------------------------------------
# ROUTE IDS (IMPORTANT: should match what route-analysis uses)
# -------------------------------------------------------------------
@app.get("/api/route-ids")
def get_route_ids():
    """
    Preferred: return unique route_id_site_id values from the budget Excel.
    Fallback: numeric folder-based IDs.
    """
    try:
        df = _read_budget_df()
        cols = [c.strip().lower() for c in df.columns.astype(str).tolist()]
        if "route_id_site_id" not in cols:
            # budget exists but doesn't have the column ? fallback to folders
            return {"route_ids": _folder_route_ids_fallback(), "source": "folders"}

        # get real column name as in df (preserve original)
        route_col = df.columns[cols.index("route_id_site_id")]
        series = df[route_col].dropna().astype(str).map(lambda x: x.strip())
        unique_vals = sorted(set([v for v in series.tolist() if v]), key=lambda x: (_extract_digits(x) or x, x))
        return {"route_ids": unique_vals, "source": str(_pick_budget_file())}
    except HTTPException:
        try:
            ids = local_db.get_budget_route_ids()
            if ids:
                return {"route_ids": sorted(ids), "source": "postgresql"}
        except Exception:
            pass
        return {"route_ids": _folder_route_ids_fallback(), "source": "folders"}
    except Exception:
        try:
            ids = local_db.get_budget_route_ids()
            if ids:
                return {"route_ids": sorted(ids), "source": "postgresql"}
        except Exception:
            pass
        return {"route_ids": _folder_route_ids_fallback(), "source": "folders"}


# -------------------------------------------------------------------
# ROUTE ANALYSIS (shared helper + endpoint)
# -------------------------------------------------------------------
def _route_analysis_rows(route_id_site_id: str) -> List[Dict[str, Any]]:
    """Returns budget rows for the given route_id_site_id (used by route-analysis and budget-by-route)."""
    df = _read_budget_df()
    cols_l = [c.strip().lower() for c in df.columns.astype(str).tolist()]
    if "route_id_site_id" not in cols_l:
        raise HTTPException(
            status_code=500,
            detail=f"Budget file {_pick_budget_file()} does not contain 'route_id_site_id' column.",
        )
    route_col = df.columns[cols_l.index("route_id_site_id")]
    q_raw = _normalize(route_id_site_id)
    q_low = q_raw.lower()
    q_digits = _extract_digits(q_raw)
    s = df[route_col].fillna("").astype(str).map(lambda x: x.strip())
    s_low = s.map(lambda x: x.lower())
    s_digits = s.map(_extract_digits)
    mask = (s_low == q_low)
    if q_digits and not mask.any():
        mask = (s_digits == q_digits)
    filtered = df[mask].copy()
    try:
        import pandas as pd
        filtered = filtered.where(pd.notnull(filtered), None)
        return filtered.to_dict(orient="records")
    except Exception:
        data = []
        for _, row in filtered.iterrows():
            rec = {str(k): (None if (v != v) else v) for k, v in row.items()}
            data.append(rec)
        return data


def _route_analysis_from_db(route_id_site_id: str) -> List[Dict[str, Any]]:
    """Fallback: get budget rows from PostgreSQL budget_master (exact then case-insensitive)."""
    try:
        sid = route_id_site_id.strip()
        rows = local_db.query_budget_by_site_id_all(sid)
        if not rows:
            rows = local_db.query_budget_by_route_id_insensitive(sid)
        return [dict(r) for r in rows] if rows else []
    except Exception:
        return []


@app.get("/api/route-analysis")
def route_analysis(route_id_site_id: str = Query(..., description="Route id (string or numeric)")):
    """
    Returns rows from budget filtered by route_id_site_id.
    Uses budget Excel if available; otherwise PostgreSQL budget_master.
    """
    data = []
    try:
        data = _route_analysis_rows(route_id_site_id)
    except HTTPException:
        data = _route_analysis_from_db(route_id_site_id)
    if not data:
        data = _route_analysis_from_db(route_id_site_id)
    return {"data": data, "rows": data}


# -------------------------------------------------------------------
# PO / BUDGET BY ROUTE (Developer Reference)
# -------------------------------------------------------------------
@app.get("/api/po-by-route")
def po_by_route(route_id_site_id: str = Query(..., description="Route id (string or numeric)")):
    """
    Returns a single PO row for the given route_id_site_id.
    Uses master_po.xlsx; first matching row or null.
    """
    try:
        import pandas as pd
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"pandas not available: {e}")
    if not MASTER_PO_PATH.exists():
        return {"data": [], "row": None}
    try:
        df = pd.read_excel(str(MASTER_PO_PATH), sheet_name=0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to read PO file: {e}")
    cols_l = [c.strip().lower() for c in df.columns.astype(str).tolist()]
    if "route_id_site_id" not in cols_l:
        return {"data": [], "row": None}
    route_col = df.columns[cols_l.index("route_id_site_id")]
    q_raw = _normalize(route_id_site_id)
    q_digits = _extract_digits(q_raw)
    s = df[route_col].fillna("").astype(str).map(lambda x: x.strip())
    s_low = s.map(lambda x: x.lower())
    s_digits = s.map(_extract_digits)
    mask = (s_low == q_raw.lower())
    if q_digits and not mask.any():
        mask = (s_digits == q_digits)
    filtered = df[mask]
    if filtered.empty:
        return {"data": [], "row": None}
    row = filtered.iloc[0].to_dict()
    row = {str(k): (None if (v != v) else v) for k, v in row.items()}
    return {"data": [row], "row": row}


@app.get("/api/budget-by-route")
def budget_by_route(route_id_site_id: str = Query(..., description="Route id (string or numeric)")):
    """
    Returns a single budget row (first from route-analysis) for the given route_id_site_id.
    """
    try:
        rows = _route_analysis_rows(route_id_site_id)
        row = rows[0] if rows else None
        return {"data": rows, "row": row}
    except HTTPException:
        return {"data": [], "row": None}
    except Exception:
        return {"data": [], "row": None}


# -------------------------------------------------------------------
# MASTER FILE DOWNLOADS (from PostgreSQL DB)
# -------------------------------------------------------------------
def _db_rows_to_excel_response(rows: List[Dict[str, Any]], filename: str):
    """Build Excel from DB rows and return as response."""
    import pandas as pd
    from io import BytesIO
    from fastapi.responses import Response
    if not rows:
        df = pd.DataFrame()
    else:
        # Drop internal id if present for cleaner export
        clean = [{k: v for k, v in r.items() if k != "id"} for r in rows]
        df = pd.DataFrame(clean)
    buf = BytesIO()
    df.to_excel(buf, index=False, sheet_name="Sheet1", engine="openpyxl")
    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/download-master-po")
def download_master_po():
    rows = local_db.get_all_po_master()
    return _db_rows_to_excel_response(rows, "Master_PO.xlsx")


@app.get("/api/download-master-budget")
def download_master_budget():
    rows = local_db.get_all_budget_master()
    return _db_rows_to_excel_response(rows, "Master_Budget.xlsx")


@app.get("/api/download-master-dn")
def download_master_dn():
    rows = local_db.get_all_dn_master()
    return _db_rows_to_excel_response(rows, "Master_DN.xlsx")


# -------------------------------------------------------------------
# LOCAL DB API (replaces Supabase)
# -------------------------------------------------------------------
@app.get("/api/db/po-master/site-ids")
def api_po_site_ids():
    """Return distinct route_id_site_id from po_master."""
    ids = local_db.get_po_site_ids()
    return {"data": ids}


@app.get("/api/db/po-master")
def api_po_by_site(route_id_site_id: str = Query(..., alias="route_id_site_id")):
    row = local_db.query_po_by_site_id(route_id_site_id)
    return {"data": row, "error": None}


@app.get("/api/db/budget-master")
def api_budget_master(
    route_id_site_id: Optional[str] = Query(None, alias="route_id_site_id"),
    survey_ids: Optional[str] = Query(None),
    all_rows: Optional[bool] = Query(False, alias="all"),
):
    if route_id_site_id:
        if all_rows:
            rows = local_db.query_budget_by_site_id_all(route_id_site_id)
            return {"data": rows, "error": None}
        row = local_db.query_budget_by_site_id(route_id_site_id)
        return {"data": row, "error": None}
    if survey_ids:
        ids = [s.strip() for s in survey_ids.split(",") if s.strip()]
        rows = local_db.query_budget_by_survey_ids(ids)
        return {"data": rows, "error": None}
    raise HTTPException(status_code=400, detail="Provide route_id_site_id or survey_ids")


@app.post("/api/db/budget-master")
def api_budget_master_bulk(body: Dict[str, Any] = Body(...)):
    """Bulk replace: delete rows whose route_id_site_id not in list, then insert rows."""
    rows = body.get("rows", [])
    if not rows:
        return {"success": True, "message": "No rows to insert"}
    site_ids = [r.get("route_id_site_id") for r in rows if r.get("route_id_site_id")]
    local_db.budget_delete_not_in_site_ids(site_ids)
    local_db.budget_insert_many(rows)
    return {"success": True, "message": "Budget rows updated."}


@app.get("/api/db/dn-master/site-ids")
def api_dn_site_ids():
    """Return distinct route_id_site_id from dn_master."""
    ids = local_db.get_dn_site_ids()
    return {"data": ids}


@app.get("/api/db/dn-master")
def api_dn_master(
    dn_number: Optional[str] = Query(None),
    route_id_site_id: Optional[str] = Query(None, alias="route_id_site_id"),
):
    if dn_number:
        row = local_db.get_dn_by_number(dn_number)
        return {"data": row, "error": None}
    if route_id_site_id:
        rows = local_db.get_dn_by_route_id_site_id(route_id_site_id)
        return {"data": rows, "error": None}
    raise HTTPException(status_code=400, detail="Provide dn_number or route_id_site_id")


@app.post("/api/db/dn-master")
def api_dn_master_upsert(body: Dict[str, Any] = Body(...)):
    """Upsert a single dn_master row (e.g. permit fields)."""
    local_db.upsert_dn_master(body)
    return {"success": True}


# -------------------------------------------------------------------
# CLIENT PARSER V2 API
# -------------------------------------------------------------------
@app.get("/api/client-parser-v2/authorities")
def api_client_parser_authorities():
    """Return list of supported authority names for Client Parser V2."""
    from parsers.clientparserv2 import AUTHORITY_CONFIGS
    return {"authorities": list(AUTHORITY_CONFIGS.keys())}


@app.get("/api/client-parser-v2/dn-numbers")
def api_client_parser_dn_numbers():
    """Return distinct DN numbers from dn_master for Client Parser V2."""
    engine = local_db.get_engine()
    rows = local_db._run_sql(
        engine,
        "SELECT DISTINCT dn_number FROM dn_master "
        "WHERE dn_number IS NOT NULL AND dn_number != '' "
        "ORDER BY dn_number",
    )
    dn_numbers = [r.get("dn_number") for r in rows if r.get("dn_number")]
    return {"dn_numbers": dn_numbers}


@app.post("/api/client-parser-v2/validate-dn")
async def api_client_parser_validate_dn(dn_number: str = Form(...)):
    """Check if DN number exists in dn_master."""
    row = local_db.get_dn_by_number(dn_number.strip())
    return {"exists": row is not None}


@app.post("/api/client-parser-v2/unified")
async def api_client_parser_unified(
    dn_number: str = Form(...),
    authority: str = Form(...),
    output_type: str = Form("both"),
):
    """Run Client Parser V2 unified parser (non_refundable, sd, or both)."""
    from parsers.clientparserv2 import unified_parser
    result = unified_parser(dn_number.strip(), authority.strip().upper(), output_type)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


# -------------------------------------------------------------------
# ROUTE REPORT API (Excel + JSON)
# -------------------------------------------------------------------
def _build_route_report_rows(route_id_site_id: str) -> List[Dict[str, Any]]:
    """
    Build per-DN rows for a route, combining budget_master, po_master, dn_master.
    Keys are simple names for JSON; Excel uses table/column markers directly.
    """
    rid = (route_id_site_id or "").strip()
    if not rid:
        return []

    budget_rows = local_db.query_budget_by_site_id_all(rid)
    budget_row = budget_rows[0] if budget_rows else None
    po_row = local_db.query_po_by_site_id(rid)
    dn_rows = local_db.get_dn_by_route_id_site_id(rid)

    rows: List[Dict[str, Any]] = []
    for dn in dn_rows:
        row: Dict[str, Any] = {}
        # Core identifiers
        row["route_id_site_id"] = rid
        row["dn_number"] = dn.get("dn_number")
        row["dn_length_mtr"] = dn.get("dn_length_mtr")
        row["dn_received_date"] = dn.get("dn_received_date")
        row["actual_total_non_refundable"] = dn.get("actual_total_non_refundable")

        # Budget fields (example; extend as needed)
        if budget_row:
            row["budget_ce_length_mtr"] = budget_row.get("ce_length_mtr")
            row["budget_ri_cost_per_meter"] = budget_row.get("ri_cost_per_meter")
            row["budget_material_cost_per_meter"] = budget_row.get("material_cost_per_meter")
            row["budget_build_cost_per_meter"] = budget_row.get("build_cost_per_meter")
            row["budget_total_cost_without_deposit"] = budget_row.get("total_cost_without_deposit")

        # PO fields (example; extend as needed)
        if po_row:
            row["po_route_type"] = po_row.get("route_type")
            row["po_no_ip1"] = po_row.get("po_no_ip1")
            row["po_no_cobuild"] = po_row.get("po_no_cobuild")
            row["po_length_ip1"] = po_row.get("po_length_ip1")
            row["po_length_cobuild"] = po_row.get("po_length_cobuild")

        rows.append(row)

    return rows


def _build_route_report_workbook(
    route_id_site_id: str,
    modality: Optional[str] = None,
) -> "Any":
    """
    Open the template Excel and fill green cells whose values are
    table_name(column_name) by pulling from budget_master, po_master, dn_master.
    All formulas are left intact.
    """
    from pathlib import Path as _Path
    import openpyxl as _openpyxl

    rid = (route_id_site_id or "").strip()
    if not rid:
        raise HTTPException(status_code=400, detail="route_id_site_id is required")

    # Fetch DB rows once
    budget_rows = local_db.query_budget_by_site_id_all(rid)
    budget_row = budget_rows[0] if budget_rows else None
    po_row = local_db.query_po_by_site_id(rid)
    planning_row = None
    try:
        planning_row = local_db.get_planning_tracker_by_route_id_site_id(rid)
    except Exception:
        planning_row = None
    dn_rows = local_db.get_dn_by_route_id_site_id(rid)

    # Template path from user
    template_path = _Path(
        r"D:\trenching-extractor-fresh\trenching-extractor-fresh\MUM_Route_23_analysis - 2026-01-08 v2 SP.xlsx"
    )
    if not template_path.exists():
        raise HTTPException(status_code=404, detail=f"Template not found: {template_path}")

    wb = _openpyxl.load_workbook(template_path)
    sheet_name = "data-sheet"
    if sheet_name not in wb.sheetnames:
        raise HTTPException(status_code=500, detail=f"Sheet '{sheet_name}' not found in template")
    ws = wb[sheet_name]

    import re as _re

    # This template has explicit mapping rows:
    # - Row 2 contains green mapping cells for budget_master / po_master
    #   and row 4 is the corresponding data row.
    # - Row 18 contains green mapping cells for dn_master (dn_number, dn_length_mtr)
    #   and the DN "Approval Required" summary rows (21, 30, ...) are filled.
    map_pat = _re.compile(r"^[A-Za-z_]+\([A-Za-z0-9_]+\)$")

    sources_common = {
        "budget_master": budget_row or {},
        "po_master": po_row or {},
    }

    # --- 1) Fill budget/po mapping (row 2 -> row 4) ---
    mapping_row_budget = 2
    target_row_budget = 4
    for c in range(1, ws.max_column + 1):
        marker = ws.cell(mapping_row_budget, c).value
        if not (isinstance(marker, str) and map_pat.match(marker.strip())):
            continue
        table, col = marker.strip()[:-1].split("(", 1)
        table = table.strip()
        col = col.strip()
        src = sources_common.get(table, {})
        # Clear any template sample value first (but keep formulas if any)
        tgt_cell = ws.cell(target_row_budget, c)
        if not (isinstance(tgt_cell.value, str) and str(tgt_cell.value).startswith("=")):
            tgt_cell.value = None
        tgt_cell.value = src.get(col)

    # Modality impacts C4 + which PO length goes into D4
    mod = (modality or "").strip()
    if mod:
        ws["C4"].value = mod
        try:
            if po_row:
                if mod.lower() in ("co-build", "cobuild", "co build", "cobuilt", "co-built"):
                    ws["D4"].value = po_row.get("po_length_cobuild")
                else:
                    ws["D4"].value = po_row.get("po_length_ip1")
        except Exception:
            pass

    # Also fill planning_tracker values into fixed cells
    # M4 -> planning_date, N4 -> strategic_type
    if planning_row:
        ws["M4"].value = planning_row.get("planning_date")
        ws["N4"].value = planning_row.get("strategic_type")
    else:
        ws["M4"].value = None
        ws["N4"].value = None

    # Ensure deterministic DN order (and stable alignment in template blocks)
    dn_rows = sorted(dn_rows, key=lambda x: str(x.get("dn_number") or ""))

    # --- 2) DN block expansion + fill ---
    # The template repeats a DN section starting with a header row where col A == "Approval Required"
    # followed by a summary row (col A numeric). We ensure there are enough blocks for every DN,
    # then fill each block with that DN's values.
    def _find_dn_block_starts() -> List[int]:
        starts: List[int] = []
        for rr in range(2, ws.max_row + 1):
            if ws.cell(rr, 1).value == "Approval Required":
                starts.append(rr)
        return starts

    def _copy_block(src_start: int, src_height: int, dest_start: int) -> None:
        """
        Copy rows [src_start .. src_start+src_height-1] to start at dest_start,
        including styles and values. Formulas are shifted by row offset.
        """
        from copy import copy as _copy
        from openpyxl.formula.translate import Translator as _Translator

        row_offset = dest_start - src_start
        for r_src in range(src_start, src_start + src_height):
            r_dst = r_src + row_offset
            ws.row_dimensions[r_dst].height = ws.row_dimensions[r_src].height
            for c in range(1, ws.max_column + 1):
                src_cell = ws.cell(r_src, c)
                dst_cell = ws.cell(r_dst, c)
                # style
                dst_cell._style = _copy(src_cell._style)
                dst_cell.number_format = src_cell.number_format
                dst_cell.font = _copy(src_cell.font)
                dst_cell.fill = _copy(src_cell.fill)
                dst_cell.border = _copy(src_cell.border)
                dst_cell.alignment = _copy(src_cell.alignment)
                dst_cell.protection = _copy(src_cell.protection)
                dst_cell.comment = src_cell.comment

                v = src_cell.value
                if isinstance(v, str) and v.startswith("="):
                    # shift formulas to new row positions
                    dst_cell.value = _Translator(v, origin=src_cell.coordinate).translate_formula(row_shift=row_offset, col_shift=0)
                else:
                    dst_cell.value = v

    dn_block_starts = _find_dn_block_starts()
    if not dn_block_starts:
        raise HTTPException(status_code=500, detail="DN block header ('Approval Required') not found in template.")

    # Determine DN block height by distance to next block start (or fallback to 9 rows if only one exists)
    if len(dn_block_starts) >= 2:
        dn_block_height = dn_block_starts[1] - dn_block_starts[0]
    else:
        dn_block_height = 9

    # Ensure enough DN blocks for every DN in dn_master
    needed_blocks = len(dn_rows)
    existing_blocks = len(dn_block_starts)
    if needed_blocks > existing_blocks:
        template_start = dn_block_starts[0]
        # Insert/copy blocks after the last existing block
        insert_at = dn_block_starts[-1] + dn_block_height
        for _ in range(needed_blocks - existing_blocks):
            # Insert blank rows for a new block
            ws.insert_rows(insert_at, amount=dn_block_height)
            # Copy template block into the inserted rows
            _copy_block(template_start, dn_block_height, insert_at)
            insert_at += dn_block_height
        # Re-scan block starts after inserting
        dn_block_starts = _find_dn_block_starts()
    elif needed_blocks < existing_blocks:
        # Remove extra pre-existing template blocks so we don't leak sample DN data.
        # Delete from bottom to top so row indices remain valid while deleting.
        starts_to_delete = dn_block_starts[needed_blocks:]
        # Special case: if there are 0 DNs, keep one empty block so fixed cells
        # (like F21 in the first block) remain present in the output.
        if needed_blocks == 0 and len(dn_block_starts) > 0:
            starts_to_delete = dn_block_starts[1:]
        for start in sorted(starts_to_delete, reverse=True):
            ws.delete_rows(start, amount=dn_block_height)
        dn_block_starts = _find_dn_block_starts()

    # DN mapping row defines which columns to fill in the summary rows
    mapping_row_dn = 18
    dn_col_mappings: Dict[int, str] = {}  # excel_col -> dn_master column
    for c in range(1, ws.max_column + 1):
        marker = ws.cell(mapping_row_dn, c).value
        if not (isinstance(marker, str) and map_pat.match(marker.strip())):
            continue
        table, col = marker.strip()[:-1].split("(", 1)
        table = table.strip()
        col = col.strip()
        if table == "dn_master":
            dn_col_mappings[c] = col

    # Fill each DN into its own block (aligned vertically)
    for idx, dn in enumerate(dn_rows):
        if idx >= len(dn_block_starts):
            break
        # summary row is the row immediately below the header row
        r = dn_block_starts[idx] + 1
        # DN header cells in the summary row (as per template)
        # B{r} -> dn_master(dn_number)
        # D{r} -> dn_master(dn_length_mtr)
        # Clear sample values first (preserve formulas elsewhere)
        ws.cell(r, 2).value = None
        ws.cell(r, 4).value = None
        ws.cell(r, 2).value = dn.get("dn_number")
        ws.cell(r, 4).value = dn.get("dn_length_mtr")

        # DN breakup values (as per template)
        # F{r+2} -> dn_master(dn_ri_amount)
        # F{r+3} -> dn_master(ground_rent)
        # F{r+4} -> dn_master(administrative_charge)
        # F{r+5} -> Access Charges (template default 0; keep 0 unless present)
        ws.cell(r + 2, 6).value = None
        ws.cell(r + 3, 6).value = None
        ws.cell(r + 4, 6).value = None
        ws.cell(r + 2, 6).value = dn.get("dn_ri_amount")
        ws.cell(r + 3, 6).value = dn.get("ground_rent")
        ws.cell(r + 4, 6).value = dn.get("administrative_charge")
        if ws.cell(r + 5, 6).value is None:
            ws.cell(r + 5, 6).value = dn.get("access_charges", 0) if isinstance(dn, dict) else 0

        # Also fill any additional dn_master(...) mappings present in row 18
        # (keeps compatibility if template is extended with more mapped columns)
        for c, dn_col in dn_col_mappings.items():
            # Avoid re-setting the ones we already hardcoded above, but it's harmless if same.
            ws.cell(r, c).value = dn.get(dn_col)

        # Some viewers (and certain download flows) don't evaluate Excel formulas.
        # The template expects F{r} to be =SUM(F{r+2}:F{r+5}). We compute and set the value explicitly.
        def _to_float(x: Any) -> float:
            if x is None or x == "":
                return 0.0
            try:
                return float(x)
            except Exception:
                return 0.0

        f_total = (
            _to_float(ws.cell(r + 2, 6).value)
            + _to_float(ws.cell(r + 3, 6).value)
            + _to_float(ws.cell(r + 4, 6).value)
            + _to_float(ws.cell(r + 5, 6).value)
        )
        ws.cell(r, 6).value = f_total

    # If no DN rows exist for this route, explicitly set the first block's total to 0
    # so F21 (and equivalents) is not left uncomputed in non-Excel viewers.
    if not dn_rows and dn_block_starts:
        r0 = dn_block_starts[0] + 1
        ws.cell(r0, 6).value = 0

    # --- 3) Block totals ---
    # As requested: data-sheet!D8 should be the sum of all dn_master.dn_length_mtr for this route.
    try:
        total_dn_length = 0.0
        for dn in dn_rows:
            v = dn.get("dn_length_mtr")
            if v is None or v == "":
                continue
            total_dn_length += float(v)
        ws["D8"].value = total_dn_length
    except Exception:
        # If any conversion fails, keep the template value/formula as-is.
        pass

    # Hint Excel to recalc on open (useful for other dependent cells),
    # while also setting key totals explicitly above.
    try:
        wb.calculation.fullCalcOnLoad = True
    except Exception:
        pass

    return wb


@app.get("/api/route-report")
def api_route_report(
    route_id_site_id: str = Query(..., alias="route_id_site_id"),
    modality: Optional[str] = Query(None),
):
    """Return combined route report data as JSON for on-screen table."""
    rows = _build_route_report_rows(route_id_site_id)

    # Build workbook so UI can mirror the Excel "Summary" + "Projection" values.
    # Note: we also compute formula results into JSON (Excel itself will still
    # keep formulas in the downloaded file).
    wb = _build_route_report_workbook(route_id_site_id, modality=modality)
    payload = _extract_route_report_summary_projection(wb)
    return {"rows": rows, "modality": modality, **payload}


@app.get("/api/route-report/xlsx")
def api_route_report_xlsx(
    route_id_site_id: str = Query(..., alias="route_id_site_id"),
    modality: Optional[str] = Query(None),
):
    """Return downloadable Excel route report based on template."""
    import tempfile as _tempfile

    wb = _build_route_report_workbook(route_id_site_id, modality=modality)
    tmp = _tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
    wb.save(tmp.name)
    tmp.close()
    filename = f"Route_Report_{route_id_site_id.strip() or 'route'}.xlsx"
    return FileResponse(
        tmp.name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )


def _extract_route_report_summary_projection(wb: "Any") -> Dict[str, Any]:
    """
    Extract the "Summary" sheet values into two grids:
    - rows 2..5  => summary section
    - rows 6..10 => projection section

    The Summary sheet cells are mostly 1-level formulas that reference
    data-sheet cells (and occasionally internal Summary cell references).
    We also evaluate the referenced data-sheet formulas to provide
    Excel-matching numeric values on the UI.
    """
    import re as _re
    import openpyxl as _openpyxl
    from openpyxl.utils import get_column_letter as _col_letter

    ws_summary = wb["Summary"]
    ws_data = wb["data-sheet"]

    # ------------------------------
    # Helpers
    # ------------------------------
    def _col_to_idx(col: str) -> int:
        idx = 0
        for ch in col.upper():
            idx = idx * 26 + (ord(ch) - 64)
        return idx

    def _idx_to_col(idx: int) -> str:
        out = ""
        n = idx
        while n > 0:
            n, rem = divmod(n - 1, 26)
            out = chr(65 + rem) + out
        return out

    def _to_json_value(v: Any) -> Any:
        # Keep strings as-is so the UI shows labels correctly.
        if v is None:
            return ""
        # openpyxl uses datetime objects for dates.
        try:
            import datetime as _dt

            if isinstance(v, (_dt.date, _dt.datetime)):
                return v.date().isoformat()
        except Exception:
            pass
        # Avoid noisy floats in UI.
        if isinstance(v, float):
            # If it's effectively an integer, show as int.
            if abs(v - round(v)) < 1e-9:
                return int(round(v))
            return v
        return v

    # ------------------------------
    # Formula evaluation (data-sheet)
    # ------------------------------
    cache_data_num: Dict[str, float] = {}
    cache_data_raw: Dict[str, Any] = {}

    def _eval_cell_as_number(cell_addr: str, stack: "set[str]") -> float:
        """
        Evaluate a data-sheet cell to a number (used in arithmetic formulas).
        Non-numeric labels become 0.
        """
        cell_addr = cell_addr.upper().replace("$", "")
        if cell_addr in cache_data_num:
            return cache_data_num[cell_addr]
        if cell_addr in stack:
            # Cycle guard (shouldn't happen in this template).
            return 0.0
        stack.add(cell_addr)

        v = ws_data[cell_addr].value
        if v is None or v == "":
            out = 0.0
        elif isinstance(v, (int, float)):
            out = float(v)
        elif isinstance(v, str) and v.startswith("="):
            out = _eval_formula_to_number(v[1:], stack=stack)
        else:
            try:
                out = float(v)
            except Exception:
                out = 0.0

        cache_data_num[cell_addr] = out
        stack.remove(cell_addr)
        return out

    def _eval_range_sum(range_a: str, range_b: str, stack: "set[str]") -> float:
        # Both ends are like A1, B5.
        m1 = _re.fullmatch(r"([A-Z]{1,3})([0-9]+)", range_a.upper().replace("$", ""))
        m2 = _re.fullmatch(r"([A-Z]{1,3})([0-9]+)", range_b.upper().replace("$", ""))
        if not (m1 and m2):
            return 0.0
        c1, r1 = m1.group(1), int(m1.group(2))
        c2, r2 = m2.group(1), int(m2.group(2))
        c1i, c2i = _col_to_idx(c1), _col_to_idx(c2)
        rmin, rmax = min(r1, r2), max(r1, r2)
        cmin, cmax = min(c1i, c2i), max(c1i, c2i)
        s = 0.0
        for rr in range(rmin, rmax + 1):
            for cc in range(cmin, cmax + 1):
                addr = _idx_to_col(cc) + str(rr)
                s += _eval_cell_as_number(addr, stack)
        return s

    def _split_excel_args(s: str) -> List[str]:
        """
        Split function args by commas at top-level only.
        Example: SUM(A1, (B2+C2), D3) => ["A1","(B2+C2)","D3"]
        """
        args: List[str] = []
        depth = 0
        start = 0
        for i, ch in enumerate(s):
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth = max(0, depth - 1)
            elif ch == "," and depth == 0:
                args.append(s[start:i].strip())
                start = i + 1
        tail = s[start:].strip()
        if tail:
            args.append(tail)
        return args

    def _eval_expression_to_number(expr: str, stack: "set[str]") -> float:
        expr = expr.strip()
        expr = expr.replace("$", "")
        if expr.startswith("(") and expr.endswith(")"):
            # keep parentheses for eval
            pass

        # Convert Excel '^' to python exponent if any.
        expr = expr.replace("^", "**")

        cell_tokens = set(_re.findall(r"\b[A-Z]{1,3}[0-9]{1,7}\b", expr.upper()))
        # Replace cell tokens with numeric values.
        for tok in cell_tokens:
            val = _eval_cell_as_number(tok, stack)
            # Use a stable repr for eval.
            expr = _re.sub(rf"\b{_re.escape(tok)}\b", repr(val), expr)

        try:
            return float(eval(expr, {"__builtins__": {}}, {}))
        except Exception:
            return 0.0

    def _eval_formula_to_number(formula_body: str, stack: "set[str]") -> float:
        body = formula_body.strip()
        body_u = body.upper()

        # SUM(...)
        if body_u.startswith("SUM(") and body.endswith(")"):
            inner = body[len("SUM(") : -1]
            # SUM may have a single arg like "O21+O30+..."
            args = _split_excel_args(inner)
            total = 0.0
            for arg in args:
                arg = arg.strip()
                m = _re.fullmatch(r"([A-Z]{1,3}[0-9]+):([A-Z]{1,3}[0-9]+)", arg.upper().replace("$", ""))
                if m:
                    total += _eval_range_sum(m.group(1), m.group(2), stack)
                else:
                    total += _eval_expression_to_number(arg, stack)
            return total

        # SUBTOTAL(3, ...)
        if body_u.startswith("SUBTOTAL(") and body.endswith(")"):
            inner = body[len("SUBTOTAL(") : -1]
            args = _split_excel_args(inner)
            if not args:
                return 0.0
            # args[0] is function_num (e.g. 3). Ignore and sum the rest.
            rest = args[1:]
            total = 0.0
            for arg in rest:
                arg = arg.strip()
                m = _re.fullmatch(r"([A-Z]{1,3}[0-9]+):([A-Z]{1,3}[0-9]+)", arg.upper().replace("$", ""))
                if m:
                    total += _eval_range_sum(m.group(1), m.group(2), stack)
                else:
                    total += _eval_expression_to_number(arg, stack)
            return total

        # Default: arithmetic expression
        return _eval_expression_to_number(body, stack)

    def _eval_data_raw(cell_addr: str) -> Any:
        """
        Evaluate a data-sheet cell into either a string/label (if not formula)
        or a numeric result (if formula).
        """
        cell_addr = cell_addr.upper().replace("$", "")
        if cell_addr in cache_data_raw:
            return cache_data_raw[cell_addr]
        v = ws_data[cell_addr].value
        if isinstance(v, str) and v.startswith("="):
            num = _eval_cell_as_number(cell_addr, set())
            # return numeric for UI.
            cache_data_raw[cell_addr] = num
        else:
            cache_data_raw[cell_addr] = v
        return cache_data_raw[cell_addr]

    # ------------------------------
    # Evaluate Summary cells
    # ------------------------------
    cache_summary_raw: Dict[str, Any] = {}

    def _eval_summary_cell(coord: str, stack: "set[str]") -> Any:
        coord = coord.upper()
        if coord in cache_summary_raw:
            return cache_summary_raw[coord]
        if coord in stack:
            return ""
        stack.add(coord)

        v = ws_summary[coord].value
        if isinstance(v, str) and v.startswith("='data-sheet'!"):
            addr = v.split("!", 1)[1].upper()
            out = _eval_data_raw(addr)
        elif isinstance(v, str) and v.startswith("="):
            ref = v[1:].strip().upper().replace("$", "")
            if _re.fullmatch(r"[A-Z]{1,3}[0-9]{1,7}", ref):
                out = _eval_summary_cell(ref, stack)
            else:
                # Unknown formula in Summary -> best effort.
                out = v
        else:
            out = v

        cache_summary_raw[coord] = out
        stack.remove(coord)
        return out

    def _make_grid(row_start: int, row_end: int) -> List[List[Any]]:
        grid: List[List[Any]] = []
        for r in range(row_start, row_end + 1):
            row: List[Any] = []
            for c in range(1, 13):  # A..L
                coord = _col_letter(c) + str(r)
                val = _eval_summary_cell(coord, set())
                row.append(_to_json_value(val))
            grid.append(row)
        return grid

    summary_grid = _make_grid(2, 5)
    projection_grid = _make_grid(6, 10)
    return {"summaryGrid": summary_grid, "projectionGrid": projection_grid}


# Field name from frontend validation table -> dn_master column
SEND_TO_MASTER_DN_FIELD_MAP = {
    "dn_number": "dn_number",
    "route_id_site_id": "route_id_site_id",
    "dn_length_mtr": "dn_length_mtr",
    "application_date": "application_date",
    "dn_received_date": "dn_received_date",
    "ground_rent": "ground_rent",
    "administrative_charge": "administrative_charge",
    "actual_total_non_refundable": "actual_total_non_refundable",
    "deposit": "deposit",
    "total_dn_amount": "total_dn_amount",
    "gst": "gst",
    "surface": "surface",
    "surface_wise_length": "surface_wise_length",
    "surface_wise_ri_amount": "surface_wise_ri_amount",
    "surface_wise_multiplication_factor": "surface_wise_multiplication_factor",
    "no_of_pits": "no_of_pits",
    "pit_ri_rate": "pit_ri_rate",
    "ot_length": "ot_length",
    "dn_ri_amount": "dn_ri_amount",
    "supervision_charges": "supervision_charges",
    "chamber_fee": "chamber_fee",
    "hdd_length": "hdd_length",
    "build_type": "build_type",
    "category_type": "category_type",
}


@app.post("/api/send-to-master-dn")
def send_to_master_dn(body: Dict[str, Any] = Body(...)):
    """Accept validation table data and upsert into dn_master."""
    data = body.get("data")  # list of { field, value }
    if not data:
        raise HTTPException(status_code=400, detail="Missing 'data' array")
    row = {}
    for item in data:
        field = (item.get("field") or "").strip()
        value = item.get("value")
        if field in SEND_TO_MASTER_DN_FIELD_MAP:
            col = SEND_TO_MASTER_DN_FIELD_MAP[field]
            if value is not None and str(value).strip() != "":
                v = str(value).strip()
                if col in ("ground_rent", "gst", "deposit", "total_dn_amount", "actual_total_non_refundable",
                           "dn_length_mtr", "ot_length", "dn_ri_amount", "administrative_charge", "supervision_charges", "chamber_fee", "hdd_length", "pit_ri_rate"):
                    try:
                        row[col] = float(v)
                    except (ValueError, TypeError):
                        row[col] = v
                else:
                    row[col] = v
    if "dn_number" not in row:
        raise HTTPException(status_code=400, detail="dn_number is required")
    existing = local_db.get_dn_by_number(str(row["dn_number"]))
    if existing and existing.get("route_id_site_id") and row.get("route_id_site_id") and existing.get("route_id_site_id") != row.get("route_id_site_id"):
        raise HTTPException(status_code=409, detail="A Demand Note with this number already exists in the master database.")
    local_db.upsert_dn_master(row)
    after = None
    try:
        after = local_db.get_dn_by_number(str(row.get("dn_number")))
    except Exception:
        after = None
    return {"success": True, "message": "Saved to Master DN.", "after": after}


def _excel_to_dict_list(path: str, sheet_name=0):
    import pandas as pd
    df = pd.read_excel(path, sheet_name=sheet_name)
    df = df.where(df.notna(), None)
    return df.to_dict(orient="records")


def _normalize_col(name: str) -> str:
    return str(name).strip().lower().replace(" ", "_").replace("-", "_").replace("/", "_")


def _map_row_to_dn(row: Dict) -> Dict:
    """Map Excel row keys to dn_master columns."""
    allowed = {"dn_number", "route_id_site_id", "dn_length_mtr", "permission_receipt_date", "permit_no",
               "permit_start_date", "permit_end_date", "permitted_length_by_ward_mts", "surface", "no_of_pits",
               "ground_rent", "gst", "deposit", "total_dn_amount", "application_date", "dn_received_date",
               "actual_total_non_refundable", "po_number", "pit_ri_rate", "ot_length", "dn_ri_amount",
               "administrative_charge", "supervision_charges", "chamber_fee", "hdd_length", "build_type", "category_type"}
    out = {}
    for k, v in row.items():
        col = _normalize_col(k)
        if col in allowed and v is not None and str(v).strip() != "":
            out[col] = v
    return out


def _map_row_to_budget(row: Dict) -> Dict:
    allowed = {"route_id_site_id", "ce_length_mtr", "ri_cost_per_meter", "material_cost_per_meter", "build_cost_per_meter",
               "total_ri_amount", "material_cost", "execution_cost_including_hh", "total_cost_without_deposit",
               "route_type", "survey_id", "existing_new", "build_type", "category_type"}
    out = {}
    for k, v in row.items():
        col = _normalize_col(k)
        if col in allowed:
            if v is None or (isinstance(v, str) and v.strip() == ""):
                out[col] = None
            elif col in ("ce_length_mtr", "ri_cost_per_meter", "material_cost_per_meter", "build_cost_per_meter",
                         "total_ri_amount", "material_cost", "execution_cost_including_hh", "total_cost_without_deposit"):
                try:
                    out[col] = float(v)
                except (ValueError, TypeError):
                    out[col] = None
            else:
                out[col] = v
    return out


@app.post("/api/upload-dn-master")
async def upload_dn_master(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "")[1] or ".xlsx"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(await file.read())
    tmp.close()
    try:
        rows = _excel_to_dict_list(tmp.name)
        errors = []
        for r in rows:
            mapped = _map_row_to_dn(r)
            if mapped.get("dn_number"):
                try:
                    local_db.upsert_dn_master(mapped)
                except Exception as e:
                    errors.append(str(e))
        return {"success": True, "message": "Upload successful! New and updated rows processed.", "errors": errors[:10]}
    finally:
        try:
            os.remove(tmp.name)
        except Exception:
            pass


@app.post("/api/upload-budget-master")
async def upload_budget_master(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "")[1] or ".xlsx"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(await file.read())
    tmp.close()
    try:
        rows = _excel_to_dict_list(tmp.name)
        mapped = [_map_row_to_budget(r) for r in rows if _map_row_to_budget(r).get("route_id_site_id")]
        if mapped:
            local_db.budget_delete_not_in_site_ids([m.get("route_id_site_id") for m in mapped])
            local_db.budget_insert_many(mapped)
        return {"success": True, "message": "Upload successful!"}
    finally:
        try:
            os.remove(tmp.name)
        except Exception:
            pass


def _map_row_to_po_flat(row: Dict) -> Dict:
    """Map Excel row to po_master columns (normalize header names)."""
    out = {}
    for k, v in row.items():
        col = _normalize_col(k)
        if col == "route_id_site_id":
            out["route_id_site_id"] = v
        elif col == "route_type":
            out["route_type"] = v
        elif col in ("po_no_ip1", "po_no_ip_1"):
            out["po_no_ip1"] = v
        elif col in ("po_no_cobuild", "po_no_cobuild"):
            out["po_no_cobuild"] = v
        elif col in ("po_length_ip1", "po_length_ip_1"):
            out["po_length_ip1"] = v
        elif col in ("po_length_cobuild",):
            out["po_length_cobuild"] = v
        elif "route" in col and "lm" in col:
            out["route_routeLM_metroLM_LMCStandalone"] = v
    return out


@app.post("/api/upload-po-master")
async def upload_po_master(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "")[1] or ".xlsx"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(await file.read())
    tmp.close()
    try:
        rows = _excel_to_dict_list(tmp.name)
        engine = local_db.get_engine()
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("DELETE FROM po_master"))
            conn.commit()
        for r in rows:
            mapped = _map_row_to_po_flat(r)
            if not mapped.get("route_id_site_id"):
                continue
            local_db.upsert_po_master(mapped)
        return {"success": True, "message": "Upload successful!"}
    finally:
        try:
            os.remove(tmp.name)
        except Exception:
            pass


# -------------------------------------------------------------------
# VALIDATE PARSERS (PO, Application, DN)
# -------------------------------------------------------------------
@app.post("/api/parse-po")
async def parse_po(site_id: str = Form(...), po_number_type: Optional[str] = Form(None)):
    """Return PO data for the given site_id from the database (for Validate Parsers)."""
    row = local_db.query_po_by_site_id(site_id)
    if not row:
        return {"PO No": "", "PO Length (Mtr)": "", "Category": "", "SiteID": site_id, "UID": "", "Parent Route Name / HH": ""}
    route_type = (row.get("route_type") or "").replace(" ", "").lower()
    rrs = (row.get("route_routeLM_metroLM_LMCStandalone") or "").replace(" ", "").lower()
    use_cobuild = (po_number_type or "").lower() == "co-built" or rrs in ("metrolm", "lmc(standalone)", "routelm") or (rrs != "route" and route_type in ("metrolm", "lmc(standalone)", "routelm"))
    if use_cobuild:
        po_no = row.get("po_no_cobuild") or ""
        po_length = row.get("po_length_cobuild")
    else:
        po_no = row.get("po_no_ip1") or ""
        po_length = row.get("po_length_ip1")
    return {
        "PO No": str(po_no) if po_no else "",
        "PO Length (Mtr)": str(po_length) if po_length is not None else "",
        "Category": str(row.get("route_type") or ""),
        "SiteID": site_id,
        "UID": "",
        "Parent Route Name / HH": str(row.get("route_routeLM_metroLM_LMCStandalone") or ""),
    }


@app.post("/api/parse-application")
async def parse_application(dn_application_file: UploadFile = File(...), authority: str = Form(...)):
    """Parse DN Application PDF and return extracted fields."""
    suffix = os.path.splitext(dn_application_file.filename or "")[1] or ".pdf"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(await dn_application_file.read())
    tmp.close()
    try:
        from parsers.universal_application_parser import universal_application_parser
        result = universal_application_parser(tmp.name)
        return result if isinstance(result, dict) else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            os.remove(tmp.name)
        except Exception:
            pass


def _run_dn_parser(pdf_path: str, authority: str) -> Dict[str, Any]:
    auth_lower = (authority or "").strip().upper()
    if auth_lower == "MCGM":
        from parsers.mcgm import non_refundable_request_parser
        return non_refundable_request_parser(pdf_path)
    if auth_lower == "MBMC":
        from parsers.mbmc import non_refundable_request_parser
        return non_refundable_request_parser(pdf_path)
    if auth_lower == "NMMC":
        from parsers.nmmc import non_refundable_request_parser
        return non_refundable_request_parser(pdf_path)
    if auth_lower == "KDMC":
        from parsers.kdmc import non_refundable_request_parser
        return non_refundable_request_parser(pdf_path)
    from parsers.mbmc import non_refundable_request_parser
    return non_refundable_request_parser(pdf_path)


@app.post("/api/parse-dn")
async def parse_dn(dn_file: UploadFile = File(...), authority: str = Form(...), site_id: Optional[str] = Form(None)):
    """Parse Demand Note PDF and return extracted fields."""
    suffix = os.path.splitext(dn_file.filename or "")[1] or ".pdf"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(await dn_file.read())
    tmp.close()
    try:
        result = _run_dn_parser(tmp.name, authority)
        return result if isinstance(result, dict) else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            os.remove(tmp.name)
        except Exception:
            pass


# -------------------------------------------------------------------
# EXISTING APIs
# -------------------------------------------------------------------
@app.post("/api/nmmc-translate")
async def nmmc_translate(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "")[1] or ".pdf"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(await file.read())
    tmp.close()

    try:
        translated_text = nmmc.translate_pdf_to_english(tmp.name)
        return {"translated_text": translated_text}
    finally:
        try:
            os.remove(tmp.name)
        except Exception:
            pass


@app.post("/api/debug-mcgm-application")
async def debug_mcgm_application(file: UploadFile = File(...)):
    temp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    temp.write(await file.read())
    temp.close()

    try:
        doc = mcgm_application_parser.fitz.open(temp.name)
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        return {"text": text}
    finally:
        try:
            os.remove(temp.name)
        except Exception:
            pass
