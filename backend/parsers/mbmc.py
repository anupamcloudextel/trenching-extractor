import fitz  # PyMuPDF
import camelot
import re
from datetime import datetime
import cv2
import numpy as np
import pytesseract
print('Tesseract being used:', pytesseract.pytesseract.tesseract_cmd)
from pdf2image import convert_from_path
import pandas as pd

# Using the same headers as MCGM parser
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
    "Additional Remarks"
]

# Static values specific to MBMC
STATIC_VALUES = {
    "Intercity/Intracity- Deployment Intercity/intracity- O&M FTTH- Deployment FTTH-O&M": "Intercity/Intracity - Deployment",
    "BUSINESS UNIT": "TNL-FF-Maharashtra",
    "Circle": "MUM",
    "City": "MUM",
    "Capping/Non Capping": "Non capping",
    "Cost type with Cost Breakup EG.. - PROCESING FEES/ SUPERVISOIN CHARGE/ ADMIN FEES/ LICENSE FEES etc etc.": "Restoration Charges",
    "Authority": "MIRA BHAYANDAR MUNICIPAL CORPORATION",
    "BENEFICIERY NAME": "MIRA BHAYANDAR MUNICIPAL CORPORATION",
    "Mode of payment(DD/ONLINE-URL/ONLINE-NEFT/BHARATKOSH": "DD",
    "EXECUTION PARTNER NAME": "Excel Telesonic India Private Limited",
    "Cost type(restoration/ supervison/ agency changes/ admin etc)": "Restoration Charges",
    "Permission Type (Primary/ Secondary)": "Primary",
    "Type (UG/OH)": "UG",
    "UG TYPE( HDD/ OT/ MICROTRENCHING)": "OT",
    "Locator Code (material)": "61027-IP01-2948564-CONT1210"
}

# Helper functions to extract data from MBMC PDFs
def extract_demand_note_reference(text):
    """Extract demand note reference from MBMC PDF text, looking for 'NO.MBMC' pattern."""
    # Look for patterns like NO.MBMCxxxxxx or NO:MBMCxxxxxx (case-insensitive)
    match = re.search(r"NO[.:\s-]*MBMC[\w/-]+", text, re.IGNORECASE)
    if match:
        ref = match.group(0).strip()
        return ref
    return ""

def extract_section_length(text):
    """Extract section length from MBMC PDF text."""
    matches = re.findall(r"(?:Length|Distance|Route Length)[:\s]*(?:in Mt[rs]?\.?)?[:\s]*([0-9,.]+)\s*(?:m(?:e)?t(?:e)?r(?:s)?)?", text, re.IGNORECASE)
    if not matches:
        matches = re.findall(r"(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:m(?:e)?t(?:e)?r(?:s)?)", text, re.IGNORECASE)
    # Only sum valid numbers, skip '.' or invalid strings
    valid_numbers = [float(m.replace(",", "")) for m in matches if re.match(r"^\d+(?:\.\d+)?$", m.replace(",", ""))]
    return str(sum(valid_numbers)) if valid_numbers else ""


def extract_sd_amount_opencv(text, pdf_path=None):
    """Extract security deposit amount from MBMC PDF using OpenCV+OCR (10th column, last/total row), fallback to regex."""
    if pdf_path is not None:
        try:
            df = opencv_pdf_table_to_df(pdf_path, page_num=2)
            if df is not None and df.shape[1] >= 10:
                # Try to find the 'Total' row first
                total_row = None
                for idx, val in enumerate(df.iloc[:, 0]):
                    if str(val).lower().strip().startswith("total"):
                        total_row = idx
                        break
                if total_row is None:
                    total_row = df.shape[0] - 1  # fallback: last row
                val_str = str(df.iloc[total_row, 9]).replace(",", "").strip()
                if re.match(r"^\d+(?:\.\d+)?$", val_str):
                    return str(int(float(val_str))) if float(val_str).is_integer() else str(float(val_str))
        except Exception as e:
            print(f"[ERROR] [mbmc] OpenCV+OCR SD amount extraction failed: {e}")
    # Fallback to regex extraction
    match = re.search(r"(?:Security\s+Deposit|SD)(?:\s+Amount)?[=: ]+(?:Rs\.?)?([0-9,.]+)", text, re.IGNORECASE)
    if not match:
        match = re.search(r"(?:Deposit|SD)(?:\s+as\s+\d+%)?(?:\s+of\s+\([A-Z]\))?[=: ]+(?:Rs\.?)?([0-9,.]+)", text, re.IGNORECASE)
    if match:
        val = match.group(1).replace(',', '')
        try:
            return str(int(float(val))) if float(val).is_integer() else str(float(val))
        except ValueError:
            return ""
    return ""

