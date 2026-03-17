import pandas as pd
import re

def po_parser(excel_path, site_id_route_id):
    """
    excel_path: path to the PO Excel file
    site_id_route_id: the Site ID or Route ID to look up
    Returns a dict with 'PO No' and 'PO Length (Mtr)' or 'PO Length', or empty strings if not found.
    """
    # Read the sheet without headers
    df_raw = pd.read_excel(excel_path, sheet_name="MasterPO", header=None)
    # Find the header row index
    header_row_idx = None
    for i in range(min(10, len(df_raw))):
        if any(str(cell).strip().lower() == "siteid" for cell in df_raw.iloc[i]):
            header_row_idx = i
            break
    if header_row_idx is None:
        return {"error": "SiteID column not found in the first 10 rows."}
    # Read again with the correct header row
    df = pd.read_excel(excel_path, sheet_name="MasterPO", header=header_row_idx)
    # Normalize column names
    def normalize(col):
        return re.sub(r'[^a-z0-9]', '', str(col).strip().lower())
    norm_cols = {normalize(col): col for col in df.columns}
    # Find the best match for PO Length columns
    po_length_col = None
    for key in ["polengthmtr", "polength"]:
        if key in norm_cols:
            po_length_col = norm_cols[key]
            break
    # Find the best match for Category columns
    category_col = None
    for key in ["categaory", "category"]:
        if key in norm_cols:
            category_col = norm_cols[key]
            break
    # Find UID column
    uid_col = None
    for col in df.columns:
        if normalize(col) == 'uid':
            uid_col = col
            break
    # Find Parent Route Name / HH column
    parent_route_col = None
    for col in df.columns:
        if normalize(col) == 'parent_route':
            parent_route_col = col
            break
    # Find the correct column for site/route id (robust to case/spacing)
    site_id_col = None
    for key in ["route_id_site_id", "siteid", "routeidsiteid"]:
        for col in df.columns:
            if normalize(col) == normalize(key):
                site_id_col = col
                break
        if site_id_col:
            break
    if not site_id_col:
        return {"error": "route_id_site_id column not found."}
    # Match against the provided site_id_route_id in the correct column
    match = df[df[site_id_col].astype(str).str.strip().str.lower() == str(site_id_route_id).strip().lower()]
    def clean_value(val):
        if pd.isna(val) or str(val).strip() in ('', '-', 'nan', 'None'):
            return ""
        return str(val).strip()
    if not match.empty:
        row = match.iloc[0]
        # Normalize route_type value for comparison
        route_type_val = clean_value(row.get('route_type', ""))
        route_type_val_norm = route_type_val.replace(" ", "").lower()
        # Robust PO No extraction based on normalized route_type
        if route_type_val_norm in ["metrolm", "lmc(standalone)", "routelm"]:
            po_no = clean_value(row.get('po_no_cobuild', "") or row.get('PO_NO_COBUILD', "") or row.get('PO No Cobuild', ""))
        elif route_type_val_norm == "route":
            po_no = clean_value(row.get('po_no_ip1', "") or row.get('PO_NO_IP1', "") or row.get('PO No IP1', ""))
        else:
            po_no = ""
        # Robust PO Length extraction based on normalized route_type
        if route_type_val_norm in ["metrolm", "lmc(standalone)", "routelm"]:
            po_length = clean_value(row.get('po_length_cobuild', "") or row.get('PO_LENGTH_COBUILD', "") or row.get('PO Length Cobuild', ""))
        elif route_type_val_norm == "route":
            po_length = clean_value(row.get('po_length_ip1', "") or row.get('PO_LENGTH_IP1', "") or row.get('PO Length IP1', ""))
        else:
            po_length = ""
        # Category: always from 'route_type' column
        category_col = None
        for col in df.columns:
            if normalize(col) == 'route_type':
                category_col = col
                break
        category_val = clean_value(row.get(category_col, "")) if category_col else ""
        # UID: always from 'uid' column
        uid_val = clean_value(row.get(uid_col, "")) if uid_col else ""
        # Parent Route Name / HH: always from 'parent_route' column
        parent_route_val = clean_value(row.get(parent_route_col, "")) if parent_route_col else ""
        # New parent_route logic (if you want to keep category logic, you can adjust here)
        parent_route = parent_route_val
        return {
            'PO No': po_no,
            'PO Length (Mtr)': po_length,
            'Category': category_val,
            'SiteID': str(site_id_route_id),
            'UID': uid_val,
            'Parent Route Name / HH': parent_route
        }
    return {'PO No': "", 'PO Length (Mtr)': "", 'Category': "", 'SiteID': str(site_id_route_id), 'UID': "", 'Parent Route Name / HH': ""}

if __name__ == "__main__":
    import sys
    excel_path = sys.argv[1]
    site_id_route_id = sys.argv[2]
    print(po_parser(excel_path, site_id_route_id)) 