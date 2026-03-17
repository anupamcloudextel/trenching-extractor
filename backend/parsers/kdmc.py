# KDMC Parser Scaffold
# This file is structured identically to nmmc.py, but extraction logic and regexes must be adapted for KDMC DNs.
# TODO: Implement KDMC-specific extraction logic in each function.

import fitz  # PyMuPDF
import camelot
import re
import datetime
import numpy as np
from pdf2image import convert_from_path
import cv2
import pytesseract
from PIL import Image
import os
import hashlib
import time
import math

ALL_HEADERS = [
    # TODO: Update headers for KDMC if different
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
    # TODO: Update static values for KDMC if different
    "Intercity/Intracity- Deployment Intercity/intracity- O&M FTTH- Deployment FTTH-O&M": "Intercity/Intracity - Deployment",
    "BUSINESS UNIT": "TNL-FF-Maharashtra",
    "Circle": "MUM",
    "City": "MUM",
    "Capping/Non Capping": "Non capping",
    "Cost type with Cost Breakup EG.. - PROCESING FEES/ SUPERVISOIN CHARGE/ ADMIN FEES/ LICENSE FEES etc etc.": "Restoration Charges",
    "Authority( email address)": "ce.kdmc@gmail.com",
    "Authority": "Kalyan Dombivli Municipal Corporation",
    "BENEFICIERY NAME": "Kalyan Dombivli Municipal Corporation",
    "Mode of payment(DD/ONLINE-URL/ONLINE-NEFT/BHARATKOSH": "DD",
    "EXECUTION PARTNER NAME": "Excel Telesonic India Private Limited",
    "Payable (Authority) Location": "Kalyan Dombivli",
    "Cost type(restoration/ supervison/ agency changes/ admin etc)": "Restoration Charges",
    "Permission Type (Primary/ Secondary)": "Primary",
    "Type (UG/OH)": "UG",
}

# Print the Tesseract executable path for user reference
print('Tesseract executable path:', pytesseract.pytesseract.tesseract_cmd)

# Explicitly set the Tesseract executable path to the correct location
pytesseract.pytesseract.tesseract_cmd = r'C:\Users\SashwatRavishankar\AppData\Local\Programs\Tesseract-OCR\tesseract.exe'

# --- Extraction Functions (placeholders) ---

def extract_section_length(text):
    """TODO: Implement KDMC-specific section length extraction."""
    pass

def extract_difference_days(received_date):
    """TODO: Implement difference in days calculation."""
    pass

def extract_ground_rent(text, pdf_path=None):
    """TODO: Implement ground rent extraction."""
    pass

def extract_administrative_charge(text):
    """TODO: Implement administrative charge extraction."""
    pass

def extract_multiplication_factor(text):
    """TODO: Implement multiplication factor extraction."""
    pass

def extract_surface_wise_length(text):
    """TODO: Implement surface-wise length extraction."""
    pass

def normalize_key(key):
    return ''.join(key.lower().split())

def extract_ri_from_table_rows(rows):
    """TODO: Implement RI extraction from table rows."""
    pass

def marathi_to_english_digits(s):
    marathi_digits = '०१२३४५६७८९'
    english_digits = '0123456789'
    trans = str.maketrans(marathi_digits, english_digits)
    result = s.translate(trans)
    print(f"[MARATHI CONVERSION DEBUG] '{s}' -> '{result}'")
    return result

def extract_dn_date_from_text(text, start_idx=0):
    """
    Extracts the DN date from KDMC text. Looks for 'दिनांक' followed by a date (Marathi or English numerals).
    Returns the date in DD/MM/YYYY format, or '' if not found.
    Optionally starts searching from a given line index.
    """
    import re
    def normalize_date(date_str):
        # Remove all trailing non-digit, non-date chars (including Unicode)
        date_str = re.sub(r'[^०१२३४५६७८९0-9/\- .]', '', date_str)
        date_str = date_str.strip('. ।|,;: ')
        # Convert Marathi digits to English
        date_str = marathi_to_english_digits(date_str)
        # Replace -, ., or space with /
        date_str = re.sub(r"[-. ]", "/", date_str)
        # Remove any non-digit or non-slash
        date_str = re.sub(r"[^0-9/]", "", date_str)
        # Ensure DD/MM/YYYY format
        parts = date_str.split("/")
        if len(parts) == 3:
            dd, mm, yyyy = parts
            if len(yyyy) == 2:
                yyyy = "20" + yyyy  # crude fix for 2-digit years
            normalized = f"{dd.zfill(2)}/{mm.zfill(2)}/{yyyy}"
            return normalized
        return date_str
    # FIXED: dash is at the start of the class
    date_regex = r"दिनांक[^०१२३४५६७८९0-9]*([०१२३४५६७८९0-9]{1,2}[.\-/ ]{1}[०१२३४५६७८९0-9]{1,2}[.\-/ ]{1}[०१२३४५६७८९0-9]{2,4})"
    lines = text.splitlines()
    for i in range(start_idx, len(lines)):
        match = re.search(date_regex, lines[i])
        if match:
            date_str = match.group(1)
            return normalize_date(date_str)
    # Fallback: search whole text
    match = re.search(date_regex, text)
    if match:
        date_str = match.group(1)
        return normalize_date(date_str)
    return ''

