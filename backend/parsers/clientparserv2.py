"""
Client Parser V2 - Unified Database-Driven Parser
This parser bypasses PDF parsing by directly querying the local database or using hardcoded values.
No parsing required - only database queries and hardcoded values per authority.
"""

from typing import Dict, Optional, List, Any
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Authority configurations with hardcoded values
# Updated to match individual parser files exactly
AUTHORITY_CONFIGS = {
    "MCGM": {
        "authority_name": "MUNICIPAL CORPORATION OF GREATER MUMBAI",
        "authority_email": "dyche.rdplg@mcgm.gov.in",
        "beneficiary_name": "MUNICIPAL CORPORATION OF GREATER MUMBAI",
        "mode_of_payment": "ONLINE-NEFT",
        "execution_partner": "Excel Telesonic India Private Limited",
        "payable_location": "Mumbai",
        "printing_location": "Mumbai",
        "business_unit": "TNL-FF-Maharashtra",
        "circle": "MUM",
        "city": "MUM",
        "capping_type": "Non capping",
        "permission_type": "Primary",
        "type_ug_oh": "UG",
        "ug_type": "OT",
        "cost_type": "Restoration Charges",
        "cost_type_breakup": "Restoration Charges"
    },
    "NMMC": {
        "authority_name": "NAVI MUMBAI MUNICIPAL CORPORATION",
        "authority_email": "info@nmmc.gov.in",
        "beneficiary_name": "NAVI MUMBAI MUNICIPAL CORPORATION",
        "mode_of_payment": "ONLINE-NEFT",
        "execution_partner": "Excel Telesonic India Private Limited",
        "payable_location": "Navi Mumbai",
        "printing_location": "Navi Mumbai",
        "business_unit": "TNL-FF-Maharashtra",
        "circle": "MUM",
        "city": "Navi Mumbai",
        "capping_type": "Non capping",
        "permission_type": "Primary",
        "type_ug_oh": "UG",
        "ug_type": "OT",
        "cost_type": "Restoration Charges",
        "cost_type_breakup": "Restoration Charges"
    },
    "MBMC": {
        "authority_name": "MIRA BHAYANDAR MUNICIPAL CORPORATION",
        "authority_email": "info@mbmc.gov.in",
        "beneficiary_name": "MIRA BHAYANDAR MUNICIPAL CORPORATION",
        "mode_of_payment": "DD",
        "execution_partner": "Excel Telesonic India Private Limited",
        "payable_location": "Miraj",
        "printing_location": "Miraj",
        "business_unit": "TNL-FF-Maharashtra",
        "circle": "MUM",
        "city": "Miraj",
        "capping_type": "Non capping",
        "permission_type": "Primary",
        "type_ug_oh": "UG",
        "ug_type": "OT",
        "cost_type": "Restoration Charges",
        "cost_type_breakup": "Restoration Charges"
    },
    "KDMC": {
        "authority_name": "Kalyan Dombivli Municipal Corporation",
        "authority_email": "ce.kdmc@gmail.com",
        "beneficiary_name": "Kalyan Dombivli Municipal Corporation",
        "mode_of_payment": "DD",
        "execution_partner": "Excel Telesonic India Private Limited",
        "payable_location": "Kalyan Dombivli",
        "printing_location": "Kalyan",
        "business_unit": "TNL-FF-Maharashtra",
        "circle": "MUM",
        "city": "MUM",
        "capping_type": "Non capping",
        "permission_type": "Primary",
        "type_ug_oh": "UG",
        "ug_type": "OT",
        "cost_type": "Restoration Charges",
        "cost_type_breakup": "Restoration Charges"
    },
    "MIDC": {
        "authority_name": "MAHARASHTRA INDUSTRIAL DEVELOPMENT CORPORATION",
        "authority_email": "info@midcindia.org",
        "beneficiary_name": "MAHARASHTRA INDUSTRIAL DEVELOPMENT CORPORATION",
        "mode_of_payment": "ONLINE-NEFT",
        "execution_partner": "Excel Telesonic India Private Limited",
        "payable_location": "Mumbai",
        "printing_location": "Mumbai",
        "business_unit": "TNL-FF-Maharashtra",
        "circle": "MUM",
        "city": "Mumbai",
        "capping_type": "Non capping",
        "permission_type": "Primary",
        "type_ug_oh": "UG",
        "ug_type": "OT",
        "cost_type": "Restoration Charges",
        "cost_type_breakup": "Restoration Charges"
    }
}

