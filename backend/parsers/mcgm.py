import fitz  # PyMuPDF
import camelot
import re
from datetime import datetime

HEADERS = [
    "Intercity/Intracity- Deployment Intercity/intracity- O&M FTTH- Deployment FTTH-O&M",
    "BUSINESS UNIT",
    "Circle",
    "City",
    "Demand Note Reference number",
    "LM/BB/FTTH",
    "Type (UG/OH)",
    "Capping/Non Capping",
    "UG TYPE( HDD/ OT/ MICROTRENCHING)",
    "Road Types - CC/BT/TILES/ Normal Soil/kacha",
    "HDD - Number of Pits",
    "OH (EB Poles/MC Poles/Own Poles)",
    "NO OF POLES",
    "RAILWAY CROSSING/ PIPELINE CROSSING( No of crossing)",
    "GO RATE",
    "PREVIOUS DN RATE",
    "Rate/mtr- Current DN (UG/OH)",
    "Annual Rate/Pole( current DN)",
    "HDD(PIT RATE)",
    "Section Length (Mtr.)",
    "Total Route (MTR)",
    "RAILWAY/ PIPELINE/ EACH CROSSING RATE",
    "Reason (Current rate is more than GO or Previous DN)",
    "Annual Lease/ rent amount",
    "Renewal Lease/Rent date",
    "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)",
    "Covered under capping (Restoration Charges, admin, registration etc.)",
    "Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')",
    "Cost type with Cost Breakup EG.. - PROCESING FEES/ SUPERVISOIN CHARGE/ ADMIN FEES/ LICENSE FEES etc etc.",
    "GST Amount",
    "BG Amount",
    "SD Amount",
    "ROW APPLICATION  DATE",
    "Demand Note Date",
    "DN RECEIVED FROM PARTNER/AUTHORITY- DATE",
    "Difference from, DN date  - DN Sent to Central team (ARTL)",
    "REASON FOR DELAY (>2 DAYS)",
    "Total DN Amount ( NON REFUNDABLE+SD+ BG+ GST) To be filled by helpdesk team",
    "Supplier Code( if team have) To be filled by helpdesk team",
    "Supplier site name( if team have) To be filled by helpdesk team",
    "Locator Code (material)",
    "Authority( email address)",
    "Authority",
    "BENEFICIERY NAME",
    "Mode of payment(DD/ONLINE-URL/ONLINE-NEFT/BHARATKOSH",
    "EXECUTION PARTNER NAME",
    "Payable (Authority) Location",
    "Printing Location",
    "PO No.",
    "Business NFA NUMBER (Approved CAF) To be filled by helpdesk team",
    "Route Name(As per CWIP)",
    "Section Name for ROW(As per CWIP)",
    "NSG ID(As per CWIP)/CWO NO.",
    "Total Amount as per capping MB(Partner Scope)",
    "Cost type(restoration/ supervison/ agency changes/ admin etc)",
    "Total Amount as per capping MB(Not in Partner Scope)",
    "Cost type (way leave charges/ rent/ license etc)",
    "Permission Type (Primary/ Secondary)",
    "Additional Remarks",
]

STATIC_VALUES = {
    "Intercity/Intracity- Deployment Intercity/intracity- O&M FTTH- Deployment FTTH-O&M": "Intercity/Intracity - Deployment",
    "BUSINESS UNIT": "TNL-FF-Maharashtra",
    "Circle": "MUM",
    "City": "MUM",
    "Capping/Non Capping": "Non capping",
    "Cost type with Cost Breakup EG.. - PROCESING FEES/ SUPERVISOIN CHARGE/ ADMIN FEES/ LICENSE FEES etc etc.": "Restoration Charges",
    "Authority( email address)": "dyche.rdplg@mcgm.gov.in",
    "Authority": "MUNICIPAL CORPORATION OF GREATER MUMBAI",
    "BENEFICIERY NAME": "MUNICIPAL CORPORATION OF GREATER MUMBAI",
    "Mode of payment(DD/ONLINE-URL/ONLINE-NEFT/BHARATKOSH": "ONLINE-NEFT",
    "EXECUTION PARTNER NAME": "Excel Telesonic India Private Limited",
    "Payable (Authority) Location": "Mumbai",
    "Printing Location": "Mumbai",
    "Cost type(restoration/ supervison/ agency changes/ admin etc)": "Restoration Charges",
    "Permission Type (Primary/ Secondary)": "Primary",
    "Type (UG/OH)": "UG",
    "UG TYPE( HDD/ OT/ MICROTRENCHING)": "OT"
}

