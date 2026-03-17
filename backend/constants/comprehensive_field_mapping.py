"""
Comprehensive Field Mapping System
This file defines ALL field mappings across ALL output tables.
Ensures complete coverage of all fields used in the system.
"""

# =============================================================================
# COMPLETE FIELD LIST (From VALIDATE_PARSER_FIELDS)
# =============================================================================

# All fields that can appear in the validation parsers table
ALL_VALIDATION_FIELDS = [
    'route_type', 'ip1_co_built', 'dn_recipient', 'project_name', 'route_id_site_id', 'uid',
    'build_type', 'category_type', 'survey_id', 'po_number', 'po_length', 'parent_route', 'ce_route_lmc_id',
    'route_lmc_section_id', 'route_lmc_subsection_id', 'application_number', 'application_length_mtr', 'application_date',
    'from_location', 'to_location', 'authority', 'ward', 'dn_number', 'dn_length_mtr', 'dn_received_date', 'trench_type',
    'ot_length', 'surface', 'ri_rate_go_rs', 'dn_ri_amount', 'multiplying_factor', 'ground_rent', 'administrative_charge', 'trench_type',
    'supervision_charges', 'chamber_fee', 'gst', 'ri_budget_amount_per_meter', 'projected_budget_ri_amount_dn',
    'actual_total_non_refundable', 'non_refundable_amount_per_mtr', 'proj_non_refundable_savings_per_mtr', 'deposit',
    'total_dn_amount', 'new_revised_dn_number', 'new_revised_dn_against', 'internal_approval_start', 'internal_approval_end',
    'ticket_raised_date', 'dn_payment_date', 'tat_days', 'civil_completion_date', 'hdd_length', 'no_of_pits', 'pit_ri_rate',
    'proj_savings_per_dn', 'surface_wise_length', 'surface_wise_ri_amount', 'surface_wise_multiplication_factor', 'road_name', 'trench_type',
]

# =============================================================================
# COMPLETE NON-REFUNDABLE TABLE FIELDS
# =============================================================================

# All fields that can appear in the non-refundable output table
ALL_NON_REFUNDABLE_FIELDS = [
    "Intercity/Intracity- Deployment Intercity/intracity- O&M FTTH- Deployment FTTH-O&M",
    "BUSINESS UNIT", "Circle", "City", "Demand Note Reference number", "LM/BB/FTTH", "Type (UG/OH)",
    "Capping/Non Capping", "UG TYPE( HDD/ OT/ MICROTRENCHING)", "Road Types - CC/BT/TILES/ Normal Soil/kacha",
    "HDD - Number of Pits", "OH (EB Poles/MC Poles/Own Poles)", "NO OF POLES",
    "RAILWAY CROSSING/ PIPELINE CROSSING( No of crossing)", "GO RATE", "PREVIOUS DN RATE",
    "Rate/mtr- Current DN (UG/OH)", "Annual Rate/Pole( current DN)", "HDD(PIT RATE)", "Section Length (Mtr.)",
    "Total Route (MTR)", "RAILWAY/ PIPELINE/ EACH CROSSING RATE",
    "Reason (Current rate is more than GO or Previous DN)", "Annual Lease/ rent amount", "Renewal Lease/Rent date",
    "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)",
    "Covered under capping (Restoration Charges, admin, registration etc.)",
    "Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')",
    "Cost type with Cost Breakup EG.. - PROCESING FEES/ SUPERVISOIN CHARGE/ ADMIN FEES/ LICENSE FEES etc etc.",
    "GST Amount", "BG Amount", "SD Amount", "ROW APPLICATION  DATE", "Demand Note Date",
    "DN RECEIVED FROM PARTNER/AUTHORITY- DATE",
    "Difference from, DN date  - DN Sent to Central team (ARTL)", "REASON FOR DELAY (>2 DAYS)",
    "Total DN Amount ( NON REFUNDABLE+SD+ BG+ GST) To be filled by helpdesk team",
    "Supplier Code( if team have) To be filled by helpdesk team",
    "Supplier site name( if team have) To be filled by helpdesk team", "Locator Code (material)",
    "Authority( email address)", "Authority", "BENEFICIERY NAME",
    "Mode of payment(DD/ONLINE-URL/ONLINE-NEFT/BHARATKOSH", "EXECUTION PARTNER NAME",
    "Payable (Authority) Location", "Printing Location", "PO No.",
    "Business NFA NUMBER (Approved CAF) To be filled by helpdesk team", "Route Name(As per CWIP)",
    "Section Name for ROW(As per CWIP)", "NSG ID(As per CWIP)/CWO NO.",
    "Total Amount as per capping MB(Partner Scope)",
    "Cost type(restoration/ supervison/ agency changes/ admin etc)",
    "Total Amount as per capping MB(Not in Partner Scope)",
    "Cost type (way leave charges/ rent/ license etc)", "Permission Type (Primary/ Secondary)", "Additional Remarks",
]