def extract_demand_note_date(text):
    """Extract demand note date from MBMC PDF text, prioritizing 'Date: dd/mm/yyyy' at the top of the page."""
    # Look for 'Date: dd/mm/yyyy' or 'Dt. dd/mm/yyyy' in the first 20 lines
    lines = text.splitlines()
    for line in lines[:20]:
        match = re.search(r"(?:Date|Dt\.?)[\s:]*([0-9]{2}[./][0-9]{2}[./][0-9]{4})", line, re.IGNORECASE)
        if match:
            return match.group(1).replace('.', '/')
   

def extract_difference_days(received_date):
    """Calculate difference in days between received date and today."""
    if not received_date:
        return ""
    try:
        dn_date = datetime.strptime(received_date, "%d/%m/%Y")
        return str((datetime.today() - dn_date).days)
    except Exception:
        return ""

def extract_total_dn_amount(fields):
    """Calculate total demand note amount."""
    try:
        sd = float(fields.get("SD Amount", 0) or 0)
        bg = float(fields.get("BG Amount", 0) or 0)
        gst = float(fields.get("GST Amount", 0) or 0)
        non_refundable = float(fields.get("Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')", 0) or 0)
        total = sd + bg + gst + non_refundable
        return str(int(total)) if total.is_integer() else str(total)
    except Exception:
        return ""

def extract_road_types_from_tables(tables, pdf_path=None):
    """Extract all unique road types using OpenCV+OCR only (ignore Camelot)."""
    if pdf_path:
        return extract_road_types_opencv_ocr(pdf_path)
    return ""