def extract_demand_note_reference(text):
    match = re.search(r"^\s*No\.?\s*([A-Za-z0-9\-\/]+)", text, re.MULTILINE)
    print(f"[DEBUG] [mcgm] extract_demand_note_reference: match={match.group(0) if match else None}, value={match.group(1) if match else None}")
    return match.group(1).strip() if match else ""

def extract_section_length(text):
    matches = re.findall(r"Length in Mt\.\s*:?\s*([0-9,.]+)", text)
    return str(sum(float(m.replace(",", "")) for m in matches)) if matches else ""

def extract_gst_amount(text):
    cgst = re.search(r"CGST\s*[:\-]?\s*([0-9,]+)", text)
    sgst = re.search(r"SGST\s*[:\-]?\s*([0-9,]+)", text)
    total = 0
    if cgst:
        total += float(cgst.group(1).replace(",", ""))
    if sgst:
        total += float(sgst.group(1).replace(",", ""))
    return str(total) if total else ""

def extract_gst_amount_from_text(text):
    cgst = 0.0
    sgst = 0.0
    match_cgst = re.search(r"CGST\s*=\s*([0-9,.]+)", text)
    if match_cgst:
        try:
            cgst = float(match_cgst.group(1).replace(',', ''))
        except ValueError:
            pass
    match_sgst = re.search(r"SGST\s*=\s*([0-9,.]+)", text)
    if match_sgst:
        try:
            sgst = float(match_sgst.group(1).replace(',', ''))
        except ValueError:
            pass
    return str(int(cgst + sgst)) if (cgst + sgst).is_integer() else str(cgst + sgst)

def extract_sd_amount_from_text(text):
    match = re.search(r"Deposit as 50% of \(C\)\s*=\s*E\s*([0-9,]+\.?[0-9]*)", text)
    if match:
        val = match.group(1).replace(',', '')
        try:
            return str(int(float(val))) if float(val).is_integer() else str(float(val))
        except ValueError:
            return ""
    match = re.search(r"Deposit as 50%.*?([0-9,]+\.?[0-9]*)", text)
    if match:
        val = match.group(1).replace(',', '')
        try:
            return str(int(float(val))) if float(val).is_integer() else str(float(val))
        except ValueError:
            return ""
    return ""

def extract_row_application_date(text):
    for line in text.splitlines():
        if 'Your Letter No.' in line:
            match = re.search(r"Dated[:\s]*([0-9]{2}[./][0-9]{2}[./][0-9]{4})", line, re.IGNORECASE)
            if match:
                return match.group(1).replace('.', '/')
    return ""

def extract_demand_note_date(text):
    match = re.search(r"Dt\.?\s*([0-9]{2}[./][0-9]{2}[./][0-9]{4})", text)
    if match:
        return match.group(1).replace('.', '/')
    return ""

def extract_difference_days(received_date):
    try:
        dn_date = datetime.strptime(received_date, "%d/%m/%Y")
        return str((datetime.today() - dn_date).days)
    except Exception:
        return ""

def extract_total_dn_amount(fields):
    try:
        sd = float(fields.get("SD Amount", 0) or 0)
        non_refundable = float(fields.get("Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')", 0) or 0)
        return str(int(sd + non_refundable)) if (sd + non_refundable).is_integer() else str(sd + non_refundable)
    except Exception:
        return ""

def extract_road_types(text):
    values = []
    stop_keywords = ["excavation", "beyond", "liability", "guarantee", "period"]
    for m in re.finditer(r'Particulars', text):
        chunk = text[m.end():m.end()+600]
        lines = chunk.splitlines()
        found_one = False
        collecting = False
        material_lines = []
        for i, line in enumerate(lines):
            s = line.strip()
            if found_one and not collecting:
                if not s or re.match(r'^\d+$', s):
                    continue
                collecting = True
            if collecting:
                if not s or any(kw in s.lower() for kw in stop_keywords):
                    break
                material_lines.append(s)
            if re.match(r'^\s*1\s*$', line):
                found_one = True
        if material_lines:
            values.append(' '.join(material_lines))
    return ' / '.join(values)