# =============================================================================
# COMPLETE SD TABLE FIELDS
# =============================================================================

# All fields that can appear in the SD output table
ALL_SD_FIELDS = [
    "SD OU Circle Name", "Execution Partner Vendor Code", "Execution Partner Vendor Name", "Execution Partner GBPA PO No.",
    "GIS Code", "M6 Code", "Locator ID", "Mother Work Order", "Child Work Order", "FA Location", "Partner PO circle",
    "Unique route id", "Supplier Code", "Supplier site name", "NFA no.", "Payment type", "DN No", "DN Date", "SD Amount", "SD Time Period"
]

# =============================================================================
# COMPREHENSIVE FIELD MAPPING
# =============================================================================

def get_comprehensive_field_mapping():
    """
    Returns a comprehensive mapping that covers ALL possible field mappings.
    This ensures no field is left unmapped.
    """
    
    # Standard field names (internal use)
    standard_fields = {
        # Basic Information
        "route_type": "route_type",
        "ip1_co_built": "ip1_co_built",
        "dn_recipient": "dn_recipient",
        "project_name": "project_name",
        "route_id_site_id": "route_id_site_id",
        "uid": "uid",
        "build_type": "build_type",
        "category_type": "category_type",
        "survey_id": "survey_id",
        "po_number": "po_number",
        "po_length": "po_length",
        "parent_route": "parent_route",
        "ce_route_lmc_id": "ce_route_lmc_id",
        "route_lmc_section_id": "route_lmc_section_id",
        "route_lmc_subsection_id": "route_lmc_subsection_id",
        "application_number": "application_number",
        "application_length_mtr": "application_length_mtr",
        "application_date": "application_date",
        "from_location": "from_location",
        "to_location": "to_location",
        "authority": "authority",
        "ward": "ward",
        "dn_number": "dn_number",
        "dn_received_date": "dn_received_date",
        "dn_length_mtr": "dn_length_mtr",
        "trench_type": "trench_type",
        "ot_length": "ot_length",
        "surface": "surface",
        "ri_rate_go_rs": "ri_rate_go_rs",
        "dn_ri_amount": "dn_ri_amount",
        "multiplying_factor": "multiplying_factor",
        "ground_rent": "ground_rent",
        "administrative_charge": "administrative_charge",
        "supervision_charges": "supervision_charges",
        "chamber_fee": "chamber_fee",
        "gst": "gst",
        "ri_budget_amount_per_meter": "ri_budget_amount_per_meter",
        "projected_budget_ri_amount_dn": "projected_budget_ri_amount_dn",
        "actual_total_non_refundable": "actual_total_non_refundable",
        "non_refundable_amount_per_mtr": "non_refundable_amount_per_mtr",
        "proj_non_refundable_savings_per_mtr": "proj_non_refundable_savings_per_mtr",
        "deposit": "deposit",
        "total_dn_amount": "total_dn_amount",
        "new_revised_dn_number": "new_revised_dn_number",
        "new_revised_dn_against": "new_revised_dn_against",
        "internal_approval_start": "internal_approval_start",
        "internal_approval_end": "internal_approval_end",
        "ticket_raised_date": "ticket_raised_date",
        "dn_payment_date": "dn_payment_date",
        "tat_days": "tat_days",
        "civil_completion_date": "civil_completion_date",
        "hdd_length": "hdd_length",
        "no_of_pits": "no_of_pits",
        "pit_ri_rate": "pit_ri_rate",
        "proj_savings_per_dn": "proj_savings_per_dn",
        "surface_wise_length": "surface_wise_length",
        "surface_wise_ri_amount": "surface_wise_ri_amount",
        "surface_wise_multiplication_factor": "surface_wise_multiplication_factor",
        "road_name": "road_name",
    }
    
    # Validation table display names (exact field names for validation table)
    validation_display_names = {field: field for field in ALL_VALIDATION_FIELDS}
    
    # Non-refundable table display names (mapping from standard field names to display names)
    non_refundable_display_names = {
        # Map standard field names to display names
        "sr_no": "Sr No",
        "route_type": "Route Type",
        "ip1_co_built": "IP1 Co Built",
        "dn_recipient": "DN Recipient",
        "project_name": "Project Name",
        "route_id_site_id": "Route ID/Site ID",
        "uid": "UID",
        "build_type": "Build Type",
        "category_type": "Category Type",
        "survey_id": "Survey ID",
        "po_number": "PO Number",
        "po_length": "PO Length",
        "parent_route": "Parent Route",
        "ce_route_lmc_id": "CE Route LMC ID",
        "route_lmc_section_id": "Route LMC Section ID",
        "route_lmc_subsection_id": "Route LMC Subsection ID",
        "application_number": "Application Number",
        "application_length_mtr": "Application Length (Mtr.)",
        "application_date": "Application Date",
        "from_location": "From Location",
        "to_location": "To Location",
        "authority": "Authority",
        "ward": "Ward",
        "dn_number": "Demand Note Reference number",
        "dn_received_date": "DN RECEIVED FROM PARTNER/AUTHORITY- DATE",
        "dn_length_mtr": "Section Length (Mtr.)",
        "trench_type": "Type (UG/OH)",
        "ot_length": "Total Route (MTR)",
        "surface": "Road Types - CC/BT/TILES/ Normal Soil/kacha",
        "ri_rate_go_rs": "GO RATE",
                    "dn_ri_amount": "RI Amount",  # Fixed: should be "RI Amount" not "Covered under capping"
        "multiplying_factor": "Rate/mtr- Current DN (UG/OH)",
        "ground_rent": "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)",
        "administrative_charge": "Covered under capping (Restoration Charges, admin, registration etc.)",
        "supervision_charges": "Cost type with Cost Breakup EG.. - PROCESING FEES/ SUPERVISOIN CHARGE/ ADMIN FEES/ LICENSE FEES etc etc.",
        "chamber_fee": "Cost type with Cost Breakup EG.. - PROCESING FEES/ SUPERVISOIN CHARGE/ ADMIN FEES/ LICENSE FEES etc etc.",
        "gst": "GST Amount",
        "ri_budget_amount_per_meter": "PREVIOUS DN RATE",
        "projected_budget_ri_amount_dn": "Rate/mtr- Current DN (UG/OH)",
        "actual_total_non_refundable": "Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')",
        "non_refundable_amount_per_mtr": "Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')",
        "proj_non_refundable_savings_per_mtr": "Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')",
        "deposit": "SD Amount",
        "total_dn_amount": "Total DN Amount ( NON REFUNDABLE+SD+ BG+ GST) To be filled by helpdesk team",
        "new_revised_dn_number": "New/Revised DN Number",
        "new_revised_dn_against": "New/Revised DN Against",
        "internal_approval_start": "Internal Approval Start",
        "internal_approval_end": "Internal Approval End",
        "ticket_raised_date": "Ticket Raised Date",
        "dn_payment_date": "DN Payment Date",
        "tat_days": "TAT Days",
        "civil_completion_date": "Civil Completion Date",
        "hdd_length": "HDD - Number of Pits",
        "no_of_pits": "HDD - Number of Pits",
        "pit_ri_rate": "HDD(PIT RATE)",
        "proj_savings_per_dn": "Proj Savings per DN",
        "surface_wise_length": "Section Length (Mtr.)",
        "surface_wise_ri_amount": "Rate/mtr- Current DN (UG/OH)",
        "surface_wise_multiplication_factor": "Rate/mtr- Current DN (UG/OH)",
        "road_name": "Route Name(As per CWIP)",
        "trench_type": "Type (UG/OH)",
    }
    
    # SD table display names (exact field names for SD table)
    sd_display_names = {field: field for field in ALL_SD_FIELDS}
    
    # Authority-specific parser field mappings
    authority_mappings = {
        "nmmc": {
            # NMMC-specific field names to standard field names
            "rate_per_meter": "surface_wise_ri_amount",
            "multiplying_factor": "surface_wise_multiplication_factor",
            "section_length": "dn_length_mtr",
            "reinstallation_amount": "dn_ri_amount",
            "non_refundable_cost": "total_dn_amount",
            "demand_note_ref": "dn_number",
            "demand_note_date": "dn_received_date",
            "row_app_date": "application_date",
            "road_types": "surface",
            "rate_in_rs": "surface_wise_ri_amount",
            "covered_under_capping": "administrative_charge",
            "not_part_of_capping": "ground_rent",
            "gst_amount": "gst",
            "sd_amount": "deposit",
            "hdd_number_of_pits": "no_of_pits",
            "hdd_pit_rate": "pit_ri_rate",
            "total_dn_amount": "total_dn_amount",
            "supervision_charges": "supervision_charges",
            "chamber_fee": "chamber_fee",
            "hdd_length": "hdd_length",
            "surface_wise_length": "surface_wise_length",
        },
        "kdmc": {
            # KDMC-specific field names to standard field names
            "rate_per_meter": "surface_wise_ri_amount",
            "section_length": "dn_length_mtr",  # Fixed: should map to dn_length_mtr
            "security_deposit": "deposit",
            "not_part_of_capping": "ground_rent",
            "covered_under_capping": "administrative_charge",
            "demand_note_ref": "dn_number",
            "demand_note_date": "dn_received_date",
            "row_application_date": "application_date",
            "road_types": "surface",
            "supervision_charges": "supervision_charges",
            "non_refundable": "actual_total_non_refundable",
            "total_dn_amount": "total_dn_amount",
            # Add missing mappings for KDMC extracted fields
            "dn_number": "dn_number",
            "dn_received_date": "dn_received_date",
            "ug_type": "ug_type",
            "surface": "surface",
            "ri_amount": "dn_ri_amount",
            "rent": "ground_rent",
            "dn_received_from_partner_date": "dn_received_date",
            "difference_days": "difference_days",
            "ug_type": "trench_type",
            "surface_wise_length": "surface_wise_length",
            "surface_wise_ri_amount": "surface_wise_ri_amount",
            # Additional KDMC specific mappings for display names
            "Section Length (Mtr.)": "dn_length_mtr",
            "Ground Rent": "ground_rent",
            "Administrative Charge": "administrative_charge",
            "RI Amount": "dn_ri_amount",
            "Supervision Charges": "supervision_charges",
            "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)": "ground_rent",
            "Covered under capping (Restoration Charges, admin, registration etc.)": "administrative_charge",
            "Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')": "actual_total_non_refundable",
            "SD Amount": "deposit",
            "Total DN Amount ( NON REFUNDABLE+SD+ BG+ GST) To be filled by helpdesk team": "total_dn_amount",
            "PO No.": "po_number",
            "PO Length (Mtr)": "po_length",
            "Demand Note Reference number": "dn_number",
            "Demand Note Date": "dn_received_date",
            "Type (UG/OH)": "trench_type",
            "UG TYPE( HDD/ OT/ MICROTRENCHING)": "trench_type",
            "surface_wise_length": "surface_wise_length",
            "surface_wise_ri_amount": "surface_wise_ri_amount",
            "dn_ri_amount": "dn_ri_amount",
        },
        "mcgm": {
            # MCGM parser already uses standard field names, so map them to themselves
            "dn_number": "dn_number",
            "dn_received_date": "dn_received_date",
            "dn_length_mtr": "dn_length_mtr",
            "ot_length": "ot_length",
            "surface": "surface",
            "surface_wise_ri_amount": "surface_wise_ri_amount",
            "surface_wise_length": "surface_wise_length",
            "dn_ri_amount": "dn_ri_amount",
            "ground_rent": "ground_rent",
            "administrative_charge": "administrative_charge",
            "supervision_charges": "supervision_charges",
            "chamber_fee": "chamber_fee",
            "gst": "gst",
            "deposit": "deposit",
            "total_dn_amount": "total_dn_amount",
            "no_of_pits": "no_of_pits",
            "pit_ri_rate": "pit_ri_rate",
            "road_name": "road_name",
            "multiplying_factor": "multiplying_factor",  # Add missing multiplying factor
            "ri_rate_go_rs": "ri_rate_go_rs",  # Add missing ri_rate_go_rs
        },
        "mbmc": {
            # MBMC-specific field names to standard field names
            "rate_in_rs": "surface_wise_ri_amount",
            "section_length": "dn_length_mtr",
            "sd_amount": "deposit",
            "demand_note_ref": "dn_number",
            "demand_note_date": "dn_received_date",
            "row_app_date": "application_date",
            "road_types": "surface",
            "covered_under_capping": "administrative_charge",
            "not_part_of_capping": "ground_rent",
            "gst_amount": "gst",
        }
    }
    
    return {
        "standard_fields": standard_fields,
        "validation_display_names": validation_display_names,
        "non_refundable_display_names": non_refundable_display_names,
        "sd_display_names": sd_display_names,
        "authority_mappings": authority_mappings,
        "all_validation_fields": ALL_VALIDATION_FIELDS,
        "all_non_refundable_fields": ALL_NON_REFUNDABLE_FIELDS,
        "all_sd_fields": ALL_SD_FIELDS,
    }

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def map_parser_to_standard(parser_fields: dict, authority: str) -> dict:
    """
    Maps parser-specific field names to standard field names.
    """
    mapping = get_comprehensive_field_mapping()
    authority_mapping = mapping["authority_mappings"].get(authority.lower(), {})
    
    # Debug: Print authority mapping for MCGM
    if authority.lower() == "mcgm":
        print(f"[MAPPING DEBUG] MCGM authority mapping keys: {list(authority_mapping.keys())}")
        print(f"[MAPPING DEBUG] Parser fields keys: {list(parser_fields.keys())}")
    
    standard_fields = {}
    for parser_field, value in parser_fields.items():
        # First try authority-specific mapping
        if parser_field in authority_mapping:
            standard_field = authority_mapping[parser_field]
            standard_fields[standard_field] = value
            if authority.lower() == "mcgm" and value:
                print(f"[MAPPING DEBUG] Mapped '{parser_field}' -> '{standard_field}': '{value}'")
        # Then try direct mapping if it's already a standard field
        elif parser_field in mapping["standard_fields"]:
            standard_fields[parser_field] = value
            if authority.lower() == "mcgm" and value:
                print(f"[MAPPING DEBUG] Direct mapped '{parser_field}': '{value}'")
        # Otherwise, keep as is (might be a display name)
        else:
            standard_fields[parser_field] = value
            if authority.lower() == "mcgm" and value:
                print(f"[MAPPING DEBUG] Kept as is '{parser_field}': '{value}'")
    
    # Special handling for route_id_site_id - remove decimals
    if "route_id_site_id" in standard_fields and standard_fields["route_id_site_id"]:
        try:
            # Convert to float and then to int to remove decimals
            route_id_value = float(str(standard_fields["route_id_site_id"]).replace(",", ""))
            standard_fields["route_id_site_id"] = str(int(route_id_value))
        except (ValueError, TypeError):
            # If conversion fails, keep original value
            pass
    
    # Special handling for dn_number - remove decimals
    if "dn_number" in standard_fields and standard_fields["dn_number"]:
        try:
            # Convert to float and then to int to remove decimals
            dn_number_value = float(str(standard_fields["dn_number"]).replace(",", ""))
            standard_fields["dn_number"] = str(int(dn_number_value))
        except (ValueError, TypeError):
            # If conversion fails, keep original value
            pass
    
    # Special handling for po_number - remove decimals
    if "po_number" in standard_fields and standard_fields["po_number"]:
        try:
            # Convert to float and then to int to remove decimals
            po_number_value = float(str(standard_fields["po_number"]).replace(",", ""))
            standard_fields["po_number"] = str(int(po_number_value))
        except (ValueError, TypeError):
            # If conversion fails, keep original value
            pass
    
    # Special handling for application_number - remove decimals
    if "application_number" in standard_fields and standard_fields["application_number"]:
        try:
            # Convert to float and then to int to remove decimals
            app_number_value = float(str(standard_fields["application_number"]).replace(",", ""))
            standard_fields["application_number"] = str(int(app_number_value))
        except (ValueError, TypeError):
            # If conversion fails, keep original value
            pass
    

    
    # Debug: Print final standard fields for MCGM
    if authority.lower() == "mcgm":
        print(f"[MAPPING DEBUG] Final standard fields (non-empty):")
        for key, value in standard_fields.items():
            if value:
                print(f"  {key}: '{value}'")
    
    return standard_fields

