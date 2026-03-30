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
    expose_headers=["Content-Disposition"],
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
    # Ignore incomplete DN rows for report block rendering so first block (row 21)
    # does not become blank when DB has placeholder rows with empty dn_number.
    dn_rows = [dn for dn in dn_rows if str((dn or {}).get("dn_number") or "").strip() != ""]

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
    from openpyxl.styles import PatternFill as _PatternFill

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

    # Production-safe template resolution (no hardcoded machine-specific path).
    # Priority:
    # 1) ROUTE_REPORT_TEMPLATE_PATH env var
    # 2) master_files/route_report_template.xlsx
    # 3) existing project root template filename (legacy fallback)
    env_tpl = os.environ.get("ROUTE_REPORT_TEMPLATE_PATH", "").strip()
    candidate_paths = []
    if env_tpl:
        candidate_paths.append(_Path(env_tpl))
    candidate_paths.extend(
        [
            BASE_DIR / "master_files" / "route_report_template.xlsx",
            BASE_DIR / "MUM_Route_23_analysis - 2026-01-08 v2 SP.xlsx",
        ]
    )
    template_path = next((p for p in candidate_paths if p.exists()), None)
    if template_path is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Route report template not found. "
                "Set ROUTE_REPORT_TEMPLATE_PATH or place template at "
                "'master_files/route_report_template.xlsx'."
            ),
        )

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
    route_report_warnings: List[str] = []
    _warn_seen: "set[str]" = set()
    mod = (modality or "").strip().lower()

    def _is_blank(v: Any) -> bool:
        return v is None or str(v).strip() == ""

    def _add_warn(msg: str) -> None:
        m = str(msg).strip()
        if not m or m in _warn_seen:
            return
        _warn_seen.add(m)
        route_report_warnings.append(m)

    def _should_warn_for_field(table: str, col: str) -> bool:
        """
        Modality-aware warning suppression:
        - For IP1: don't warn for cobuild fields
        - For Co-build: don't warn for ip1 fields
        """
        t = (table or "").strip().lower()
        c = (col or "").strip().lower()
        if t != "po_master":
            return True
        if mod in ("ip1",):
            if "cobuild" in c or "co_build" in c or "co-built" in c or "co_build" in c:
                return False
        if mod in ("co-build", "cobuild", "co build", "co-built", "cobuilt"):
            if "ip1" in c or "ip_1" in c:
                return False
        return True

    sources_common = {
        "budget_master": budget_row or {},
        "po_master": po_row or {},
    }

    # --- 1) Fill budget/po mapping (row 2 -> row 4) ---
    mapping_row_budget = 2
    target_row_budget = 4
    budget_mapping_cols: List[int] = []
    for c in range(1, ws.max_column + 1):
        marker = ws.cell(mapping_row_budget, c).value
        if not (isinstance(marker, str) and map_pat.match(marker.strip())):
            continue
        budget_mapping_cols.append(c)
        table, col = marker.strip()[:-1].split("(", 1)
        table = table.strip()
        col = col.strip()
        src = sources_common.get(table, {})
        # Clear any template sample value first (but keep formulas if any)
        tgt_cell = ws.cell(target_row_budget, c)
        if not (isinstance(tgt_cell.value, str) and str(tgt_cell.value).startswith("=")):
            tgt_cell.value = None
        val = src.get(col)
        tgt_cell.value = val
        if _is_blank(val) and _should_warn_for_field(table, col):
            _add_warn(f"{table}.{col} is blank (used in Excel cell {tgt_cell.coordinate}).")

    # Fallback for templates that do not contain mapping markers in row 2.
    # This keeps download generation functional when reference template is changed.
    if len(budget_mapping_cols) == 0:
        def _set_if_not_formula(addr: str, value: Any) -> None:
            c = ws[addr]
            if isinstance(c.value, str) and c.value.startswith("="):
                return
            c.value = value

        # Core route/report identity cells
        _set_if_not_formula("B4", rid)
        if budget_row:
            _set_if_not_formula("E4", budget_row.get("ce_length_mtr"))
            _set_if_not_formula("F4", budget_row.get("total_cost_without_deposit"))
            _set_if_not_formula("G4", budget_row.get("ri_cost_per_meter"))
            _set_if_not_formula("H4", budget_row.get("build_cost_per_meter"))
            _set_if_not_formula("I4", budget_row.get("material_cost_per_meter"))
            # If J4/K4 are value cells (not formulas), provide budget totals.
            jv = None
            try:
                jv = (float(budget_row.get("build_cost_per_meter") or 0) + float(budget_row.get("material_cost_per_meter") or 0))
            except Exception:
                jv = None
            if jv is not None:
                _set_if_not_formula("J4", jv)
            _set_if_not_formula("K4", budget_row.get("execution_cost_including_hh") or budget_row.get("total_cost_without_deposit"))
            _set_if_not_formula("M4", budget_row.get("category_type") or budget_row.get("route_type"))
        if po_row:
            # O4/D4 are also set modality-wise below; this is baseline fallback.
            _set_if_not_formula("O4", po_row.get("po_no_ip1") or po_row.get("po_no_cobuild"))

    # Modality impacts C4 + which PO length goes into D4
    mod_raw = (modality or "").strip()
    if mod_raw:
        ws["C4"].value = mod_raw
        try:
            if po_row:
                if mod_raw.lower() in ("co-build", "cobuild", "co build", "cobuilt", "co-built"):
                    ws["D4"].value = po_row.get("po_length_cobuild")
                    # PO number cell in template row-4 output block
                    ws["O4"].value = po_row.get("po_no_cobuild")
                else:
                    ws["D4"].value = po_row.get("po_length_ip1")
                    ws["O4"].value = po_row.get("po_no_ip1")
        except Exception:
            pass

    # Fill P4 from po_data using where clause:
    # po_number = O4 AND route_id_site_id = B4
    # Also gather warnings for missing required po_data fields for UI display.
    try:
        po_no_o4 = str(ws["O4"].value or "").strip()
        route_b4 = str(ws["B4"].value or "").strip()
        if not po_no_o4 or not route_b4:
            if not po_no_o4:
                _add_warn("po_data lookup skipped: O4 (po_number) is blank.")
            if not route_b4:
                _add_warn("po_data lookup skipped: B4 (route_id_site_id) is blank.")
        else:
            po_data_row = local_db.get_po_data_by_po_and_route(po_no_o4, route_b4)
            if not po_data_row:
                _add_warn(
                    f"po_data row not found for po_number '{po_no_o4}' and route_id_site_id '{route_b4}'."
                )
            else:
                # P4 <- line_total
                ws["P4"].value = po_data_row.get("line_total")

                required_fields = ("po_number", "cust_route_id_site_id", "quantity", "uom", "unit_price", "line_total")
                for fld in required_fields:
                    if str(po_data_row.get(fld) or "").strip() == "":
                        _add_warn(f"po_data.{fld} is blank for po_number '{po_no_o4}' and route_id_site_id '{route_b4}'.")
    except Exception as e:
        _add_warn(f"po_data lookup failed: {e}")

    # Also fill planning_tracker values into fixed cells
    # M4 -> planning_date, N4 -> strategic_type
    if planning_row:
        val_m4 = planning_row.get("planning_date")
        val_n4 = planning_row.get("strategic_type")
        ws["M4"].value = val_m4
        ws["N4"].value = val_n4
        if _is_blank(val_m4):
            _add_warn("planning_tracker.planning_date is blank (used in Excel cell M4).")
        if _is_blank(val_n4):
            _add_warn("planning_tracker.strategic_type is blank (used in Excel cell N4).")
    else:
        ws["M4"].value = None
        ws["N4"].value = None
        _add_warn("planning_tracker row not found for route_id_site_id.")

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
                    try:
                        # Works across openpyxl versions: translate to destination coordinate.
                        dst_cell.value = _Translator(v, origin=src_cell.coordinate).translate_formula(dst_cell.coordinate)
                    except Exception:
                        # Fallback for versions supporting delta-style args.
                        try:
                            dst_cell.value = _Translator(v, origin=src_cell.coordinate).translate_formula(row_delta=row_offset, col_delta=0)
                        except Exception:
                            # Last resort: keep original formula text.
                            dst_cell.value = v
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
    dn_mapping_cols: List[int] = []
    for c in range(1, ws.max_column + 1):
        marker = ws.cell(mapping_row_dn, c).value
        if not (isinstance(marker, str) and map_pat.match(marker.strip())):
            continue
        dn_mapping_cols.append(c)
        table, col = marker.strip()[:-1].split("(", 1)
        table = table.strip()
        col = col.strip()
        if table == "dn_master":
            dn_col_mappings[c] = col

    # Fill each DN into its own block (aligned vertically).
    # Re-scan block starts each iteration because row insertions inside one block
    # can shift the start rows of the following blocks.
    for idx, dn in enumerate(dn_rows):
        current_starts = _find_dn_block_starts()
        if idx >= len(current_starts):
            break
        # summary row is the row immediately below the header row
        r = current_starts[idx] + 1
        # DN header cells in the summary row (as per template)
        # B{r} -> dn_master(dn_number)
        # D{r} -> dn_master(dn_length_mtr)
        # Clear sample values first (preserve formulas elsewhere)
        ws.cell(r, 2).value = None
        ws.cell(r, 4).value = None
        ws.cell(r, 2).value = dn.get("dn_number")
        ws.cell(r, 4).value = dn.get("dn_length_mtr")
        if _is_blank(dn.get("dn_number")):
            _add_warn(f"dn_master.dn_number is blank for DN block #{idx + 1} (cell B{r}).")
        if _is_blank(dn.get("dn_length_mtr")):
            _add_warn(f"dn_master.dn_length_mtr is blank for dn_number '{dn.get('dn_number') or '-'}' (cell D{r}).")

        def _split_by_comma(v: Any) -> List[str]:
            if v is None:
                return []
            s = str(v).strip()
            if not s:
                return []
            import re as _re_local
            return [x.strip() for x in _re_local.split(r"[,+]", s) if x.strip()]

        def _split_generic(v: Any) -> List[str]:
            if v is None:
                return []
            s = str(v).strip()
            if not s:
                return []
            import re as _re_local
            return [x.strip() for x in _re_local.split(r"[,/+]", s) if x.strip()]

        surfaces = _split_by_comma(dn.get("surface"))
        lengths = _split_generic(dn.get("surface_wise_length"))
        rates = _split_generic(dn.get("surface_wise_ri_amount"))
        factors = _split_generic(dn.get("surface_wise_multiplication_factor"))
        dn_no_for_warn = str(dn.get("dn_number") or "-")
        if len(surfaces) == 0:
            _add_warn(f"dn_master.surface is blank for dn_number '{dn_no_for_warn}'.")
        if len(lengths) == 0:
            _add_warn(f"dn_master.surface_wise_length is blank for dn_number '{dn_no_for_warn}'.")
        if len(rates) == 0:
            _add_warn(f"dn_master.surface_wise_ri_amount is blank for dn_number '{dn_no_for_warn}'.")
        if len(factors) == 0:
            _add_warn(f"dn_master.surface_wise_multiplication_factor is blank for dn_number '{dn_no_for_warn}'.")
        surface_count = max(len(surfaces), 1)

        # Template has one RI row at r+2. Add extra rows for additional surfaces so
        # G23/G24/G25... can hold each segment and K-total row moves down dynamically.
        extra_surface_rows = max(0, surface_count - 1)
        if extra_surface_rows > 0:
            ws.insert_rows(r + 3, amount=extra_surface_rows)
            # Copy RI-row style/formulas to newly inserted RI rows.
            for j in range(1, surface_count):
                _copy_block(r + 2, 1, r + 2 + j)

        ri_start = r + 2
        ri_end = ri_start + surface_count - 1
        ground_row = ri_end + 1
        admin_row = ri_end + 2
        access_row = ri_end + 3

        def _to_float(x: Any) -> float:
            if x is None or x == "":
                return 0.0
            try:
                return float(str(x).replace(",", ""))
            except Exception:
                return 0.0

        # Fill dynamic per-surface lines in G/H/I/J and line total in K.
        for rr in range(ri_start, ri_end + 1):
            ws.cell(rr, 7).value = None  # G
            ws.cell(rr, 8).value = None  # H
            ws.cell(rr, 9).value = None  # I
            ws.cell(rr, 10).value = None  # J
            ws.cell(rr, 11).value = None  # K
            # Keep "RI Charges" label only on first row.
            if rr == ri_start:
                ws.cell(rr, 5).value = "RI Charges"
            else:
                ws.cell(rr, 5).value = None
                ws.cell(rr, 4).value = None
                # Avoid repeated RI amount value in F (e.g. F24, F25...)
                ws.cell(rr, 6).value = None

        k_row_totals: List[float] = []
        for i in range(surface_count):
            rr = ri_start + i
            if i < len(surfaces):
                ws.cell(rr, 7).value = surfaces[i]
            if i < len(lengths):
                ws.cell(rr, 8).value = lengths[i]
            if i < len(rates):
                ws.cell(rr, 9).value = rates[i]
            if i < len(factors):
                f_raw = factors[i]
                try:
                    f_num = float(str(f_raw).strip())
                    ws.cell(rr, 10).value = 1 if f_num == 0 else f_raw
                except Exception:
                    ws.cell(rr, 10).value = f_raw
            elif ws.cell(rr, 10).value in (None, ""):
                ws.cell(rr, 10).value = 1

            line_total = (
                _to_float(ws.cell(rr, 8).value)
                * _to_float(ws.cell(rr, 9).value)
                * _to_float(ws.cell(rr, 10).value)
            )
            k_row_totals.append(line_total)
            # Write numeric total so it is visible even without formula recalculation.
            ws.cell(rr, 11).value = line_total if line_total != 0 else None

        # Keep breakup lines below dynamic RI block.
        ws.cell(ground_row, 6).value = dn.get("ground_rent")
        ws.cell(admin_row, 6).value = dn.get("administrative_charge")
        if _is_blank(dn.get("ground_rent")):
            _add_warn(f"dn_master.ground_rent is blank for dn_number '{dn_no_for_warn}'.")
        if _is_blank(dn.get("administrative_charge")):
            _add_warn(f"dn_master.administrative_charge is blank for dn_number '{dn_no_for_warn}'.")
        if ws.cell(access_row, 6).value is None:
            ws.cell(access_row, 6).value = dn.get("access_charges", 0) if isinstance(dn, dict) else 0

        # Total K row should shift downward based on surface rows.
        # For default 3 surfaces, this remains K26; otherwise moves accordingly.
        k_total = sum(k_row_totals)
        ws.cell(access_row, 11).value = k_total if k_total != 0 else None
        # RI charges row in F points to the shifted K total.
        ws.cell(ri_start, 6).value = k_total if k_total != 0 else None

        # Also fill any additional dn_master(...) mappings present in row 18
        # (keeps compatibility if template is extended with more mapped columns)
        for c, dn_col in dn_col_mappings.items():
            # Avoid re-setting the ones we already hardcoded above, but it's harmless if same.
            v_dn = dn.get(dn_col)
            ws.cell(r, c).value = v_dn
            if _is_blank(v_dn):
                _add_warn(f"dn_master.{dn_col} is blank for dn_number '{dn_no_for_warn}' (cell {ws.cell(r, c).coordinate}).")

        # Numeric fallback for F{r} in non-recalculating viewers.
        k_numeric = k_total

        f_total = (
            k_numeric
            + _to_float(ws.cell(ground_row, 6).value)
            + _to_float(ws.cell(admin_row, 6).value)
            + _to_float(ws.cell(access_row, 6).value)
        )
        ws.cell(r, 6).value = f_total

    # If no DN rows exist for this route, explicitly set the first block's total to 0
    # so F21 (and equivalents) is not left uncomputed in non-Excel viewers.
    if not dn_rows and dn_block_starts:
        r0 = dn_block_starts[0] + 1
        ws.cell(r0, 6).value = 0

    # --- 3) Block totals ---
    # data-sheet!A8 (and Summary!A4 via reference) should reflect actual DN count.
    # Do not rely on template's fixed SUBTOTAL(B21,B30,...) because row positions
    # shift when DN blocks expand dynamically.
    try:
        dn_count = sum(1 for dn in dn_rows if str(dn.get("dn_number") or "").strip() != "")
        ws["A8"].value = dn_count
    except Exception:
        pass

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

    # Note: no explicit template-marker row cleanup here.

    # Attach non-fatal warnings so /api/route-report can show them in UI.
    try:
        setattr(wb, "_route_report_warnings", route_report_warnings)
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
    warnings = getattr(wb, "_route_report_warnings", []) or []
    return {"rows": rows, "modality": modality, "warnings": warnings, **payload}


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
                out = float(str(v).replace(",", ""))
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
            # args[0] is function_num. In this template, SUBTOTAL(3,...) means COUNTA.
            fn_raw = args[0].strip()
            try:
                fn_num = int(float(fn_raw))
            except Exception:
                fn_num = -1
            rest = args[1:]
            if fn_num == 3:
                count = 0.0
                for arg in rest:
                    arg = arg.strip()
                    m = _re.fullmatch(r"([A-Z]{1,3}[0-9]+):([A-Z]{1,3}[0-9]+)", arg.upper().replace("$", ""))
                    if m:
                        m1 = _re.fullmatch(r"([A-Z]{1,3})([0-9]+)", m.group(1))
                        m2 = _re.fullmatch(r"([A-Z]{1,3})([0-9]+)", m.group(2))
                        if not (m1 and m2):
                            continue
                        c1, r1 = m1.group(1), int(m1.group(2))
                        c2, r2 = m2.group(1), int(m2.group(2))
                        c1i, c2i = _col_to_idx(c1), _col_to_idx(c2)
                        rmin, rmax = min(r1, r2), max(r1, r2)
                        cmin, cmax = min(c1i, c2i), max(c1i, c2i)
                        for rr in range(rmin, rmax + 1):
                            for cc in range(cmin, cmax + 1):
                                addr = _idx_to_col(cc) + str(rr)
                                raw = ws_data[addr].value
                                if raw is not None and str(raw).strip() != "":
                                    count += 1.0
                    elif _re.fullmatch(r"[A-Z]{1,3}[0-9]+", arg.upper().replace("$", "")):
                        addr = arg.upper().replace("$", "")
                        raw = ws_data[addr].value
                        if raw is not None and str(raw).strip() != "":
                            count += 1.0
                    else:
                        # Fallback: treat non-zero expression as one non-empty value.
                        if _eval_expression_to_number(arg, stack) != 0:
                            count += 1.0
                return count

            # Fallback for other SUBTOTAL types: sum-like behavior.
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
                if col == "surface":
                    # Normalize parser-delimited values to comma-separated storage.
                    # Example: "A / B + C" -> "A, B, C"
                    import re as _re
                    v = _re.sub(r"\s*[\/+]\s*", ", ", v)
                    v = _re.sub(r"\s*,\s*", ", ", v).strip(" ,")
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


