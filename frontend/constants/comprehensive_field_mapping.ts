/**
 * Comprehensive Field Mapping System - Frontend
 * This file defines ALL field mappings across ALL output tables for the frontend.
 */

// =============================================================================
// COMPLETE FIELD LIST (From VALIDATE_PARSER_FIELDS)
// =============================================================================

// All fields that can appear in the validation parsers table
// Ordered with populated fields first, then empty fields
export const ALL_VALIDATION_FIELDS = [
    // Basic route and project info (usually populated)
    'route_type', 'ip1_co_built', 'dn_recipient', 'project_name', 'route_id_site_id', 'uid',
    'po_number', 'po_length', 'parent_route',
    
    // Application info (usually populated)
    'application_number', 'application_length_mtr', 'application_date', 'from_location', 'to_location', 'ward',
    
    // Surface and road info (usually populated)
    'surface', 'road_name',
    
    // Financial calculations (usually populated)
    'ri_budget_amount_per_meter', 'projected_budget_ri_amount_dn', 'actual_total_non_refundable', 
    'non_refundable_amount_per_mtr', 'proj_non_refundable_savings_per_mtr', 'deposit', 'total_dn_amount',
    'proj_savings_per_dn', 'surface_wise_length', 'surface_wise_ri_amount', 'surface_wise_multiplication_factor',
    
    // Empty/optional fields (usually empty)
    'build_type', 'category_type', 'ce_route_lmc_id', 'route_lmc_section_id', 
    'route_lmc_subsection_id', 'authority', 'dn_number', 'dn_length_mtr', 'dn_received_date', 'trench_type',
    'ot_length', 'dn_ri_amount', 'ground_rent', 'administrative_charge', 'supervision_charges', 'chamber_fee', 'gst',
    'new_revised_dn_number', 'new_revised_dn_against', 'internal_approval_start', 'internal_approval_end',
    'ticket_raised_date', 'dn_payment_date', 'tat_days', 'civil_completion_date', 'hdd_length', 'no_of_pits', 'pit_ri_rate',
];

// =============================================================================
// COMPLETE NON-REFUNDABLE TABLE FIELDS
// =============================================================================

// All fields that can appear in the non-refundable output table
export const ALL_NON_REFUNDABLE_FIELDS = [
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
];

// =============================================================================
// COMPLETE SD TABLE FIELDS
// =============================================================================

