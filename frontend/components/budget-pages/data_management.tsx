import React from 'react';
import { useState, useRef, useEffect } from "react";
import * as XLSX from 'xlsx';
import { getPoMasterSiteIds, getPoMasterBySiteId, getBudgetMasterBySiteId } from "@/lib/localDb";
import { queryBySiteId } from "@/lib/lmcLogic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, FileText, Shield, XCircle, Loader2, ChevronDown, Search } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Input as ShadcnInput } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MultiSelect } from "@/components/ui/multiselect";
// import axios from 'axios';

// Date columns in the DB schema
const DATE_COLUMNS = [
  "application_date",
  "dn_received_date",
  "internal_approval_start",
  "internal_approval_end",
  "ticket_raised_date",
  "dn_payment_date",
  "civil_completion_date"
];

export const MANUAL_FIELDS = [
  "new_revised_dn_number",
  "new_revised_dn_against",
  "internal_approval_start",
  "internal_approval_end",
  "ticket_raised_date",
  "dn_payment_date",
  "tat_days",
  "civil_completion_date"
];

// Import centralized field mapping
import { ALL_VALIDATION_FIELDS as VALIDATION_FIELDS } from "@/constants/comprehensive_field_mapping";

// List of fields to display in Validate Parsers output, in order, as-is
// Now using centralized field mapping
export const VALIDATE_PARSER_FIELDS = VALIDATION_FIELDS;

const PERMIT_FIELDS = [
  { key: 'permission_receipt_date', label: 'Permission Receipt Date' },
  { key: 'permit_no', label: 'Permit No' },
  { key: 'permit_start_date', label: 'Permit Start Date' },
  { key: 'permit_end_date', label: 'Permit End Date' },
  { key: 'permitted_length_by_ward_mts', label: 'Permitted Length by Ward (mts)' },
];