def _extract_po_essentials_from_text(text: str) -> Dict[str, Any]:
    src = text or ""
    po_number = ""
    route_id_site_id = ""
    po_value = ""
    entries: List[Dict[str, str]] = []

    # PO number appears like ".../10004960" in the sample.
    m_po = re.search(r"\bPO\s*No\.?\s*:?\s*([^\n\r]+)", src, flags=re.IGNORECASE)
    if m_po:
        line = m_po.group(1).strip()
        m_digits = re.search(r"(\d{6,12})(?!.*\d)", line)
        if m_digits:
            po_number = m_digits.group(1)
    if not po_number:
        m_fallback_po = re.search(r"/(\d{6,12})\b", src)
        if m_fallback_po:
            po_number = m_fallback_po.group(1)

    # Route/Site id in sample appears as MA4640.
    m_route = re.search(r"\b[A-Z]{2}\d{3,6}\b", src)
    if m_route:
        route_id_site_id = m_route.group(0)

    def _looks_like_route_site_id(line: str) -> bool:
        s = (line or "").strip()
        if not s:
            return False
        s_low = s.lower()
        if any(k in s_low for k in ("chapter heading", "hsn number", "sac number", "reference gbpa", "po no", "partner name")):
            return False
        if re.fullmatch(r"[A-Z]{2}\d{3,6}", s):
            return True
        # Numeric-only site ids are usually short (e.g., 2475), avoid long refs like 100016.
        if re.fullmatch(r"\d{3,5}", s):
            return True
        if "/" in s and re.search(r"\broute\b", s, flags=re.IGNORECASE):
            return True
        if re.search(r"\broute\b", s, flags=re.IGNORECASE):
            return True
        return False

    def _extract_route_for_item(window_text: str, fallback: str) -> str:
        lines = [ln.strip() for ln in (window_text or "").splitlines()]
        lines = [ln for ln in lines if ln]
        if not lines:
            return fallback

        chapter_idxs = [i for i, ln in enumerate(lines) if re.search(r"chapter\s*heading", ln, flags=re.IGNORECASE)]
        if chapter_idxs:
            idx = chapter_idxs[-1]
            # Primary rule: Route/Site id is the nearest useful line above "Chapter Heading".
            def _is_noise(ln: str) -> bool:
                t = (ln or "").strip().lower()
                if not t:
                    return True
                return any(k in t for k in (
                    "chapter heading",
                    "hsn number",
                    "sac number",
                    "this line",
                    "reference gbpa",
                    "po no",
                    "partner name",
                    "purchase order continuation sheet",
                ))

            for j in range(idx - 1, max(-1, idx - 8), -1):
                cand = lines[j].strip()
                if _is_noise(cand):
                    continue
                # Prefer explicit route-like candidates, otherwise still accept nearest text line.
                if _looks_like_route_site_id(cand):
                    return cand
                if len(cand) >= 3 and len(cand) <= 80:
                    return cand

            # Secondary rule: explicit route-like line in the nearby context.
            for j in range(idx - 1, max(-1, idx - 7), -1):
                cand = lines[j].strip()
                if _looks_like_route_site_id(cand):
                    return cand

        # Fallback 1: last slash-route style token in local window.
        route_like = re.findall(r"([A-Za-z0-9][A-Za-z0-9\s]*/\s*Route\s*/\s*\d+[^\n\r]*)", window_text, flags=re.IGNORECASE)
        if route_like:
            return route_like[-1].strip()

        # Fallback 2: last compact code like MA4640 in local window.
        compact = re.findall(r"\b[A-Z]{2}\d{3,6}\b", window_text)
        if compact:
            return compact[-1].strip()

        return fallback

    # Extract all table line items from the full PDF text:
    # Qty -> UOM -> Unit Price -> Line Total
    # Keep this format-driven (no value-specific assumptions).
    line_item_pat = re.compile(
        r"\b(?P<qty>\d{1,7})\s*\n\s*(?P<uom>[A-Za-z][A-Za-z ./-]{1,24})\s*\n\s*(?P<unit>\d[\d,]{2,})\s*\n\s*(?P<line>\d[\d,]{4,})\b",
        flags=re.IGNORECASE,
    )
    for i, m in enumerate(line_item_pat.finditer(src), start=1):
        qty = re.sub(r"[^\d]", "", m.group("qty"))
        uom = m.group("uom")
        unit_price = re.sub(r"[^\d]", "", m.group("unit"))
        line_total = re.sub(r"[^\d]", "", m.group("line"))
        route_window = src[max(0, m.start() - 2500): m.start()]
        row_route = _extract_route_for_item(route_window, route_id_site_id)
        entries.append(
            {
                "sr_no": str(i),
                "po_number": po_number,
                "route_id_site_id": row_route,
                "qty": qty,
                "uom": uom,
                "unit_price": unit_price,
                "po_value": line_total,
            }
        )

    if entries:
        # Keep top-level po_value as aggregate of all extracted line totals.
        try:
            po_value = str(sum(int(e.get("po_value") or "0") for e in entries))
        except Exception:
            po_value = entries[0].get("po_value") or ""
    else:
        # Fallback: single value near heading.
        m_seq = re.search(
            r"\b\d{1,6}\s*\n\s*(?:Meter|Metre)\s*\n\s*\d[\d,]{2,}\s*\n\s*(\d[\d,]{4,})\b",
            src,
            flags=re.IGNORECASE,
        )
        if m_seq:
            po_value = re.sub(r"[^\d]", "", m_seq.group(1))
        else:
            m_heading = re.search(r"Line\s*Total", src, flags=re.IGNORECASE)
            if m_heading:
                window = src[m_heading.end(): m_heading.end() + 1500]
                nums = [int(n.replace(",", "")) for n in re.findall(r"\b\d[\d,]{4,}\b", window)]
                nums = [n for n in nums if n <= 500000000]
                if nums:
                    po_value = str(max(nums))

    unique_routes = sorted({(e.get("route_id_site_id") or "").strip() for e in entries if (e.get("route_id_site_id") or "").strip()})
    if unique_routes:
        route_id_site_id = ", ".join(unique_routes)

    return {
        "po_number": po_number,
        "route_id_site_id": route_id_site_id,
        "po_value": po_value,
        "entries": entries,
        "entry_count": len(entries),
    }