def extract_rate_in_rs(text):
    rates = []
    for m in re.finditer(r'Rate in Rs\.', text):
        chunk = text[m.end():m.end()+200]
        lines = chunk.splitlines()
        idx_1 = None
        for i, line in enumerate(lines):
            if re.match(r'^\s*1\s*$', line):
                idx_1 = i
                break
        if idx_1 is not None:
            for j in range(idx_1+1, len(lines)):
                s = lines[j].strip()
                if s:
                    for k in range(j+1, len(lines)):
                        s2 = lines[k].strip()
                        if s2:
                            parts = s2.split()
                            if len(parts) >= 4:
                                rates.append(parts[3])
                            break
                    break
    return ' / '.join(rates)

def extract_road_types_from_tables(tables):
    road_types = []
    for table in tables:
        df = table.df
        for col_idx, col_name in enumerate(df.iloc[0]):
            if "Particulars" in col_name:
                for i in range(2, len(df)):
                    val = df.iloc[i, col_idx].replace('\n', ' ').strip()
                    if val and "Total" not in val:
                        road_types.append(val)
                break
    return ' / '.join(road_types)

def extract_rate_in_rs_from_tables(tables):
    rates = []
    for table in tables:
        df = table.df
        for col_idx, col_name in enumerate(df.iloc[0]):
            if "Rate" in col_name and "Rs" in col_name:
                for i in range(2, len(df)):
                    val = df.iloc[i, col_idx].replace('\n', '').strip()
                    if val and "Total" not in val:
                        rates.append(val)
                break
    return ' / '.join(rates)

def extract_section_length_from_tables(tables):
    total_length = 0.0
    for table in tables:
        df = table.df
        for col_idx, col_name in enumerate(df.iloc[0]):
            if "Length" in col_name and "Mt" in col_name:
                for i in range(2, len(df)):
                    val = df.iloc[i, col_idx].replace('\n', '').replace(',', '').strip()
                    if val and "Total" not in val:
                        try:
                            total_length += float(val)
                        except ValueError:
                            pass
                break
    return str(int(total_length)) if total_length.is_integer() else str(total_length)


def extract_covered_under_capping(text, tables):
    total = 0.0
    for table in tables:
        df = table.df
        for i in range(len(df)):
            for j in range(len(df.columns)):
                cell = df.iloc[i, j].replace('\n', ' ').strip()
                if "Total R.I." in cell or "Total R.I. (A+B) = (C)" in cell:
                    for k in range(len(df.columns)-1, -1, -1):
                        val = df.iloc[i, k].replace(',', '').replace('\n', '').strip()
                        try:
                            total += float(val)
                            break
                        except ValueError:
                            continue
    for table in tables:
        df = table.df
        for i in range(len(df)):
            for j in range(len(df.columns)):
                cell = df.iloc[i, j].replace('\n', ' ').strip()
                if "Access Charges(F)" in cell:
                    for k in range(len(df.columns)-1, -1, -1):
                        val = df.iloc[i, k].replace(',', '').replace('\n', '').strip()
                        try:
                            total += float(val)
                            break
                        except ValueError:
                            continue
    # Only include Administrative Charge, NOT Ground Rent
    match = re.search(r"\(ii\)\s*Administrative Charge\s*:?\s*([0-9,.]+)", text)
    if match:
        try:
            total += float(match.group(1).replace(',', ''))
        except ValueError:
            pass
    return str(int(total)) if total.is_integer() else str(total)

def extract_not_part_of_capping(text, tables):
    """
    Extract the 'not part of capping' value from ground rent in MCGM PDFs.
    This is the actual ground rent amount, not a calculated value.
    """
    return extract_ground_rent_from_text(text)

def extract_ri_from_tables(tables):
    for table in tables:
        df = table.df
        for i in range(len(df)):
            for j in range(len(df.columns)):
                cell = df.iloc[i, j].replace('\n', ' ').strip()
                if "Total R.I." in cell or "Total R.I. (A+B) = (C)" in cell:
                    # Return the last column value in this row
                    for k in range(len(df.columns)-1, -1, -1):
                        val = df.iloc[i, k].replace(',', '').replace('\n', '').strip()
                        if val:
                            return val
    return ""