def query_dn_master(dn_number: str) -> Optional[Dict[str, Any]]:
    """Query the local DN master database for a specific DN number."""
    try:
        import db as local_db
        row = local_db.get_dn_by_number(dn_number)
        if row:
            logger.info(f"Found DN data for DN number: {dn_number}")
            return row
        logger.warning(f"No DN data found for DN number: {dn_number}")
        return None
    except Exception as e:
        logger.error(f"Error querying DN master for DN {dn_number}: {str(e)}")
        return None

def query_budget_master(site_id: str) -> Optional[Dict[str, Any]]:
    """Query the local budget master database for a specific site ID."""
    try:
        import db as local_db
        row = local_db.query_budget_by_site_id(site_id)
        if row:
            logger.info(f"Found budget data for site ID: {site_id}")
            return row
        logger.warning(f"No budget data found for site ID: {site_id}")
        return None
    except Exception as e:
        logger.error(f"Error querying budget master for site {site_id}: {str(e)}")
        return None

def query_po_master(site_id: str) -> Optional[Dict[str, Any]]:
    """Query the local PO master database for a specific site ID."""
    try:
        import db as local_db
        row = local_db.query_po_by_site_id(site_id)
        if row:
            logger.info(f"Found PO data for site ID: {site_id}")
            return row
        logger.warning(f"No PO data found for site ID: {site_id}")
        return None
    except Exception as e:
        logger.error(f"Error querying PO master for site {site_id}: {str(e)}")
        return None