def opencv_pdf_table_to_df(pdf_path, page_num=2, dpi=300, downscale_factor=0.7, debug_save_path=None):
    """
    Convert a PDF page to an image and extract the largest table as a DataFrame using OpenCV + pytesseract OCR.
    Uses more aggressive downscaling for speed, and limits ThreadPoolExecutor to 4 workers.
    Saves the processed table mask, the original grayscale table region, and a debug image with cell boxes for inspection.
    """
    from concurrent.futures import ThreadPoolExecutor
    from PIL import Image
    import os
    import cv2
    import numpy as np
    # Convert PDF page to image (in-memory)
    pages = convert_from_path(pdf_path, dpi=dpi)
    if page_num-1 >= len(pages):
        raise ValueError(f"Page {page_num} not found in PDF.")
    pil_img = pages[page_num-1]
    if downscale_factor != 1.0:
        new_size = (int(pil_img.width * downscale_factor), int(pil_img.height * downscale_factor))
        pil_img = pil_img.resize(new_size, Image.LANCZOS)
    img = np.array(pil_img.convert('L'))  # grayscale
    color_img = np.array(pil_img.convert('RGB'))  # for drawing boxes
    # Binarize
    _, img_bin = cv2.threshold(img, 128, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    kernel_len = np.array(img).shape[1] // 100
    vert_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, kernel_len))
    hori_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_len, 1))
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    img_temp1 = cv2.erode(img_bin, vert_kernel, iterations=3)
    vert_lines = cv2.dilate(img_temp1, vert_kernel, iterations=3)
    img_temp2 = cv2.erode(img_bin, hori_kernel, iterations=3)
    hori_lines = cv2.dilate(img_temp2, hori_kernel, iterations=3)
    table_mask = cv2.addWeighted(vert_lines, 0.5, hori_lines, 0.5, 0.0)
    table_mask = cv2.erode(~table_mask, kernel, iterations=2)
    _, table_mask = cv2.threshold(table_mask, 128, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    # Save the processed table mask for debugging
    script_dir = os.path.dirname(os.path.abspath(__file__))
    mask_path = os.path.join(script_dir, 'mbmc_table_mask_debug.png')
    cv2.imwrite(mask_path, table_mask)
    # Find contours and bounding boxes
    contours, _ = cv2.findContours(table_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    boxes = [cv2.boundingRect(c) for c in contours if cv2.contourArea(c) > 1000]
    boxes = sorted(boxes, key=lambda b: (b[1], b[0]))
    # Draw boxes on color image for debug
    for (x, y, w, h) in boxes:
        cv2.rectangle(color_img, (x, y), (x+w, y+h), (0, 0, 255), 2)
    boxes_path = os.path.join(script_dir, 'mbmc_table_boxes_debug.png')
    cv2.imwrite(boxes_path, color_img)
    # Save the full grayscale table region for debug (bounding all boxes)
    if boxes:
        x0 = min([x for (x, y, w, h) in boxes])
        y0 = min([y for (x, y, w, h) in boxes])
        x1 = max([x+w for (x, y, w, h) in boxes])
        y1 = max([y+h for (x, y, w, h) in boxes])
        table_crop = img[y0:y1, x0:x1]
        crop_path = os.path.join(script_dir, 'mbmc_table_crop_debug.png')
        cv2.imwrite(crop_path, table_crop)
    # Group boxes into rows
    rows = []
    current_row = []
    last_y = -1
    for box in boxes:
        x, y, w, h = box
        if last_y == -1 or abs(y - last_y) < 10:
            current_row.append(box)
            last_y = y
        else:
            rows.append(sorted(current_row, key=lambda b: b[0]))
            current_row = [box]
            last_y = y
    if current_row:
        rows.append(sorted(current_row, key=lambda b: b[0]))
    # OCR each cell in parallel, with padding
    def ocr_cell(args):
        img, box = args
        x, y, w, h = box
        pad = 2  # pixels
        x1 = max(x - pad, 0)
        y1 = max(y - pad, 0)
        x2 = min(x + w + pad, img.shape[1])
        y2 = min(y + h + pad, img.shape[0])
        cell_img = img[y1:y2, x1:x2]
        return pytesseract.image_to_string(cell_img, config='--psm 6').strip()
    table_data = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        for row in rows:
            cell_imgs = [(img, box) for box in row]
            row_data = list(executor.map(ocr_cell, cell_imgs))
            table_data.append(row_data)
    df = None
    try:
        df = pd.DataFrame(table_data)
    except Exception as e:
        print("Table DataFrame creation failed:", e)
    if df is not None:
        return df
    else:
        print("No DataFrame created from table data.")
        return pd.DataFrame() # Return an empty DataFrame to avoid errors

def opencv_pdf_table_to_df_original(pdf_path, page_num=2, dpi=300, out_path='mbmc_page2.png'):
    """
    [BACKUP] Original: Convert a PDF page to an image and extract the largest table as a DataFrame using OpenCV + pytesseract OCR.
    """
    pages = convert_from_path(pdf_path, dpi=dpi)
    if page_num-1 >= len(pages):
        raise ValueError(f"Page {page_num} not found in PDF.")
    pages[page_num-1].save(out_path, 'PNG')
    img = cv2.imread(out_path, 0)
    _, img_bin = cv2.threshold(img, 128, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    kernel_len = np.array(img).shape[1] // 100
    vert_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, kernel_len))
    hori_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_len, 1))
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    img_temp1 = cv2.erode(img_bin, vert_kernel, iterations=3)
    vert_lines = cv2.dilate(img_temp1, vert_kernel, iterations=3)
    img_temp2 = cv2.erode(img_bin, hori_kernel, iterations=3)
    hori_lines = cv2.dilate(img_temp2, hori_kernel, iterations=3)
    table_mask = cv2.addWeighted(vert_lines, 0.5, hori_lines, 0.5, 0.0)
    table_mask = cv2.erode(~table_mask, kernel, iterations=2)
    _, table_mask = cv2.threshold(table_mask, 128, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(table_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    boxes = [cv2.boundingRect(c) for c in contours if cv2.contourArea(c) > 1000]
    boxes = sorted(boxes, key=lambda b: (b[1], b[0]))
    # Group boxes into rows
    rows = []
    current_row = []
    last_y = -1
    for box in boxes:
        x, y, w, h = box
        if last_y == -1 or abs(y - last_y) < 10:
            current_row.append(box)
            last_y = y
        else:
            rows.append(sorted(current_row, key=lambda b: b[0]))
            current_row = [box]
            last_y = y
    if current_row:
        rows.append(sorted(current_row, key=lambda b: b[0]))
    # OCR each cell
    table_data = []
    for row in rows:
        row_data = []
        for box in row:
            x, y, w, h = box
            cell_img = img[y:y+h, x:x+w]
            text = pytesseract.image_to_string(cell_img, config='--psm 6').strip()
            row_data.append(text)
        table_data.append(row_data)
    df = pd.DataFrame(table_data)
    return df

def extract_road_types_opencv_ocr(pdf_path):
    """
    Extract road types from page 2 of the PDF using OpenCV + pytesseract OCR table extraction.
    Returns a string of unique, valid road types from the 3rd column, joined by slashes if multiple.
    """
    try:
        df = opencv_pdf_table_to_df(pdf_path, page_num=2)
        if df is not None and df.shape[1] >= 3:
            road_types = [
                str(val).strip()
                for val in df.iloc[1:, 2]  # 3rd column, skip header row
                if val and isinstance(val, str) and len(val.strip()) > 1 and not re.match(r"^[a-zA-Z]$", val.strip())
                and "Type Of Surface".lower() not in val.lower() and "None".lower() not in val.lower()
            ]
            # Remove duplicates, preserve order
            seen = set()
            unique_road_types = []
            for rt in road_types:
                if rt not in seen:
                    unique_road_types.append(rt)
                    seen.add(rt)
            return " / ".join(unique_road_types) if unique_road_types else ""
        else:
            return ""
    except Exception as e:
        print(f"[ERROR] [mbmc] OpenCV+OCR road type extraction failed: {e}")
        return ""

def extract_rate_in_rs_from_tables(tables, pdf_path=None):
    """
    Extract rate per meter from the table in the PDF using OpenCV+OCR logic, always extracting from the 5th column (index 4), skipping header and 'Total' rows.
    """
    if pdf_path is None:
        return ""
    try:
        df = opencv_pdf_table_to_df(pdf_path, page_num=2)
        if df is not None and df.shape[1] >= 5:
            values = []
            for idx, val in enumerate(df.iloc[1:, 4], start=1):
                val_str = str(val).replace(",", "").strip()
                row_label = str(df.iloc[idx, 0]).lower() if df.shape[1] > 0 else ""
                if row_label.startswith("total"):
                    continue
                if re.match(r"^\d+(?:\.\d+)?$", val_str):
                    values.append(val_str)
            return " / ".join(values) if values else ""
        return ""
    except Exception as e:
        print(f"[ERROR] [mbmc] OpenCV+OCR RM Rate extraction failed: {e}")
        return ""

def extract_section_length_from_tables(tables, pdf_path=None):
    """
    Extract section length from the table in the PDF using OpenCV+OCR logic, extracting and summing values from the 4th column (index 3), skipping header and 'Total' rows.
    """
    if pdf_path is None:
        return ""
    try:
        df = opencv_pdf_table_to_df(pdf_path, page_num=2)
        if df is not None and df.shape[1] >= 4:
            total_length = 0.0
            for idx, val in enumerate(df.iloc[1:, 3], start=1):
                val_str = str(val).replace(",", "").strip()
                row_label = str(df.iloc[idx, 0]).lower() if df.shape[1] > 0 else ""
                if row_label.startswith("total"):
                    continue
                if re.match(r"^\d+(?:\.\d+)?$", val_str):
                    total_length += float(val_str)
            return str(int(total_length)) if total_length.is_integer() else str(total_length)
        return ""
    except Exception as e:
        print(f"[ERROR] [mbmc] OpenCV+OCR section length extraction failed: {e}")
        return ""

def extract_covered_under_capping(text, tables, pdf_path=None):
    """
    Extract amounts covered under capping from PDF using OpenCV+OCR logic.
    Sums values from columns 7, 8, and 9 in the "Total" row, which typically contain:
    - Chamber Charges
    - Security Deposit
    - Total
    
    Args:
        text (str): Full text of the PDF (not used in OpenCV implementation)
        tables (list): List of Camelot tables (not used in OpenCV implementation)
        pdf_path (str): Path to the PDF file to process
        
    Returns:
        str: Sum of covered under capping amounts as a string, empty string if extraction fails
    """
    if pdf_path is None:
        return ""
    
    try:
        df = opencv_pdf_table_to_df(pdf_path, page_num=2)
        if df is not None and df.shape[1] >= 10:  # Need at least 10 columns
            # Find the "Total" row
            total_row = None
            for idx, val in enumerate(df.iloc[:, 0]):
                if str(val).lower().strip().startswith("total"):
                    total_row = idx
                    break
            
            if total_row is not None:
                covered_amount = 0.0
                # Sum values from columns 7, 8, and 9 (indices 6, 7, 8) in the total row
                for col_idx in [6, 7, 8]:
                    val_str = str(df.iloc[total_row, col_idx]).replace(",", "").strip()
                    if re.match(r"^\d+(?:\.\d+)?$", val_str):
                        covered_amount += float(val_str)
                
                # Return as integer if whole number, otherwise as float string
                return str(int(covered_amount)) if covered_amount.is_integer() else str(covered_amount)
        return ""
    except Exception as e:
        print(f"[ERROR] [mbmc] OpenCV+OCR covered under capping extraction failed: {e}")
        return ""

def extract_not_part_of_capping(text, tables):
    """Extract amounts not part of capping from PDF."""
    # Try to find in tables first
    if tables and len(tables) > 0:
        for table in tables:
            df = table.df
            if df is not None:
                for i in range(len(df)):
                    for j in range(len(df.columns)):
                        cell = str(df.iloc[i, j]).strip().lower()
                        if any(term in cell for term in ["license", "rental", "way leave", "permission"]):
                            # Look for amount in nearby cells
                            for di in [-1, 0, 1]:
                                for dj in [-1, 0, 1]:
                                    if 0 <= i+di < len(df) and 0 <= j+dj < len(df.columns):
                                        val = str(df.iloc[i+di, j+dj]).strip()
                                        if re.match(r"^\d+(?:,\d+)*(?:\.\d+)?$", val):
                                            return val.replace(",", "")
    
    # Try regular expressions on text
    matches = re.findall(r"(?:License|Rental|Way Leave)(?:\s+[Cc]harges?)?[:\s]+(?:Rs\.?)?([0-9,.]+)", text)
    if matches:
        return str(sum(float(m.replace(",", "")) for m in matches))
    
    return ""

def extract_gst_amount_opencv(pdf_path):
    """
    Extract GST amount from MBMC PDF using OpenCV+OCR table extraction.
    Sums CGST (12th col, index 11) and SGST (13th col, index 12) from the last/total row.
    """
    try:
        df = opencv_pdf_table_to_df(pdf_path, page_num=2)
        if df is not None and df.shape[1] >= 13:
            # Find the 'Total' row, else use last row
            total_row = None
            for idx, val in enumerate(df.iloc[:, 0]):
                if str(val).lower().strip().startswith("total"):
                    total_row = idx
                    break
            if total_row is None:
                total_row = df.shape[0] - 1
            cgst_str = str(df.iloc[total_row, 11]).replace(",", "").strip()
            sgst_str = str(df.iloc[total_row, 12]).replace(",", "").strip()
            cgst = float(cgst_str) if re.match(r"^\d+(?:\.\d+)?$", cgst_str) else 0.0
            sgst = float(sgst_str) if re.match(r"^\d+(?:\.\d+)?$", sgst_str) else 0.0
            total = cgst + sgst
            return str(int(total)) if total.is_integer() else str(total)
        return ""
    except Exception as e:
        print(f"[ERROR] [mbmc] OpenCV+OCR GST extraction failed: {e}")
        return ""

def non_refundable_request_parser(pdf_path, manual_values=None):
    """
    Extraction logic for MBMC Non Refundable Request Parser.
    Uses comprehensive field mapping system.
    """
    doc = fitz.open(pdf_path)
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    
    # Extract tables from the PDF (still used for not_part_of_capping fallback)
    tables = camelot.read_pdf(pdf_path, pages='1,2', flavor='lattice')

    # Extract data from text and tables, prioritizing OpenCV+OCR for all table-based fields
    demand_note_ref = extract_demand_note_reference(text)
    section_length = extract_section_length_from_tables(None, pdf_path=pdf_path) or extract_section_length(text)
    gst_amount = extract_gst_amount_opencv(pdf_path)
    sd_amount = extract_sd_amount_opencv(text, pdf_path=pdf_path)
    row_app_date = extract_row_application_date(text) if 'extract_row_application_date' in globals() else ''
    demand_note_date = extract_demand_note_date(text)
    received_date = demand_note_date
    diff_days = extract_difference_days(received_date)
    road_types = extract_road_types_opencv_ocr(pdf_path)
    rate_in_rs = extract_rate_in_rs_from_tables(None, pdf_path=pdf_path)
    covered_under_capping = extract_covered_under_capping(text, None, pdf_path=pdf_path)
    not_part_of_capping = extract_not_part_of_capping(text, tables)

    # Build extracted fields dict with standard field names
    extracted_fields = {
        "dn_number": demand_note_ref,
        "dn_received_date": demand_note_date,
        "dn_length_mtr": section_length,
        "ot_length": section_length,
        "surface": road_types,
        "surface_wise_ri_amount": rate_in_rs,
        "surface_wise_length": "",  # MBMC doesn't extract this
        "surface_wise_multiplication_factor": "",  # MBMC doesn't extract this
        "dn_ri_amount": covered_under_capping,
        "ground_rent": not_part_of_capping,
        "administrative_charge": covered_under_capping,
        "supervision_charges": "",  # MBMC doesn't extract this
        "chamber_fee": "",  # MBMC doesn't extract this
        "gst": gst_amount,
        "deposit": sd_amount,
        "total_dn_amount": extract_total_dn_amount({
            "SD Amount": sd_amount,
            "BG Amount": "0",
            "GST Amount": gst_amount,
            "Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')": str(float(covered_under_capping or 0) + float(not_part_of_capping or 0))
        }),
        "no_of_pits": "",  # MBMC doesn't extract this
        "pit_ri_rate": "",  # MBMC doesn't extract this
        "road_name": "",  # MBMC doesn't extract this
    }

    # Import the comprehensive field mapping
    from constants.comprehensive_field_mapping import map_parser_to_standard, convert_standard_to_table, ensure_all_fields_present
    
    # Map parser fields to standard field names
    standard_fields = map_parser_to_standard(extracted_fields, "mbmc")
    
    # Convert to validation table format (with display names)
    validation_result = convert_standard_to_table(standard_fields, "validation")
    
    # Ensure all required fields are present
    validation_result = ensure_all_fields_present(validation_result, "validation")
    
    # Apply manual values if provided
    if manual_values:
        validation_result.update(manual_values)

    # Print comprehensive field mapping for Non-Refundable table
    print("\n" + "="*80)
    print("MBMC NON-REFUNDABLE TABLE - COMPLETE FIELD MAPPING")
    print("="*80)
    
    # Import the comprehensive field mapping to get all required fields
    from constants.comprehensive_field_mapping import ALL_NON_REFUNDABLE_FIELDS
    
    # Convert validation_result to non-refundable table format
    non_refundable_result = convert_standard_to_table(standard_fields, "non_refundable")
    non_refundable_result = ensure_all_fields_present(non_refundable_result, "non_refundable")
    
    # Show every field in the non-refundable table
    for field in ALL_NON_REFUNDABLE_FIELDS:
        value = non_refundable_result.get(field, "")
        if value:
            print(f"✓ {field}: {value}")
        else:
            print(f"✗ {field}: (blank)")
    
    print("="*80 + "\n")

    return validation_result

def sd_parser(pdf_path, manual_values=None):
    """
    SD Parser for MBMC: outputs a 20-column, 2-row Excel with static headers and mapped row values, using OpenCV+OCR for SD Amount and related fields.
    """
    alt_headers = [
        "SD OU Circle Name", "Execution Partner Vendor Code", "Execution Partner Vendor Name", "Execution Partner GBPA PO No.",
        "GIS Code", "M6 Code", "Locator ID", "Mother Work Order", "Child Work Order", "FA Location", "Partner PO circle",
        "Unique route id", "Supplier Code", "Supplier site name", "NFA no.", "Payment type", "DN No", "Authority", "DN Date", "SD Amount", "SD Time Period",
        # New columns
        "Payment Mode-", "Route", "Node Id"
    ]

    # Get data from the non-refundable parser (now uses OpenCV+OCR for all table-based fields)
    row_main = non_refundable_request_parser(pdf_path)

    def get_main(header):
        try:
            return row_main[HEADERS.index(header)]
        except Exception:
            return ""

    # Create SD row with static and extracted values
    row = [
        "TNL-FF-Maharashtra",               # SD OU Circle Name
        "632607",                           # Execution Partner Vendor Code
        "Excel Telesonic India Private Limited",  # Execution Partner Vendor Name
        "",                                 # Execution Partner GBPA PO No. (manual)
        "",                                 # GIS Code (manual)
        "",                                 # M6 Code (manual)
        "61027-IP01-2948564-CONT1210",      # Locator ID
        "",                                 # Mother Work Order (manual)
        "",                                 # Child Work Order (manual)
        "Mira Bhayandar",                   # FA Location
        "",                                 # Partner PO circle (manual)
        "",                                 # Unique route id (manual)
        "",                                 # Supplier Code (manual)
        "",                                 # Supplier site name (manual)
        "",                                 # NFA no. (manual)
        "DD",                      # Payment type
        get_main("Demand Note Reference number"),  # DN No
        "MIRA BHAYANDAR MUNCIPAL CORPORATION",     # Authority (hardcoded)
        get_main("Demand Note Date"),              # DN Date
        get_main("SD Amount"),                     # SD Amount (OpenCV+OCR)
        "2 Years",                           # SD Time Period
        # New columns
        "DD", "MU-MB1608", "MU-MB1608"
    ]

    # Apply manual values if provided
    if manual_values:
        for field, value in manual_values.items():
            if field in alt_headers:
                idx = alt_headers.index(field)
                row[idx] = value

    # Print comprehensive field mapping for SD table
    print("\n" + "="*80)
    print("MBMC SD TABLE - COMPLETE FIELD MAPPING")
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

__all__ = [
    'extract_demand_note_reference',
    'extract_road_types_opencv_ocr',
    'extract_rate_in_rs_from_tables',
    'extract_section_length_from_tables',
    'extract_covered_under_capping',
    'extract_sd_amount_opencv',
    'non_refundable_request_parser',
    'sd_parser'
]