def extract_ground_rent_from_text(text):
    import re
    match = re.search(r"\(i\)\s*Ground Rent\s*:?\s*([0-9,.]+)", text)
    if match:
        try:
            return str(float(match.group(1).replace(',', '')))
        except ValueError:
            return ""
    return ""

def extract_administrative_charge_from_text(text):
    import re
    match = re.search(r"\(ii\)\s*Administrative Charge\s*:?\s*([0-9,.]+)", text)
    if match:
        try:
            return str(float(match.group(1).replace(',', '')))
        except ValueError:
            return ""
    return ""

def extract_supervision_charges_from_text(text):
    # MCGM: Not applicable, return blank
    return ""

def extract_chamber_fee_from_text(text):
    # MCGM: Not applicable, return blank
    return ""

def extract_gst_from_text(text):
    # MCGM: Not applicable, return blank (use other GST extractors if needed)
    return ""

def extract_multiplication_factor_from_tables(tables):
    def normalize(s):
        return s.replace('\n', '').replace(' ', '').lower()
    factors = []
    for idx, table in enumerate(tables):
        df = table.df
        for col_idx, col_name in enumerate(df.iloc[0]):
            if "multiplyingfactor" in normalize(col_name):
                for i in range(2, len(df)):
                    val = df.iloc[i, col_idx].replace('\n', '').replace(',', '').strip()
                    first_col = str(df.iloc[i, 0]).strip().lower()
                    # Only append if val is numeric, not 'Total', and first column is not empty or a summary
                    if val and "total" not in val.lower() and first_col and "total" not in first_col:
                        try:
                            float_val = float(val)
                            factors.append(val)
                        except ValueError:
                            continue
                break
    return ' / '.join(factors)

def extract_surface_wise_length_from_tables(tables):
    """
    Extracts the surface-wise lengths from Camelot tables for MCGM DNs.
    Returns a string like '135 / 5' (order as found in tables).
    """
    lengths = []
    for table in tables:
        df = table.df
        # Try to find the column index for 'Length' or 'Length in Mt.'
        length_col_idx = None
        for idx, col in enumerate(df.iloc[0]):
            if 'length' in col.lower():
                length_col_idx = idx
                break
        if length_col_idx is not None:
            # Find the first row after header that looks like a number
            for i in range(2, len(df)):
                val = df.iloc[i, length_col_idx].replace('\n', '').replace(',', '').strip()
                if val and val.replace('.', '', 1).isdigit():
                    lengths.append(val)
                    break
    return ' / '.join(lengths)