def generate_non_refundable_output(dn_number: str, authority: str) -> Dict[str, Any]:
    """
    Generate non-refundable output by querying database and using hardcoded values.
    
    Args:
        dn_number: The demand note number
        authority: The authority name (MCGM, NMMC, etc.)
        
    Returns:
        Dictionary containing all non-refundable fields
    """
    logger.info(f"=== GENERATING NON-REFUNDABLE OUTPUT ===")
    logger.info(f"DN Number: {dn_number}")
    logger.info(f"Authority: {authority}")
    
    # Get authority configuration
    auth_config = AUTHORITY_CONFIGS.get(authority.upper(), {})
    if not auth_config:
        logger.error(f"Unknown authority: {authority}")
        return {}
    
    logger.info(f"=== AUTHORITY CONFIG FOR {authority.upper()} ===")
    for key, value in auth_config.items():
        logger.info(f"  {key}: {value}")
    
    # Query database for DN data
    logger.info(f"=== QUERYING DN MASTER ===")
    dn_data = query_dn_master(dn_number)
    
    if dn_data:
        logger.info(f"✓ DN data found successfully")
        logger.info(f"=== ALL DN DATA FIELDS ===")
        for key, value in dn_data.items():
            logger.info(f"  {key}: {value} (type: {type(value)})")
    else:
        logger.info(f"✗ No DN data found for DN number: {dn_number}")
        dn_data = {}
    
    # Initialize output with authority-specific hardcoded values (STEP 1: Fill hardcoded fields)
    output = {
        "Intercity/Intracity- Deployment Intercity/intracity- O&M FTTH- Deployment FTTH-O&M": "Intercity/Intracity - Deployment",
        "BUSINESS UNIT": auth_config.get("business_unit", ""),
        "Circle": auth_config.get("circle", ""),
        "City": auth_config.get("city", ""),
        "Demand Note Reference number": dn_number,
        "LM/BB/FTTH": "",
        "Type (UG/OH)": auth_config.get("type_ug_oh", ""),
        "Capping/Non Capping": auth_config.get("capping_type", ""),
        "UG TYPE( HDD/ OT/ MICROTRENCHING)": auth_config.get("ug_type", ""),
        "Road Types - CC/BT/TILES/ Normal Soil/kacha": "",
        "HDD - Number of Pits": "",
        "OH (EB Poles/MC Poles/Own Poles)": "",
        "NO OF POLES": "",
        "RAILWAY CROSSING/ PIPELINE CROSSING( No of crossing)": "",
        "GO RATE": "",
        "PREVIOUS DN RATE": "",
        "Rate/mtr- Current DN (UG/OH)": "",
        "Annual Rate/Pole( current DN)": "",
        "HDD(PIT RATE)": "",
        "Section Length (Mtr.)": "",
        "Total Route (MTR)": "",
        "RAILWAY/ PIPELINE/ EACH CROSSING RATE": "",
        "Reason (Current rate is more than GO or Previous DN)": "",
        "Annual Lease/ rent amount": "",
        "Renewal Lease/Rent date": "",
        "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)": "",
        "Covered under capping (Restoration Charges, admin, registration etc.)": "",
        "Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')": "",
        "Cost type with Cost Breakup EG.. - PROCESING FEES/ SUPERVISOIN CHARGE/ ADMIN FEES/ LICENSE FEES etc etc.": auth_config.get("cost_type_breakup", ""),
        "GST Amount": "",
        "BG Amount": "",
        "SD Amount": "",
        "ROW APPLICATION  DATE": "",
        "Demand Note Date": "",
        "DN RECEIVED FROM PARTNER/AUTHORITY- DATE": "",
        "Difference from, DN date  - DN Sent to Central team (ARTL)": "",
        "REASON FOR DELAY (>2 DAYS)": "",
        "Total DN Amount ( NON REFUNDABLE+SD+ BG+ GST) To be filled by helpdesk team": "",
        "Supplier Code( if team have) To be filled by helpdesk team": "",
        "Supplier site name( if team have) To be filled by helpdesk team": "",
        "Locator Code (material)": "",
        "Authority( email address)": auth_config.get("authority_email", ""),
        "Authority": auth_config.get("authority_name", ""),
        "BENEFICIERY NAME": auth_config.get("beneficiary_name", ""),
        "Mode of payment(DD/ONLINE-URL/ONLINE-NEFT/BHARATKOSH": auth_config.get("mode_of_payment", ""),
        "EXECUTION PARTNER NAME": auth_config.get("execution_partner", ""),
        "Payable (Authority) Location": auth_config.get("payable_location", ""),
        "Printing Location": auth_config.get("printing_location", ""),
        "PO No.": "",
        "Business NFA NUMBER (Approved CAF) To be filled by helpdesk team": "",
        "Route Name(As per CWIP)": "",
        "Section Name for ROW(As per CWIP)": "",
        "NSG ID(As per CWIP)/CWO NO.": "",
        "Total Amount as per capping MB(Partner Scope)": "",
        "Cost type(restoration/ supervison/ agency changes/ admin etc)": auth_config.get("cost_type", ""),
        "Total Amount as per capping MB(Not in Partner Scope)": "",
        "Cost type (way leave charges/ rent/ license etc)": "",
        "Permission Type (Primary/ Secondary)": auth_config.get("permission_type", ""),
        "Additional Remarks": ""
    }
    
    logger.info(f"=== STEP 1: HARDCODED VALUES INITIALIZED ===")
    for key, value in output.items():
        if value != "":
            logger.info(f"  HARDCODED: {key} = {value}")
    
    # STEP 2: Populate with database data if available (or leave blank if not found)
    if dn_data:
        logger.info(f"=== STEP 2: DATABASE FIELD MAPPING ===")
        
        # Map DN master fields to output fields
        field_mapping = {
            "surface": "Road Types - CC/BT/TILES/ Normal Soil/kacha",
            "no_of_pits": "HDD - Number of Pits",
            "dn_length_mtr": "Section Length (Mtr.)",
            "ground_rent": "Annual Lease/ rent amount",
            "gst": "GST Amount",
            "deposit": "SD Amount",
            "total_dn_amount": "Total DN Amount ( NON REFUNDABLE+SD+ BG+ GST) To be filled by helpdesk team",
            "application_date": "ROW APPLICATION  DATE",
            "po_number": "PO No.",
            "pit_ri_rate": "HDD(PIT RATE)"
        }
        
        # Map database fields to output fields (leave blank if not found)
        for db_field, output_field in field_mapping.items():
            logger.info(f"Checking field: {db_field}")
            if db_field in dn_data:
                value = dn_data[db_field]
                logger.info(f"  Found in DB: {value} (type: {type(value)})")
                if value is not None:
                    output[output_field] = str(value)
                    logger.info(f"  ✓ MAPPED: {db_field} -> {output_field} = {value}")
                else:
                    logger.info(f"  ✗ NULL VALUE: {db_field} is None - leaving blank")
            else:
                logger.info(f"  ✗ NOT FOUND: {db_field} not in DN data - leaving blank")
        
        # Additional field mappings
        logger.info(f"=== ADDITIONAL FIELD MAPPINGS ===")
        
        # "Demand Note Date" comes from dn_received_date
        if "dn_received_date" in dn_data and dn_data["dn_received_date"] is not None:
            output["Demand Note Date"] = str(dn_data["dn_received_date"])
            logger.info(f"✓ MAPPED: dn_received_date -> Demand Note Date = {dn_data['dn_received_date']}")
        else:
            logger.info(f"✗ dn_received_date not found or null - leaving 'Demand Note Date' blank")
        
        # "Difference from, DN date - DN Sent to Central team (ARTL)" is calculated as days between today and demand note date
        if "dn_received_date" in dn_data and dn_data["dn_received_date"] is not None:
            try:
                dn_date = dn_data["dn_received_date"]
                if isinstance(dn_date, str):
                    dn_date = datetime.strptime(dn_date, "%Y-%m-%d").date()
                elif hasattr(dn_date, 'date'):
                    dn_date = dn_date.date()
                else:
                    dn_date = dn_date
                
                today = datetime.now().date()
                days_difference = (today - dn_date).days
                output["Difference from, DN date  - DN Sent to Central team (ARTL)"] = str(days_difference)
                logger.info(f"✓ CALCULATED: Days difference between {today} and {dn_date} = {days_difference}")
            except Exception as e:
                logger.error(f"✗ Error calculating days difference: {e}")
        else:
            logger.info(f"✗ Cannot calculate days difference - dn_received_date not available")
        
        # "Additional Remarks" should always be blank
        output["Additional Remarks"] = ""
        logger.info(f"✓ SET: Additional Remarks = '' (always blank)")
        
        # Calculate derived fields based on database data
        logger.info(f"=== STEP 3: CALCULATING DERIVED FIELDS ===")
        
        # "Not part of capping" (License Fee/Rental Payment /Way Leave charges etc.)
        ground_rent = dn_data.get("ground_rent")
        logger.info(f"Ground rent from DB: {ground_rent} (type: {type(ground_rent)})")
        if ground_rent is not None:
            output["Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)"] = str(ground_rent)
            logger.info(f"✓ Set 'Not part of capping' = {ground_rent}")
        else:
            logger.info(f"✗ Ground rent is None - leaving 'Not part of capping' blank")
        
        # "Covered under capping" (Restoration Charges, admin, registration etc.)
        # This should be actual_total_non_refundable - ground_rent
        actual_total_non_refundable = dn_data.get("actual_total_non_refundable")
        logger.info(f"Actual total non-refundable from DB: {actual_total_non_refundable} (type: {type(actual_total_non_refundable)})")
        
        if actual_total_non_refundable is not None and ground_rent is not None:
            try:
                covered_under_capping = float(actual_total_non_refundable) - float(ground_rent)
                logger.info(f"Calculated covered under capping: {actual_total_non_refundable} - {ground_rent} = {covered_under_capping}")
                if covered_under_capping > 0:
                    output["Covered under capping (Restoration Charges, admin, registration etc.)"] = str(covered_under_capping)
                    logger.info(f"✓ Set 'Covered under capping' = {covered_under_capping}")
                else:
                    logger.info(f"✗ Covered under capping <= 0 ({covered_under_capping}) - leaving blank")
            except (ValueError, TypeError) as e:
                logger.error(f"✗ Error calculating covered under capping: {e}")
        else:
            logger.info(f"✗ Cannot calculate covered under capping - missing values:")
            if actual_total_non_refundable is None:
                logger.info(f"  - actual_total_non_refundable is None")
            if ground_rent is None:
                logger.info(f"  - ground_rent is None")
        
        # "Non Refundable Cost" (Amount to process for payment should be sum of 'A' + 'B' + 'AA')
        # This should be the sum of "Not part of capping" + "Covered under capping"
        try:
            not_part_of_capping = float(dn_data.get("ground_rent", 0) or 0)
            covered_under_capping_value = float(output.get("Covered under capping (Restoration Charges, admin, registration etc.)", 0) or 0)
            total_non_refundable_cost = not_part_of_capping + covered_under_capping_value
            logger.info(f"Calculated total non-refundable cost: {not_part_of_capping} + {covered_under_capping_value} = {total_non_refundable_cost}")
            if total_non_refundable_cost > 0:
                output["Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')"] = str(total_non_refundable_cost)
                logger.info(f"✓ Set 'Non Refundable Cost' = {total_non_refundable_cost}")
            else:
                logger.info(f"✗ Total non-refundable cost <= 0 ({total_non_refundable_cost}) - leaving blank")
        except (ValueError, TypeError) as e:
            logger.error(f"✗ Error calculating total non-refundable cost: {e}")
    else:
        logger.info("=== NO DN DATA - ALL DATABASE FIELDS WILL REMAIN BLANK ===")
    
    logger.info(f"=== FINAL OUTPUT SUMMARY ===")
    for key, value in output.items():
        if value == "" or value is None:
            logger.info(f"  BLANK: {key}")
        else:
            logger.info(f"  FILLED: {key} = {value}")
    
    logger.info(f"Generated non-refundable output with {len(output)} fields")
    return output