def extract_rate_per_meter_from_text(pages_texts):
    """
    Extract rate per meter from KDMC OCR text.
    Look for lines with 'केबल' context and extract rates from subsequent lines.
    Returns a '/'-separated string of rates, preserving order.
    """
    import re
    ordered_rates = []
    
    for page_num, text in enumerate(pages_texts):
        lines = text.splitlines()
        for i, line in enumerate(lines):
            # Look for context line with 'केबल'
            if 'केबल' in line and 'मीटर' in line:
                # Try to find rate in the same line
                rate_match = re.search(r'(\d+\.?\d*)\s*रु\.', line)
                if rate_match:
                    rate = rate_match.group(1)
                    if rate not in ordered_rates:
                        ordered_rates.append(rate)
                # Also check next few lines for rates
                for j in range(1, 4):
                    if i + j < len(lines):
                        next_line = lines[i + j]
                        rate_match = re.search(r'(\d+\.?\d*)\s*रु\.', next_line)
                        if rate_match:
                            rate = rate_match.group(1)
                            if rate not in ordered_rates:
                                ordered_rates.append(rate)
    
    return ' / '.join(ordered_rates) if ordered_rates else ''

def extract_section_length_from_text(pages_texts):
    """
    Extract section length from KDMC OCR text.
    Look for lines with 'लांबीच्या रस्त्यांच्या कामासाठी' context and extract the length value.
    Returns the length as a string with English digits.
    """
    import re
    
    for page_num, text in enumerate(pages_texts):
        lines = text.splitlines()
        for i, line in enumerate(lines):
            # Look for context with 'लांबीच्या रस्त्यांच्या कामासाठी' (length of roads for work)
            if 'लांबीच्या रस्त्यांच्या कामासाठी' in line:
                # Extract length from the same line or next few lines
                for j in range(0, 3):  # Check current line and next 2 lines
                    check_line = lines[i + j] if i + j < len(lines) else ""
                    
                    # Look for pattern: X मी. or X मीटर (with Marathi or English digits)
                    length_match = re.search(r'([०१२३४५६७८९0-9]+\.?[०१२३४५६७८९0-9]*)\s*मी\.?', check_line)
                    if length_match:
                        raw_length = length_match.group(1)
                        length = marathi_to_english_digits(raw_length)
                        print(f"[SECTION LENGTH DEBUG] Found length: {raw_length} -> {length}")
                        return length
                    
                    # Also look for pattern: X मीटर
                    length_match = re.search(r'([०१२३४५६७८९0-9]+\.?[०१२३४५६७८९0-9]*)\s*मीटर', check_line)
                    if length_match:
                        raw_length = length_match.group(1)
                        length = marathi_to_english_digits(raw_length)
                        print(f"[SECTION LENGTH DEBUG] Found length: {raw_length} -> {length}")
                        return length
    
    # Fallback: look for any line with मी. or मीटर and a number
    for page_num, text in enumerate(pages_texts):
        lines = text.splitlines()
        for line in lines:
            # Look for any number followed by मी. or मीटर
            length_match = re.search(r'([०१२३४५६७८९0-9]+\.?[०१२३४५६७८९0-9]*)\s*मी\.?', line)
            if length_match:
                raw_length = length_match.group(1)
                length = marathi_to_english_digits(raw_length)
                print(f"[SECTION LENGTH DEBUG] Fallback found length: {raw_length} -> {length}")
                return length
            
            length_match = re.search(r'([०१२३४५६७८९0-9]+\.?[०१२३४५६७८९0-9]*)\s*मीटर', line)
            if length_match:
                raw_length = length_match.group(1)
                length = marathi_to_english_digits(raw_length)
                print(f"[SECTION LENGTH DEBUG] Fallback found length: {raw_length} -> {length}")
                return length
    
    return ''

def extract_total_dn_amount_from_text(pages_texts):
    """
    Extract total DN amount from KDMC OCR text.
    Look for 'Say' lines and extract the amount value.
    Returns the amount as a string.
    """
    import re
    
    for page_num, text in enumerate(pages_texts):
        lines = text.splitlines()
        for i, line in enumerate(lines):
            # Look for 'Say' line with amount
            if 'Say' in line or 'साय' in line:
                # Extract amount from the line
                amount_match = re.search(r'रु\.\s*([०१२३४५६७८९0-9,]+)', line)
                if amount_match:
                    amount = marathi_to_english_digits(amount_match.group(1).replace(',', ''))
                    return amount
                # Fallback: look for any number in the line
                amount_match = re.search(r'([०१२३४५६७८९0-9,]+)', line)
                if amount_match:
                    amount = marathi_to_english_digits(amount_match.group(1).replace(',', ''))
                    return amount
    
    return ''