def convert_standard_to_table(standard_fields: dict, table_type: str) -> dict:
    """
    Converts standard field names to table-specific display names.
    """
    mapping = get_comprehensive_field_mapping()
    
    if table_type == "validation":
        display_names = mapping["validation_display_names"]
    elif table_type == "non_refundable":
        display_names = mapping["non_refundable_display_names"]
    elif table_type == "sd":
        display_names = mapping["sd_display_names"]
    else:
        raise ValueError(f"Invalid table_type: {table_type}")
    
    # Debug: Print conversion info for validation table
    if table_type == "validation":
        print(f"[CONVERSION DEBUG] Converting to validation table")
        print(f"[CONVERSION DEBUG] Standard fields keys: {list(standard_fields.keys())}")
        print(f"[CONVERSION DEBUG] Display names keys: {list(display_names.keys())}")
    
    table_fields = {}
    for standard_field, value in standard_fields.items():
        # Try to find the display name for this standard field
        display_name = display_names.get(standard_field, standard_field)
        table_fields[display_name] = value
        
        # Debug: Print conversion for missing fields
        if table_type == "validation" and value and standard_field in ['dn_number', 'dn_received_date', 'surface', 'ri_rate_go_rs', 'dn_ri_amount', 'multiplying_factor']:
            print(f"[CONVERSION DEBUG] '{standard_field}' -> '{display_name}': '{value}'")
    
    return table_fields

def ensure_all_fields_present(data: dict, table_type: str) -> dict:
    """
    Ensures all required fields are present in the data, filling missing ones with empty strings.
    """
    mapping = get_comprehensive_field_mapping()
    
    if table_type == "validation":
        required_fields = mapping["all_validation_fields"]
    elif table_type == "non_refundable":
        required_fields = mapping["all_non_refundable_fields"]
    elif table_type == "sd":
        required_fields = mapping["all_sd_fields"]
    else:
        raise ValueError(f"Invalid table_type: {table_type}")
    
    complete_data = {}
    for field in required_fields:
        complete_data[field] = data.get(field, "")
    
    return complete_data 