def generate_sd_output(dn_number: str, authority: str) -> Dict[str, Any]:
    """
    Generate SD output by querying database and using hardcoded values.
    
    Args:
        dn_number: The demand note number
        authority: The authority name (MCGM, NMMC, etc.)
        
    Returns:
        Dictionary containing all SD fields
    """
    logger.info(f"Generating SD output for DN: {dn_number}, Authority: {authority}")
    
    # Query database for DN data
    dn_data = query_dn_master(dn_number)
    
    # Initialize output with default values
    output = {
        "SD OU Circle Name": "MUM",
        "Execution Partner Vendor Code": "",
        "Execution Partner Vendor Name": "Excel Telesonic India Private Limited",
        "Execution Partner GBPA PO No.": "",
        "GIS Code": "",
        "M6 Code": "",
        "Locator ID": "61027-IP01-2948564-CONT1210",
        "Mother Work Order": "",
        "Child Work Order": "",
        "FA Location": "Mumbai",
        "Partner PO circle": "MUM",
        "Unique route id": "",
        "Supplier Code": "",
        "Supplier site name": "",
        "NFA no.": "",
        "Payment type": "SD",
        "DN No": dn_number,
        "DN Date": "",
        "SD Amount": "",
        "SD Time Period": "2 years"
    }
    
    # Populate with database data if available
    if dn_data:
        # Map DN master fields to SD output fields
        field_mapping = {
            "dn_received_date": "DN Date",
            "deposit": "SD Amount"
        }
        
        for db_field, output_field in field_mapping.items():
            if db_field in dn_data and dn_data[db_field]:
                output[output_field] = str(dn_data[db_field])
    
    logger.info(f"Generated SD output with {len(output)} fields")
    return output