def non_refundable_request_parser(pdf_path, manual_values=None):
    """
    Main extraction logic for MCGM Non Refundable Request Parser.
    Uses comprehensive field mapping system.
    """
    doc = fitz.open(pdf_path)
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    tables = camelot.read_pdf(pdf_path, pages='1', flavor='lattice')
    
    # Extract all fields using existing functions
    demand_note_ref = extract_demand_note_reference(text)
    section_length = extract_section_length_from_tables(tables) or extract_section_length(text)
    dn_length = extract_section_length_from_tables(tables) or extract_section_length(text)
    gst_amount = extract_gst_amount_from_text(text)
    sd_amount = extract_sd_amount_from_text(text)
    row_app_date = extract_row_application_date(text)
    demand_note_date = extract_demand_note_date(text)
    received_date = demand_note_date
    diff_days = extract_difference_days(received_date)
    road_types = extract_road_types_from_tables(tables)
    rate_in_rs = extract_rate_in_rs_from_tables(tables)
    covered_under_capping = extract_covered_under_capping(text, tables)
    not_part_of_capping = extract_not_part_of_capping(text, tables)
    surface_wise_length = extract_surface_wise_length_from_tables(tables)
    multiplying_factor = extract_multiplication_factor_from_tables(tables)
    
    # Extract route_id_site_id from demand note reference (remove decimals)
    route_id_site_id = ""
    if demand_note_ref:
        try:
            # Extract the site ID part from the demand note reference
            # MCGM format: usually contains site ID in the reference
            import re
            # Look for patterns like MU-XXXX or similar
            site_id_match = re.search(r'MU-(\d+)', demand_note_ref)
            if site_id_match:
                route_id_site_id = site_id_match.group(1)
            else:
                # Fallback: use the demand note reference number
                route_id_site_id = str(int(float(demand_note_ref.replace(",", ""))))
        except (ValueError, TypeError):
            route_id_site_id = demand_note_ref
    
    # Remove decimals from demand_note_ref (dn_number)
    if demand_note_ref:
        try:
            # Convert to float and then to int to remove decimals
            dn_number_clean = str(int(float(demand_note_ref.replace(",", ""))))
        except (ValueError, TypeError):
            dn_number_clean = demand_note_ref
    else:
        dn_number_clean = ""
    
    # Build extracted fields dict with standard field names
    extracted_fields = {
        "route_id_site_id": route_id_site_id,  # Add route_id_site_id
        "dn_number": dn_number_clean,  # Use cleaned version without decimals
        "dn_received_date": demand_note_date,
        "Section Length": section_length,  # Use display name that frontend expects
        "ot_length": dn_length,  # Use DN length for Total Route (MTR)
        "surface": road_types,  # Map to 'surface' so frontend can convert to 'Road Types - CC/BT/TILES/ Normal Soil/kacha'
        "Surface-wise RI Amount": rate_in_rs,  # Use display name that frontend expects
        "surface_wise_length": surface_wise_length,
        "RI Amount": covered_under_capping,  # Use display name that frontend expects
        "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)": not_part_of_capping,  # Use display name
        "Covered under capping (Restoration Charges, admin, registration etc.)": covered_under_capping,  # Use display name
        "Supervision Charges": "",  # MCGM doesn't extract this
        "Chamber Fee": "",  # MCGM doesn't extract this
        "GST Amount": gst_amount,  # Use display name that frontend expects
        "SD Amount": sd_amount,  # Use display name that frontend expects
        "Total DN Amount ( NON REFUNDABLE+SD+ BG+ GST) To be filled by helpdesk team": extract_total_dn_amount({
            "SD Amount": sd_amount,
            "Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')": str(float(covered_under_capping or 0) + float(not_part_of_capping or 0))
        }),
        "no_of_pits": "",  # MCGM doesn't extract this
        "pit_ri_rate": "",  # MCGM doesn't extract this
        "road_name": "",  # MCGM doesn't extract this
        "Surface-wise Multiplication Factor": multiplying_factor,  # Use display name that frontend expects
        "GO RATE": rate_in_rs,  # Use display name that frontend expects
        # ri_budget_amount_per_meter will be calculated dynamically by the frontend
    }
    
    # Calculate the non-refundable cost (sum of covered under capping + not part of capping)
    non_refundable_cost = str(float(covered_under_capping or 0) + float(not_part_of_capping or 0))
    
    # Calculate additional calculated fields
    try:
        # ri_budget_amount_per_meter will be calculated by the frontend
        dn_length_mtr = float(extracted_fields.get("Section Length", 0) or 0)  # Use correct field name
        actual_total_non_refundable = float(non_refundable_cost or 0)
        
        # projected_budget_ri_amount_dn and non_refundable_amount_per_mtr will be calculated by the frontend
        # based on the dynamic ri_budget_amount_per_meter value
        
        # Add calculated fields to extracted_fields (these will be overridden by frontend calculations)
        extracted_fields["actual_total_non_refundable"] = str(actual_total_non_refundable)
        
        # Debug: Print calculated values
        print(f"[MCGM DEBUG] dn_length_mtr (Section Length): {dn_length_mtr}")
        print(f"[MCGM DEBUG] actual_total_non_refundable: {actual_total_non_refundable}")
        print(f"[MCGM DEBUG] Note: ri_budget_amount_per_meter, projected_budget_ri_amount_dn, and non_refundable_amount_per_mtr will be calculated by frontend")
    except (ValueError, TypeError, ZeroDivisionError) as e:
        print(f"[MCGM DEBUG] Error calculating fields: {e}")
        extracted_fields["actual_total_non_refundable"] = non_refundable_cost
    
    # Debug: Print extracted values for missing fields
    print(f"[MCGM DEBUG] demand_note_ref (original): '{demand_note_ref}'")
    print(f"[MCGM DEBUG] dn_number_clean: '{dn_number_clean}'")
    print(f"[MCGM DEBUG] route_id_site_id: '{route_id_site_id}'")
    print(f"[MCGM DEBUG] demand_note_date: '{demand_note_date}'")
    print(f"[MCGM DEBUG] road_types (surface): '{road_types}'")
    print(f"[MCGM DEBUG] rate_in_rs: '{rate_in_rs}'")
    print(f"[MCGM DEBUG] multiplying_factor: '{multiplying_factor}'")
    print(f"[MCGM DEBUG] covered_under_capping: '{covered_under_capping}'")
    
    # Add hardcoded values that should be present in non-refundable output
    # These need to be in the display name format that the frontend expects
    hardcoded_values = {
        "Intercity/Intracity- Deployment Intercity/intracity- O&M FTTH- Deployment FTTH-O&M": "Intercity/Intracity - Deployment",
        "BUSINESS UNIT": "TNL-FF-Maharashtra",
        "Circle": "MUM",
        "City": "MUM",
        "LM/BB/FTTH": "Intercity/Intracity - Deployment",
        "Type (UG/OH)": "UG",
        "Capping/Non Capping": "Non capping",
        "UG TYPE( HDD/ OT/ MICROTRENCHING)": "OT",
        "Cost type with Cost Breakup EG.. - PROCESING FEES/ SUPERVISOIN CHARGE/ ADMIN FEES/ LICENSE FEES etc etc.": "Restoration Charges",
        "Authority( email address)": "dyche.rdplg@mcgm.gov.in",
        "Authority": "MUNICIPAL CORPORATION OF GREATER MUMBAI",
        "BENEFICIERY NAME": "MUNICIPAL CORPORATION OF GREATER MUMBAI",
        "Mode of payment(DD/ONLINE-URL/ONLINE-NEFT/BHARATKOSH": "ONLINE-NEFT",
        "EXECUTION PARTNER NAME": "Excel Telesonic India Private Limited",
        "Payable (Authority) Location": "Mumbai",
        "Printing Location": "Mumbai",
        "Cost type(restoration/ supervison/ agency changes/ admin etc)": "Restoration Charges",
        "Permission Type (Primary/ Secondary)": "Primary",
        "Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')": non_refundable_cost,
        "ROW APPLICATION  DATE": row_app_date,
        "Demand Note Date": demand_note_date,
        "Difference from, DN date  - DN Sent to Central team (ARTL)": diff_days,
        "Section Length (Mtr.)": section_length  # Use total length for non-refundable table
    }
    
    # Merge extracted fields with hardcoded values
    extracted_fields.update(hardcoded_values)
    
    # Import the comprehensive field mapping
    from constants.comprehensive_field_mapping import map_parser_to_standard, convert_standard_to_table, ensure_all_fields_present
    
    # Map parser fields to standard field names
    standard_fields = map_parser_to_standard(extracted_fields, "mcgm")
    
    # Convert to validation table format (with display names)
    validation_result = convert_standard_to_table(standard_fields, "validation")
    
    # Ensure all required fields are present
    validation_result = ensure_all_fields_present(validation_result, "validation")
    
    # Apply manual values if provided
    if manual_values:
        validation_result.update(manual_values)
    
    # Print comprehensive field mapping for Non-Refundable table
    print("\n" + "="*80)
    print("MCGM NON-REFUNDABLE TABLE - COMPLETE FIELD MAPPING")
    print("="*80)
    
    # Import the comprehensive field mapping to get all required fields
    from constants.comprehensive_field_mapping import ALL_NON_REFUNDABLE_FIELDS
    
    # Convert standard_fields to non-refundable table format
    non_refundable_result = convert_standard_to_table(standard_fields, "non_refundable")
    non_refundable_result = ensure_all_fields_present(non_refundable_result, "non_refundable")
    
    # Merge hardcoded values directly into the result
    non_refundable_result.update(hardcoded_values)
    
    # Show every field in the non-refundable table
    for field in ALL_NON_REFUNDABLE_FIELDS:
        value = non_refundable_result.get(field, "")
        if value:
            print(f"✓ {field}: {value}")
        else:
            print(f"✗ {field}: (blank)")
    
    print("="*80 + "\n")
    
    return non_refundable_result