def extract_ri_amount_from_text(pages_texts):
    """
    Extract RI amount from KDMC OCR text.
    Find SD amounts from lines after "सिक्युरिटी डिपॉझीट खोदाई शुल्कावर १०%" 
    and calculate RI as SD ÷ 0.10 (since SD is 10% of RI).
    
    Logic varies by table count:
    - 1 table: Skip 2 lines, take 3rd रु.X amount (1st=ground rent, 2nd=supervision, 3rd=SD)
    - 2+ tables: Take रु.X amount right after 10% line (SD is directly after)
    
    Returns the sum of all calculated RI amounts as a string.
    """
    import re
    
    ri_amounts = []

    
    # First, count how many tables we have by looking for "तक्ता क्र. :-"
    table_count = 0
    for page_num, text in enumerate(pages_texts):
        table_matches = re.findall(r'तक्ता क्र\. :- [अब]', text)
        table_count += len(table_matches)
    

    
    for page_num, text in enumerate(pages_texts):
        lines = text.splitlines()
        for i, line in enumerate(lines):
            # Look for SD lines: "सिक्युरिटी डिपॉझीट खोदाई शुल्कावर १०%"
            if 'सिक्युरिटी डिपॉझीट' in line and '१०%' in line:
                print(f"[RI DEBUG] Found SD line {i+1} on page {page_num+1}: {line}")
                
                if table_count == 1:
                    # Single table logic: Skip 2 lines, take 3rd रु.X amount
                    print(f"[RI DEBUG] Single table logic: Skip 2 lines, take 3rd रु.X amount")
                    ru_amounts_found = []
                    for j in range(1, 16):
                        if i + j < len(lines):
                            next_line = lines[i + j]
                            print(f"[RI DEBUG] Checking line {i+j+1}: {next_line}")
                            
                            # Look for ALL रु.X amounts in this line
                            ru_matches = re.findall(r'रु\.([०१२३४५६७८९0-9,]+\.?[०१२३४५६७८९0-9]*)', next_line)
                            for ru_match in ru_matches:
                                try:
                                    amount = float(marathi_to_english_digits(ru_match.replace(',', '')))
                                    ru_amounts_found.append(amount)
                                    print(f"[RI DEBUG] Found रु amount: {ru_match} -> {amount}")
                                except (ValueError, AttributeError) as e:
                                    print(f"[RI DEBUG] ✗ Error parsing रु amount: {e}")
                    
                    # Take the THIRD रु amount as SD (1st=ground rent, 2nd=supervision, 3rd=SD)
                    if len(ru_amounts_found) >= 3:
                        sd_amount = ru_amounts_found[2]  # Third amount
                        # Calculate RI as SD ÷ 0.10 (since SD is 10% of RI)
                        ri_amount = round(sd_amount / 0.10, 2)
                        ri_amounts.append(ri_amount)
                        print(f"[RI DEBUG] ✓ Selected SD (3rd रु amount): {sd_amount}")
                        print(f"[RI DEBUG] ✓ Calculated RI: {sd_amount} ÷ 0.10 = {ri_amount}")
                    elif len(ru_amounts_found) == 2:
                        print(f"[RI DEBUG] ⚠ Only found 2 रु amounts, might be incomplete: {ru_amounts_found}")
                    elif len(ru_amounts_found) == 1:
                        print(f"[RI DEBUG] ⚠ Only found 1 रु amount, might be incomplete: {ru_amounts_found}")
                    else:
                        print(f"[RI DEBUG] ✗ No रु amounts found after SD line")
                
                else:
                    # Multiple tables logic: Take रु.X amount right after 10% line
                    print(f"[RI DEBUG] Multiple tables logic: Take रु.X amount right after 10% line")
                    for j in range(1, 4):  # Check next 3 lines
                        if i + j < len(lines):
                            next_line = lines[i + j]
                            print(f"[RI DEBUG] Checking line {i+j+1}: {next_line}")
                            
                            # Look for रु.X amount in this line
                            sd_match = re.search(r'रु\.([०१२३४५६७८९0-9,]+\.?[०१२३४५६७८९0-9]*)', next_line)
                            if sd_match:
                                try:
                                    sd_amount = float(marathi_to_english_digits(sd_match.group(1).replace(',', '')))
                                    # Calculate RI as SD ÷ 0.10 (since SD is 10% of RI)
                                    ri_amount = round(sd_amount / 0.10, 2)
                                    ri_amounts.append(ri_amount)
                                    print(f"[RI DEBUG] ✓ Found SD right after 10%: {sd_match.group(1)} -> {sd_amount}")
                                    print(f"[RI DEBUG] ✓ Calculated RI: {sd_amount} ÷ 0.10 = {ri_amount}")
                                    break
                                except (ValueError, AttributeError) as e:
                                    print(f"[RI DEBUG] ✗ Error parsing SD amount: {e}")
    
    total_ri = round(sum(ri_amounts), 2)
    print(f"[RI DEBUG] Found SD amounts and calculated RI amounts: {ri_amounts}")
    print(f"[RI DEBUG] Total RI amount: {total_ri}")
    print("="*60 + "\n")
    return str(total_ri) if total_ri > 0 else ''

def extract_security_deposit_from_text(pages_texts):
    """
    Extract security deposit from KDMC OCR text.
    Calculate as 10% of RI amount.
    Returns the SD amount as a string.
    """
    ri_amount = extract_ri_amount_from_text(pages_texts)
    if ri_amount:
        try:
            ri_val = float(ri_amount)
            sd_amount = ri_val * 0.10
            return f"{sd_amount:.2f}"
        except ValueError:
            pass
    return ''

def extract_supervision_charges_from_text(pages_texts):
    """
    Extract supervision charges from KDMC OCR text.
    Calculate as 15% of RI amount.
    Returns the supervision charges as a string.
    """
    ri_amount = extract_ri_amount_from_text(pages_texts)
    if ri_amount:
        try:
            ri_val = float(ri_amount)
            supervision_amount = ri_val * 0.15
            return f"{supervision_amount:.2f}"
        except ValueError:
            pass
    return ''

def extract_non_refundable_from_values(supervision_charges, ri_amount, not_part_of_capping):
    """
    Calculate non-refundable amount from supervision charges, RI amount, and not part of capping.
    Returns the result as a string with 2 decimals.
    """
    try:
        supervision = float(supervision_charges) if supervision_charges else 0
        ri = float(ri_amount) if ri_amount else 0
        npc = float(not_part_of_capping) if not_part_of_capping else 0
        result = supervision + ri + npc
        return f"{result:.2f}"
    except ValueError:
        return ''

def extract_row_application_date_from_text(pages_texts):
    """
    Extract row application date from KDMC OCR text.
    Look for lines with 'अर्ज' and extract the date.
    Returns the date as a string in DD/MM/YYYY format.
    """
    import re
    
    for page_num, text in enumerate(pages_texts):
        lines = text.splitlines()
        for i, line in enumerate(lines):
            # Look for line with 'अर्ज' and date
            if 'अर्ज' in line:
                # Extract date from the line
                date_match = re.search(r'दि\.\s*([०१२३४५६७८९0-9\s/]+)', line)
                if date_match:
                    raw_date = date_match.group(1).strip()
                    # Convert Marathi digits to English
                    normalized = marathi_to_english_digits(raw_date)
                    # Clean up the date format
                    normalized = re.sub(r'\s+', '', normalized)
                    if re.match(r'\d{1,2}/\d{1,2}/\d{4}', normalized):
                        return normalized
                    # Try to format the date
                    parts = re.findall(r'\d+', normalized)
                    if len(parts) >= 3:
                        day, month, year = parts[:3]
                        return f"{day.zfill(2)}/{month.zfill(2)}/{year}"
    
    return ''