def unified_parser(dn_number: str, authority: str, output_type: str = "both") -> Dict[str, Any]:
    """
    Main unified parser function that generates both non-refundable and SD outputs.
    
    Args:
        dn_number: The demand note number
        authority: The authority name (MCGM, NMMC, etc.)
        output_type: "non_refundable", "sd", or "both"
        
    Returns:
        Dictionary containing the requested output(s)
    """
    logger.info(f"Starting unified parser for DN: {dn_number}, Authority: {authority}, Type: {output_type}")
    
    try:
        result = {}
        
        if output_type in ["non_refundable", "both"]:
            result["non_refundable"] = generate_non_refundable_output(dn_number, authority)
        
        if output_type in ["sd", "both"]:
            result["sd"] = generate_sd_output(dn_number, authority)
        
        logger.info(f"Unified parser completed successfully")
        return result
        
    except Exception as e:
        logger.error(f"Error in unified parser: {str(e)}")
        return {"error": str(e)}

# Convenience functions for backward compatibility
def non_refundable_request_parser(dn_number: str, authority: str, **kwargs) -> Dict[str, Any]:
    """Wrapper for non-refundable parsing."""
    return generate_non_refundable_output(dn_number, authority)

def sd_parser(dn_number: str, authority: str, **kwargs) -> Dict[str, Any]:
    """Wrapper for SD parsing."""
    return generate_sd_output(dn_number, authority) 