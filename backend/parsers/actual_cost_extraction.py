from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import List
import tempfile, os

# Import MCGM extraction functions
from .mcgm import extract_section_length_from_tables, extract_rate_in_rs_from_tables, non_refundable_request_parser
import camelot

router = APIRouter()

@router.post("/actual_cost_extraction/")
async def actual_cost_extraction(
    authority: str = Form(...),
    files: List[UploadFile] = File(...)
):
    results = []
    for file in files:
        if authority == "mcgm":
            try:
                # Save file to temp
                suffix = os.path.splitext(file.filename)[-1]
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    tmp.write(await file.read())
                    tmp_path = tmp.name
                # Extract tables
                tables = camelot.read_pdf(tmp_path, pages='1', flavor='lattice')
                section_length = extract_section_length_from_tables(tables)
                # Extract RI Cost (Non Refundable Cost)
                row = non_refundable_request_parser(tmp_path)
                # Find the correct header index
                ri_cost = None
                try:
                    from .mcgm import HEADERS
                    idx = HEADERS.index("Non Refundable Cost( Amount to process for payment shold be sum of 'Z' and 'AA' coulm )")
                    ri_cost = row[idx]
                    dn_idx = HEADERS.index("Demand Note Reference number")
                    demand_note_reference = row[dn_idx]
                except Exception:
                    ri_cost = None
                    demand_note_reference = None
                result = {
                    "filename": file.filename,
                    "section_length": section_length,
                    "ri_cost": ri_cost,
                    "demand_note_reference": demand_note_reference
                }
                os.remove(tmp_path)
            except Exception as e:
                result = {"filename": file.filename, "error": str(e)}
        elif authority == "mbmc":
            result = {"filename": file.filename, "parsed": "MBMC result (placeholder)"}
        elif authority == "kdmc":
            result = {"filename": file.filename, "parsed": "KDMC result (placeholder)"}
        elif authority == "midc-type1":
            result = {"filename": file.filename, "parsed": "MIDC Type 1 result (placeholder)"}
        elif authority == "midc-type2":
            result = {"filename": file.filename, "parsed": "MIDC Type 2 result (placeholder)"}
        elif authority == "nmmc":
            result = {"filename": file.filename, "parsed": "NMMC result (placeholder)"}
        else:
            result = {"filename": file.filename, "error": "Unknown authority"}
        results.append(result)
    return JSONResponse(content={"results": results}) 