def sd_parser(pdf_path, manual_values=None):
    """
    SD Parser for MCGM Type 1: outputs a 20-column, 2-row Excel with static headers and mapped row values.
    """
    alt_headers = [
        "SD OU Circle Name", "Execution Partner Vendor Code", "Execution Partner Vendor Name", "Execution Partner GBPA PO No.",
        "GIS Code", "M6 Code", "Locator ID", "Mother Work Order", "Child Work Order", "FA Location", "Partner PO circle",
        "Unique route id", "Supplier Code", "Supplier site name", "NFA no.", "Payment type", "DN No", "DN Date", "SD Amount", "SD Time Period"
    ]
    row_main = non_refundable_request_parser(pdf_path)
    def get_main(header):
        try:
            return row_main.get(header, "")
        except Exception:
            return ""
    row = [
        "TNL-FF-Maharashtra",  # SD OU Circle Name
        "632607",               # Execution Partner Vendor Code
        "Excel Telesonic India Private Limited",  # Execution Partner Vendor Name
        "",                     # Execution Partner GBPA PO No.
        "",                     # GIS Code
        "",                     # M6 Code
        "61027-IP01-2948564-CONT1210",  # Locator ID
        "",                     # Mother Work Order
        "",                     # Child Work Order
        "Mumbai",               # FA Location
        "",                     # Partner PO circle
        "",                     # Unique route id
        "",                     # Supplier Code
        "",                     # Supplier site name
        "",                     # NFA no.
        "ONLINE-NEFT",          # Payment type
        get_main("Demand Note Reference number"),  # DN No
        get_main("Demand Note Date"),              # DN Date
        get_main("SD Amount"),                     # SD Amount
        "2 Years"               # SD Time Period
    ]
    # Apply manual values if provided
    if manual_values:
        for field, value in manual_values.items():
            if field in alt_headers:
                idx = alt_headers.index(field)
                row[idx] = value
    
    # Print comprehensive field mapping for SD table
    print("\n" + "="*80)
    print("MCGM SD TABLE - COMPLETE FIELD MAPPING")
    print("="*80)
    
    # Import the comprehensive field mapping to get all required fields
    from constants.comprehensive_field_mapping import ALL_SD_FIELDS
    
    # Create the complete SD row data
    sd_data = {}
    for i, header in enumerate(alt_headers):
        sd_data[header] = row[i] if i < len(row) else ""
    
    # Show every field in the SD table
    for field in ALL_SD_FIELDS:
        value = sd_data.get(field, "")
        if value:
            print(f"✓ {field}: {value}")
        else:
            print(f"✗ {field}: (blank)")
    
    print("="*80 + "\n")
    
    return alt_headers, row