def extract_rent_from_text(not_part_of_capping):
    """
    Extract rent from not_part_of_capping value.
    Returns the rent value as a string.
    """
    return not_part_of_capping if not_part_of_capping else ''

def extract_kdmc_all_fields(pdf_path):
    """
    Extracts all possible fields from the KDMC DN using robust OCR logic.
    Returns a dictionary with all fields that might be needed for any output table.
    """
    from pdf2image import convert_from_path
    import re
    pages = convert_from_path(pdf_path, dpi=300)
    dn_number = None
    dn_received_date = None
    road_types = ''
    pages_texts = []
    for page_num, page in enumerate(pages):
        text = google_vision_ocr(page, lang_hints=['en', 'mr'])
        pages_texts.append(text)
        lines = text.splitlines()
        if page_num == 0:
            # Only extract surface type from the first page
            road_types = extract_road_types_from_text(text)
        dn_number_line_idx = None
        # DN Number extraction (robust)
        dn_number_found = False
        for idx, line in enumerate(lines):
            # 1. Try strict pattern (with optional spaces, dots, slashes)
            strict_match = re.search(r'जा\.?क्र\.?\s*[\.:]?\s*कडोंमपा\s*/?\s*काअ\s*/?\s*बांध\s*/?\s*कवि\s*/?\s*([०१२३४५६७८९0-9]+)', line)
            if strict_match and not dn_number_found:
                marathi_number = strict_match.group(1)
                english_number = marathi_to_english_digits(marathi_number)
                dn_number = f"KDMC/Ex.Engg/Construction/K-W/{english_number}"
                dn_number_line_idx = idx
                dn_number_found = True
                break
        # 2. Fallback: any line with 'जा.क्र.' and a number after
        if not dn_number_found:
            for idx, line in enumerate(lines):
                loose_match = re.search(r'जा\.?क्र\.?[^०१२३४५६७८९0-9]*([०१२३४५६७८९0-9]+)', line)
                if loose_match:
                    marathi_number = loose_match.group(1)
                    english_number = marathi_to_english_digits(marathi_number)
                    dn_number = f"KDMC/Ex.Engg/Construction/K-W/{english_number}"
                    dn_number_line_idx = idx
                    dn_number_found = True
                    break
        # DN Date extraction: search after DN number line if found
        if dn_number_line_idx is not None and not dn_received_date:
            dn_received_date = extract_dn_date_from_text(text, start_idx=dn_number_line_idx+1)
        # Fallback: search whole text
        if not dn_received_date:
            dn_received_date = extract_dn_date_from_text(text)
    fields = {}
    if dn_number:
        fields['dn_number'] = dn_number
    if dn_received_date:
        fields['dn_received_date'] = dn_received_date
    # Keep trench type blank for manual entry
    fields['ug_type'] = ''
    # Keep OT length blank for manual entry
    fields['ot_length'] = ''
    # Add road types to output fields
    fields['surface'] = road_types
    # Add rate per meter to output fields (from all pages)
    rate_per_meter = extract_rate_per_meter_from_text(pages_texts)
    fields['rate_per_meter'] = ''  # Leave blank for now
    # Add section length to output fields
    section_length = extract_section_length_from_text(pages_texts)
    fields['section_length'] = section_length
    # Add not part of capping (200 * section_length)
    not_part_of_capping = ''
    try:
        if section_length:
            length_val = float(section_length)
            not_part_of_capping = f"{length_val * 200:.2f}" if not (length_val * 200).is_integer() else str(int(length_val * 200))
    except Exception as e:
        pass
    fields['not_part_of_capping'] = not_part_of_capping
    # Add total DN amount to output fields
    total_dn_amount = extract_total_dn_amount_from_text(pages_texts)
    fields['total_dn_amount'] = total_dn_amount
    # Add security deposit (SD) to output fields
    security_deposit = extract_security_deposit_from_text(pages_texts)
    fields['security_deposit'] = security_deposit
    # Add supervision charges to output fields (15% of RI)
    supervision_charges = extract_supervision_charges_from_text(pages_texts)
    fields['supervision_charges'] = supervision_charges
    # Add non-refundable to output fields (supervision + RI + not_part_of_capping)
    non_refundable = extract_non_refundable_from_values(supervision_charges, extract_ri_amount_from_text(pages_texts), not_part_of_capping)
    fields['non_refundable'] = non_refundable
    # --- Add covered_under_capping: non_refundable - not_part_of_capping (rounded up) ---
    covered_under_capping = ''
    print(f"[ADMINISTRATIVE CHARGE DEBUG] Starting calculation...")
    print(f"[ADMINISTRATIVE CHARGE DEBUG] non_refundable: '{non_refundable}'")
    print(f"[ADMINISTRATIVE CHARGE DEBUG] not_part_of_capping: '{not_part_of_capping}'")
    print(f"[ADMINISTRATIVE CHARGE DEBUG] supervision_charges: '{supervision_charges}'")
    print(f"[ADMINISTRATIVE CHARGE DEBUG] ri_amount: '{extract_ri_amount_from_text(pages_texts)}'")
    
    try:
        if non_refundable and not_part_of_capping:
            covered = float(non_refundable) - float(not_part_of_capping)
            import math
            covered_under_capping = str(int(math.ceil(covered)))
            print(f"[ADMINISTRATIVE CHARGE DEBUG] ✓ Calculated: {non_refundable} - {not_part_of_capping} = {covered_under_capping}")
        else:
            print(f"[ADMINISTRATIVE CHARGE DEBUG] ✗ Missing values - non_refundable: {bool(non_refundable)}, not_part_of_capping: {bool(not_part_of_capping)}")
    except Exception as e:
        print(f"[ADMINISTRATIVE CHARGE DEBUG] ✗ Error calculating: {e}")
        pass
    fields['covered_under_capping'] = covered_under_capping
    
    # Keep administrative_charge blank for KDMC (as requested)
    fields['covered_under_capping'] = ''
    # Add row application date to output fields
    row_application_date = extract_row_application_date_from_text(pages_texts)
    fields['row_application_date'] = row_application_date
    # Set DN RECEIVED FROM PARTNER/AUTHORITY- DATE to be the same as demand note date
    dn_received_from_partner_date = fields.get('dn_received_date', '')
    fields['dn_received_from_partner_date'] = dn_received_from_partner_date
    # Calculate difference_days: number of days between today and dn_received_date
    import datetime
    dn_date_str = fields.get('dn_received_date', '')
    difference_days = ''
    if dn_date_str:
        try:
            dn_date = datetime.datetime.strptime(dn_date_str, '%d/%m/%Y').date()
            today = datetime.date.today()
            diff = (today - dn_date).days
            difference_days = str(diff)
        except Exception as e:
            difference_days = ''
    fields['difference_days'] = difference_days
    # Add rent to output fields (same as not_part_of_capping)
    rent = extract_rent_from_text(fields.get('not_part_of_capping', ''))
    fields['rent'] = rent
    # Add RI amount to output fields
    print(f"[DN_RI_AMOUNT DEBUG] Starting RI amount extraction...")
    ri_amount = extract_ri_amount_from_text(pages_texts)
    print(f"[DN_RI_AMOUNT DEBUG] Extracted ri_amount: '{ri_amount}'")
    fields['ri_amount'] = ri_amount
    # Add surface-wise length and RI amount (always set section_length if available)
    if section_length:
        fields['surface_wise_length'] = section_length
    else:
        fields['surface_wise_length'] = ''
    
    if ri_amount:
        fields['surface_wise_ri_amount'] = ri_amount
    else:
        fields['surface_wise_ri_amount'] = ''
    return fields