export default function DnManagementSection() {
  // State for 3-file upload
  const [dnAppFile, setDnAppFile] = useState<File | null>(null);
  const [dnFile, setDnFile] = useState<File | null>(null);
  const [appParseResult, setAppParseResult] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);

  // DN Master File Upload state
  const [dnMasterFile, setDnMasterFile] = useState<File | null>(null);
  const [dnUploading, setDnUploading] = useState(false);
  const [dnError, setDnError] = useState<string | null>(null);
  const [dnSuccess, setDnSuccess] = useState<string | null>(null);

  // PO File Upload state
  const [poSiteId, setPoSiteId] = useState("");
  const [poSiteIdOptions, setPoSiteIdOptions] = useState<string[]>([]);
  const [poSiteIdDropdownOpen, setPoSiteIdDropdownOpen] = useState(false);
  const [poHeaders, setPoHeaders] = useState<string[]>([]);
  const [poSiteIdColIdx, setPoSiteIdColIdx] = useState<number>(-1);
  const [poSiteIdDebugVals, setPoSiteIdDebugVals] = useState<any[]>([]);
  const [poParseResult, setPoParseResult] = useState<any | null>(null);
  const [poUploading, setPoUploading] = useState(false);

  // DN File Upload state
  const [dnAuthority, setDnAuthority] = useState("MBMC");
  const [dnParseResult, setDnParseResult] = useState<any | null>(null);
  const [dnParsing, setDnParsing] = useState(false);
  const [showAuthorityDropdown, setShowAuthorityDropdown] = useState(false);

  // New state for validation
  const [validationResults, setValidationResults] = useState<any[]>([]);
  const [validating, setValidating] = useState(false);
  const [riCostPerMeter, setRiCostPerMeter] = useState<string | null>(null);
  const [showProRatedInput, setShowProRatedInput] = useState(false);
  const [proRatedRiCostPerMeter, setProRatedRiCostPerMeter] = useState("");

  // New state for Site ID input focus
  const [siteIdInputFocused, setSiteIdInputFocused] = useState(false);

  // New state for validation error
  const [validateError, setValidateError] = useState<string | null>(null);

  // New state for sending to Master DN
  const [sendingToMasterDN, setSendingToMasterDN] = useState(false);
  const [sendToMasterDNSuccess, setSendToMasterDNSuccess] = useState<string | null>(null);
  const [sendToMasterDNError, setSendToMasterDNError] = useState<string | null>(null);

  const [isRouteSelected, setIsRouteSelected] = useState(false);
  // Removed survey_id state variables - now using one budget per route

  const [poNumberType, setPoNumberType] = useState<'IP1' | 'Co-Built' | null>(null);
  const [poNumberTypeConfirmed, setPoNumberTypeConfirmed] = useState<'IP1' | 'Co-Built' | null>(null);
  const [poNoIp1, setPoNoIp1] = useState<string>("");
  const [poNoCoBuild, setPoNoCoBuild] = useState<string>("");

  // New state for PO row info
  const [poRowRouteType, setPoRowRouteType] = useState<string>("");
  const [poRowNoIp1, setPoRowNoIp1] = useState<string>("");
  const [poRowNoCoBuild, setPoRowNoCoBuild] = useState<string>("");
  const [poRowRouteLM, setPoRowRouteLM] = useState("");

  // Add state for PO Number Type error
  const [poNumberTypeError, setPoNumberTypeError] = useState<string | null>(null);

  const [poLengthIp1, setPoLengthIp1] = useState<string | number>("");
  const [poLengthCoBuild, setPoLengthCoBuild] = useState<string | number>("");

  // Add state
  const [checkingProRated, setCheckingProRated] = useState(false);

  // Add state for build_type and category_type
  const [buildType, setBuildType] = useState("");
  const [categoryType, setCategoryType] = useState("");

  const { toast } = useToast();

  const [pdfDebugResult, setPdfDebugResult] = useState<{ text: string, tables: string[][][] } | null>(null);
  const [pdfDebugLoading, setPdfDebugLoading] = useState(false);
  const [pdfDebugError, setPdfDebugError] = useState<string | null>(null);

  const [mcgmAppDebugFile, setMcgmAppDebugFile] = useState<File | null>(null);
  const [mcgmAppDebugText, setMcgmAppDebugText] = useState<string>("");
  const [mcgmAppDebugLoading, setMcgmAppDebugLoading] = useState(false);
  const [mcgmAppDebugError, setMcgmAppDebugError] = useState<string | null>(null);

  // Permit PDF upload state
  const [permitFile, setPermitFile] = useState<File | null>(null);
  const [permitUploadStatus, setPermitUploadStatus] = useState<string | null>(null);
  const [permitUploading, setPermitUploading] = useState(false);
  const [permitPreview, setPermitPreview] = useState<any | null>(null);
  const [permitEdit, setPermitEdit] = useState<any | null>(null);
  const [permitSaving, setPermitSaving] = useState(false);
  const [permitSaveStatus, setPermitSaveStatus] = useState<string | null>(null);

  // Master PO File Upload state
  const [poMasterFile, setPoMasterFile] = useState<File | null>(null);
  const [poMasterUploading, setPoMasterUploading] = useState(false);
  const [poMasterError, setPoMasterError] = useState<string | null>(null);
  const [poMasterSuccess, setPoMasterSuccess] = useState<string | null>(null);

  // Master Budget File Upload state
  const [budgetMasterFile, setBudgetMasterFile] = useState<File | null>(null);
  const [budgetMasterUploading, setBudgetMasterUploading] = useState(false);
  const [budgetMasterError, setBudgetMasterError] = useState<string | null>(null);
  const [budgetMasterSuccess, setBudgetMasterSuccess] = useState<string | null>(null);

  const handlePermitFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPermitFile(e.target.files[0]);
      setPermitUploadStatus(null);
      setPermitPreview(null);
      setPermitEdit(null);
      setPermitSaveStatus(null);
    }
  };

  const handlePermitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permitFile) {
      setPermitUploadStatus('Please select a PDF file.');
      return;
    }
    setPermitUploading(true);
    setPermitUploadStatus(null);
    setPermitPreview(null);
    setPermitEdit(null);
    setPermitSaveStatus(null);
    const formData = new FormData();
    formData.append('file', permitFile);
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/parse-permit', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setPermitPreview(data);
        setPermitEdit(data);
        setPermitUploadStatus('Permit PDF uploaded and parsed. Review and edit below.');
      } else {
        setPermitUploadStatus('Error uploading or processing permit PDF.');
      }
    } catch (err: any) {
      setPermitUploadStatus('Error uploading or processing permit PDF.');
    } finally {
      setPermitUploading(false);
    }
  };

  const handlePermitEditChange = (key: string, value: string) => {
    setPermitEdit((prev: any) => ({ ...prev, [key]: value }));
  };

  const handlePermitSave = async () => {
    setPermitSaving(true);
    setPermitSaveStatus(null);
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/upsert-permit-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permitEdit),
      });
      if (res.ok) {
        setPermitSaveStatus('Permit fields saved to database!');
      } else {
        setPermitSaveStatus('Error saving permit fields to database.');
      }
    } catch (err: any) {
      setPermitSaveStatus('Error saving permit fields to database.');
    } finally {
      setPermitSaving(false);
    }
  };

  // Fetch RI Cost per Meter from Supabase when poSiteId changes
  useEffect(() => {
    if (poSiteId) {
      queryBySiteId(poSiteId, ["ri_cost_per_meter"]).then(res => {
        if (!res.data || res.data.ri_cost_per_meter === undefined) {
          setRiCostPerMeter(null);
        } else {
          setRiCostPerMeter(res.data.ri_cost_per_meter);
        }
      });
    } else {
      setRiCostPerMeter(null);
    }
  }, [poSiteId]);

  // Log validationResults for mapping debug
  useEffect(() => {
    // Removed debug logging
  }, [validationResults]);

  // 1. On mount, fetch all unique route_id_site_id values from po_master (local DB)
  useEffect(() => {
    async function fetchSiteIdsFromDB() {
      const { data, error } = await getPoMasterSiteIds();
      if (!error && data) {
        const unique = Array.isArray(data) ? data : (data as any[]).map((row: any) => row?.route_id_site_id).filter(Boolean);
        setPoSiteIdOptions(unique);
      }
    }
    fetchSiteIdsFromDB();
  }, []);

  // Fetch survey_id options when poSiteId changes, only if route_type === 'Route'
  // Removed fetchSurveyIdsAndCheckRoute useEffect - no longer needed with one budget per route

  // Simplified RI cost per meter check - now using one budget per route
  const checkRiCostPerMeter = async (siteId: string) => {
    setCheckingProRated(true);
    if (!siteId) {
      setRiCostPerMeter(null);
      setShowProRatedInput(false);
      setProRatedRiCostPerMeter("");
      setCheckingProRated(false);
      return;
    }
    const { data, error } = await getBudgetMasterBySiteId(siteId);
    if (!error && data) {
      console.log(`🔧 checkRiCostPerMeter debug:`);
      console.log(`  data.ri_cost_per_meter: ${data.ri_cost_per_meter} (type: ${typeof data.ri_cost_per_meter})`);
      console.log(`  String(data.ri_cost_per_meter): ${String(data.ri_cost_per_meter)}`);
      console.log(`  Number(data.ri_cost_per_meter): ${Number(data.ri_cost_per_meter)}`);
      console.log(`  JSON.stringify(data): ${JSON.stringify(data)}`);
      
      // Use the database value as-is - it's already correct
      const riCostValue = data.ri_cost_per_meter || 0;
      console.log(`🔧 Using ri_cost_per_meter from database: ${riCostValue}`);
      
      setRiCostPerMeter(String(riCostValue));
      setBuildType(data.build_type || "");
      setCategoryType(data.category_type || "");
      setShowProRatedInput(false);
    }
    setCheckingProRated(false);
  };

  // Check RI cost when poSiteId changes
  useEffect(() => {
    checkRiCostPerMeter(poSiteId);
  }, [poSiteId]);

  // When validationResults or route_type changes, update PO number options if route_type is 'Route'
  useEffect(() => {
    // Find the PO row
    const poRow = validationResults.find(row => normalizeFieldName(row.source) === 'po');
    // Find route_type
    const routeType = getValidateParserFieldValueRaw('route_type');
    if (String(routeType).replace(/\s+/g, '').toLowerCase() === 'route') {
      // Find both PO numbers from validationResults
      let ip1 = "";
      let cobuild = "";
      for (const row of validationResults) {
        if (normalizeFieldName(row.field).includes('po_no_ip1')) ip1 = row.value;
        if (normalizeFieldName(row.field).includes('po_no_cobuild')) cobuild = row.value;
      }
      setPoNoIp1(ip1);
      setPoNoCoBuild(cobuild);
      // Do NOT set poNumberType here; let the user control it
    } else {
      setPoNumberType(null);
      setPoNoIp1("");
      setPoNoCoBuild("");
    }
  }, [validationResults]);

  // Fetch PO row info as soon as poSiteId changes
  useEffect(() => {
    if (!poSiteId) {
      setPoRowRouteType("");
      setPoRowNoIp1("");
      setPoRowNoCoBuild("");
      setPoRowRouteLM("");
      setPoLengthIp1("");
      setPoLengthCoBuild("");
      setPoNumberType(null);
      setBuildType("");
      setCategoryType("");
      return;
    }
    async function fetchPoRow() {
      console.log(`🔧 fetchPoRow debug: poSiteId=${poSiteId}`);
      let { data, error } = await getPoMasterBySiteId(poSiteId);
      console.log(`🔧 fetchPoRow result: data=${JSON.stringify(data)}, error=${error}`);
      if (!error && data) {
        console.log(`🔧 Setting PO data: po_no_ip1=${data.po_no_ip1}, po_no_cobuild=${data.po_no_cobuild}, po_length_ip1=${data.po_length_ip1}, po_length_cobuild=${data.po_length_cobuild}`);
        setPoRowRouteType(data.route_type || "");
        setPoRowNoIp1(data.po_no_ip1 || "");
        setPoRowNoCoBuild(data.po_no_cobuild || "");
        setPoRowRouteLM(data.route_routeLM_metroLM_LMCStandalone || "");
        setPoLengthIp1(data.po_length_ip1 || "");
        setPoLengthCoBuild(data.po_length_cobuild || "");
        // Use route_routeLM_metroLM_LMCStandalone for Route/Non-Route logic
        if (String(data.route_routeLM_metroLM_LMCStandalone).replace(/\s+/g, '').toLowerCase() !== 'route') {
          // Not Route: set PO number, PO length, build_type, category_type as per user request
          setPoNumberType('Co-Built');
          setPoNumberTypeConfirmed('Co-Built');
          setBuildType('New-Build');
          setCategoryType('Non-Strategic');
        }
      } else {
        console.log(`🔧 No PO data found for siteId=${poSiteId}`);
        setPoRowRouteType("");
        setPoRowNoIp1("");
        setPoRowNoCoBuild("");
        setPoRowRouteLM("");
        setPoLengthIp1("");
        setPoLengthCoBuild("");
        setPoNumberType(null);
        setBuildType("");
        setCategoryType("");
      }
    }
    fetchPoRow();
  }, [poSiteId]);

  // Log when PO row is fetched
  useEffect(() => {
    // Removed debug logging
  }, [poSiteId]);

  useEffect(() => {
    // Removed debug logging
  }, [poRowRouteType, poRowNoIp1, poRowNoCoBuild, poLengthIp1, poLengthCoBuild]);

  // Log when PO Number Type dropdown changes
  useEffect(() => {
    // Removed debug logging
  }, [poNumberType]);

  // Reset confirmed PO Number Type when Site/Route ID or route type changes
  useEffect(() => {
    setPoNumberType(null);
    setPoNumberTypeConfirmed(null);
    setPoNumberTypeError(null);
  }, [poSiteId, poRowRouteType]);

  // Update PO Lengths when validationResults or PO row changes
  

  // Handler for testing application parsing only
  const handleApplicationParse = async () => {
    if (!dnAppFile || !(dnAppFile instanceof File)) {
      alert("Please select a valid DN Application file (PDF). File missing or not a File object.");
      return;
    }
    if (!dnAuthority || typeof dnAuthority !== "string" || dnAuthority.trim() === "") {
      alert("Please select a valid authority.");
      return;
    }
    setUploading(true);
    setAppParseResult(null);
    try {
      const formData = new FormData();
      formData.append("dn_application_file", dnAppFile);
      formData.append("authority", dnAuthority);
      const res = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/parse-application', {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errText = await res.text();
        alert(`Failed to parse application file. (${res.status})\n${errText}`);
        return;
      }
      const result = await res.json();
      setAppParseResult(result);
    } catch (err) {
      alert("Failed to parse application file.");
    } finally {
      setUploading(false);
    }
  };

  // Handler for DN Master File upload
  const handleDnMasterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDnMasterFile(e.target.files?.[0] || null);
    setDnError(null);
    setDnSuccess(null);
  };

  const handleDnMasterUpload = async () => {
    if (!dnMasterFile) return;
    setDnUploading(true);
    setDnError(null);
    setDnSuccess(null);
    try {
      console.time('dnMasterUpload');
      const formData = new FormData();
      formData.append('file', dnMasterFile);
      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/upload-dn-master', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      console.timeEnd('dnMasterUpload');
      if (!response.ok || result.success === false) {
        let errorMsg = result.errors ? result.errors.join('\n') : (result.detail || result.message || 'Upload failed');
        setDnError(errorMsg);
        return;
      }
      setDnSuccess(result.message || 'Upload successful! New and updated rows processed.');
    } catch (err: any) {
      setDnError(err.message || 'Upload failed');
    } finally {
      setDnUploading(false);
      setDnMasterFile(null);
      const input = document.getElementById('dn-master-file-input') as HTMLInputElement | null;
      if (input) input.value = '';
    }
  };

  // When a PO file is selected, extract Site IDs
  const handlePoFileChange = async (file: File | null) => {
    setPoSiteId("");
    setPoSiteIdOptions([]);
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const normalizeCol = (str: string) => String(str).toLowerCase().replace(/\s|\_|\//g, '');
      let found = false;
      for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!json.length) continue;
        const headerRow = (json[0] as any[]).map((h: any) => normalizeCol(h));
        const idx = headerRow.findIndex((h: string) => h === 'routeidsiteid' || h === 'route_id_site_id');
        if (idx !== -1) {
          const values = json.slice(1).map((row: any) => row[idx]).filter(Boolean);
          const unique = Array.from(new Set(values.map((v: any) => String(v).trim())));
          setPoSiteIdOptions(unique);
          found = true;
          break;
        }
      }
      if (!found) setPoSiteIdOptions([]);
    } catch (err) {
      setPoSiteIdOptions([]);
    }
    if (poSiteIdOptions.length === 0) {
      setValidateError("No 'Route ID / Site ID' column found in uploaded file.");
    }
  };

  const handlePoParse = async () => {
    if (!poSiteId) {
      alert("Please select a Site ID.");
      return;
    }
    setPoUploading(true);
    setPoParseResult(null);
    try {
      console.time('poParse');
      const formData = new FormData();
      formData.append("site_id", poSiteId);
      const res = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/parse-po', {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      console.timeEnd('poParse');
      setPoParseResult(result);
      console.log(result);
    } catch (err) {
      alert("Failed to parse PO file.");
    } finally {
      setPoUploading(false);
    }
  };

  const handleDnParse = async () => {
    if (!dnFile || !dnAuthority) {
      alert("Please select a DN file and authority.");
      return;
    }
    setDnParsing(true);
    // Only set to null at the start
    setDnParseResult(null);
    try {
      const formData = new FormData();
      formData.append("dn_file", dnFile);
      formData.append("authority", dnAuthority);
      if (poSiteId) formData.append("site_id", poSiteId); // <-- Always send user Site ID
      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/parse-dn', {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const text = await response.text();
        setDnParseResult(null);
        setDnParsing(false);
        return;
      }
      let result = null;
      try {
        result = await response.json();
      } catch (err) {
        const text = await response.text();
        setDnParseResult(null);
        setDnParsing(false);
        return;
      }
      // Always set the result if present
      if (result && typeof result === 'object') {
        setDnParseResult(result);
      } else {
        setDnParseResult(null);
      }
    } catch (err) {
      setDnParseResult(null);
    } finally {
      setDnParsing(false);
    }
  };

  // Remove redundant mapping - use comprehensive field mapping instead

  const handleValidateParsers = async () => {
    console.log("🚀 VALIDATE PARSERS STARTED");
    console.log("🔍 Current state check:");
    console.log("  - poSiteId:", poSiteId);
    console.log("  - dnAppFile:", dnAppFile ? "File selected" : "No file");
    console.log("  - dnFile:", dnFile ? "File selected" : "No file");
    console.log("  - dnAuthority:", dnAuthority);
    console.log("  - poRowRouteLM:", poRowRouteLM);
    console.log("  - poNumberTypeConfirmed:", poNumberTypeConfirmed);
    console.log("  - poRowNoIp1:", poRowNoIp1);
    console.log("  - poRowNoCoBuild:", poRowNoCoBuild);
    console.log("  - poLengthIp1:", poLengthIp1);
    console.log("  - poLengthCoBuild:", poLengthCoBuild);
    
    setValidateError(null);
    setPoNumberTypeError(null);
    if (!poSiteId || !dnAppFile || !dnFile || !dnAuthority) {
      console.log("❌ Validation failed - missing required fields");
      setValidateError("Please upload all files and fill all required fields.");
      return;
    }
    // Use route_routeLM_metroLM_LMCStandalone for IP1 vs Co-Built validation
    if (poRowRouteLM.replace(/\s+/g, '').toLowerCase() === 'route' && !poNumberTypeConfirmed) {
      console.log("❌ Validation failed - PO Number Type not confirmed for Route");
      setPoNumberTypeError("Please confirm your PO Number Type selection (IP1 or Co-Built).");
      return;
    }
    setValidating(true);
    setValidationResults([]);
    console.log("📁 Starting file parsing...");
      try {
      // Prepare requests
      const poForm = new FormData();
      poForm.append("site_id", poSiteId);
      // Add PO Number Type to the request
      if (poNumberTypeConfirmed) {
        poForm.append("po_number_type", poNumberTypeConfirmed);
        console.log(`📤 Sending PO Number Type: "${poNumberTypeConfirmed}" to backend`);
      } else {
        console.log(`⚠️ No PO Number Type selected, backend will use fallback logic`);
      }
      const dnAppForm = new FormData();
      dnAppForm.append("dn_application_file", dnAppFile);
      dnAppForm.append("authority", dnAuthority);
      const dnForm = new FormData();
      dnForm.append("dn_file", dnFile);
      dnForm.append("authority", dnAuthority);
      if (poSiteId) dnForm.append("site_id", poSiteId); // <-- Always send user Site ID
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:8000` : "");
      if (!backendUrl) {
        setValidateError("Backend URL not configured. Set NEXT_PUBLIC_BACKEND_URL.");
        setValidating(false);
        return;
      }
      console.log("📡 Making API calls to", backendUrl, "...");
      const [poR, dnAppR, dnR] = await Promise.all([
        fetch(backendUrl + "/api/parse-po", { method: "POST", body: poForm }),
        fetch(backendUrl + "/api/parse-application", { method: "POST", body: dnAppForm }),
        fetch(backendUrl + "/api/parse-dn", { method: "POST", body: dnForm }),
      ]);
      const poRes = await poR.json().catch(() => ({}));
      const dnAppRes = await dnAppR.json().catch(() => ({}));
      const dnRes = await dnR.json().catch(() => ({}));

      if (!poR.ok && poRes.detail) {
        setValidateError("PO parse failed: " + (typeof poRes.detail === "string" ? poRes.detail : JSON.stringify(poRes.detail)));
        setValidating(false);
        return;
      }
      if (!dnAppR.ok && dnAppRes.detail) {
        setValidateError("Application parse failed: " + (typeof dnAppRes.detail === "string" ? dnAppRes.detail : JSON.stringify(dnAppRes.detail)));
        setValidating(false);
        return;
      }
      if (!dnR.ok && dnRes.detail) {
        setValidateError("DN parse failed: " + (typeof dnRes.detail === "string" ? dnRes.detail : JSON.stringify(dnRes.detail)));
        setValidating(false);
        return;
      }

      console.log("📊 API Response Analysis:");
      console.log("  - PO Response:", poRes);
      console.log("  - DN App Response:", dnAppRes);
      console.log("  - DN Response:", dnRes);

      // Merge results into a single array with source
      const merged: any[] = [];

      // Map PO fields to standard field names
      Object.entries(poRes).forEach(([k, v]) => {
        let standardFieldName = k;
        
        // Map PO field names to standard field names
        if (k === 'PO No') standardFieldName = 'po_number';
        else if (k === 'PO Length (Mtr)') standardFieldName = 'po_length';
        else if (k === 'Category') standardFieldName = 'category_type';
        else if (k === 'SiteID') standardFieldName = 'route_id_site_id';
        else if (k === 'UID') standardFieldName = 'uid';
        else if (k === 'Parent Route Name / HH') standardFieldName = 'parent_route';
        
        const entry = { field: standardFieldName, value: roundTo2Decimals(v, k), source: "PO" };
        merged.push(entry);
        console.log(`  📋 PO Field: "${k}" → "${standardFieldName}" = "${v}" (rounded: "${entry.value}")`);
      });
      
      // Use comprehensive field mapping for application parser
      Object.entries(dnAppRes).forEach(([k, v]) => {
        // For now, keep the field name as-is since comprehensive mapping is for DN parser
        merged.push({ field: k, value: roundTo2Decimals(v, k), source: "DN Application" });
      });
      
      // Use comprehensive field mapping for DN parser
      Object.entries(dnRes).forEach(([k, v]) => {
        // The backend parser should already have applied comprehensive field mapping
        // So the field names should already be in standard format (e.g., "po_number", "po_length")
        merged.push({ field: k, value: roundTo2Decimals(v, k), source: "DN" });
      });
      
      console.log(`🔧 DN Parser Results (should be standard field names):`, Object.keys(dnRes));
      
      // Debug: Log all merged results to see what we have
              // Merged results ready for processing
      
      // Update riCostPerMeter state with the latest database value before calculations
      if (poSiteId) {
        try {
          const { data, error } = await getBudgetMasterBySiteId(poSiteId);
          
          if (!error && data && data.ri_cost_per_meter !== null) {
            const dbValue = String(data.ri_cost_per_meter);
            console.log(`🔧 Updating riCostPerMeter state from database: ${dbValue}`);
            setRiCostPerMeter(dbValue);
          }
        } catch (err) {
          console.error(`🔧 Error updating riCostPerMeter state:`, err);
        }
      }
      
      // Filter to only include fields needed for validation parsers table
      const filteredResults = merged.filter(item => VALIDATE_PARSER_FIELDS.includes(item.field));
      
      // Add missing fields that are required for calculations
      const requiredFields = [
        "Section Length (Mtr.)", // KDMC uses this exact field name
        "Ground Rent",
        "Administrative Charge", 
        "RI Amount",
        "Supervision Charges",
        "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)", // KDMC ground rent
        "Covered under capping (Restoration Charges, admin, registration etc.)", // KDMC admin charges
        "Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')", // KDMC total non-refundable
        "SD Amount", // KDMC deposit
        "Total DN Amount ( NON REFUNDABLE+SD+ BG+ GST) To be filled by helpdesk team", // KDMC total DN amount
        "PO No.", // PO number from KDMC
        "PO Length (Mtr)", // PO length from KDMC
        "Demand Note Reference number", // KDMC DN number
        "Demand Note Date", // KDMC DN date
        "dn_ri_amount", // KDMC RI amount
        "supervision_charges", // KDMC supervision charges
        "route_id_site_id", // PO route ID
        "po_no_cobuild", // PO number co-build
        "po_length_cobuild", // PO length co-build
        "po_no_ip1", // PO number IP1
        "po_length_ip1" // PO length IP1
      ];
      
      console.log("🔍 Checking required fields...");
      // Add missing required fields from the full results
      requiredFields.forEach(fieldName => {
        const existing = filteredResults.find(r => r.field === fieldName);
        if (!existing) {
          const foundInFull = merged.find(r => r.field === fieldName);
          if (foundInFull) {
            console.log(`  ✅ Adding missing field: "${fieldName}" = "${foundInFull.value}" (source: ${foundInFull.source})`);
            filteredResults.push(foundInFull);
          } else {
            console.log(`  ❌ Required field not found in merged results: "${fieldName}"`);
          }
        } else {
          console.log(`  ✅ Field already exists: "${fieldName}" = "${existing.value}"`);
        }
      });
      
      // PO fields are handled by getValidateParserFieldValue function (same as MCGM)
      // No need for complex mapping logic here
      
      // Add missing fields from enriched DN row if they exist in merged results
      const enrichedFields = [
        { field: "Road Types", targetField: "surface" },
        { field: "Road Types - CC/BT/TILES/ Normal Soil/kacha", targetField: "surface" },
        { field: "Surface-wise RI Amount", targetField: "surface_wise_ri_amount" },
        { field: "Surface-wise Multiplication Factor", targetField: "surface_wise_multiplication_factor" },
        { field: "Section Length", targetField: "dn_length_mtr" },
        { field: "Section Length", targetField: "ot_length" }
      ];
      
      const updatedFilteredResults = [...filteredResults];
      
      enrichedFields.forEach(({ field, targetField }) => {
        const enrichedValue = merged.find(r => r.field === field)?.value;
        const existingField = updatedFilteredResults.find(r => r.field === targetField);
        
        // Processing enriched field mapping
        
        if (enrichedValue) {
          if (!existingField) {
            // Field doesn't exist, add it
            updatedFilteredResults.push({
              field: targetField,
              value: enrichedValue,
              source: "DN"
            });
            // Field added successfully
          } else if (!existingField.value || existingField.value === "") {
            // Field exists but is empty, update it
            existingField.value = enrichedValue;
            existingField.source = "DN";
            // Field updated successfully
          }
        }
      });
      
      console.log("📋 Final validation results before setting state:");
      updatedFilteredResults.forEach(result => {
        console.log(`  - "${result.field}": "${result.value}" (source: ${result.source})`);
      });
      
      // Check if PO fields are present
      const poNumberField = updatedFilteredResults.find(r => r.field === "po_number" || r.field === "PO No.");
      const poLengthField = updatedFilteredResults.find(r => r.field === "po_length" || r.field === "PO Length (Mtr)");
      
      console.log("🔍 PO Fields Check:");
      console.log(`  - po_number field found:`, poNumberField ? `"${poNumberField.value}"` : "NOT FOUND");
      console.log(`  - po_length field found:`, poLengthField ? `"${poLengthField.value}"` : "NOT FOUND");
      
      setValidationResults(updatedFilteredResults);
      
      // Update calculated fields with actual calculated values
      setTimeout(async () => {
        const updatedResults = [...updatedFilteredResults];
        
        // Calculate and update projected_budget_ri_amount_dn
        const riBudgetPerMeterRaw = await getEffectiveRiCostPerMeter();
        console.log(`🔧 projected_budget_ri_amount_dn debug - riBudgetPerMeterRaw: "${riBudgetPerMeterRaw}"`);
        
        // Try multiple possible field names for DN length, prioritizing the enriched dn_length_mtr field
        const dnLength = parseFloat(updatedResults.find(r => r.field === "dn_length_mtr")?.value ?? "") ||
                        parseFloat(updatedResults.find(r => r.field === "ot_length")?.value ?? "") ||
                        parseFloat(updatedResults.find(r => r.field === "application_length_mtr")?.value ?? "") ||
                        parseFloat(filteredResults.find(r => r.field === "Section Length (Mtr.)")?.value ?? "") ||
                        parseFloat(filteredResults.find(r => r.field === "Section Length")?.value ?? "");
        
        if (riBudgetPerMeterRaw && riBudgetPerMeterRaw.includes("⚠️")) {
          // Set warning message for dependent field
          const index = updatedResults.findIndex(r => r.field === "projected_budget_ri_amount_dn");
          if (index !== -1) {
            updatedResults[index].value = "⚠️ Cannot calculate - budget values not entered";
          }
        } else {
          const riBudgetPerMeter = parseFloat(riBudgetPerMeterRaw ?? "");
          
          console.log(`🔧 projected_budget_ri_amount_dn debug - riBudgetPerMeter: ${riBudgetPerMeter}, dnLength: ${dnLength}`);
          console.log(`🔧 DN Length calculation: dn_length_mtr=${updatedResults.find(r => r.field === "dn_length_mtr")?.value}, final dnLength=${dnLength}`);
          
          if (!isNaN(riBudgetPerMeter) && !isNaN(dnLength)) {
            const calculatedValue = (riBudgetPerMeter * dnLength).toFixed(2);
            
            const index = updatedResults.findIndex(r => r.field === "projected_budget_ri_amount_dn");
            if (index !== -1) {
              updatedResults[index].value = calculatedValue;
              console.log(`🔧 Fixed projected_budget_ri_amount_dn: ${riBudgetPerMeter} * ${dnLength} = ${calculatedValue}`);
            }
          } else {
            console.log(`🔧 projected_budget_ri_amount_dn calculation failed: riBudgetPerMeter=${riBudgetPerMeter}, dnLength=${dnLength}`);
          }
        }
        
        // Calculate and update non_refundable_amount_per_mtr
        // Try multiple field names for KDMC compatibility
        const groundRent = parseFloat(filteredResults.find(r => r.field === "Ground Rent")?.value ?? "") ||
                          parseFloat(filteredResults.find(r => r.field === "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)")?.value ?? "");
        const adminCharge = parseFloat(filteredResults.find(r => r.field === "Administrative Charge")?.value ?? "") ||
                           parseFloat(filteredResults.find(r => r.field === "Covered under capping (Restoration Charges, admin, registration etc.)")?.value ?? "");
        const riAmount = parseFloat(filteredResults.find(r => r.field === "RI Amount")?.value ?? "");
        const supervisionCharges = parseFloat(filteredResults.find(r => r.field === "Supervision Charges")?.value ?? "");
        
        // If we can't find individual components, try to get the total non-refundable amount
        let actualTotal = [groundRent, adminCharge, riAmount, supervisionCharges]
          .map(v => isNaN(v) ? 0 : v)
          .reduce((a, b) => a + b, 0);
        
        // If total is 0, try to get from KDMC total non-refundable field
        if (actualTotal === 0) {
          const kdmcTotal = parseFloat(filteredResults.find(r => r.field === "Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')")?.value ?? "");
          if (!isNaN(kdmcTotal)) {
            actualTotal = kdmcTotal;
          }
        }
        
        if (actualTotal > 0 && !isNaN(dnLength) && dnLength > 0) {
          const calculatedValue = (actualTotal / dnLength).toFixed(2);
          
          const index = updatedResults.findIndex(r => r.field === "non_refundable_amount_per_mtr");
          if (index !== -1) {
            updatedResults[index].value = calculatedValue;
            console.log(`🔧 Fixed non_refundable_amount_per_mtr: ${actualTotal} / ${dnLength} = ${calculatedValue}`);
          }
        } else {
          console.log(`🔧 non_refundable_amount_per_mtr calculation failed: actualTotal=${actualTotal}, dnLength=${dnLength}`);
        }
        
        // Calculate and update proj_non_refundable_savings_per_mtr
        const riBudgetAmountPerMeterRaw = updatedResults.find(r => r.field === "ri_budget_amount_per_meter")?.value ?? "";
        if (riBudgetAmountPerMeterRaw && riBudgetAmountPerMeterRaw.includes("⚠️")) {
          // Set warning message for dependent fields
          const savingsIndex = updatedResults.findIndex(r => r.field === "proj_non_refundable_savings_per_mtr");
          if (savingsIndex !== -1) {
            updatedResults[savingsIndex].value = "⚠️ Cannot calculate - budget values not entered";
          }
        } else {
          const riBudgetAmountPerMeter = parseFloat(riBudgetAmountPerMeterRaw);
          const nonRefundableAmountPerMtr = parseFloat(updatedResults.find(r => r.field === "non_refundable_amount_per_mtr")?.value ?? "");
          if (!isNaN(riBudgetAmountPerMeter) && !isNaN(nonRefundableAmountPerMtr)) {
            const calculatedSavings = (riBudgetAmountPerMeter - nonRefundableAmountPerMtr).toFixed(2);
            
            const savingsIndex = updatedResults.findIndex(r => r.field === "proj_non_refundable_savings_per_mtr");
            if (savingsIndex !== -1) {
              updatedResults[savingsIndex].value = calculatedSavings;
              console.log(`🔧 Fixed proj_non_refundable_savings_per_mtr: ${riBudgetAmountPerMeter} - ${nonRefundableAmountPerMtr} = ${calculatedSavings}`);
            }
          }
        }
        
        // Calculate and update proj_savings_per_dn
        const savingsPerMtrRaw = updatedResults.find(r => r.field === "proj_non_refundable_savings_per_mtr")?.value ?? "";
        if (savingsPerMtrRaw && savingsPerMtrRaw.includes("⚠️")) {
          // Set warning message for dependent field
          const index = updatedResults.findIndex(r => r.field === "proj_savings_per_dn");
          if (index !== -1) {
            updatedResults[index].value = "⚠️ Cannot calculate - budget values not entered";
          }
        } else {
          const savingsPerMtr = parseFloat(savingsPerMtrRaw);
          if (!isNaN(savingsPerMtr) && !isNaN(dnLength)) {
            const calculatedValue = (savingsPerMtr * dnLength).toFixed(2);
            
            const index = updatedResults.findIndex(r => r.field === "proj_savings_per_dn");
            if (index !== -1) {
              updatedResults[index].value = calculatedValue;
              console.log(`🔧 Fixed proj_savings_per_dn: ${savingsPerMtr} * ${dnLength} = ${calculatedValue}`);
            }
          } else {
            console.log(`🔧 proj_savings_per_dn calculation failed: savingsPerMtr=${savingsPerMtr}, dnLength=${dnLength}`);
          }
        }
        
        setValidationResults(updatedResults);
        
        // Clear console and show ONLY validation parser fields using the latest updatedResults
        console.clear();
        console.log("🔍 === VALIDATION PARSERS TABLE ===");
        VALIDATE_PARSER_FIELDS.forEach((field, index) => {
          // Use updatedResults directly instead of getValidateParserFieldValue (which uses old state)
          const fieldResult = updatedResults.find(r => r.field === field);
          const value = fieldResult?.value ?? '';
          console.log(`${String(index + 1).padStart(2, '0')}. ${field.padEnd(40, ' ')} = "${value}"`);
          
          // Field logged successfully
        });
        console.log("🔍 === END VALIDATION PARSERS TABLE ===");
      }, 100);
    } catch (err) {
      setValidateError("Failed to validate parsers.");
    } finally {
      setValidating(false);
    }
  };

  // Helper to get the effective RI Cost Per Meter (pro-rated if set, else auto)
  async function getEffectiveRiCostPerMeter() {
    console.log(`🔧 getEffectiveRiCostPerMeter debug:`);
    console.log(`  showProRatedInput: ${showProRatedInput}`);
    console.log(`  proRatedRiCostPerMeter: "${proRatedRiCostPerMeter}"`);
    console.log(`  riCostPerMeter: "${riCostPerMeter}"`);
    
    // Always fetch the latest value from database to ensure we have the correct ri_cost_per_meter
    if (poSiteId) {
      try {
        const { data, error } = await getBudgetMasterBySiteId(poSiteId);
        
        if (!error && data && data.ri_cost_per_meter !== null) {
          const dbValue = String(data.ri_cost_per_meter);
          console.log(`🔧 Using fresh database value: ${dbValue}`);
          
          let result = null;
          if (showProRatedInput && proRatedRiCostPerMeter !== "") {
            result = proRatedRiCostPerMeter;
            console.log(`  Returning proRatedRiCostPerMeter: ${result}`);
          } else {
            result = dbValue;
            console.log(`  Returning fresh database value: ${result}`);
          }
          
          console.log(`  Final result: ${result}`);
          return String(result);
        }
      } catch (err) {
        console.error(`🔧 Error fetching ri_cost_per_meter:`, err);
      }
    }
    
    // Fallback to current state if database fetch fails
    let result = null;
    if (showProRatedInput && proRatedRiCostPerMeter !== "") {
      result = proRatedRiCostPerMeter;
      console.log(`  Returning proRatedRiCostPerMeter: ${result}`);
    } else if (riCostPerMeter !== null && riCostPerMeter !== "") {
      result = riCostPerMeter;
      console.log(`  Returning riCostPerMeter: ${result}`);
    } else {
      console.log(`  Returning BUDGET_MISSING_MESSAGE`);
      return "BUDGET_MISSING_MESSAGE"; // Special message to indicate budget is missing
    }
    
    // Return the result as-is - no need to "clean" it
    console.log(`  Final result: ${result}`);
    return String(result);
  }

  // Helper function to get field value from validation results
  function getFieldValue(field: string) {
    return validationResults.find(row => row.field === field && row.source === "DN")?.value;
  }

  // Helper to round numbers to 2 decimals for display, but skip for ID fields
  function roundTo2Decimals(val: any, field?: string) {
    // Skip rounding for ID fields that should remain as integers
    if (field === 'route_id / site_id' || field === 'SiteID' || field === 'route_id_site_id' || 
        field === 'po_number' || field === 'application_number' || field === 'dn_number' || field === 'dn_reference_number') {
      // Convert to integer if it's a number, then to string
      if (typeof val === 'number') return String(Math.round(val));
      if (typeof val === 'string' && val !== '' && !isNaN(Number(val))) return String(Math.round(Number(val)));
      return val?.toString();
    }
    if (typeof val === 'number') return val.toFixed(2);
    if (typeof val === 'string' && val !== '' && !isNaN(Number(val))) return Number(val).toFixed(2);
    return val;
  }

  // Helper to normalize field names for case-insensitive matching
  function normalizeFieldName(name: string) {
    return name.replace(/\s+/g, '').toLowerCase();
  }

  // Helper to get the raw value for a field (bypassing custom logic)
  function getValidateParserFieldValueRaw(field: string): any {
    // First try exact field name match
    const exactMatch = validationResults.find(row => row.field === field);
    if (exactMatch) return exactMatch.value;
    
    // Then try field mapping
    const fieldMap: Record<string, string> = {
      // route_type is now handled by custom logic, not field mapping
      "route_id / site_id": "SiteID",
      "uid": "UID",
      "po_number": "PO No",
      "po_length": "PO Length (Mtr)",
      "parent_route": "Parent Route Name / HH",
      "application_number": "Application Number",
      "application_length_mtr": "Application Length (Mtr)",
      "application_date": "Application Date",
      "from_location": "From",
      "to_location": "To",
      "authority": "Authority",
      "ward": "Ward",
      "dn_number": "Demand Note Reference number",
      "dn_length_mtr": "Section Length",
      "dn_received_date": "Demand Note Date",
      "ot_length": "Section Length",
      "surface": "Road Types",
      "surface_wise_ri_amount": "Surface-wise RI Amount",
      "dn_ri_amount": "RI Amount",
      "surface_wise_multiplication_factor": "Surface-wise Multiplication Factor",
      "multiplying_factor": "Surface-wise Multiplication Factor",
      "ground_rent": "Ground Rent",
      "administrative_charge": "Administrative Charge",
      "supervision_charges": "Supervision Charges",
      "chamber_fee": "Chamber Fee",
      "gst": "GST Amount",
      "deposit": "SD Amount"
    };
    const lookup = fieldMap[field] || field;
    const found = validationResults.find(row => normalizeFieldName(row.field) === normalizeFieldName(lookup));
    if (found) return found.value;
    return null;
  }

  // Helper to get the value for each field
  function getValidateParserFieldValue(field: string): any {
    // Special logging for PO fields
    if (field === "po_number" || field === "po_length") {
      console.log(`🔍 getValidateParserFieldValue("${field}") - Starting resolution`);
    }
    
    // PRIORITY 1: Always check user edits first - this is the most important!
    // Look for exact field name match in validationResults (user edits)
    const directEdit = validationResults.find(row => row.field === field);
        if (directEdit !== undefined) {
    
    // PRIORITY 1.5: Special handling for NMMC fields - keep blank for manual entry
    if (dnAuthority?.toLowerCase() === "nmmc") {
      if (field === "administrative_charge") {
        console.log(`🔧 NMMC administrative_charge - returning blank for manual entry`);
        return "";
      }
      if (field === "ot_length") {
        console.log(`🔧 NMMC ot_length - returning blank for manual entry`);
        return "";
      }
      if (field === "trench_type") {
        console.log(`🔧 NMMC trench_type - returning blank for manual entry`);
        return "";
      }
    }
      if (field === "po_number" || field === "po_length") {
        console.log(`  ✅ Found user edit for "${field}": "${directEdit.value}"`);
      }
              // For certain fields, don't return empty values if we have calculated logic
        if (field === "route_type" && (directEdit.value === "" || directEdit.value === null || directEdit.value === undefined)) {
          // Continue to calculated logic below
        } else if (field === "dn_recipient") {
          // Always use calculated logic for dn_recipient, ignore validation result
          // Continue to calculated logic below
        } else if (field === "ip1_co_built") {
          // Always use calculated logic for ip1_co_built, ignore validation result
          // Continue to calculated logic below
        } else if (field === "build_type" || field === "category_type" || field === "survey_id") {
          // Always use calculated logic for these fields, ignore validation result
          // Continue to calculated logic below
        } else if (field === "po_number" || field === "po_length" || field === "application_number") {
          // Ensure no decimals for these fields if they are numeric
          const value = directEdit.value;
          // Don't return empty values for PO fields - let them fall through to calculated logic
          if (!value || value === "" || value === null || value === undefined) {
            // Continue to calculated logic below
          } else if (value && !isNaN(Number(value))) {
            const parsedValue = String(parseInt(value, 10));
            return parsedValue;
          } else {
            return value; // Return as is if not a number
          }
        } else {
          return directEdit.value;
        }
    }
    
    // PRIORITY 2: Check for field mapping variations (e.g., "po_number" -> "PO No")
    const fieldMap: Record<string, string> = {
      // route_type is now handled by custom logic, not field mapping
      "route_id / site_id": "SiteID",
      "uid": "UID",
      "po_number": "PO No",
      "po_length": "PO Length (Mtr)",
      "parent_route": "Parent Route Name / HH",
      "application_number": "Application Number",
      "application_length_mtr": "Application Length (Mtr)",
      "application_date": "Application Date",
      "from_location": "From",
      "to_location": "To",
      "authority": "Authority",
      "ward": "Ward",
      "dn_number": "Demand Note Reference number",
      "dn_length_mtr": "Section Length",
      "dn_received_date": "Demand Note Date",
      "ot_length": "Section Length",
      "surface": "Road Types",
      "surface_wise_ri_amount": "Surface-wise RI Amount",
      "ri_rate_go_rs": "Surface-wise RI Amount",
      "dn_ri_amount": "RI Amount",
      "surface_wise_multiplication_factor": "Surface-wise Multiplication Factor",
      "ground_rent": "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)",
      "administrative_charge": "Covered under capping (Restoration Charges, admin, registration etc.)",
      "supervision_charges": "Supervision Charges",
      "chamber_fee": "Chamber Fee",
      "gst": "GST Amount",
      "deposit": "SD Amount",
      "build_type": "build_type",
      "category_type": "category_type",
      // Additional KDMC specific field mappings
      "total_dn_amount": "Total DN Amount ( NON REFUNDABLE+SD+ BG+ GST) To be filled by helpdesk team",
      "non_refundable": "Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')",
    };
    
    const mappedField = fieldMap[field];
    if (mappedField) {
      const normalizeFieldName = (name: string) => name.replace(/\s+/g, '').toLowerCase();
      const mappedEdit = validationResults.find(row => normalizeFieldName(row.field) === normalizeFieldName(mappedField));
      if (mappedEdit !== undefined) {
        // Apply parseInt for po_number, po_length and application_number
        if ((field === "po_number" || field === "po_length" || field === "application_number") && mappedEdit.value && !isNaN(Number(mappedEdit.value))) {
          const parsedValue = String(parseInt(mappedEdit.value, 10));
          return parsedValue;
        }
        // Don't return empty values for PO fields - let them fall through to calculated logic
        if ((field === "po_number" || field === "po_length" || field === "application_number") && (!mappedEdit.value || mappedEdit.value === "" || mappedEdit.value === null || mappedEdit.value === undefined)) {
          // Continue to calculated logic below
        } else {
          return mappedEdit.value;
        }
      }
    }
    
    // Try multiple field name variations for better compatibility
    const fieldVariations: Record<string, string[]> = {
      "ground_rent": ["Ground Rent", "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)"],
      "administrative_charge": ["Administrative Charge", "Covered under capping (Restoration Charges, admin, registration etc.)"],
      "dn_ri_amount": ["RI Amount", "ri_amount", "dn_ri_amount", "Rate/mtr- Current DN (UG/OH)"],
      "supervision_charges": ["Supervision Charges", "supervision_charges"],
      "chamber_fee": ["Chamber Fee"],
      "gst": ["GST Amount"],
      "deposit": ["SD Amount"],
      "total_dn_amount": ["Total DN Amount ( NON REFUNDABLE+SD+ BG+ GST) To be filled by helpdesk team"],
      "actual_total_non_refundable": ["Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')"],
      "dn_number": ["Demand Note Reference number", "dn_number"],
      "dn_length_mtr": ["Section Length", "Section Length (Mtr.)", "section_length", "dn_length_mtr", "application_length_mtr", "ot_length"],
      "ot_length": ["Section Length", "application_length_mtr", "Section Length (Mtr.)", "section_length", "ot_length"],
      "surface": ["Road Types", "Road Types - CC/BT/TILES/ Normal Soil/kacha", "surface", "Road Type", "surface_type", "road_surface"],
      "surface_wise_ri_amount": ["Surface-wise RI Amount", "Rate/mtr- Current DN (UG/OH)", "surface_wise_ri_amount", "ri_rate_go_rs", "GO RATE"],
      "surface_wise_length": ["Surface-wise Length", "surface_wise_length"],
      "surface_wise_multiplication_factor": ["Surface-wise Multiplication Factor", "surface_wise_multiplication_factor"],
      "dn_received_date": ["Demand Note Date", "dn_received_date"],
      "po_number": ["PO No.", "po_number"],
      "po_length": ["PO Length (Mtr)", "po_length"],
      "route_id_site_id": ["route_id_site_id", "route_id / site_id", "SiteID"],
      "uid": ["uid"],
      "build_type": ["build_type"],
      "category_type": ["category_type"],
      "ri_rate_go_rs": ["ri_rate_go_rs", "GO RATE"],
      "road_name": ["road_name"]
    };
    
    const variations = fieldVariations[field];
    if (variations) {
      for (const variation of variations) {
        const normalizeFieldName = (name: string) => name.replace(/\s+/g, '').toLowerCase();
        const found = validationResults.find(row => normalizeFieldName(row.field) === normalizeFieldName(variation));
        if (found !== undefined) {
          // Apply parseInt for po_number, po_length and application_number
          if ((field === "po_number" || field === "po_length" || field === "application_number") && found.value && !isNaN(Number(found.value))) {
            const parsedValue = String(parseInt(found.value, 10));
            return parsedValue;
          }
          // Don't return empty values for PO fields - let them fall through to calculated logic
          if ((field === "po_number" || field === "po_length" || field === "application_number") && (!found.value || found.value === "" || found.value === null || found.value === undefined)) {
            // Continue to calculated logic below
          } else {
            return found.value;
          }
        }
      }
    }
    
    // PRIORITY 3: Check reverse mapping (e.g., "PO No" -> "po_number")
    const reverseFieldMap: Record<string, string> = {};
    Object.entries(fieldMap).forEach(([key, value]) => {
      reverseFieldMap[value] = key;
    });
    
    const reverseField = reverseFieldMap[field];
    if (reverseField) {
      const reverseEdit = validationResults.find(row => row.field === reverseField);
      if (reverseEdit !== undefined) {
        // Apply parseInt for po_number, po_length and application_number
        if ((field === "po_number" || field === "po_length" || field === "application_number") && reverseEdit.value && !isNaN(Number(reverseEdit.value))) {
          const parsedValue = String(parseInt(reverseEdit.value, 10));
          return parsedValue;
        }
        // Don't return empty values for PO fields - let them fall through to calculated logic
        if ((field === "po_number" || field === "po_length" || field === "application_number") && (!reverseEdit.value || reverseEdit.value === "" || reverseEdit.value === null || reverseEdit.value === undefined)) {
          // Continue to calculated logic below
        } else {
          return reverseEdit.value;
        }
      }
    }
    
    // PRIORITY 4: Only if NO user edits exist, fall back to calculated/hardcoded values
    
    // Special handling for authority field
    if (field === "authority") return dnAuthority;
    
    // Special handling for KDMC dn_ri_amount - debug why it's not appearing
    if (field === "dn_ri_amount" && dnAuthority?.toLowerCase() === "kdmc") {
      // Try multiple possible field names from backend
      const rawValue1 = getValidateParserFieldValueRaw("dn_ri_amount");
      const rawValue2 = getValidateParserFieldValueRaw("Rate/mtr- Current DN (UG/OH)");
      const rawValue3 = getValidateParserFieldValueRaw("ri_amount");
      
      console.log(`🔧 KDMC dn_ri_amount debug - trying multiple sources:`);
      console.log(`  - dn_ri_amount: "${rawValue1}"`);
      console.log(`  - Rate/mtr- Current DN (UG/OH): "${rawValue2}"`);
      console.log(`  - ri_amount: "${rawValue3}"`);
      
      // Return the first non-empty value
      const finalValue = rawValue1 || rawValue2 || rawValue3 || "";
      console.log(`🔧 KDMC dn_ri_amount final value: "${finalValue}"`);
      return finalValue;
    }
    
    // Special handling for KDMC supervision_charges - calculate as 15% of dn_ri_amount
    if (field === "supervision_charges" && dnAuthority?.toLowerCase() === "kdmc") {
      const dnRiAmount = parseFloat(getValidateParserFieldValueRaw("dn_ri_amount") ?? "");
      console.log(`🔧 KDMC supervision_charges debug - dnRiAmount: ${dnRiAmount}`);
      if (!isNaN(dnRiAmount) && dnRiAmount > 0) {
        const supervisionCharges = (dnRiAmount * 0.15).toFixed(2);
        console.log(`🔧 KDMC supervision_charges calculation: ${dnRiAmount} * 0.15 = ${supervisionCharges}`);
        return supervisionCharges;
      }
      console.log(`🔧 KDMC supervision_charges - no valid dn_ri_amount found`);
      return "";
    }
    
    // Special handling for KDMC trench_type - keep blank for manual entry
    if (field === "trench_type" && dnAuthority?.toLowerCase() === "kdmc") {
      console.log(`🔧 KDMC trench_type - returning blank for manual entry`);
      return "";
    }
    
    // Special handling for KDMC ot_length - keep blank for manual entry
    if (field === "ot_length" && dnAuthority?.toLowerCase() === "kdmc") {
      console.log(`🔧 KDMC ot_length - returning blank for manual entry`);
      return "";
    }
    
    // For KDMC, prefer parsed surface-wise values when available.
    // Keep blank only if parser didn't provide anything.
    if (
      (field === "surface_wise_length" ||
        field === "surface_wise_ri_amount" ||
        field === "surface_wise_multiplication_factor") &&
      dnAuthority?.toLowerCase() === "kdmc"
    ) {
      const parsedValue = getValidateParserFieldValueRaw(field);
      if (parsedValue !== null && parsedValue !== undefined && String(parsedValue).trim() !== "") {
        return parsedValue;
      }
      console.log(`🔧 KDMC ${field} - no parsed value, keeping blank for manual entry`);
      return "";
    }
    
    // Special handling for NMMC administrative_charge - keep blank for manual entry
    if (field === "administrative_charge" && dnAuthority?.toLowerCase() === "nmmc") {
      console.log(`🔧 NMMC administrative_charge - returning blank for manual entry`);
      return "";
    }
    
    // Special handling for NMMC ot_length - keep blank for manual entry
    if (field === "ot_length" && dnAuthority?.toLowerCase() === "nmmc") {
      console.log(`🔧 NMMC ot_length - returning blank for manual entry`);
      return "";
    }
    
    // Special handling for trench_type and ot_length
    if (field === "trench_type") {
      if (dnAuthority?.toLowerCase() === "mcgm") {
        console.log(`🔧 MCGM trench_type - hardcoded to OT`);
        return "OT";
      } else if (dnAuthority?.toLowerCase() === "nmmc") {
        // For NMMC, trench_type should be blank for manual entry
        console.log(`🔧 NMMC trench_type - returning blank for manual entry`);
        return "";
      } else {
        console.log(`🔧 ${dnAuthority} trench_type - returning blank for manual entry`);
        return "";
      }
    }
    
    if (field === "ot_length") {
      if (dnAuthority?.toLowerCase() === "mcgm") {
        // For MCGM, ot_length should be same as dn_length
        const dnLength = getValidateParserFieldValueRaw("dn_length_mtr");
        console.log(`🔧 MCGM ot_length - using dn_length: ${dnLength}`);
        return dnLength || "";
      } else if (dnAuthority?.toLowerCase() === "nmmc") {
        // For NMMC, ot_length should be blank for manual entry
        console.log(`🔧 NMMC ot_length - returning blank for manual entry`);
        return "";
      } else {
        console.log(`🔧 ${dnAuthority} ot_length - returning blank for manual entry`);
        return "";
      }
    }
    
    // Special handling for PO fields - get from PO database (SAME LOGIC AS MCGM)
    if (field === "po_number") {
      console.log(`🔍 getValidateParserFieldValue("po_number") called`);
      console.log(`  - poSiteId: ${poSiteId}`);
      console.log(`  - poRowRouteType: "${poRowRouteType}"`);
      console.log(`  - poNumberTypeConfirmed: "${poNumberTypeConfirmed}"`);
      console.log(`  - poRowNoIp1: "${poRowNoIp1}"`);
      console.log(`  - poRowNoCoBuild: "${poRowNoCoBuild}"`);
      
      if (!poSiteId) {
        console.log(`  ❌ No poSiteId - returning warning`);
        return "⚠️ Please select a Site ID first";
      }
      // Use route_routeLM_metroLM_LMCStandalone for PO number logic
      const routeTypeForPoLogic = poRowRouteLM.replace(/\s+/g, '').toLowerCase();
      console.log(`  - Normalized routeTypeForPoLogic: "${routeTypeForPoLogic}"`);
      
      if (routeTypeForPoLogic === 'route') {
        // For Route type, use the confirmed PO number type
        if (poNumberTypeConfirmed === 'IP1') {
          // If IP1 is empty, fall back to Co-Built
          if (poRowNoIp1 && String(poRowNoIp1).trim() !== "") {
            console.log(`  ✅ Route + IP1 -> returning poRowNoIp1: "${poRowNoIp1}"`);
            return poRowNoIp1;
          } else {
            console.log(`  ⚠️ Route + IP1 but IP1 is empty -> falling back to Co-Built: "${poRowNoCoBuild}"`);
            return poRowNoCoBuild || "";
          }
        } else if (poNumberTypeConfirmed === 'Co-Built') {
          console.log(`  ✅ Route + Co-Built -> returning poRowNoCoBuild: "${poRowNoCoBuild}"`);
          return poRowNoCoBuild || "";
        } else {
          console.log(`  ⚠️ Route but no confirmation -> defaulting to poRowNoCoBuild: "${poRowNoCoBuild}"`);
          return poRowNoCoBuild || "";
        }
      } else {
        // For non-Route type, always use Co-Built
        console.log(`  ✅ Non-Route -> returning poRowNoCoBuild: "${poRowNoCoBuild}"`);
        return poRowNoCoBuild || "";
      }
    }
    
    if (field === "po_length") {
      console.log(`🔍 getValidateParserFieldValue("po_length") called`);
      console.log(`  - poSiteId: ${poSiteId}`);
      console.log(`  - poRowRouteType: "${poRowRouteType}"`);
      console.log(`  - poNumberTypeConfirmed: "${poNumberTypeConfirmed}"`);
      console.log(`  - poLengthIp1: "${poLengthIp1}"`);
      console.log(`  - poLengthCoBuild: "${poLengthCoBuild}"`);
      
      if (!poSiteId) {
        console.log(`  ❌ No poSiteId - returning warning`);
        return "⚠️ Please select a Site ID first";
      }
      // Use route_routeLM_metroLM_LMCStandalone for PO length logic
      const routeTypeForPoLogic = poRowRouteLM.replace(/\s+/g, '').toLowerCase();
      console.log(`  - Normalized routeTypeForPoLogic: "${routeTypeForPoLogic}"`);
      
      if (routeTypeForPoLogic === 'route') {
        // For Route type, use the confirmed PO number type
        if (poNumberTypeConfirmed === 'IP1') {
          // If IP1 is empty, fall back to Co-Built
          if (poLengthIp1 && String(poLengthIp1).trim() !== "") {
            console.log(`  ✅ Route + IP1 -> returning poLengthIp1: "${poLengthIp1}"`);
            return poLengthIp1;
          } else {
            console.log(`  ⚠️ Route + IP1 but IP1 is empty -> falling back to Co-Built: "${poLengthCoBuild}"`);
            return poLengthCoBuild || "";
          }
        } else if (poNumberTypeConfirmed === 'Co-Built') {
          console.log(`  ✅ Route + Co-Built -> returning poLengthCoBuild: "${poLengthCoBuild}"`);
          return poLengthCoBuild || "";
        } else {
          console.log(`  ⚠️ Route but no confirmation -> defaulting to poLengthCoBuild: "${poLengthCoBuild}"`);
          return poLengthCoBuild || "";
        }
      } else {
        // For non-Route type, always use Co-Built
        console.log(`  ✅ Non-Route -> returning poLengthCoBuild: "${poLengthCoBuild}"`);
        return poLengthCoBuild || "";
      }
    }
    
    // Removed survey_id logic - no longer needed with one budget per route
    
    if (field === "ip1_co_built") {
      // Use route_routeLM_metroLM_LMCStandalone for IP1 vs Co-Built logic only
      const routeTypeForPoLogic = poRowRouteLM.replace(/\s+/g, '').toLowerCase();
      
      if (routeTypeForPoLogic === 'route') {
        // If route_routeLM_metroLM_LMCStandalone is Route, use the PO number type user selection
        if (poNumberTypeConfirmed === 'IP1') {
          return 'IP1';
        } else if (poNumberTypeConfirmed === 'Co-Built') {
          return 'Co-Built';
        } else {
          return 'Co-Built';
        }
      } else {
        // If route_routeLM_metroLM_LMCStandalone is NOT Route, always return Co-Built
        return 'Co-Built';
      }
    }
    

    
          if (field === "build_type") {
        // Use route_routeLM_metroLM_LMCStandalone for build_type logic
        const routeTypeForPoLogic = poRowRouteLM.replace(/\s+/g, '').toLowerCase();
        
        if (routeTypeForPoLogic !== 'route') {
          return 'New-Build';
        }
        
        if (buildType && buildType.trim() !== '') {
          return buildType;
        }
        
        return 'New-Build';
      }
      
      if (field === "category_type") {
        // Use route_routeLM_metroLM_LMCStandalone for category_type logic
        const routeTypeForPoLogic = poRowRouteLM.replace(/\s+/g, '').toLowerCase();
        
        if (routeTypeForPoLogic !== 'route') {
          return 'Non-Strategic';
        }
        
        if (categoryType && categoryType.trim() !== '') {
          return categoryType;
        }
        
        return 'Non-Strategic';
      }
    
    // Hardcoded fields
    if (field === "route_routeLM_metroLM_LMCStandalone") return poRowRouteLM;
    
    // Handle route_type logic - use po_master.route_type instead of route_routeLM_metroLM_LMCStandalone
    if (field === "route_type") {
      // Return the route_type from PO master
      return poRowRouteType;
    }
    

    
    if (field === "dn_recipient") {
      // Use route_routeLM_metroLM_LMCStandalone for dn_recipient logic
      const routeTypeForPoLogic = poRowRouteLM.replace(/\s+/g, '').toLowerCase();
      
      if (routeTypeForPoLogic === 'route') {
        // If route_routeLM_metroLM_LMCStandalone is Route, use the PO number type user selection
        if (poNumberTypeConfirmed === 'IP1') {
        return "CE";
        } else if (poNumberTypeConfirmed === 'Co-Built') {
          return "Airtel";
        } else {
          return "Airtel";
        }
      } else {
        // If route_routeLM_metroLM_LMCStandalone is NOT Route, always return Airtel
      return "Airtel";
      }
    }
    if (field === "project_name") return "Mumbai Fiber Refresh Project";
    if (field === "trench_type") return "Open Trench";
    
    // Calculated values - calculate dynamically based on current validation results
    if (field === "ri_budget_amount_per_meter") {
      // Note: This function is now async, but we can't make getValidateParserFieldValue async
      // So we'll use the current state value instead of calling getEffectiveRiCostPerMeter
      if (showProRatedInput && proRatedRiCostPerMeter !== "") {
        return proRatedRiCostPerMeter;
      } else if (riCostPerMeter !== null && riCostPerMeter !== "") {
        return riCostPerMeter;
      } else {
        return "⚠️ Budget values not entered - please upload budget master or enter pro-rated value";
      }
    }
    
    if (field === "projected_budget_ri_amount_dn") {
      // Use the same value that's displayed in the table, not the raw database value
      const riBudgetPerMeterRaw = getValidateParserFieldValue("ri_budget_amount_per_meter");
      if (riBudgetPerMeterRaw && riBudgetPerMeterRaw.includes("⚠️")) {
        return "⚠️ Cannot calculate - budget values not entered";
      }
      const riBudgetPerMeter = parseFloat(riBudgetPerMeterRaw ?? "");
      // Try multiple possible field names for DN length - prioritize dn_length_mtr since it's already working
      const dnLengthRaw = getValidateParserFieldValueRaw("dn_length_mtr") ?? "";
      const dnLength = parseFloat(dnLengthRaw) || 
                      parseFloat(getValidateParserFieldValueRaw("ot_length") ?? "") ||
                      parseFloat(getValidateParserFieldValueRaw("application_length_mtr") ?? "");
      console.log(`🔧 projected_budget_ri_amount_dn calculation debug:`);
      console.log(`  riBudgetPerMeterRaw: "${riBudgetPerMeterRaw}"`);
      console.log(`  riBudgetPerMeter: ${riBudgetPerMeter} (type: ${typeof riBudgetPerMeter})`);
      console.log(`  dnLengthRaw: "${dnLengthRaw}"`);
      console.log(`  dnLength: ${dnLength} (type: ${typeof dnLength})`);
      console.log(`  riCostPerMeter state: ${riCostPerMeter}`);
      console.log(`  getValidateParserFieldValueRaw("dn_length_mtr"): ${getValidateParserFieldValueRaw("dn_length_mtr")}`);
      console.log(`  EXPECTED: ${riBudgetPerMeter} * ${dnLength} = ${riBudgetPerMeter * dnLength}`);
      console.log(`  ACTUAL RESULT: ${(riBudgetPerMeter * dnLength).toFixed(2)}`);
      if (!isNaN(riBudgetPerMeter) && !isNaN(dnLength)) {
        const result = (riBudgetPerMeter * dnLength).toFixed(2);
        
        console.log(`  Calculation: ${riBudgetPerMeter} * ${dnLength} = ${result}`);
        return result;
      }
      console.log(`  Calculation failed - returning null`);
      return null;
    }
    
    if (field === "actual_total_non_refundable") {
      // Try to get from KDMC total non-refundable field first
      const kdmcTotal = parseFloat(getValidateParserFieldValueRaw("Non Refundable Cost (Amount to process for payment should be sum of 'A' + 'B' + 'AA')") ?? "");
      if (!isNaN(kdmcTotal)) {
        return kdmcTotal.toFixed(2);
      }
      
      // Fallback to component calculation
      const groundRent = parseFloat(getValidateParserFieldValueRaw("ground_rent") ?? "");
      const adminCharge = parseFloat(getValidateParserFieldValueRaw("administrative_charge") ?? "");
      const riAmount = parseFloat(getValidateParserFieldValueRaw("dn_ri_amount") ?? "");
      const supervisionCharges = parseFloat(getValidateParserFieldValueRaw("supervision_charges") ?? "");
      const sum = [groundRent, adminCharge, riAmount, supervisionCharges]
        .map(v => isNaN(v) ? 0 : v)
        .reduce((a, b) => a + b, 0);
      
      if (sum > 0) {
        return sum.toFixed(2);
      }
      return null;
    }
    
    if (field === "non_refundable_amount_per_mtr") {
      const actualTotal = parseFloat(getValidateParserFieldValue("actual_total_non_refundable") ?? "");
      // Try multiple possible field names for DN length - prioritize dn_length_mtr since it's already working
      const dnLength = parseFloat(getValidateParserFieldValueRaw("dn_length_mtr") ?? "") || 
                      parseFloat(getValidateParserFieldValueRaw("ot_length") ?? "") ||
                      parseFloat(getValidateParserFieldValueRaw("application_length_mtr") ?? "");
      if (!isNaN(actualTotal) && !isNaN(dnLength) && dnLength > 0) {
        const result = (actualTotal / dnLength).toFixed(2);
        
        return result;
      }
      return null;
    }
    
    if (field === "proj_non_refundable_savings_per_mtr") {
      const riBudgetAmountPerMeterRaw = getValidateParserFieldValue("ri_budget_amount_per_meter");
      if (riBudgetAmountPerMeterRaw && riBudgetAmountPerMeterRaw.includes("⚠️")) {
        return "⚠️ Cannot calculate - budget values not entered";
      }
      const riBudgetAmountPerMeter = parseFloat(riBudgetAmountPerMeterRaw ?? "");
      const nonRefundableAmountPerMtr = parseFloat(getValidateParserFieldValue("non_refundable_amount_per_mtr") ?? "");
      console.log(`🔧 proj_non_refundable_savings_per_mtr calculation:`);
      console.log(`  ri_budget_amount_per_meter: ${riBudgetAmountPerMeter}`);
      console.log(`  non_refundable_amount_per_mtr: ${nonRefundableAmountPerMtr}`);
      console.log(`  isNaN check - ri: ${isNaN(riBudgetAmountPerMeter)}, non_ref: ${isNaN(nonRefundableAmountPerMtr)}`);
      if (!isNaN(riBudgetAmountPerMeter) && !isNaN(nonRefundableAmountPerMtr)) {
        const result = (riBudgetAmountPerMeter - nonRefundableAmountPerMtr).toFixed(2);
        
        console.log(`  Calculation: ${riBudgetAmountPerMeter} - ${nonRefundableAmountPerMtr} = ${result}`);
        return result;
      }
      console.log(`  Calculation failed - returning ri_budget_amount_per_meter: ${riBudgetAmountPerMeter.toFixed(2)}`);
      return riBudgetAmountPerMeter.toFixed(2);
    }
    
    if (field === "proj_savings_per_dn") {
      const savingsPerMtrRaw = getValidateParserFieldValue("proj_non_refundable_savings_per_mtr");
      if (savingsPerMtrRaw && savingsPerMtrRaw.includes("⚠️")) {
        return "⚠️ Cannot calculate - budget values not entered";
      }
      const savingsPerMtr = parseFloat(savingsPerMtrRaw ?? "");
      const dnLength = parseFloat(getValidateParserFieldValue("dn_length_mtr") ?? "");
      if (!isNaN(savingsPerMtr) && !isNaN(dnLength)) {
        const result = (savingsPerMtr * dnLength).toFixed(2);
        
        return result;
      }
      return null;
    }
    
    if (field === "total_dn_amount") {
      // Try to get from KDMC total DN amount field first
      const kdmcTotal = parseFloat(getValidateParserFieldValueRaw("Total DN Amount ( NON REFUNDABLE+SD+ BG+ GST) To be filled by helpdesk team") ?? "");
      if (!isNaN(kdmcTotal)) {
        return kdmcTotal.toFixed(2);
      }
      
      // Fallback to component calculation
      const dnRiAmount = parseFloat(getValidateParserFieldValueRaw("dn_ri_amount") ?? "");
      const groundRentTotal = parseFloat(getValidateParserFieldValueRaw("ground_rent") ?? "");
      const adminChargeTotal = parseFloat(getValidateParserFieldValueRaw("administrative_charge") ?? "");
      const supervisionChargesTotal = parseFloat(getValidateParserFieldValueRaw("supervision_charges") ?? "");
      const chamberFee = parseFloat(getValidateParserFieldValueRaw("chamber_fee") ?? "");
      const gst = parseFloat(getValidateParserFieldValueRaw("gst") ?? "");
      const sdAmount = parseFloat(getValidateParserFieldValueRaw("deposit") ?? "");
      const dnSum = [dnRiAmount, groundRentTotal, adminChargeTotal, supervisionChargesTotal, chamberFee, gst, sdAmount]
        .map(v => isNaN(v) ? 0 : v)
        .reduce((a, b) => a + b, 0);
      
      if (dnSum > 0) {
        return dnSum.toFixed(2);
      }
      return null;
    }
    
    // Default to empty for blank/manual fields
    if ([
      "ce_route_lmc_id", "route_lmc_section_id", "route_lmc_subsection_id",
      "hdd_length", "no_of_pits", "pit_ri_rate",
      "new_revised_dn_number", "new_revised_dn_against", "internal_approval_start", "internal_approval_end",
      "ticket_raised_date", "dn_payment_date", "tat_days", "civil_completion_date"
    ].includes(field)) return "";
    
    return "";
  }



  // Helper to get the source for each field
  function getValidateParserFieldSource(field: string): string {
    // Hardcoded
    if (["route_routeLM_metroLM_LMCStandalone", "ip1_co_built", "dn_recipient", "project_name", "trench_type"].includes(field)) {
      if (["route_routeLM_metroLM_LMCStandalone", "ip1_co_built", "dn_recipient"].includes(field)) return "PO";
      return "Hardcoded";
    }
    // Calculated
    if (["ri_budget_amount_per_meter", "projected_budget_ri_amount_dn", "actual_total_non_refundable", "non_refundable_amount_per_mtr", "proj_non_refundable_savings_per_mtr", "total_dn_amount", "proj_savings_per_dn"].includes(field)) return "Calculated";
    // Blank/manual
    if (["ce_route_lmc_id", "route_lmc_section_id", "route_lmc_subsection_id", "hdd_length", "no_of_pits", "pit_ri_rate", "new_revised_dn_number", "new_revised_dn_against", "internal_approval_start", "internal_approval_end", "ticket_raised_date", "dn_payment_date", "tat_days", "civil_completion_date"].includes(field)) return "Blank";
    // Map to source by field
    const fieldMap: Record<string, string> = {
      "route_type": "Calculated",
      "route_id / site_id": "PO",
      "uid": "PO",
      "po_number": "PO",
      "po_length": "PO",
      "parent_route": "PO",
      "application_number": "DN Application",
      "application_length_mtr": "DN Application",
      "application_date": "DN Application",
      "from_location": "DN Application",
      "to_location": "DN Application",
      "authority": "DN Application",
      "ward": "DN Application",
      "dn_number": "DN",
      "dn_length_mtr": "DN",
      "dn_received_date": "DN",
      "ot_length": "DN",
      "surface": "DN",
      "surface_wise_ri_amount": "DN",
      "dn_ri_amount": "DN",
      "surface_wise_multiplication_factor": "DN",
      "ground_rent": "DN",
      "administrative_charge": "DN",
      "supervision_charges": "DN",
      "chamber_fee": "DN",
      "gst": "DN",
      "deposit": "DN",
      "surface_wise_length": "DN",
      "dn_recipient": "PO",
      // Fields from budget_master table
      "build_type": "Budget",
      "category_type": "Budget",
      "ri_budget_amount_per_meter": "Budget"
    };
    return fieldMap[field] || "";
  }

  // Handler for editing a value in the validation table
  const handleValidationEdit = (field: string, newValue: string) => {
    setValidationResults(prev => {
      // First try to find existing field by exact match
      const existingIndex = prev.findIndex(row => row.field === field);
      
      if (existingIndex !== -1) {
        // Update existing field
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], value: newValue };
        return updated;
      } else {
        // Try to find by normalized field mapping
        const fieldMap: Record<string, string> = {
          "route_type": "Category",
          "route_id / site_id": "SiteID", 
          "uid": "UID",
          "po_number": "PO No",
          "po_length": "PO Length (Mtr)",
          "parent_route": "Parent Route Name / HH",
          "application_number": "Application Number",
          "application_length_mtr": "Application Length (Mtr)",
          "application_date": "Application Date",
          "from_location": "From",
          "to_location": "To",
          "authority": "Authority",
          "ward": "Ward",
          "dn_number": "Demand Note Reference number",
          "dn_length_mtr": "Section Length",
          "dn_received_date": "Demand Note Date",
          "ot_length": "Section Length",
          "surface": "Road Types",
          "surface_wise_ri_amount": "Surface-wise RI Amount",
          "dn_ri_amount": "RI Amount",
          "surface_wise_multiplication_factor": "Surface-wise Multiplication Factor",
          "ground_rent": "Ground Rent",
          "administrative_charge": "Administrative Charge",
          "supervision_charges": "Supervision Charges",
          "chamber_fee": "Chamber Fee",
          "gst": "GST Amount",
          "deposit": "SD Amount"
        };
        
        const mappedField = fieldMap[field];
        const normalizeFieldName = (name: string) => name.replace(/\s+/g, '').toLowerCase();
        
        if (mappedField) {
          const mappedIndex = prev.findIndex(row => normalizeFieldName(row.field) === normalizeFieldName(mappedField));
          if (mappedIndex !== -1) {
            // Update mapped field
            const updated = [...prev];
            updated[mappedIndex] = { ...updated[mappedIndex], value: newValue };
            return updated;
          }
        }
        
        // If not found anywhere, add new entry
        const source = getValidateParserFieldSource(field);
        const newEntry = { field: mappedField || field, value: newValue, source };
        return [...prev, newEntry];
      }
    });
  };

  // Before rendering the Site ID dropdown:
  // Removed debug logging

  const handleSendToMasterDN = async () => {
    setSendingToMasterDN(true);
    setSendToMasterDNSuccess(null);
    setSendToMasterDNError(null);
    setPoNumberTypeError(null);
    // Use route_routeLM_metroLM_LMCStandalone for IP1 vs Co-Built validation
    if (poRowRouteLM.replace(/\s+/g, '').toLowerCase() === 'route' && !poNumberTypeConfirmed) {
      setPoNumberTypeError("Please confirm your PO Number Type selection (IP1 or Co-Built).");
      setSendingToMasterDN(false);
      return;
    }
    // Build the data array to always include every field in VALIDATE_PARSER_FIELDS
    const data = VALIDATE_PARSER_FIELDS.map(field => {
      let value = getValidateParserFieldValue(field);
      
      // Ensure dn_number is sent as integer without decimals
      if (field === 'dn_number' && value && !isNaN(Number(value))) {
        value = String(Math.round(Number(value)));
      }
      
      // Log calculated fields to ensure correct values are being sent
      if (["projected_budget_ri_amount_dn", "proj_non_refundable_savings_per_mtr", "proj_savings_per_dn", "non_refundable_amount_per_mtr", "actual_total_non_refundable", "total_dn_amount"].includes(field)) {
        console.log(`📤 Sending to DB - ${field}: ${value}`);
      }
      
      return { field, value };
    });
    try {
      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/send-to-master-dn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (!response.ok) {
        let errorMsg = 'Error sending to Master DN Database.';
        try {
          const errorData = await response.json();
          if (response.status === 409 && errorData.error?.includes('already exists')) {
            errorMsg = 'A Demand Note with this number already exists in the master database.';
          } else if (errorData.error) {
            errorMsg = errorData.error;
          }
        } catch {}
        setSendToMasterDNError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
        return;
      }
      setSendToMasterDNSuccess('Successfully sent to Master DN Database!');
      toast({
        title: 'Success',
        description: 'Successfully sent to Master DN Database!',
      });
    } catch (err: any) {
      setSendToMasterDNError(err.message || 'Error sending to Master DN Database.');
      toast({
        title: 'Error',
        description: err.message || 'Error sending to Master DN Database.',
        variant: 'destructive',
      });
    } finally {
      setSendingToMasterDN(false);
    }
  };

  // Remove old logic that sets isRouteSelected in fetchSurveyIdsAndCheckRoute
  // Instead, add this useEffect:
  useEffect(() => {
    // Use route_routeLM_metroLM_LMCStandalone for route selection logic
    const isRoute = poRowRouteLM.replace(/\s+/g, '').toLowerCase() === 'route';
    setIsRouteSelected(isRoute);
  }, [poRowRouteLM]);

  // Add debug log before rendering the prorated input box
  {(() => {
    // Removed debug logging
    return null;
  })()}
  {/* Removed survey ID selection UI - no longer needed with one budget per route */}

  // Removed build_type and category_type useEffect - now handled in checkRiCostPerMeter

  const handleExtractPdfDebug = async () => {
    if (!dnAppFile) {
      setPdfDebugError("Please select a DN Application file (PDF) first.");
      return;
    }
    setPdfDebugLoading(true);
    setPdfDebugError(null);
    setPdfDebugResult(null);
    try {
      const formData = new FormData();
      formData.append("pdf_file", dnAppFile);
      const res = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/extract-pdf-debug', {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (result.error) {
        setPdfDebugError(result.error);
      } else {
        setPdfDebugResult(result);
      }
    } catch (err) {
      setPdfDebugError("Failed to extract PDF text/tables.");
    } finally {
      setPdfDebugLoading(false);
    }
  };

  const handleMcgmAppDebugUpload = async () => {
    if (!mcgmAppDebugFile) return;
    setMcgmAppDebugLoading(true);
    setMcgmAppDebugError(null);
    setMcgmAppDebugText("");
    try {
      const formData = new FormData();
      formData.append("file", mcgmAppDebugFile);
      const res = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/parse-permit', {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to extract permit fields");
      const data = await res.json();
      setMcgmAppDebugText(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setMcgmAppDebugError(err.message || "Unknown error");
    } finally {
      setMcgmAppDebugLoading(false);
    }
  };

  // Add this inside the component, before the return statement
  React.useEffect(() => {
    // Removed debug logging
  }, [dnParseResult, dnAuthority]);

  // Add at the top of the DN component (after hooks, before return)
  // Removed debug logging

  // Before rendering the validation table, add:
  // Removed all KDMC validation debug logging

  // Handlers for PO Master File
  const handlePoMasterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPoMasterFile(e.target.files?.[0] || null);
    setPoMasterError(null);
    setPoMasterSuccess(null);
  };

  const handlePoMasterUpload = async () => {
    if (!poMasterFile) {
      setPoMasterError("Please select a PO Master Excel file.");
      return;
    }
    setPoMasterUploading(true);
    setPoMasterError(null);
    setPoMasterSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", poMasterFile);
      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/upload-po-master', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        let errorMsg = result.errors ? result.errors.join('\n') : (result.detail || result.message || 'Upload failed');
        setPoMasterError(errorMsg);
        return;
      }
      setPoMasterSuccess(result.message || 'Upload successful!');
    } catch (err: any) {
      setPoMasterError(err.message || 'Upload failed');
    } finally {
      setPoMasterUploading(false);
      setPoMasterFile(null);
      const input = document.getElementById('po-master-file-input') as HTMLInputElement | null;
      if (input) input.value = '';
    }
  };

  // Handlers for Budget Master File
  const handleBudgetMasterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBudgetMasterFile(e.target.files?.[0] || null);
    setBudgetMasterError(null);
    setBudgetMasterSuccess(null);
  };

  const handleBudgetMasterUpload = async () => {
    if (!budgetMasterFile) {
      setBudgetMasterError("Please select a Budget Master Excel file.");
      return;
    }
    setBudgetMasterUploading(true);
    setBudgetMasterError(null);
    setBudgetMasterSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", budgetMasterFile);
      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/upload-budget-master', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        let errorMsg = result.errors ? result.errors.join('\n') : (result.detail || result.message || 'Upload failed');
        setBudgetMasterError(errorMsg);
        return;
      }
      setBudgetMasterSuccess(result.message || 'Upload successful!');
    } catch (err: any) {
      setBudgetMasterError(err.message || 'Upload failed');
    } finally {
      setBudgetMasterUploading(false);
      setBudgetMasterFile(null);
      const input = document.getElementById('budget-master-file-input') as HTMLInputElement | null;
      if (input) input.value = '';
    }
  };

  return (
    <>
      {/* Master File Upload Cards */}
      <div className="w-full mb-8">
        <Card className="bg-[#101624] shadow-2xl border-none p-0 rounded-3xl">
          <CardHeader className="pb-2 flex flex-col gap-2 border-b border-slate-800/60 bg-[#101624]">
            <CardTitle className="text-2xl font-semibold text-white flex items-center gap-2 tracking-normal">
              <FileSpreadsheet className="h-8 w-8 text-blue-400 drop-shadow-lg" />
              <span>Upload Master Files</span>
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1 text-base font-normal leading-snug">
              Upload Master PO, Budget, and DN files to keep your database up to date.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 pb-8 px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Master PO File Card */}
              <div className="bg-[#181e2b] rounded-2xl shadow-lg p-6 flex flex-col items-center">
                <div className="flex items-center gap-3 mb-4 w-full">
                  <FileSpreadsheet className="h-8 w-8 text-blue-400" />
                  <div className="font-bold text-2xl text-white">Master PO File</div>
                </div>
                <div
                  className="w-full min-h-[120px] bg-[#101624] border-2 border-dashed border-blue-500 rounded-xl flex flex-col items-center justify-center py-6 px-4 cursor-pointer transition hover:bg-[#16203a] mb-2"
                  onClick={() => document.getElementById('po-master-file-input')?.click()}
                  tabIndex={0}
                  role="button"
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { document.getElementById('po-master-file-input')?.click(); } }}
                >
                  <FileSpreadsheet className="h-8 w-8 text-blue-400 mb-2" />
                  <div className="font-semibold text-sm text-white mb-1">Upload Excel File</div>
                  <div className="text-xs text-slate-400">Supports .xlsx and .xls files</div>
                  <input
                    id="po-master-file-input"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handlePoMasterFileChange}
                  />
                </div>
                <div className="min-h-[20px] text-xs text-blue-300 mt-1">{poMasterFile ? poMasterFile.name : ""}</div>
                <Button
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-md shadow hover:from-blue-600 hover:to-blue-800 py-2 text-sm flex items-center justify-center gap-2 mt-2"
                  onClick={handlePoMasterUpload}
                  disabled={!poMasterFile || poMasterUploading}
                >
                  {poMasterUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {poMasterUploading ? 'Uploading...' : 'Upload to Database'}
                </Button>
                {poMasterError && <div className="text-red-400 text-xs mt-2 text-center">{poMasterError}</div>}
                {poMasterSuccess && <div className="text-green-400 text-xs mt-2 text-center">{poMasterSuccess}</div>}
              </div>

              {/* Master Budget File Card */}
              <div className="bg-[#181e2b] rounded-2xl shadow-lg p-6 flex flex-col items-center">
                <div className="flex items-center gap-3 mb-4 w-full">
                  <FileSpreadsheet className="h-8 w-8 text-blue-400" />
                  <div className="font-bold text-2xl text-white">Master Budget File</div>
                </div>
                <div
                  className="w-full min-h-[120px] bg-[#101624] border-2 border-dashed border-blue-500 rounded-xl flex flex-col items-center justify-center py-6 px-4 cursor-pointer transition hover:bg-[#16203a] mb-2"
                  onClick={() => document.getElementById('budget-master-file-input')?.click()}
                  tabIndex={0}
                  role="button"
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { document.getElementById('budget-master-file-input')?.click(); } }}
                >
                  <FileSpreadsheet className="h-8 w-8 text-blue-400 mb-2" />
                  <div className="font-semibold text-sm text-white mb-1">Upload Excel File</div>
                  <div className="text-xs text-slate-400">Supports .xlsx and .xls files</div>
                  <input
                    id="budget-master-file-input"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleBudgetMasterFileChange}
                  />
                </div>
                <div className="min-h-[20px] text-xs text-blue-300 mt-1">{budgetMasterFile ? budgetMasterFile.name : ""}</div>
                <Button
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-md shadow hover:from-blue-600 hover:to-blue-800 py-2 text-sm flex items-center justify-center gap-2 mt-2"
                  onClick={handleBudgetMasterUpload}
                  disabled={!budgetMasterFile || budgetMasterUploading}
                >
                  {budgetMasterUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {budgetMasterUploading ? 'Uploading...' : 'Upload to Database'}
                </Button>
                {budgetMasterError && <div className="text-red-400 text-xs mt-2 text-center">{budgetMasterError}</div>}
                {budgetMasterSuccess && <div className="text-green-400 text-xs mt-2 text-center">{budgetMasterSuccess}</div>}
              </div>

              {/* Master DN File Card */}
              <div className="bg-[#181e2b] rounded-2xl shadow-lg p-6 flex flex-col items-center">
                <div className="flex items-center gap-3 mb-4 w-full">
                  <FileSpreadsheet className="h-8 w-8 text-blue-400" />
                  <div className="font-bold text-2xl text-white">Master DN File</div>
                </div>
                <div
                  className="w-full min-h-[120px] bg-[#101624] border-2 border-dashed border-blue-500 rounded-xl flex flex-col items-center justify-center py-6 px-4 cursor-pointer transition hover:bg-[#16203a] mb-2"
                  onClick={() => document.getElementById('dn-master-file-input')?.click()}
                  tabIndex={0}
                  role="button"
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { document.getElementById('dn-master-file-input')?.click(); } }}
                >
                  <FileSpreadsheet className="h-8 w-8 text-blue-400 mb-2" />
                  <div className="font-semibold text-sm text-white mb-1">Upload Excel File</div>
                  <div className="text-xs text-slate-400">Supports .xlsx and .xls files</div>
                  <input
                    id="dn-master-file-input"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleDnMasterFileChange}
                  />
                </div>
                <div className="min-h-[20px] text-xs text-blue-300 mt-1">{dnMasterFile ? dnMasterFile.name : ""}</div>
                <Button
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-md shadow hover:from-blue-600 hover:to-blue-800 py-2 text-sm flex items-center justify-center gap-2 mt-2"
                  onClick={handleDnMasterUpload}
                  disabled={!dnMasterFile || dnUploading}
                >
                  {dnUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {dnUploading ? 'Uploading...' : 'Upload to Database'}
                </Button>
                {dnError && <div className="text-red-400 text-xs mt-2 text-center">{dnError}</div>}
                {dnSuccess && <div className="text-green-400 text-xs mt-2 text-center">{dnSuccess}</div>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add DN Entry from 3 Files */}
      <Card className="bg-[#101624] shadow-2xl border-none p-0 rounded-3xl">
        <CardHeader className="pb-2 flex flex-col gap-2 border-b border-slate-800/60 bg-[#101624]">
          <CardTitle className="text-2xl font-semibold text-white flex items-center gap-2 tracking-normal">
            <Upload className="h-8 w-8 text-blue-400 drop-shadow-lg" />
            <span>Automated DN Entry & Budget Integration
            </span>
          </CardTitle>
          <CardDescription className="text-slate-400 mt-1 text-base font-normal leading-snug">
          Upload and parse POs, Applications, and DNs to power accurate Budget vs Actual financial analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-6 px-4">
          {/* Row 1: Site ID and Authority */}
          <div className="w-full flex flex-col md:flex-row gap-8 mb-2 items-start pt-8">
            <div className="flex-1 flex flex-col">
              <div className="flex items-center w-full mb-1">
                <label className="text-white text-sm font-medium block text-left" htmlFor="site-id-input">
                  <span className="flex items-center gap-1">
                    <Search className="h-4 w-4 text-green-500" /> Site ID / Route ID
                  </span>
                </label>
              </div>
              <div className="w-full relative mb-2">
                <Input
                  id="site-id-input"
                  placeholder="Search Site ID / Route ID"
                  className="bg-[#1f2937] text-white placeholder:text-gray-400 border border-gray-600 focus:ring-2 focus:ring-blue-500 w-full h-12 text-base px-4"
                  value={poSiteId}
                  onChange={e => {
                    setPoSiteId(e.target.value);
                    setSiteIdInputFocused(true);
                  }}
                  onFocus={() => setSiteIdInputFocused(true)}
                  onBlur={() => setTimeout(() => setSiteIdInputFocused(false), 150)}
                  autoComplete="off"
                />
                {siteIdInputFocused && (
                  <div className="absolute left-0 right-0 mt-1 z-30 bg-[#232a3a] border border-slate-600 rounded-lg max-h-32 overflow-y-auto shadow-xl">
                    {poSiteIdOptions.filter(id => id.toLowerCase().includes(poSiteId.toLowerCase())).length === 0 ? (
                      <div className="px-4 py-2 text-slate-400 text-sm">
                        {poSiteIdOptions.length === 0
                          ? "No Site IDs in database. Upload the Master PO file in the section below to add them."
                          : "No matching Site IDs"}
                      </div>
                    ) : (
                      poSiteIdOptions
                        .filter(id => id.toLowerCase().includes(poSiteId.toLowerCase()))
                        .map(id => (
                          <div
                            key={id}
                            className={`px-4 py-2 cursor-pointer hover:bg-green-600/10 text-white text-base rounded transition-all ${poSiteId === id ? "bg-green-600/10 font-semibold" : ""}`}
                            onMouseDown={() => { setPoSiteId(id); setSiteIdInputFocused(false); }}
                          >
                            {id}
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="flex items-center w-full mb-1">
                <label className="text-white text-sm font-medium block text-left" htmlFor="authority-select">
                  <span className="flex items-center gap-1">
                    <Shield className="h-4 w-4 text-blue-400" /> Authority
                  </span>
                </label>
              </div>
              <Select value={dnAuthority} onValueChange={setDnAuthority}>
                <SelectTrigger id="authority-select" className="bg-[#1f2937] text-white border border-gray-600 focus:ring-2 focus:ring-blue-500 w-full h-12 text-base px-4">
                  <SelectValue placeholder="Select Authority" />
                </SelectTrigger>
                <SelectContent className="bg-[#1f2937] text-white border border-gray-700">
                  <SelectItem value="MCGM" className="hover:bg-blue-600">MCGM</SelectItem>
                  <SelectItem value="MBMC" className="hover:bg-blue-600">MBMC</SelectItem>
                  <SelectItem value="KDMC" className="hover:bg-blue-600">KDMC</SelectItem>
                  <SelectItem value="NMMC" className="hover:bg-blue-600">NMMC</SelectItem>
                  <SelectItem value="MIDC Type 1" className="hover:bg-blue-600">MIDC Type 1</SelectItem>
                  <SelectItem value="MIDC Type 2" className="hover:bg-blue-600">MIDC Type 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Row 2: Survey ID(s) and PO Number Type */}
          <div className="w-full flex flex-col md:flex-row gap-8 mb-6 items-start">
            <div className="flex-1 flex flex-col">
              {/* Removed survey ID selection UI - no longer needed with one budget per route */}
            </div>
            <div className="flex-1 flex flex-col">
              {/* PO Number Type Dropdown for Route - now top-aligned with Survey ID(s) */}
              {(() => {
                // Use route_routeLM_metroLM_LMCStandalone for UI rendering logic
                const isRoute = poRowRouteLM.replace(/\s+/g, '').toLowerCase() === 'route';
                return isRoute;
              })() && (
                <div className="w-full mt-2 mb-8">
                  <label className="text-white text-sm font-medium block mb-1" htmlFor="po-number-type">PO Number Type <span className="text-red-500">*</span></label>
                  {!poNumberTypeConfirmed ? (
                    <>
                      <select
                        id="po-number-type"
                        value={poNumberType || ''}
                        onChange={e => { setPoNumberType(e.target.value as 'IP1' | 'Co-Built'); setPoNumberTypeError(null); }}
                        className="w-full rounded bg-[#1f2937] border border-gray-600 focus:ring-2 focus:ring-blue-500 text-white px-4 py-3 text-base h-12"
                        required
                      >
                        <option value="" disabled>Select PO Number Type</option>
                        <option value="IP1">IP1</option>
                        <option value="Co-Built">Co-Built</option>
                      </select>
                      {poNumberTypeError && (
                        <div className="text-red-400 text-xs mt-1">{poNumberTypeError}</div>
                      )}
                      <button
                        className="mt-3 px-4 py-2 bg-green-600 text-white rounded font-semibold hover:bg-green-700 transition disabled:opacity-50 h-12 text-base"
                        onClick={() => {
                          if (!poNumberType) {
                            setPoNumberTypeError('Please select a PO Number Type (IP1 or Co-Built).');
                          } else {
                            setPoNumberTypeConfirmed(poNumberType);
                            setPoNumberTypeError(null);
                          }
                        }}
                        disabled={!poNumberType}
                        type="button"
                        style={{ minWidth: 180 }}
                      >
                        Confirm Selection
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="bg-blue-700/20 text-blue-200 px-3 py-1 rounded-full text-sm font-medium border border-blue-400/20">
                          {poNumberTypeConfirmed}
                        </span>
                      </div>
                      <button
                        className="mb-2 px-3 py-1 bg-gray-700 text-white rounded font-medium hover:bg-gray-800 transition h-10 text-base"
                        onClick={() => setPoNumberTypeConfirmed(null)}
                        type="button"
                        style={{ minWidth: 140 }}
                      >
                        Change Selection
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Main cards below the aligned row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-6 items-start">
            {/* DN Application Card */}
            <Card className="flex-1 flex flex-col h-full bg-[#101624] shadow-2xl border-none p-0 rounded-3xl">
              <CardHeader className="pb-4 flex flex-col gap-2 border-b border-slate-800/60 bg-[#101624]">
                <div className="min-h-[32px] flex flex-col justify-center">
                  <CardTitle className="text-2xl font-semibold text-white flex items-center gap-2 tracking-normal">
                    <FileText className="h-7 w-7 text-blue-400 drop-shadow-lg" />
                    <span>DN Application</span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col h-full pt-2 pb-6 px-6">
                <div className="flex flex-col h-full justify-between w-full gap-4">
                  <div
                    className="w-full min-h-[64px] max-w-5xl bg-[#101624] border-2 border-dashed border-blue-500 rounded-2xl flex flex-col items-center justify-center py-4 px-6 cursor-pointer transition hover:bg-[#16203a]"
                    onClick={() => document.getElementById('dn-app-file-input')?.click()}
                    tabIndex={0}
                    role="button"
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { document.getElementById('dn-app-file-input')?.click(); } }}
                  >
                    <FileText className="h-14 w-14 text-blue-400 mb-2" />
                    <div className="font-semibold text-lg text-white mb-1">Upload File</div>
                    <div className="text-xs text-slate-400">Supports .pdf files</div>
                    <input
                      id="dn-app-file-input"
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={e => setDnAppFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  {dnAppFile && (
                    <div className="text-xs text-blue-300 mt-1 truncate w-full text-center">{dnAppFile.name}</div>
                  )}
                </div>
              </CardContent>
            </Card>
            {/* Demand Note Card */}
            <Card className="flex-1 flex flex-col h-full bg-[#101624] shadow-2xl border-none p-0 rounded-3xl">
              <CardHeader className="pb-4 flex flex-col gap-2 border-b border-slate-800/60 bg-[#101624]">
                <div className="min-h-[32px] flex flex-col justify-center">
                  <CardTitle className="text-2xl font-semibold text-white flex items-center gap-2 tracking-normal">
                    <FileText className="h-7 w-7 text-blue-400 drop-shadow-lg" />
                    <span>Demand Note</span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col h-full pt-2 pb-6 px-6">
                <div className="flex flex-col h-full justify-between w-full gap-4">
                  <div
                    className="w-full min-h-[64px] max-w-5xl bg-[#101624] border-2 border-dashed border-blue-500 rounded-2xl flex flex-col items-center justify-center py-4 px-6 cursor-pointer transition hover:bg-[#16203a]"
                    onClick={() => document.getElementById('dn-file-input')?.click()}
                    tabIndex={0}
                    role="button"
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { document.getElementById('dn-file-input')?.click(); } }}
                  >
                    <FileText className="h-14 w-14 text-blue-400 mb-2" />
                    <div className="font-semibold text-lg text-white mb-1">Upload File</div>
                    <div className="text-xs text-slate-400">Supports .pdf files</div>
                    <input
                      id="dn-file-input"
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0] || null;
                        setDnFile(file);
                      }}
                    />
                  </div>
                  {dnFile && (
                    <div className="text-xs text-blue-300 mt-1 truncate w-full text-center">{dnFile.name}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
                    <div className="flex flex-col items-center w-full mt-10 gap-2">
            <Button
              className="w-full max-w-md bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white font-bold rounded-md px-8 py-4 flex items-center justify-center gap-3 shadow-2xl transition text-lg tracking-wide drop-shadow-lg"
              onClick={handleValidateParsers}
              disabled={validating}
            >
              {validating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Shield className="w-6 h-6 text-white" />}
              {validating ? "Validating..." : "Validate Parsers"}
            </Button>
            {validateError && <div className="text-red-400 text-base font-medium mt-2">{validateError}</div>}
          </div>
          {validationResults.length > 0 && (
            <div className="max-h-[60vh] overflow-x-auto rounded-2xl shadow-2xl border border-slate-700 w-full mt-8">
              <Table className="text-xs border-collapse w-full">
                <TableHeader>
                  <TableRow className="bg-[#232a3a] sticky top-0 z-10">
                    <TableHead className="text-gray-200 font-semibold py-2 px-4 border-b border-slate-700 border-t border-x-0 rounded-tl-2xl w-1/4 min-w-[160px]">Field</TableHead>
                    <TableHead className="text-gray-200 font-semibold py-2 px-4 border-b border-slate-700 border-t border-x-0 w-2/5 min-w-[200px]">Value</TableHead>
                    <TableHead className="text-gray-200 font-semibold py-2 px-4 border-b border-slate-700 border-t border-x-0 rounded-tr-2xl w-1/4 min-w-[120px]">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TooltipProvider>
                    {VALIDATE_PARSER_FIELDS.map((field: string, idx: number) => {
                        const isEven = idx % 2 === 0;
                        // Use robust mapping for value and apply proper formatting
                        const rawValue = getValidateParserFieldValue(field) ?? '';
                        const value = roundTo2Decimals(rawValue, field);
                        const source = getValidateParserFieldSource(field);
                        // Find the index in validationResults using normalization and alias mapping
                        const fieldMap: Record<string, string> = {
                          "route_type": "Category",
                          "route_id / site_id": "SiteID",
                          "uid": "UID",
                          "po_number": "PO No",
                          "po_length": "PO Length (Mtr)",
                          "parent_route": "Parent Route Name / HH",
                          "application_number": "Application Number",
                          "application_length_mtr": "Application Length (Mtr)",
                          "application_date": "Application Date",
                          "from_location": "From",
                          "to_location": "To",
                          "authority": "Authority",
                          "ward": "Ward",
                          "dn_number": "Demand Note Reference number",
                          "dn_length_mtr": "Section Length",
                          "dn_received_date": "Demand Note Date",
                          "ot_length": "Section Length",
                          "surface": "Road Types",
                          "surface_wise_ri_amount": "Surface-wise RI Amount",
                          "dn_ri_amount": "RI Amount",
                          "surface_wise_multiplication_factor": "Surface-wise Multiplication Factor",
                          "ground_rent": "Ground Rent",
                          "administrative_charge": "Administrative Charge",
                          "supervision_charges": "Supervision Charges",
                          "chamber_fee": "Chamber Fee",
                          "gst": "GST Amount",
                          "deposit": "SD Amount"
                        };
                        const lookup = fieldMap[field] || field;
                        const normalizeFieldName = (name: string) => name.replace(/\s+/g, '').toLowerCase();
                        const resultIdx = validationResults.findIndex(row => normalizeFieldName(row.field) === normalizeFieldName(lookup));
                        let badgeClass = "bg-slate-700/10 text-slate-100 border-slate-400/10";
                        if (source === "PO") badgeClass = "bg-blue-700/10 text-blue-200 border-blue-400/10";
                        else if (source === "DN") badgeClass = "bg-purple-700/10 text-purple-200 border-purple-400/10";
                        else if (source === "DN Application") badgeClass = "bg-orange-700/10 text-orange-200 border-orange-400/10";
                        else if (source === "Calculated") badgeClass = "bg-green-700/10 text-green-200 border-green-400/10";
                        else if (source === "Blank") badgeClass = "bg-gray-700/10 text-gray-300 border-gray-400/10";
                        return (
                          <TableRow
                            key={field}
                            className={
                              `${isEven ? "bg-[#232a3a]/40" : "bg-[#1a1f2b]/30"} hover:bg-[#2d3650]/40 transition-colors border-x border-slate-700` +
                              (idx === 0 ? " rounded-tl-2xl" : "") +
                              (idx === VALIDATE_PARSER_FIELDS.length - 1 ? " rounded-bl-2xl" : "")
                            }
                          >
                            <TableCell className="text-white font-medium py-2 px-4 border-x border-slate-700 align-middle whitespace-nowrap w-1/4 min-w-[160px] text-sm">
                              {field}
                            </TableCell>
                            <TableCell className="text-gray-200 py-2 px-4 border-x border-slate-700 align-middle w-2/5 min-w-[200px] text-sm">
                              <input
                                type="text"
                                value={value}
                                onChange={e => {
                                  handleValidationEdit(field, e.target.value);
                                }}
                                className={`w-full rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                                  value && value.includes("⚠️") 
                                    ? "bg-yellow-900/30 border border-yellow-500/50 text-yellow-200" 
                                    : "bg-[#232a3a] border border-slate-700 text-white"
                                }`}
                                style={value && value.includes("⚠️") ? {} : { background: 'rgba(35,42,58,0.85)' }}
                              />
                            </TableCell>
                            <TableCell className="w-1/4 min-w-[120px] py-2 px-4 border-x border-slate-700 align-middle">
                              <Badge className={badgeClass}>{source}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TooltipProvider>
                </TableBody>
              </Table>
            </div>
          )}
          {validationResults.length > 0 && (
            <div className="flex flex-col items-center w-full mt-6 gap-4">
              <Button
                className="w-full max-w-md bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-md shadow-lg hover:from-blue-600 hover:to-blue-800 transition py-3 text-base flex items-center justify-center gap-3"
                onClick={handleSendToMasterDN}
                disabled={sendingToMasterDN}
              >
                {sendingToMasterDN ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 mr-1" />}
                {sendingToMasterDN ? 'Uploading...' : 'Upload to Database'}
              </Button>
              {sendToMasterDNSuccess && <div className="text-green-400 text-base font-medium mt-2">{sendToMasterDNSuccess}</div>}
              {sendToMasterDNError && <div className="text-red-400 text-base font-medium mt-2">{sendToMasterDNError}</div>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DN Master Database Management Section (Redesigned) */}
      <div className="w-full mb-8">
        <Card className="bg-[#101624] shadow-2xl border-none p-0 rounded-3xl flex flex-col">
          <CardHeader className="pb-2 flex flex-col gap-2 border-b border-slate-800/60 bg-[#101624]">
            <CardTitle className="text-2xl font-semibold text-white flex items-center gap-2 tracking-normal">
              <FileSpreadsheet className="h-7 w-7 text-blue-400 drop-shadow-lg" />
              <span>Download Master Files</span>
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1 text-base font-normal leading-snug">
              Download the latest Master DN, Master Budget, or Master PO database as an Excel file for offline analysis or backup.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-1 pt-0 pb-8 px-6">
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {/* PO Card (left) */}
              <div className="bg-[#181e2b] rounded-2xl shadow-lg p-4 flex flex-col items-center flex-1 w-full h-full min-w-0">
                <FileSpreadsheet className="h-8 w-8 text-blue-400 mb-2" />
                <div className="font-bold text-base text-white mb-1">Master PO Database</div>
                <div className="text-slate-400 text-xs mb-3 text-center">Download the latest Master PO Excel file.</div>
                <Button
                  className="w-full flex-1 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-md shadow hover:from-blue-600 hover:to-blue-800 py-2 text-sm flex items-center justify-center gap-2"
                  onClick={() => window.open(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/download-master-po', '_blank')}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" /> Download
                </Button>
              </div>
              {/* Budget Card (middle) */}
              <div className="bg-[#181e2b] rounded-2xl shadow-lg p-4 flex flex-col items-center flex-1 w-full h-full min-w-0">
                <FileSpreadsheet className="h-8 w-8 text-blue-400 mb-2" />
                <div className="font-bold text-base text-white mb-1">Master Budget Database</div>
                <div className="text-slate-400 text-xs mb-3 text-center">Download the latest Master Budget Excel file.</div>
                <Button
                  className="w-full flex-1 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-md shadow hover:from-blue-600 hover:to-blue-800 py-2 text-sm flex items-center justify-center gap-2"
                  onClick={() => window.open(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/download-master-budget', '_blank')}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" /> Download
                </Button>
              </div>
              {/* DN Card (right) */}
              <div className="bg-[#181e2b] rounded-2xl shadow-lg p-4 flex flex-col items-center flex-1 w-full h-full min-w-0">
                <FileSpreadsheet className="h-8 w-8 text-blue-400 mb-2" />
                <div className="font-bold text-base text-white mb-1">Master DN Database</div>
                <div className="text-slate-400 text-xs mb-3 text-center">Download the latest Master DN Excel file.</div>
                <Button
                  className="w-full flex-1 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-md shadow hover:from-blue-600 hover:to-blue-800 py-2 text-sm flex items-center justify-center gap-2"
                  onClick={() => window.open(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/download-master-dn', '_blank')}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" /> Download
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
} 