// All fields that can appear in the SD output table
export const ALL_SD_FIELDS = [
    "SD OU Circle Name", "Execution Partner Vendor Code", "Execution Partner Vendor Name", "Execution Partner GBPA PO No.",
    "GIS Code", "M6 Code", "Locator ID", "Mother Work Order", "Child Work Order", "FA Location", "Partner PO circle",
    "Unique route id", "Supplier Code", "Supplier site name", "NFA no.", "Payment type", "DN No", "DN Date", "SD Amount", "SD Time Period"
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Maps parser-specific field names to standard field names
 */
export function mapParserToStandard(parserFields: Record<string, any>, authority: string): Record<string, any> {
    // Authority-specific field mappings
    const authorityMappings: Record<string, Record<string, string>> = {
        "nmmc": {
            "rate_per_meter": "surface_wise_ri_amount",

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
            "rate_per_meter": "surface_wise_ri_amount",
            "section_length": "dn_length_mtr",
            "security_deposit": "deposit",
            "not_part_of_capping": "ground_rent",
            "covered_under_capping": "administrative_charge",
            "demand_note_ref": "dn_number",
            "demand_note_date": "dn_received_date",
            "row_application_date": "application_date",
            "road_types": "surface",
            "Road Types - CC/BT/TILES/ Normal Soil/kacha": "surface",
            "supervision_charges": "supervision_charges",
            "non_refundable": "actual_total_non_refundable",
            "total_dn_amount": "total_dn_amount",
            // Additional KDMC specific mappings
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
            "ri_amount": "dn_ri_amount",
        },
        "mcgm": {
            "dn_number": "dn_number",
            "dn_received_date": "dn_received_date",
            "dn_length_mtr": "dn_length_mtr",
            "ot_length": "ot_length",
            "surface": "surface",
            "Road Types": "surface",  // Map backend 'Road Types' to surface
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

            "ri_rate_go_rs": "surface_wise_ri_amount",  // Map GO rate to surface-wise RI amount
        },
        "mbmc": {
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
    };

    const authorityMapping = authorityMappings[authority.toLowerCase()] || {};
    
    const standardFields: Record<string, any> = {};
    for (const [parserField, value] of Object.entries(parserFields)) {
        // First try authority-specific mapping
        if (parserField in authorityMapping) {
            standardFields[authorityMapping[parserField]] = value;
        }
        // Then try direct mapping if it's already a standard field
        else if (ALL_VALIDATION_FIELDS.includes(parserField)) {
            standardFields[parserField] = value;
        }
        // Otherwise, keep as is (might be a display name)
        else {
            standardFields[parserField] = value;
        }
    }
    
    // Special handling for route_id_site_id - remove decimals
    if (standardFields["route_id_site_id"] && standardFields["route_id_site_id"] !== "") {
        try {
            // Convert to float and then to int to remove decimals
            const routeIdValue = parseFloat(String(standardFields["route_id_site_id"]).replace(/,/g, ""));
            standardFields["route_id_site_id"] = String(Math.floor(routeIdValue));
        } catch (error) {
            // If conversion fails, keep original value
        }
    }
    
    // Special handling for dn_number - remove decimals
    if (standardFields["dn_number"] && standardFields["dn_number"] !== "") {
        try {
            // Convert to float and then to int to remove decimals
            const dnNumberValue = parseFloat(String(standardFields["dn_number"]).replace(/,/g, ""));
            standardFields["dn_number"] = String(Math.floor(dnNumberValue));
        } catch (error) {
            // If conversion fails, keep original value
        }
    }
    
    // Special handling for po_number - remove decimals
    if (standardFields["po_number"] && standardFields["po_number"] !== "") {
        try {
            // Convert to float and then to int to remove decimals
            const poNumberValue = parseFloat(String(standardFields["po_number"]).replace(/,/g, ""));
            standardFields["po_number"] = String(Math.floor(poNumberValue));
        } catch (error) {
            // If conversion fails, keep original value
        }
    }
    
    // Special handling for application_number - remove decimals
    if (standardFields["application_number"] && standardFields["application_number"] !== "") {
        try {
            // Convert to float and then to int to remove decimals
            const appNumberValue = parseFloat(String(standardFields["application_number"]).replace(/,/g, ""));
            standardFields["application_number"] = String(Math.floor(appNumberValue));
        } catch (error) {
            // If conversion fails, keep original value
        }
    }
    

    
    return standardFields;
}

/**
 * Converts standard field names to table-specific display names
 */
export function convertStandardToTable(standardFields: Record<string, any>, tableType: string): Record<string, any> {
    let displayNames: Record<string, string> = {};
    
    if (tableType === "validation") {
        // For validation table, use field names as display names
        displayNames = Object.fromEntries(ALL_VALIDATION_FIELDS.map(field => [field, field]));
    } else if (tableType === "non_refundable") {
        // For non-refundable table, map standard field names to display names
        displayNames = {
            // Map standard field names to display names
            "route_type": "Route Type",
            "ip1_co_built": "IP1 Co Built",
            "dn_recipient": "DN Recipient",
            "project_name": "Project Name",
            "route_id_site_id": "Route ID/Site ID",
            "uid": "UID",
            "build_type": "Build Type",
            "category_type": "Category Type",
            // Removed survey_id - no longer needed with one budget per route
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

            "dn_ri_amount": "RI Amount",  // Changed from "Covered under capping" to "RI Amount"

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
        };
    } else if (tableType === "sd") {
        // For SD table, use the exact display names
        displayNames = Object.fromEntries(ALL_SD_FIELDS.map(field => [field, field]));
    } else {
        throw new Error(`Invalid table_type: ${tableType}`);
    }
    
    const tableFields: Record<string, any> = {};
    for (const [standardField, value] of Object.entries(standardFields)) {
        // Try to find the display name for this standard field
        const displayName = displayNames[standardField] || standardField;
        tableFields[displayName] = value;
    }
    
    return tableFields;
}

/**
 * Ensures all required fields are present in the data, filling missing ones with empty strings
 */
export function ensureAllFieldsPresent(data: Record<string, any>, tableType: string): Record<string, any> {
    let requiredFields: string[] = [];
    
    if (tableType === "validation") {
        requiredFields = ALL_VALIDATION_FIELDS;
    } else if (tableType === "non_refundable") {
        requiredFields = ALL_NON_REFUNDABLE_FIELDS;
    } else if (tableType === "sd") {
        requiredFields = ALL_SD_FIELDS;
    } else {
        throw new Error(`Invalid table_type: ${tableType}`);
    }
    
    const completeData: Record<string, any> = {};
    for (const field of requiredFields) {
        completeData[field] = data[field] || "";
    }
    
    return completeData;
}

/**
 * Gets the column headers for a specific table type
 */
export function getTableColumns(tableType: string): string[] {
    if (tableType === "validation") {
        return ALL_VALIDATION_FIELDS;
    } else if (tableType === "non_refundable") {
        return ALL_NON_REFUNDABLE_FIELDS;
    } else if (tableType === "sd") {
        return ALL_SD_FIELDS;
    } else {
        throw new Error(`Invalid table_type: ${tableType}`);
    }
} 