def extract_all_fields_for_testing(pdf_path):
    import fitz
    import camelot
    doc = fitz.open(pdf_path)
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    tables = camelot.read_pdf(pdf_path, pages='1', flavor='lattice')
    results = {
        "Demand Note Reference number": extract_demand_note_reference(text),
        "Section Length": extract_section_length_from_tables(tables),
        "GST Amount": extract_gst_amount(text),
        "GST Amount (from text)": extract_gst_amount_from_text(text),
        "SD Amount": extract_sd_amount_from_text(text),
        "ROW APPLICATION  DATE": extract_row_application_date(text),
        "DN Received Date": extract_row_application_date(text),
        "Demand Note Date": extract_demand_note_date(text),
        "Difference Days": extract_difference_days(extract_demand_note_date(text)),
        "Total DN Amount": extract_total_dn_amount({
            "SD Amount": extract_sd_amount_from_text(text),
            "Non Refundable Cost( Amount to process for payment shold be sum of 'Z' and 'AA' coulm )": extract_covered_under_capping(text, tables)
        }),
        "Road Types": extract_road_types_from_tables(tables),
        "Surface-wise RI Amount": extract_rate_in_rs_from_tables(tables),
        "Covered under capping": extract_covered_under_capping(text, tables),
        "Not part of capping": extract_not_part_of_capping(text, tables),
        "Non Refundable Cost": extract_covered_under_capping(text, tables),
        "RI Amount": extract_ri_from_tables(tables),
        "Ground Rent": extract_ground_rent_from_text(text),
        "Administrative Charge": extract_administrative_charge_from_text(text),
        "Supervision Charges": extract_supervision_charges_from_text(text),
        "Chamber Fee": extract_chamber_fee_from_text(text),
        "GST (custom)": extract_gst_from_text(text),
        "Surface-wise Multiplication Factor": extract_multiplication_factor_from_tables(tables),
        # Extra fields for validation table only (not in main output row):
        "surface_wise_length": extract_surface_wise_length_from_tables(tables),
        # Add more extra fields here as needed
    }
    print("\n" + "*"*60)

    print("*"*60 + "\n")
    return results