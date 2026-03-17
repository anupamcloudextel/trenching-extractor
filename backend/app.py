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
    from sqlalchemy import text
    engine = local_db.get_engine()
    rows = local_db._run_sql(engine, "SELECT DISTINCT dn_number FROM dn_master WHERE dn_number IS NOT NULL AND dn_number != '' ORDER BY dn_number")
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
    return {"success": True, "message": "Saved to Master DN."}


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
