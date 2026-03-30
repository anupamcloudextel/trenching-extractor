"""
Local database layer - PostgreSQL only (replaces Supabase).
Requires DATABASE_URL (postgresql://...) in environment.
"""
import os
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("DB_URL")

def _get_engine():
    if not DATABASE_URL or not str(DATABASE_URL).strip().lower().startswith("postgresql"):
        raise RuntimeError(
            "DATABASE_URL must be set to a PostgreSQL connection string, e.g. "
            "postgresql://user:password@127.0.0.1:5432/trenching_db"
        )
    from sqlalchemy import create_engine
    return create_engine(DATABASE_URL)

_engine = None

def get_engine():
    global _engine
    if _engine is None:
        _engine = _get_engine()
    return _engine

def _run_sql(engine, sql: str, params: Optional[dict] = None, fetch: bool = True):
    from sqlalchemy import text
    with engine.connect() as conn:
        result = conn.execute(text(sql), params or {})
        if fetch:
            rows = result.fetchall()
            keys = result.keys()
            return [dict(zip(keys, row)) for row in rows]
        conn.commit()
        return None

def init_tables(engine=None):
    engine = engine or get_engine()
    # PostgreSQL DDL
    dn_sql = """
    CREATE TABLE IF NOT EXISTS dn_master (
        id SERIAL PRIMARY KEY,
        dn_number VARCHAR(255) UNIQUE,
        route_id_site_id VARCHAR(255),
        dn_length_mtr NUMERIC(18,4),
        permission_receipt_date VARCHAR(50),
        permit_no VARCHAR(255),
        permit_start_date VARCHAR(50),
        permit_end_date VARCHAR(50),
        permitted_length_by_ward_mts VARCHAR(50),
        surface VARCHAR(255),
        surface_wise_length TEXT,
        surface_wise_ri_amount TEXT,
        surface_wise_multiplication_factor TEXT,
        no_of_pits VARCHAR(50),
        ground_rent NUMERIC(18,4),
        gst NUMERIC(18,4),
        deposit NUMERIC(18,4),
        total_dn_amount NUMERIC(18,4),
        application_date VARCHAR(50),
        dn_received_date VARCHAR(50),
        actual_total_non_refundable NUMERIC(18,4),
        po_number VARCHAR(255),
        pit_ri_rate NUMERIC(18,4),
        ot_length NUMERIC(18,4),
        dn_ri_amount NUMERIC(18,4),
        administrative_charge NUMERIC(18,4),
        supervision_charges NUMERIC(18,4),
        chamber_fee NUMERIC(18,4),
        hdd_length NUMERIC(18,4),
        build_type VARCHAR(255),
        category_type VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    _run_sql(engine, dn_sql, fetch=False)
    # Backfill columns for already-existing dn_master tables created from older schema.
    _run_sql(engine, "ALTER TABLE dn_master ADD COLUMN IF NOT EXISTS surface_wise_length TEXT", fetch=False)
    _run_sql(engine, "ALTER TABLE dn_master ADD COLUMN IF NOT EXISTS surface_wise_ri_amount TEXT", fetch=False)
    _run_sql(engine, "ALTER TABLE dn_master ADD COLUMN IF NOT EXISTS surface_wise_multiplication_factor TEXT", fetch=False)
    _run_sql(engine, "CREATE UNIQUE INDEX IF NOT EXISTS idx_dn_master_dn_number ON dn_master(dn_number)", fetch=False)

    budget_sql = """
    CREATE TABLE IF NOT EXISTS budget_master (
        id SERIAL PRIMARY KEY,
        route_id_site_id VARCHAR(255),
        ce_length_mtr NUMERIC(18,4),
        ri_cost_per_meter NUMERIC(18,4),
        material_cost_per_meter NUMERIC(18,4),
        build_cost_per_meter NUMERIC(18,4),
        total_ri_amount NUMERIC(18,4),
        material_cost NUMERIC(18,4),
        execution_cost_including_hh NUMERIC(18,4),
        total_cost_without_deposit NUMERIC(18,4),
        route_type VARCHAR(255),
        survey_id VARCHAR(255),
        existing_new VARCHAR(255),
        build_type VARCHAR(255),
        category_type VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    _run_sql(engine, budget_sql, fetch=False)

    po_sql = """
    CREATE TABLE IF NOT EXISTS po_master (
        id SERIAL PRIMARY KEY,
        route_id_site_id VARCHAR(255) UNIQUE,
        route_type VARCHAR(255),
        po_no_ip1 VARCHAR(255),
        po_no_cobuild VARCHAR(255),
        po_length_ip1 NUMERIC(18,4),
        po_length_cobuild NUMERIC(18,4),
        route_routeLM_metroLM_LMCStandalone VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    _run_sql(engine, po_sql, fetch=False)
    _run_sql(engine, "CREATE UNIQUE INDEX IF NOT EXISTS idx_po_master_route_id_site_id ON po_master(route_id_site_id)", fetch=False)

    planning_sql = """
    CREATE TABLE IF NOT EXISTS planning_tracker (
        route_id_site_id TEXT PRIMARY KEY,
        planning_date TEXT,
        strategic_type TEXT
    );
    """
    _run_sql(engine, planning_sql, fetch=False)

    po_data_sql = """
    CREATE TABLE IF NOT EXISTS po_data (
        id TEXT PRIMARY KEY,
        po_number TEXT,
        route_id_site_id TEXT,
        cust_route_id_site_id TEXT,
        quantity TEXT,
        uom TEXT,
        unit_price TEXT,
        line_total TEXT
    );
    """
    _run_sql(engine, po_data_sql, fetch=False)
    _run_sql(engine, "ALTER TABLE po_data ADD COLUMN IF NOT EXISTS cust_route_id_site_id TEXT", fetch=False)
    _run_sql(
        engine,
        "UPDATE po_data SET cust_route_id_site_id = route_id_site_id "
        "WHERE (cust_route_id_site_id IS NULL OR cust_route_id_site_id = '') "
        "AND route_id_site_id IS NOT NULL",
        fetch=False,
    )
    _run_sql(
        engine,
        "UPDATE po_data SET route_id_site_id = cust_route_id_site_id "
        "WHERE (route_id_site_id IS NULL OR route_id_site_id = '') "
        "AND cust_route_id_site_id IS NOT NULL",
        fetch=False,
    )

    logger.info("PostgreSQL tables initialized (dn_master, budget_master, po_master).")

# ---- DN master ----
def get_dn_length_by_dn_number(dn_no: str) -> Optional[float]:
    engine = get_engine()
    rows = _run_sql(engine, "SELECT dn_length_mtr FROM dn_master WHERE dn_number = :dn_no", {"dn_no": dn_no})
    if rows and rows[0].get("dn_length_mtr") is not None:
        return float(rows[0]["dn_length_mtr"])
    return None

def get_dn_by_number(dn_number: str) -> Optional[Dict[str, Any]]:
    engine = get_engine()
    rows = _run_sql(engine, "SELECT * FROM dn_master WHERE dn_number = :dn_no", {"dn_no": dn_number})
    return rows[0] if rows else None

def get_dn_by_route_id_site_id(route_id_site_id: str) -> List[Dict[str, Any]]:
    engine = get_engine()
    return _run_sql(engine, "SELECT * FROM dn_master WHERE route_id_site_id = :rid", {"rid": route_id_site_id})

def upsert_dn_master(row: Dict[str, Any]) -> None:
    engine = get_engine()
    allowed = {"dn_number", "route_id_site_id", "dn_length_mtr", "permission_receipt_date", "permit_no",
               "permit_start_date", "permit_end_date", "permitted_length_by_ward_mts", "surface",
               "surface_wise_length", "surface_wise_ri_amount", "surface_wise_multiplication_factor", "no_of_pits",
               "ground_rent", "gst", "deposit", "total_dn_amount", "application_date", "dn_received_date",
               "actual_total_non_refundable", "po_number", "pit_ri_rate", "ot_length", "dn_ri_amount",
               "administrative_charge", "supervision_charges", "chamber_fee", "hdd_length", "build_type", "category_type"}
    cols = [k for k in row if k in allowed]
    if not cols or "dn_number" not in cols:
        return
    params = {c: row.get(c) for c in cols}
    placeholders = ", ".join(f":{c}" for c in cols)
    columns = ", ".join(cols)
    upd = ", ".join(f"{c} = excluded.{c}" for c in cols if c != "dn_number")
    sql = f"INSERT INTO dn_master ({columns}) VALUES ({placeholders}) ON CONFLICT(dn_number) DO UPDATE SET {upd}"
    _run_sql(engine, sql, params, fetch=False)

# ---- Budget master ----
def query_budget_by_site_id(site_id: str, columns: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
    engine = get_engine()
    sel = ", ".join(columns) if columns else "*"
    rows = _run_sql(engine, f"SELECT {sel} FROM budget_master WHERE route_id_site_id = :sid LIMIT 1", {"sid": site_id})
    return rows[0] if rows else None

def query_budget_by_site_id_all(site_id: str, columns: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    engine = get_engine()
    sel = ", ".join(columns) if columns else "*"
    return _run_sql(engine, f"SELECT {sel} FROM budget_master WHERE route_id_site_id = :sid", {"sid": site_id})

def query_budget_by_route_id_insensitive(route_id_site_id: str, columns: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Match route_id_site_id case-insensitively (for route-analysis when exact match returns nothing)."""
    if not (route_id_site_id or str(route_id_site_id).strip()):
        return []
    engine = get_engine()
    sel = ", ".join(columns) if columns else "*"
    return _run_sql(
        engine,
        f"SELECT {sel} FROM budget_master WHERE LOWER(TRIM(route_id_site_id)) = LOWER(TRIM(:sid))",
        {"sid": str(route_id_site_id).strip()},
    )

def query_budget_by_survey_ids(survey_ids: List[str], columns: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    if not survey_ids:
        return []
    engine = get_engine()
    sel = ", ".join(columns) if columns else "*"
    placeholders = ", ".join(f":s{i}" for i in range(len(survey_ids)))
    params = {f"s{i}": v for i, v in enumerate(survey_ids)}
    return _run_sql(engine, f"SELECT {sel} FROM budget_master WHERE survey_id IN ({placeholders})", params)

def budget_delete_not_in_site_ids(site_ids: List[str]) -> None:
    if not site_ids:
        return
    engine = get_engine()
    placeholders = ", ".join(f":s{i}" for i in range(len(site_ids)))
    params = {f"s{i}": v for i, v in enumerate(site_ids)}
    _run_sql(engine, f"DELETE FROM budget_master WHERE route_id_site_id NOT IN ({placeholders})", params, fetch=False)

def budget_insert_many(rows: List[Dict[str, Any]]) -> None:
    if not rows:
        return
    from sqlalchemy import text
    engine = get_engine()
    allowed = {"route_id_site_id", "ce_length_mtr", "ri_cost_per_meter", "material_cost_per_meter", "build_cost_per_meter",
               "total_ri_amount", "material_cost", "execution_cost_including_hh", "total_cost_without_deposit",
               "route_type", "survey_id", "existing_new", "build_type", "category_type"}
    cols = list(allowed)
    placeholders = ", ".join(f":{c}" for c in cols)
    sql = f"INSERT INTO budget_master ({','.join(cols)}) VALUES ({placeholders})"
    with engine.connect() as conn:
        for row in rows:
            params = {c: row.get(c) for c in cols}
            conn.execute(text(sql), params)
        conn.commit()

# ---- PO master ----
def query_po_by_site_id(site_id: str) -> Optional[Dict[str, Any]]:
    engine = get_engine()
    rows = _run_sql(engine, "SELECT * FROM po_master WHERE route_id_site_id = :sid LIMIT 1", {"sid": site_id})
    return rows[0] if rows else None

def get_po_site_ids() -> List[str]:
    engine = get_engine()
    rows = _run_sql(engine, "SELECT DISTINCT route_id_site_id FROM po_master WHERE route_id_site_id IS NOT NULL AND route_id_site_id != ''")
    return [r["route_id_site_id"] for r in rows if r.get("route_id_site_id")]

def get_all_po_master() -> List[Dict[str, Any]]:
    engine = get_engine()
    return _run_sql(engine, "SELECT * FROM po_master ORDER BY id")

def get_all_budget_master() -> List[Dict[str, Any]]:
    engine = get_engine()
    return _run_sql(engine, "SELECT * FROM budget_master ORDER BY id")

def get_budget_route_ids() -> List[str]:
    """Distinct route_id_site_id from budget_master for route dropdown and route-analysis."""
    engine = get_engine()
    rows = _run_sql(engine, "SELECT DISTINCT route_id_site_id FROM budget_master WHERE route_id_site_id IS NOT NULL AND route_id_site_id != '' ORDER BY route_id_site_id")
    return [r["route_id_site_id"] for r in rows if r.get("route_id_site_id")]

def get_all_dn_master() -> List[Dict[str, Any]]:
    engine = get_engine()
    return _run_sql(engine, "SELECT * FROM dn_master ORDER BY id")

def get_dn_site_ids() -> List[str]:
    engine = get_engine()
    rows = _run_sql(engine, "SELECT DISTINCT route_id_site_id FROM dn_master WHERE route_id_site_id IS NOT NULL AND route_id_site_id != ''")
    return [r["route_id_site_id"] for r in rows if r.get("route_id_site_id")]

def upsert_po_master(row: Dict[str, Any]) -> None:
    engine = get_engine()
    cols = ["route_id_site_id", "route_type", "po_no_ip1", "po_no_cobuild", "po_length_ip1", "po_length_cobuild", "route_routeLM_metroLM_LMCStandalone"]
    params = {c: row.get(c) for c in cols}
    placeholders = ", ".join(f":{c}" for c in cols)
    columns = ", ".join(cols)
    upd = ", ".join(f"{c} = excluded.{c}" for c in cols if c != "route_id_site_id")
    sql = f"INSERT INTO po_master ({columns}) VALUES ({placeholders}) ON CONFLICT(route_id_site_id) DO UPDATE SET {upd}"
    _run_sql(engine, sql, params, fetch=False)

# ---- Planning tracker ----
def get_planning_tracker_by_route_id_site_id(route_id_site_id: str) -> Optional[Dict[str, Any]]:
    engine = get_engine()
    rows = _run_sql(engine, "SELECT * FROM planning_tracker WHERE route_id_site_id = :sid LIMIT 1", {"sid": route_id_site_id})
    return rows[0] if rows else None

def _serialize_row(row: Dict) -> Dict:
    out = {}
    for k, v in row.items():
        if k == "id":
            continue
        if hasattr(v, "isoformat"):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


# ---- PO extracted rows ----
def make_po_data_id(po_number: Any, route_id_site_id: Any) -> str:
    # Concatenate values directly (no literal '+' character stored).
    return f"{str(po_number or '').strip()}{str(route_id_site_id or '').strip()}"


def get_po_data_by_id(row_id: str) -> Optional[Dict[str, Any]]:
    engine = get_engine()
    rows = _run_sql(engine, "SELECT * FROM po_data WHERE id = :rid LIMIT 1", {"rid": row_id})
    return rows[0] if rows else None


def insert_po_data_if_new(row: Dict[str, Any]) -> bool:
    """
    Insert a po_data row if id does not exist.
    Returns True when inserted, False when row already exists.
    """
    engine = get_engine()
    params = {
        "id": row.get("id"),
        "po_number": row.get("po_number"),
        "route_id_site_id": row.get("route_id_site_id"),
        "cust_route_id_site_id": row.get("cust_route_id_site_id"),
        "quantity": row.get("quantity"),
        "uom": row.get("uom"),
        "unit_price": row.get("unit_price"),
        "line_total": row.get("line_total"),
    }
    if get_po_data_by_id(str(params["id"])) is not None:
        return False

    sql = """
    INSERT INTO po_data (id, po_number, route_id_site_id, cust_route_id_site_id, quantity, uom, unit_price, line_total)
    VALUES (:id, :po_number, :route_id_site_id, :cust_route_id_site_id, :quantity, :uom, :unit_price, :line_total)
    ON CONFLICT(id) DO NOTHING
    """
    _run_sql(engine, sql, params, fetch=False)
    return True


def get_po_data_by_po_and_route(po_number: str, route_id_site_id: str) -> Optional[Dict[str, Any]]:
    """
    Lookup po_data row using strict match on:
    po_number AND route_id_site_id.
    """
    engine = get_engine()
    params = {
        "po_number": str(po_number or "").strip(),
        "route_id_site_id": str(route_id_site_id or "").strip(),
    }
    rows = _run_sql(
        engine,
        """
        SELECT * FROM po_data
        WHERE COALESCE(TRIM(po_number), '') = :po_number
          AND COALESCE(TRIM(route_id_site_id), '') = :route_id_site_id
        LIMIT 1
        """,
        params,
    )
    return rows[0] if rows else None
