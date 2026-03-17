import re
from typing import Dict, Optional
import logging

# Setup logging
logging.basicConfig(level=logging.WARNING, format='[PERMIT LOG] %(asctime)s %(levelname)s: %(message)s')

# You can use PyPDF2, pdfplumber, or your preferred PDF/OCR library
# import pdfplumber
# import pytesseract


def extract_permission_receipt_date(text):
    # Look for 'Dt:' or 'dt:' followed by a date (e.g., 07.05.2025)
    match = re.search(r'Dt[:\.]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})', text, re.IGNORECASE)
    if match:
        date_str = match.group(1)
        # Try to normalize to DD-MM-YYYY
        parts = re.split(r'[./-]', date_str)
        if len(parts) == 3:
            day, month, year = parts
            if len(year) == 2:
                year = '20' + year  # crude fix for 2-digit years
            try:
                result = f"{day.zfill(2)}-{month.zfill(2)}-{year.zfill(4)}"
                return result
            except Exception as e:
                logging.error(f"Error normalizing date in extract_permission_receipt_date: {e}")
                return date_str
        return date_str
    return ""

def extract_permit_no(text):
    # Look for 'No.' or 'No:' followed by a number, optionally before 'Dt:'
    match = re.search(r'No[.:]?\s*(\d{6,})\s+Dt[:\.]?', text, re.IGNORECASE)
    if match:
        result = match.group(1)
        return result
    # Fallback: look for 'No.' or 'No:' followed by a number anywhere
    match2 = re.search(r'No[.:]?\s*(\d{6,})', text, re.IGNORECASE)
    if match2:
        result = match2.group(1)
        return result
    return ""

def extract_permit_start_date(text):
    # Look for 'Date of Start' followed by a date
    match = re.search(r'Date of Start\s*[:=\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})', text, re.IGNORECASE)
    if match:
        date_str = match.group(1)
        parts = re.split(r'[./-]', date_str)
        if len(parts) == 3:
            day, month, year = parts
            if len(year) == 2:
                year = '20' + year
            try:
                result = f"{day.zfill(2)}-{month.zfill(2)}-{year.zfill(4)}"
                return result
            except Exception as e:
                logging.error(f"Error normalizing date in extract_permit_start_date: {e}")
                return date_str
        return date_str
    return ""

def extract_permit_end_date(text):
    # Look for 'Date of Completion' followed by a date
    match = re.search(r'Date of Completion\s*[:=\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})', text, re.IGNORECASE)
    if match:
        date_str = match.group(1)
        parts = re.split(r'[./-]', date_str)
        if len(parts) == 3:
            day, month, year = parts
            if len(year) == 2:
                year = '20' + year
            try:
                result = f"{day.zfill(2)}-{month.zfill(2)}-{year.zfill(4)}"
                return result
            except Exception as e:
                logging.error(f"Error normalizing date in extract_permit_end_date: {e}")
                return date_str
        return date_str
    return ""

def get_dn_length_from_db(dn_no):
    """
    Query the local PostgreSQL dn_master table using dn_no and return dn_length_mtr.
    """
    try:
        import db as local_db
        return local_db.get_dn_length_by_dn_number(dn_no)
    except Exception as e:
        logging.error(f"Local DB query error: {e}")
        return None

def extract_permitted_length_by_ward(text, permit_no=None):
    """
    Query local dn_master using permit_no as dn_no and return dn_length_mtr.
    """
    if not permit_no:
        logging.warning("No permit_no provided for DN query.")
        return ""
    length = get_dn_length_from_db(permit_no)
    return str(length) if length is not None else ""

def upsert_permit_fields_to_dn_master(permit_fields):
    """
    Upsert the permit fields into local dn_master using permit_no as dn_number.
    """
    try:
        import db as local_db
        upsert_dict = {
            "dn_number": permit_fields.get("permit_no"),
            "permission_receipt_date": permit_fields.get("permission_receipt_date"),
            "permit_no": permit_fields.get("permit_no"),
            "permit_start_date": permit_fields.get("permit_start_date"),
            "permit_end_date": permit_fields.get("permit_end_date"),
            "permitted_length_by_ward_mts": permit_fields.get("permitted_length_by_ward_mts"),
        }
        local_db.upsert_dn_master(upsert_dict)
        return True
    except Exception as e:
        logging.error(f"Upsert error: {e}")
        return None

def to_yyyy_mm_dd(date_str):
    """Convert DD-MM-YYYY or similar to YYYY-MM-DD. Returns original if not possible."""
    import re
    if not date_str:
        return date_str
    parts = re.split(r'[./-]', date_str)
    if len(parts) == 3:
        day, month, year = parts
        if len(year) == 2:
            year = '20' + year
        return f"{year.zfill(4)}-{month.zfill(2)}-{day.zfill(2)}"
    return date_str

def extract_permit_fields(pdf_path):
    # Example: Use OCR or PDF text extraction (placeholder)
    try:
        from pdf2image import convert_from_path
        import pytesseract
        pages = convert_from_path(pdf_path, dpi=300)
        full_text = "\n".join([pytesseract.image_to_string(page) for page in pages])
        permission_date = extract_permission_receipt_date(full_text)
        permit_no = extract_permit_no(full_text)
        permit_start = extract_permit_start_date(full_text)
        permit_end = extract_permit_end_date(full_text)
        permitted_length = extract_permitted_length_by_ward(full_text, permit_no)
        # Convert all dates to YYYY-MM-DD for DB
        permission_date_db = to_yyyy_mm_dd(permission_date)
        permit_start_db = to_yyyy_mm_dd(permit_start)
        permit_end_db = to_yyyy_mm_dd(permit_end)
        permit_fields = {
            "dn_number": "", # No longer extracted
            "permission_receipt_date": permission_date_db,
            "permit_no": permit_no,
            "permit_start_date": permit_start_db,
            "permit_end_date": permit_end_db,
            "permitted_length_by_ward_mts": permitted_length
        }
        # Do NOT upsert here. Only return fields for preview.
        return permit_fields
    except Exception as e:
        logging.error(f"Exception in extract_permit_fields: {e}")
        raise 