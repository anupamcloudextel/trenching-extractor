import * as XLSX from "xlsx";
import { getBudgetMasterBySiteId, getBudgetMasterBySurveyIds, uploadBudgetMasterRows } from "@/lib/localDb";

// Budget table headers and numeric columns (schema matches backend budget_master)
export const budgetHeaders = [
  "id",
  "route_id_site_id",
  "ce_length_mtr",
  "ri_cost_per_meter",
  "material_cost_per_meter",
  "build_cost_per_meter",
  "total_ri_amount",
  "material_cost",
  "execution_cost_including_hh",
  "total_cost_without_deposit",
  "route_type",
  "survey_id",
  "existing_new",
  "build_type",
  "category_type"
];

export const numericColumns = new Set([
  "ce_length_mtr",
  "ri_cost_per_meter",
  "material_cost_per_meter",
  "build_cost_per_meter",
  "total_ri_amount",
  "material_cost",
  "execution_cost_including_hh",
  "total_cost_without_deposit"
]);

export type BudgetData = {
  id?: number;
  route_id_site_id: string | null;
  ce_length_mtr: number | null;
  ri_cost_per_meter: number | null;
  material_cost_per_meter: number | null;
  build_cost_per_meter: number | null;
  total_ri_amount: number | null;
  material_cost: number | null;
  execution_cost_including_hh: number | null;
  total_cost_without_deposit: number | null;
  route_type: string | null;
  survey_id: string | null;
  existing_new: string | null;
  build_type: string | null;
  category_type: string | null;
};

// Parse and clean Excel file
export function parseAndCleanExcel(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        console.log("[parseAndCleanExcel] Raw JSON from XLSX:", json);
        const cleaned = json.map(cleanRow);
        console.log("[parseAndCleanExcel] Cleaned rows:", cleaned);
        resolve(cleaned);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Clean a row to match budget_master schema
export function cleanRow(row: any) {
  console.log("[cleanRow] Row keys:", Object.keys(row));
  const cleaned: any = {};
  for (const key of budgetHeaders) {
    const normalize = (str: string) => str.replace(/\s|\_/g, '').toLowerCase();
    const foundKey = Object.keys(row).find(
      k => normalize(k) === normalize(key)
    );
    let value = foundKey ? row[foundKey] : null;
    if (key === "survey_id" || key === "existing_new") {
      console.log(`[cleanRow] Mapping ${key}: foundKey=`, foundKey, ", value=", value);
    }
    if (value === "" || value === undefined) {
      value = null;
    } else if (numericColumns.has(key)) {
      if (typeof value === "number") {
        value = Math.round(value * 100) / 100;
      } else if (!isNaN(Number(value)) && value !== null && value !== "") {
        value = Math.round(Number(value) * 100) / 100;
      } else {
        value = null;
      }
    }
    cleaned[key] = value;
  }
  console.log("[cleanRow] Cleaned row:", cleaned);
  return cleaned;
}

// Force all empty strings in an object to null
export function forceNulls(obj: any) {
  for (const k in obj) {
    if (obj[k] === "") obj[k] = null;
  }
  // Always remove id (autoincrementing PK)
  delete obj.id;
  return obj;
}

// Upload to local DB (bulk replace by site IDs)
export async function uploadToSupabase(rows: any[]) {
  const cleanedRows = rows.map(forceNulls);
  cleanedRows.forEach((row, rowIndex) => {
    for (const col of numericColumns) {
      if (row[col] !== null && typeof row[col] !== "number") {
        console.error(
          `[uploadBudget] Non-numeric value in numeric column: Row ${rowIndex + 2}, Column "${col}", Value: "${row[col]}"`
        );
      }
    }
  });
  console.time('uploadBudget');
  const { error } = await uploadBudgetMasterRows(cleanedRows);
  console.timeEnd('uploadBudget');
  if (error) {
    return { data: null, error: { message: error.message, details: error.details } };
  }
  return { data: null, error: null };
}

// Query by SiteID
export async function queryBySiteId(siteId: string, columns: string[]) {
  return await getBudgetMasterBySiteId(siteId, columns);
}

// Query material cost per meter by SiteID
export async function getMaterialCostPerMeter(siteId: string): Promise<number> {
  const { data, error } = await getBudgetMasterBySiteId(siteId, ["material_cost_per_meter"]);
  
  if (error || !data || data.material_cost_per_meter === null || data.material_cost_per_meter === undefined) {
    console.log(`[MATERIAL_COST] No material_cost_per_meter found for ${siteId}, using fallback 270`);
    return 270;
  }
  console.log(`[MATERIAL_COST] Found material_cost_per_meter for ${siteId}: ${data.material_cost_per_meter}`);
  return Number(data.material_cost_per_meter);
}

// Query service cost per meter by SiteID
export async function getServiceCostPerMeter(siteId: string): Promise<number> {
  const { data, error } = await getBudgetMasterBySiteId(siteId, ["build_cost_per_meter"]);
  
  if (error || !data || data.build_cost_per_meter === null || data.build_cost_per_meter === undefined) {
    console.log(`[SERVICE_COST] No build_cost_per_meter found for ${siteId}, using fallback 1100`);
    return 1100;
  }
  console.log(`[SERVICE_COST] Found build_cost_per_meter for ${siteId}: ${data.build_cost_per_meter}`);
  return Number(data.build_cost_per_meter);
}

// Query by Survey IDs (for Route)
export async function queryBySurveyIds(surveyIds: string[], columns: string[]) {
  if (!surveyIds || surveyIds.length === 0) return { data: [], error: null };
  return await getBudgetMasterBySurveyIds(surveyIds, columns);
} 