def google_vision_ocr(pil_img, lang_hints=None):
    try:
        import io
        # Import vision inside the function to avoid linter issues
        from google.cloud import vision as google_vision
        client = google_vision.ImageAnnotatorClient()
        buf = io.BytesIO()
        pil_img.save(buf, format='PNG')
        content = buf.getvalue()
        image = google_vision.Image(content=content)
        image_context = google_vision.ImageContext(language_hints=lang_hints or ['en', 'mr'])
        response = client.document_text_detection(image=image, image_context=image_context)
        if response.error.message:
            print("[GOOGLE VISION ERROR]", response.error.message)
            return ""
        return response.full_text_annotation.text
    except ImportError:
        print("[GOOGLE VISION] Google Cloud Vision not available, skipping OCR")
        return ""
    except Exception as e:
        print(f"[GOOGLE VISION ERROR] {e}")
        return ""


def debug_extract_kdmc_pdf(pdf_path):
    """
    Print Google Vision OCR and extracted fields. No OpenCV table extraction or table-like row printing.
    """
    from pdf2image import convert_from_path
    import re

    print(f"[KDMC DEBUG] Starting debug extraction for: {pdf_path}")
    pages = convert_from_path(pdf_path, dpi=300)
    for page_num, page in enumerate(pages):
        # Google Cloud Vision OCR
        print(f"\n--- GOOGLE VISION OCR PAGE {page_num+1} (mar+eng) ---")
        vision_text = google_vision_ocr(page, lang_hints=['en', 'mr'])
        print(vision_text)

    fields = extract_kdmc_all_fields(pdf_path)
    print(f"\n--- EXTRACTED FIELDS (WIP) ---\n{fields}\n")
    # Print the extracted DN date explicitly
    dn_date = fields.get('dn_received_date', '')
    print(f"[KDMC DEBUG] Extracted DN Date: {dn_date}\n")
    return None

# --- Add additional placeholder functions as needed, following the nmmc.py structure ---

def extract_road_types_from_text(text):
    """
    Extract road types from KDMC OCR text.
    Maps Marathi/English surface types to canonical English names.
    Returns a '/'-separated string of English road types.
    """
    import re
    
    # Canonical mapping for surface types
    surface_map = {
        'पेव्हर ब्लॉक': 'Paver Block',
        'पेवर ब्लॉक': 'Paver Block',
        'पेव्हरब्लॉक': 'Paver Block',
        'paver block': 'Paver Block',
        'paverblock': 'Paver Block',
        'ब्लॉक': 'Paver Block',
        'block': 'Paver Block',
        'डांबरी': 'Bituminous (Dambri)',
        'dambri': 'Bituminous (Dambri)',
        'bituminous': 'Bituminous (Dambri)',
        'bitumen': 'Bituminous (Dambri)',
        'asphalt': 'Bituminous (Dambri)',
        'concrete': 'Concrete',
        'cc': 'Concrete',
        'cement': 'Concrete',
        'soil': 'Normal Soil',
        'kacha': 'Normal Soil',
        'kachha': 'Normal Soil',
        'tiles': 'Tiles',
        'tile': 'Tiles',
    }
    
    ordered_types = []
    seen_types = set()
    
    # First try to find 'एकुण <type> रस्ता लांबी' pattern
    ekun_pattern = re.compile(r'एकुण\s+([^रस्ता]+)\s+रस्ता\s+लांबी')
    matches = ekun_pattern.findall(text)
    
    for match in matches:
        raw_type = match.strip()
        # Try to map the raw type
        mapped_type = None
        for key, val in surface_map.items():
            if key.lower() in raw_type.lower():
                mapped_type = val
                break
        if mapped_type and mapped_type not in seen_types:
            ordered_types.append(mapped_type)
            seen_types.add(mapped_type)
    
    # Fallback: search for surface types in any line
    if not ordered_types:
        lines = text.splitlines()
        for line in lines:
            for key, val in surface_map.items():
                if key.lower() in line.lower() and val not in seen_types:
                    ordered_types.append(val)
                    seen_types.add(val)
    
    return ' / '.join(ordered_types)

