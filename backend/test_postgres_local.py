#!/usr/bin/env python3
"""Test: PostgreSQL-only local DB. No Supabase, no SQLite."""
import os
import sys

env_file = os.path.join(os.path.dirname(__file__), ".env")
if os.path.isfile(env_file):
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))
if os.path.isfile("/etc/trenching-extractor/backend.env"):
    with open("/etc/trenching-extractor/backend.env") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                val = v.strip().strip('"')
                if k.strip() == "DB_URL":
                    os.environ["DATABASE_URL"] = val
                os.environ[k.strip()] = val

sys.path.insert(0, os.path.dirname(__file__))

def main():
    errors = []
    print("1. Check db.py: no SQLite usage, no Supabase client")
    with open(os.path.join(os.path.dirname(__file__), "db.py")) as f:
        c = f.read()
    if "sqlite" in c.lower() and "sqlite://" in c.lower():
        errors.append("db.py uses SQLite")
    if "create_client" in c or "supabase.table" in c:
        errors.append("db.py uses Supabase client")
    print("   OK" if not errors else "   FAIL")

    print("2. DATABASE_URL")
    url = os.environ.get("DATABASE_URL") or os.environ.get("DB_URL")
    if not url or "postgresql" not in url.lower():
        errors.append("Need DATABASE_URL/DB_URL postgresql")
    print("   OK" if url else "   FAIL")

    print("3. Init tables")
    try:
        import db as local_db
        local_db.init_tables()
        print("   OK")
    except Exception as e:
        errors.append(str(e))
        print("   FAIL:", e)
        return 1

    print("4. DN master upsert + get")
    try:
        local_db.upsert_dn_master({"dn_number": "T-DN-1", "route_id_site_id": "TS1", "dn_length_mtr": 50.0})
        r = local_db.get_dn_by_number("T-DN-1")
        assert r and r.get("dn_number") == "T-DN-1"
        print("   OK")
    except Exception as e:
        errors.append(str(e))
        print("   FAIL:", e)

    print("5. Budget insert + query")
    try:
        local_db.budget_insert_many([{"route_id_site_id": "TS1", "ri_cost_per_meter": 100.0}])
        r = local_db.query_budget_by_site_id("TS1")
        assert r and r.get("route_id_site_id") == "TS1"
        print("   OK")
    except Exception as e:
        errors.append(str(e))
        print("   FAIL:", e)

    print("6. PO master upsert + get_po_site_ids")
    try:
        local_db.upsert_po_master({"route_id_site_id": "TS1", "route_type": "Route"})
        r = local_db.query_po_by_site_id("TS1")
        assert r and r.get("route_id_site_id") == "TS1"
        ids = local_db.get_po_site_ids()
        assert "TS1" in ids
        print("   OK")
    except Exception as e:
        errors.append(str(e))
        print("   FAIL:", e)

    print("7. Cleanup")
    try:
        from sqlalchemy import text
        e = local_db.get_engine()
        with e.connect() as conn:
            conn.execute(text("DELETE FROM dn_master WHERE dn_number = 'T-DN-1'"))
            conn.execute(text("DELETE FROM budget_master WHERE route_id_site_id = 'TS1'"))
            conn.execute(text("DELETE FROM po_master WHERE route_id_site_id = 'TS1'"))
            conn.commit()
        print("   OK")
    except Exception as ex:
        print("   WARN:", ex)

    print("8. API endpoints (TestClient)")
    try:
        try:
            from fastapi.testclient import TestClient
            from app import app as fastapi_app
            client = TestClient(fastapi_app)
        except Exception as skip_err:
            if "httpx" in str(skip_err).lower():
                print("   SKIP (httpx not installed)")
            else:
                raise
        else:
            r = client.get("/api/db/po-master/site-ids")
            if r.status_code != 200:
                errors.append(f"GET po-master/site-ids: {r.status_code}")
            else:
                data = r.json()
                if "data" not in data:
                    errors.append("GET po-master/site-ids: no 'data'")
            r = client.get("/api/db/dn-master/site-ids")
            if r.status_code != 200:
                errors.append(f"GET dn-master/site-ids: {r.status_code}")
            r = client.post("/api/send-to-master-dn", json={"data": [{"field": "dn_number", "value": "API-TEST-1"}, {"field": "route_id_site_id", "value": "API-Site1"}]})
            if r.status_code != 200:
                errors.append(f"POST send-to-master-dn: {r.status_code} - {r.text[:200]}")
            else:
                row = local_db.get_dn_by_number("API-TEST-1")
                if not row:
                    errors.append("send-to-master-dn: row not in DB")
                else:
                    from sqlalchemy import text
                    with local_db.get_engine().connect() as conn:
                        conn.execute(text("DELETE FROM dn_master WHERE dn_number = 'API-TEST-1'"))
                        conn.commit()
            if not errors:
                print("   OK")
    except Exception as e:
        errors.append(str(e))
        print("   FAIL:", e)

    if errors:
        print("FAILED:", errors)
        return 1
    print("All PostgreSQL tests passed.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