@app.post("/api/parse-po-pdf")
async def parse_po_pdf(file: UploadFile = File(...)):
    """Extract PO Number, Route ID/Site ID, and PO Value from PO PDF."""
    suffix = os.path.splitext(file.filename or "")[1] or ".pdf"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(await file.read())
    tmp.close()
    try:
        import fitz

        doc = fitz.open(tmp.name)
        text = "\n".join(page.get_text("text") for page in doc)
        doc.close()
        extracted = _extract_po_essentials_from_text(text)
        return extracted
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PO PDF parsing failed: {e}")
    finally:
        try:
            os.remove(tmp.name)
        except Exception:
            pass


@app.post("/api/po-data/save")
async def save_po_data(payload: Dict[str, Any] = Body(...)):
    """
    Save extracted PO rows into po_data.
    - id is auto-generated as: po_number + cust_route_id_site_id (direct concat)
    - existing ids are reported back row-wise
    """
    entries = payload.get("entries") if isinstance(payload, dict) else None
    if not isinstance(entries, list) or len(entries) == 0:
        raise HTTPException(status_code=400, detail="entries is required")

    results: List[Dict[str, Any]] = []
    inserted = 0
    exists = 0

    for idx, row in enumerate(entries):
        if not isinstance(row, dict):
            continue
        po_number = str(row.get("po_number") or "").strip()
        cust_route_id_site_id = str(row.get("route_id_site_id") or row.get("cust_route_id_site_id") or "").strip()
        if not po_number or not cust_route_id_site_id:
            results.append({
                "row_index": idx,
                "status": "skipped",
                "reason": "po_number or cust_route_id_site_id missing",
            })
            continue

        row_id = local_db.make_po_data_id(po_number, cust_route_id_site_id)
        saved = local_db.insert_po_data_if_new(
            {
                "id": row_id,
                "po_number": po_number,
                # Keep both for strict report lookup and custom tracking.
                "route_id_site_id": cust_route_id_site_id,
                "cust_route_id_site_id": cust_route_id_site_id,
                "quantity": str(row.get("qty") or row.get("quantity") or "").strip(),
                "uom": str(row.get("uom") or "").strip(),
                "unit_price": str(row.get("unit_price") or "").strip(),
                "line_total": str(row.get("po_value") or row.get("line_total") or "").strip(),
            }
        )
        if saved:
            inserted += 1
            results.append({"row_index": idx, "id": row_id, "status": "inserted"})
        else:
            exists += 1
            results.append({"row_index": idx, "id": row_id, "status": "exists"})

    return {
        "success": True,
        "inserted_count": inserted,
        "exists_count": exists,
        "results": results,
    }