# --- KDMC Preview Table Column Lists and Mapping Dicts ---
# Use the exact same column headers as the frontend
PREVIEW_NON_REFUNDABLE_COLUMNS = [
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
    "dn_ri_amount",  # Add dn_ri_amount field to the columns list
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

PREVIEW_SD_COLUMNS = [
    "SD OU Circle Name", "Execution Partner Vendor Code", "Execution Partner Vendor Name", "Execution Partner GBPA PO No.",
    "GIS Code", "M6 Code", "Locator ID", "Mother Work Order", "Child Work Order", "FA Location", "Partner PO circle",
    "Unique route id", "Supplier Code", "Supplier site name", "NFA no.", "Payment type", "DN No", "DN Date", "SD Amount", "SD Time Period"
]

# Simple mapping from extracted field names to standard column names
KDMC_FIELD_MAPPING = {
    # Non-refundable fields - using actual extracted field names
    "dn_number": "Demand Note Reference number",
    "surface": "Road Types - CC/BT/TILES/ Normal Soil/kacha",
    "rate_per_meter": "Rate/mtr- Current DN (UG/OH)",
    "ug_type": "UG TYPE( HDD/ OT/ MICROTRENCHING)",
    "rent": "Annual Lease/ rent amount",
    "section_length": "Section Length (Mtr.)",
    "not_part_of_capping": "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)",
    "total_dn_amount": "Total DN Amount ( NON REFUNDABLE+SD+ BG+ GST) To be filled by helpdesk team",
    "security_deposit": "SD Amount",
    "non_refundable": "Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')",
    "covered_under_capping": "Covered under capping (Restoration Charges, admin, registration etc.)",
    "row_application_date": "ROW APPLICATION  DATE",
    "dn_received_date": "Demand Note Date",
    "dn_received_from_partner_date": "DN RECEIVED FROM PARTNER/AUTHORITY- DATE",
    "difference_days": "Difference from, DN date  - DN Sent to Central team (ARTL)",
    "ri_amount": "dn_ri_amount",  # Add missing mapping for ri_amount to dn_ri_amount
    
    # Additional mappings for fields that might be extracted
    "type_ug_oh": "Type (UG/OH)",
    "capping_non_capping": "Capping/Non Capping",
    "trench_type": "Type (UG/OH)",
    "ot_length": "OT Length",
    "hdd_pits": "HDD - Number of Pits",
    "oh_poles": "OH (EB Poles/MC Poles/Own Poles)",
    "no_of_poles": "NO OF POLES",
    "railway_crossing": "RAILWAY CROSSING/ PIPELINE CROSSING( No of crossing)",
    "go_rate": "GO RATE",
    "previous_dn_rate": "PREVIOUS DN RATE",
    "annual_rate_pole": "Annual Rate/Pole( current DN)",
    "hdd_pit_rate": "HDD(PIT RATE)",
    "total_route_mtr": "Total Route (MTR)",
    "railway_pipeline_crossing_rate": "RAILWAY/ PIPELINE/ EACH CROSSING RATE",
    "reason_current_rate_more": "Reason (Current rate is more than GO or Previous DN)",
    "renewal_lease_rent_date": "Renewal Lease/Rent date",
    "cost_type_breakup": "Cost type with Cost Breakup EG.. - PROCESING FEES/ SUPERVISOIN CHARGE/ ADMIN FEES/ LICENSE FEES etc etc.",
    "gst_amount": "GST Amount",
    "bg_amount": "BG Amount",
    "supplier_code": "Supplier Code( if team have) To be filled by helpdesk team",
    "supplier_site_name": "Supplier site name( if team have) To be filled by helpdesk team",
    "locator_code": "Locator Code (material)",
    "authority_email": "Authority( email address)",
    "authority": "Authority",
    "beneficiary_name": "BENEFICIERY NAME",
    "payment_mode": "Mode of payment(DD/ONLINE-URL/ONLINE-NEFT/BHARATKOSH",
    "execution_partner": "EXECUTION PARTNER NAME",
    "payable_location": "Payable (Authority) Location",
    "printing_location": "Printing Location",
    "po_no": "PO No.",
    "business_nfa_number": "Business NFA NUMBER (Approved CAF) To be filled by helpdesk team",
    "route_name": "Route Name(As per CWIP)",
    "section_name": "Section Name for ROW(As per CWIP)",
    "nsg_id_cwo_no": "NSG ID(As per CWIP)/CWO NO.",
    "total_amount_capping_mb_partner": "Total Amount as per capping MB(Partner Scope)",
    "cost_type_restoration": "Cost type(restoration/ supervison/ agency changes/ admin etc)",
    "total_amount_capping_mb_not_partner": "Total Amount as per capping MB(Not in Partner Scope)",
    "cost_type_way_leave": "Cost type (way leave charges/ rent/ license etc)",
    "permission_type": "Permission Type (Primary/ Secondary)",
    "additional_remarks": "Additional Remarks",
    
    # Default values for required fields
    "intercity_intracity": "Intercity/Intracity- Deployment Intercity/intracity- O&M FTTH- Deployment FTTH-O&M",
}

# Separate mapping for SD fields to avoid conflicts
KDMC_SD_FIELD_MAPPING = {
    "security_deposit": "SD Amount",
    "dn_number": "DN No",
    "dn_received_date": "DN Date",
    "row_application_date": "ROW APPLICATION  DATE",
    
    # Additional SD field mappings
    "sd_ou_circle_name": "SD OU Circle Name",
    "execution_partner_vendor_code": "Execution Partner Vendor Code",
    "execution_partner_vendor_name": "Execution Partner Vendor Name",
    "execution_partner_gbpa_po_no": "Execution Partner GBPA PO No.",
    "gis_code": "GIS Code",
    "m6_code": "M6 Code",
    "locator_id": "Locator ID",
    "mother_work_order": "Mother Work Order",
    "child_work_order": "Child Work Order",
    "fa_location": "FA Location",
    "partner_po_circle": "Partner PO circle",
    "unique_route_id": "Unique route id",
    "supplier_code": "Supplier Code",
    "supplier_site_name": "Supplier site name",
    "nfa_no": "NFA no.",
    "payment_type": "Payment type",
    "sd_time_period": "SD Time Period",
}

def map_kdmc_fields_to_standard_columns(extracted_fields):
    """
    Simple mapping function that maps all extracted KDMC fields to standard column names.
    Returns a dictionary with all standard column names, filling empty values for missing fields.
    """
    result = {}
    
    # Initialize all columns with empty values
    for col in PREVIEW_NON_REFUNDABLE_COLUMNS:
        result[col] = ""
    for col in PREVIEW_SD_COLUMNS:
        result[col] = ""
    
    # Add default values for KDMC authority
    result["Intercity/Intracity- Deployment Intercity/intracity- O&M FTTH- Deployment FTTH-O&M"] = "Intercity/Intracity - Deployment"
    result["BUSINESS UNIT"] = "TNL-FF-Maharashtra"
    result["Circle"] = "MUM"
    result["City"] = "MUM"
    result["Authority"] = "KALYAN DOMBIVLI MUNICIPAL CORPORATION"
    result["Authority( email address)"] = "ce.kdmc@gmail.com"
    result["BENEFICIERY NAME"] = "KALYAN DOMBIVLI MUNICIPAL CORPORATION"
    result["Mode of payment(DD/ONLINE-URL/ONLINE-NEFT/BHARATKOSH"] = "DD"
    result["EXECUTION PARTNER NAME"] = "Excel Telesonic India Private Limited"
    result["Payable (Authority) Location"] = "Kalyan"
    result["Printing Location"] = ""
    result["Capping/Non Capping"] = "Non capping"
    result["Type (UG/OH)"] = ""
    result["UG TYPE( HDD/ OT/ MICROTRENCHING)"] = ""
    result["Cost type with Cost Breakup EG.. - PROCESING FEES/ SUPERVISOIN CHARGE/ ADMIN FEES/ LICENSE FEES etc etc."] = "Restoration Charges"
    result["Cost type(restoration/ supervison/ agency changes/ admin etc)"] = "Restoration Charges"
    result["Permission Type (Primary/ Secondary)"] = "Primary"
    # Always blank for KDMC
    result["Annual Lease/ rent amount"] = ""
    
    print("[KDMC MAP] Set static values for KDMC authority")
    print("[KDMC MAP] Static values set:", {k: v for k, v in result.items() if v != ""})
    
    print("[KDMC MAP] Starting mapping for extracted fields:", list(extracted_fields.keys()))
    
    # Map extracted fields to standard column names
    for extracted_key, extracted_value in extracted_fields.items():
        if extracted_key in KDMC_FIELD_MAPPING:
            standard_column = KDMC_FIELD_MAPPING[extracted_key]
            # Always skip setting 'Annual Lease/ rent amount' from extracted fields
            if standard_column == "Annual Lease/ rent amount":
                continue
            if extracted_value not in [None, '', 'None']:
                result[standard_column] = extracted_value
                print(f"[KDMC MAP] Mapped '{extracted_key}' -> '{standard_column}' = '{extracted_value}'")
            else:
                print(f"[KDMC MAP] Skipped '{extracted_key}' -> '{standard_column}' (empty value: '{extracted_value}')")
        else:
            print(f"[KDMC MAP] No mapping found for '{extracted_key}' = '{extracted_value}'")
    
    print("[KDMC MAP] Final result keys:", list(result.keys()))
    return result

def map_kdmc_fields_to_sd_columns(extracted_fields):
    """
    Map KDMC extracted fields to standard SD columns.
    """
    result = {}
    
    # Map extracted fields to SD columns
    field_mapping = {
        'dn_number': 'DN No',
        'dn_received_date': 'DN Date',
        'security_deposit': 'SD Amount',
        'row_application_date': 'ROW APPLICATION  DATE',
    }
    
    for extracted_key, standard_column in field_mapping.items():
        extracted_value = extracted_fields.get(extracted_key, '')
        if extracted_value:
            result[standard_column] = extracted_value
    
    # Add hardcoded values for SD output
    hardcoded_values = {
        'SD OU Circle Name': 'TNL-FF-Maharashtra',
        'Execution Partner Vendor Code': '632607',
        'Execution Partner Vendor Name': 'Excel Telesonic India Private Limited',
        'Execution Partner GBPA PO No.': '',
        'GIS Code': '',
        'M6 Code': '',
        'Locator ID': '61027-IP01-2948564-CONT1210',
        'Mother Work Order': '',
        'Child Work Order': '',
        'FA Location': '',
        'Partner PO circle': 'Mumbai',
        'Unique route id': '',
        'Supplier Code': '',
        'Supplier site name': '',
        'NFA no.': '1-Business/156/205658',
        'Payment type': 'DD',
        'SD Time Period': '2 years',
    }
    
    # Add hardcoded values to result
    result.update(hardcoded_values)
    
    print(f"[SD MAPPING DEBUG] Extracted fields: {list(extracted_fields.keys())}")
    print(f"[SD MAPPING DEBUG] Mapped result: {list(result.keys())}")
    print(f"[SD MAPPING DEBUG] Hardcoded values added: {list(hardcoded_values.keys())}")
    
    return result

def non_refundable_request_parser(pdf_path, manual_values=None):
    """
    Extract fields from KDMC PDF and return a dict with canonical field names for validation parsers.
    Uses comprehensive field mapping system.
    """
    extracted_fields = extract_kdmc_all_fields(pdf_path)
    if manual_values:
        extracted_fields.update(manual_values)
    
    # Import the comprehensive field mapping
    from constants.comprehensive_field_mapping import map_parser_to_standard, convert_standard_to_table, ensure_all_fields_present
    
    # Map parser fields to standard field names
    standard_fields = map_parser_to_standard(extracted_fields, "kdmc")
    
    # Ensure section_length is properly mapped
    if 'section_length' in extracted_fields and 'surface_wise_length' not in standard_fields:
        standard_fields['surface_wise_length'] = extracted_fields['section_length']
    
    # Convert to validation table format (with display names)
    validation_result = convert_standard_to_table(standard_fields, "validation")
    
    # Ensure all required fields are present
    validation_result = ensure_all_fields_present(validation_result, "validation")
    
    # Import the comprehensive field mapping to get all required fields
    from constants.comprehensive_field_mapping import ALL_NON_REFUNDABLE_FIELDS
    
    # Convert validation_result to non-refundable table format
    non_refundable_result = convert_standard_to_table(standard_fields, "non_refundable")
    non_refundable_result = ensure_all_fields_present(non_refundable_result, "non_refundable")
    
    # Add hardcoded values for KDMC (using display names as keys)
    hardcoded_values = {
        "Intercity/Intracity- Deployment Intercity/intracity- O&M FTTH- Deployment FTTH-O&M": "Intercity/Intracity - Deployment",
        "BUSINESS UNIT": "TNL-FF-Maharashtra",
        "Circle": "MUM",
        "City": "MUM",
        "Capping/Non Capping": "Non capping",
        "Cost type with Cost Breakup EG.. - PROCESING FEES/ SUPERVISOIN CHARGE/ ADMIN FEES/ LICENSE FEES etc etc.": "Restoration Charges",
        "Authority( email address)": "ce.kdmc@gmail.com",
        "Authority": "Kalyan Dombivli Municipal Corporation",
        "BENEFICIERY NAME": "Kalyan Dombivli Municipal Corporation",
        "Mode of payment(DD/ONLINE-URL/ONLINE-NEFT/BHARATKOSH": "DD",
        "EXECUTION PARTNER NAME": "Excel Telesonic India Private Limited",
        "Payable (Authority) Location": "Kalyan Dombivli",
        "Cost type(restoration/ supervison/ agency changes/ admin etc)": "Restoration Charges",
        "Permission Type (Primary/ Secondary)": "Primary",
        "Type (UG/OH)": "UG",
        "Project Name": "Mumbai Fiber Refresh LMC",
    }
    
    # Add extracted date values to hardcoded values
    row_app_date = extracted_fields.get("row_application_date", "")
    if row_app_date:
        hardcoded_values["ROW APPLICATION  DATE"] = row_app_date
    
    demand_note_date = extracted_fields.get("dn_received_date", "")
    if demand_note_date:
        hardcoded_values["Demand Note Date"] = demand_note_date
    
    diff_days = extracted_fields.get("difference_days", "")
    if diff_days:
        hardcoded_values["Difference from, DN date  - DN Sent to Central team (ARTL)"] = diff_days
    
    # Merge hardcoded values into non_refundable_result
    non_refundable_result.update(hardcoded_values)
    
    # Print clean extracted fields summary
    print("\n" + "="*80)
    print("KDMC EXTRACTED FIELDS SUMMARY")
    print("="*80)
    print("NON-REFUNDABLE FIELDS:")
    for field, value in non_refundable_result.items():
        if value:
            print(f"  ✓ {field}: {value}")
    print("\nSD FIELDS:")
    sd_fields = map_kdmc_fields_to_sd_columns(extracted_fields)
    for field, value in sd_fields.items():
        if value:
            print(f"  ✓ {field}: {value}")
    print("="*80 + "\n")
    
    return non_refundable_result

def sd_parser(pdf_path, manual_values=None):
    """
    Extract fields from KDMC PDF and return mapped to standard SD columns.
    """
    # Extract all fields from the PDF
    extracted_fields = extract_kdmc_all_fields(pdf_path)
    
    # Add manual values if provided
    if manual_values:
        extracted_fields.update(manual_values)
    
    # Map to standard SD columns (this includes hardcoded values)
    result = map_kdmc_fields_to_sd_columns(extracted_fields)
    
    # Return standard SD columns in the expected format
    headers = PREVIEW_SD_COLUMNS
    row = [result.get(col, "") for col in PREVIEW_SD_COLUMNS]
    
    print(f"📋 KDMC SD PARSED: {len(row)} columns")
    
    return headers, row

def parse_kdmc_application_table(pdf_path):
    """
    Given a PDF path, extract the KDMC application table robustly.
    TODO: Implement KDMC-specific table extraction logic.
    """
    return {}