@app.post("/api/deposit-return/docx")
async def generate_deposit_return_docx(permit_pdf: UploadFile = File(...)):
    """
    Generate Deposit Refund / WCC-like DOCX using:
    - Excel: fixed sheet at project root `ward-address/Mumbai_Ward Address.xlsx`
    - PDF: Permit details + Ward extraction
    """
    import tempfile as _tempfile
    from io import BytesIO as _BytesIO

    # Save PDF upload
    tmp_pdf = _tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp_pdf.write(await permit_pdf.read())
    tmp_pdf.close()

    try:
        # ---- Extract from PDF ----
        import fitz

        doc = fitz.open(tmp_pdf.name)
        pdf_text = "\n".join(page.get_text("text") for page in doc)
        doc.close()

        def _pick_first(pattern: str) -> str:
            m = re.search(pattern, pdf_text, flags=re.IGNORECASE)
            return (m.group(1).strip() if m else "")

        def _pick_last_group1(pattern: str) -> str:
            ms = list(re.finditer(pattern, pdf_text, flags=re.IGNORECASE))
            return (ms[-1].group(1).strip() if ms else "")

        # Permit number + permit date appear in multiple formats in PDFs.
        # Example (from your screenshot):
        #   No. 783339100 Dt. 16.04.2025
        m_no_dt = re.search(
            r"\bNo\.?\s*([0-9]{6,})\s*Dt\.?\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})\b",
            pdf_text,
            flags=re.IGNORECASE,
        )
        permit_no = m_no_dt.group(1).strip() if m_no_dt else ""
        permit_date = m_no_dt.group(2).strip() if m_no_dt else ""

        if not permit_no:
            permit_no = _pick_first(r"\bPermit\s*No\.?\s*[:\-]?\s*([0-9]{6,})\b") or _pick_first(r"\b([0-9]{6,})\b")
        if not permit_date:
            # Example alternative format: Dt. 16.04.2025
            permit_date = _pick_first(r"\bDt\.?\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})\b")
            if not permit_date:
                permit_date = _pick_first(r"\bDate\s*[:\-]?\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})\b")
        # Ward: prefer signature line "Asst. Engineer (Maint) A Ward" (usually at PDF end).
        # Generic "\b... Ward\b" must NOT run first — with IGNORECASE it matches English
        # "by Ward" / "near by ward" and yields false "BY", breaking Excel lookup.
        _WARD_STOPWORDS = frozenset(
            {
                "BY",
                "TO",
                "THE",
                "AND",
                "OR",
                "FOR",
                "NOT",
                "BUT",
                "OUR",
                "NOR",
                "PER",
                "VIA",
                "CUM",
                "MAY",
                "WAS",
                "ARE",
                "HIS",
                "HER",
                "ITS",
            }
        )
        _WARD_SIG = (
            r"Asst\.?\s+Engineer\s*\([^)]*\)\s*"
            r"([A-Za-z]{1,3}(?:\s*\/\s*[A-Za-z]{1,3})?)\s+Ward\b"
        )
        _WARD_GEN = r"\b([A-Za-z]{1,3}(?:\s*\/\s*[A-Za-z]{1,3})?)\s*Ward\b"
        _WARD_GEN_DOT = r"\b([A-Za-z]{1,3}(?:\s*\/\s*[A-Za-z]{1,3})?)\s*Ward\."

        ward = _pick_last_group1(_WARD_SIG)
        if not ward:
            # Last non-stopword generic match (prefer end of document — signature / footer).
            for pat in (_WARD_GEN_DOT, _WARD_GEN):
                ms = list(re.finditer(pat, pdf_text, flags=re.IGNORECASE))
                for m in reversed(ms):
                    raw = m.group(1).strip()
                    w_try = re.sub(r"\s*/\s*", "/", raw.upper())
                    if w_try in _WARD_STOPWORDS:
                        continue
                    ward = raw
                    break
                if ward:
                    break
        if ward:
            # Normalize spaces around slash, uppercase for consistent matching/output.
            ward = re.sub(r"\s*/\s*", "/", ward.strip().upper())

        # Road name (best-effort)
        # Prefer "Name of Road : <ROAD>" because other "Trench on ..." occurrences
        # may refer to Carriageway/Footpath sections.
        trench_road = _pick_first(
            r"\bName\s+of\s+Road\s*[:\-]\s*([A-Za-z0-9][A-Za-z0-9 \\/&().,-]{2,90})"
        )
        if not trench_road:
            trench_road = _pick_first(r"\bTrench\s+on\s+([A-Za-z0-9][A-Za-z0-9 /&().,-]{3,60})")
            # Avoid capturing sub-sections like "Carriageway"/"Footpath"
            if trench_road and trench_road.strip().lower() in ("carriageway", "footpath", "carriage way"):
                trench_road = ""

        # Dates of start / completion
        date_of_start = _pick_first(
            r"\bDate\s*of\s*Start\s*[:\-]?\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})"
        )
        date_of_completion = _pick_first(
            r"\bDate\s*of\s*Completion\s*[:\-]?\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})"
        )

        # ---- Excel: Ward -> Address ----
        import openpyxl as _openpyxl

        base_dir = Path(__file__).resolve().parent.parent
        excel_path = base_dir / "ward-address" / "Mumbai_Ward Address.xlsx"
        if not excel_path.exists():
            raise HTTPException(
                status_code=400,
                detail=f"Ward address Excel not found at: {excel_path}",
            )

        wb = _openpyxl.load_workbook(str(excel_path), data_only=True)
        ws = wb[wb.sheetnames[0]]

        # Find header row containing "Ward" (optional).
        header_row_idx = None
        header_map: Dict[str, int] = {}
        for r in range(1, min(ws.max_row, 15) + 1):
            row_vals = [str(ws.cell(r, c).value or "").strip() for c in range(1, min(ws.max_column, 50) + 1)]
            low = [v.lower() for v in row_vals]
            if any(v == "ward" for v in low):
                header_row_idx = r
                for ci, name in enumerate(row_vals, start=1):
                    if name:
                        header_map[name.lower()] = ci
                break

        def _get_col(*names: str) -> Optional[int]:
            for n in names:
                if n.lower() in header_map:
                    return header_map[n.lower()]
            return None

        ward_col = _get_col("ward")
        addr_col = _get_col("address", "adress", "office address", "ward address")

        # If the uploaded file uses fixed columns (as you specified):
        # Column A = Ward, Column C = Address
        if not ward_col:
            ward_col = 1
        if not addr_col:
            addr_col = 3

        def _excel_ward_matches(extracted: str, cell_val: str) -> bool:
            """Match Excel column A even if it uses punctuation variants like 'H/W' vs 'HW'."""
            if not extracted:
                return False

            def _norm(x: str) -> str:
                t = str(x or "").strip().upper()
                if not t:
                    return ""
                # Remove trailing/prefixed 'WARD' labels, then keep only alphanumerics.
                t = re.sub(r"\bWARD\.?\b", "", t)
                t = re.sub(r"[^A-Z0-9]", "", t)
                return t

            e_norm = _norm(extracted)
            w_norm = _norm(cell_val)
            return bool(e_norm and w_norm and e_norm == w_norm)

        address = ""
        if ward and ward_col and addr_col:
            start_r = (header_row_idx + 1) if header_row_idx else 1
            for r in range(start_r, ws.max_row + 1):
                wv = str(ws.cell(r, ward_col).value or "").strip()
                if _excel_ward_matches(ward, wv):
                    address = str(ws.cell(r, addr_col).value or "").strip()
                    break

        # If trench road is not in PDF, try excel columns
        if not trench_road and header_row_idx:
            road_col = _get_col("road", "trench on", "location", "street")
            if road_col:
                trench_road = str(ws.cell(header_row_idx + 1, road_col).value or "").strip()

        # ---- Build DOCX ----
        from docx import Document
        from docx.shared import Pt
        from docx.enum.text import WD_LINE_SPACING, WD_BREAK

        _LINE_GAP = Pt(12)  # ~one blank line in Word at default body size

        out = _BytesIO()
        d = Document()

        def _fmt_tight_para(p) -> None:
            pf = p.paragraph_format
            pf.space_before = Pt(0)
            pf.space_after = Pt(0)
            pf.line_spacing_rule = WD_LINE_SPACING.SINGLE

        def _add_tight_line(text: str, *, bold: bool = False):
            p = d.add_paragraph()
            _fmt_tight_para(p)
            r = p.add_run(text)
            r.bold = bold
            return p

        def _estimate_body_lines() -> float:
            """Rough line count for page-fill heuristic (~75 chars/line on A4)."""
            n = 0.0
            for p in d.paragraphs:
                t = (p.text or "").strip()
                if not t:
                    continue
                n += max(1.0, (len(t) + 74) / 75.0)
            return n

        p_title = d.add_paragraph()
        r_top = p_title.add_run("PROGRESS REPORT OF AIRTEL")
        r_top.bold = True
        p_title.add_run("\n")
        r_sub = p_title.add_run("(Work Completion Certificate)")
        r_sub.bold = True
        _fmt_tight_para(p_title)
        p_title.paragraph_format.space_after = Pt(0)

        p_to = d.add_paragraph()
        _fmt_tight_para(p_to)
        p_to.paragraph_format.space_before = _LINE_GAP
        p_to.paragraph_format.space_after = _LINE_GAP
        p_to.add_run("To:")
        _add_tight_line("ASSISTANT ENGINEER - MAINTENANCE")
        if ward:
            _add_tight_line(f"{ward} Ward Office Bldg.,")
        if address:
            # One line per segment; collapse internal spaces; no blank lines.
            addr_parts: List[str] = []
            for chunk in re.split(r",|\n", address):
                line = " ".join(str(chunk).split())
                if line:
                    addr_parts.append(line)
            for part in addr_parts:
                _add_tight_line(part)

        p_subj = d.add_paragraph(f"Sub:- Trench on {trench_road or ''}".strip())
        p_subj.paragraph_format.space_before = _LINE_GAP
        if permit_no:
            d.add_paragraph(f"Ref: - Permit No. {permit_no}")
        d.add_paragraph("Sir,")
        if permit_no:
            if permit_date:
                d.add_paragraph(f"1. Permit No. & Date :  {permit_no}   Date {permit_date}")
            else:
                d.add_paragraph(f"1. Permit No. & Date :  {permit_no}")
        if date_of_start:
            d.add_paragraph(f"2. Date of Start :  {date_of_start} Work Done")
        else:
            d.add_paragraph("2. Date of Start :")

        if date_of_completion:
            d.add_paragraph(f"3. Date of Completion :  {date_of_completion} Work Done")
        else:
            d.add_paragraph("3. Date of Completion :")
        d.add_paragraph("The progress of above work is as follows:-")
        d.add_paragraph("Sr.No. Particular Proposed as per plan Actual Progress")
        d.add_paragraph("1  Laying of cable : Yes  Done")
        d.add_paragraph("2  Transporting of excavated earth : Yes  Done")
        d.add_paragraph("3  Damage to Municipal Utility : No")
        d.add_paragraph("4  Damages to other Utility : No")
        d.add_paragraph("Engineer of Utility.")
        d.add_paragraph("Date:")
        # ~45 lines ≈ one full A4 page (11–12pt, default margins). If ~90% full, start Observations on next page.
        _PAGE_LINES_FULL = 45.0
        _OBS_LINES_GAP = Pt(22)  # ~2 blank lines above Observations when same page
        lines_before_obs = _estimate_body_lines()
        if lines_before_obs >= _PAGE_LINES_FULL * 0.9:
            p_br = d.add_paragraph()
            _fmt_tight_para(p_br)
            p_br.add_run().add_break(WD_BREAK.PAGE)
            obs_space_top = Pt(6)
        else:
            obs_space_top = _OBS_LINES_GAP

        p_obs = d.add_paragraph()
        p_obs.paragraph_format.space_before = obs_space_top
        p_obs.paragraph_format.space_after = _LINE_GAP
        p_obs.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
        p_obs.add_run("Observations of Ward Engineer").bold = True
        observations = [
            "1 Delayed in starting Yes / No",
            "2 Delayed in completion Yes / No",
            "3 Delayed in phase wise completion Yes / No",
            "4 Engineer of Utility is available Yes / No",
            "5 Barricading fixed Yes / No",
            "6 Reflectory signage provided Yes / No",
            "7 Name Board displayed Yes / No",
            "8 Warden appointed Yes / No",
            "9 M. S. Plate provided Yes / No",
            "10 Earth removed in time Yes / No",
            "11 Excavated earth removed Yes / No",
            "12 Excavated earth transported to identified spot Yes / No",
            "13 Water entrances covered Yes / No",
            "14 Water entrances cleaned Yes / No",
            "15 Municipal Utility damaged Yes / No",
            "16 Other Utility damaged Yes / No",
            "17 Damages to private property Yes / No",
            "18 Length increased Yes / No",
            "19 Alignment changed Yes / No",
            "20 Starting Point changed Yes / No",
            "21 End point change Yes / No",
            "22 Missing cover provided Yes / No",
            "23 Night lighting provided Yes / No",
        ]
        for line in observations:
            d.add_paragraph(line)

        d.save(out)
        out.seek(0)

        from fastapi.responses import Response

        safe_permit_no = re.sub(r"[^0-9A-Za-z_-]", "", str(permit_no or "").strip())
        filename = f"Permit_No_{safe_permit_no}.docx" if safe_permit_no else "Permit_No_deposit_return.docx"
        return Response(
            content=out.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            os.remove(tmp_pdf.name)
        except Exception:
            pass


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
