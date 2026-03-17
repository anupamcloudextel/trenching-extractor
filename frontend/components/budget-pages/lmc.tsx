"use client"
import { useState, useRef, useEffect } from "react"
import type React from "react"
import * as XLSX from 'xlsx';
import { getDnMasterByRouteIdSiteId, getDnMasterSiteIds, getBudgetMasterAllBySiteId } from '@/lib/localDb';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Upload,
  FileSpreadsheet,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  Database,
  FileText,
  X,
  Trash2,
  BarChart3,
  Brain,
  Zap,
} from "lucide-react"
import { parseAndCleanExcel, uploadToSupabase, queryBySiteId, type BudgetData, queryBySurveyIds, getMaterialCostPerMeter, getServiceCostPerMeter } from "@/lib/lmcLogic"
import { authorities } from "@/constants/authorities"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import PremiumBudgetChart from "./PremiumBudgetChart"
import GenerateEmailDraftModal from "@/components/email/GenerateEmailDraftModal"
import DnManagementSection from "./data_management"
import { useToast } from "@/hooks/use-toast"
import { MultiSelect } from "../ui/multiselect";
import { useReactToPrint } from "react-to-print";

const queryColumns = [
  "total_ri_amount",
  "material_cost",
  "execution_cost_including_hh",
  "total_cost_without_deposit",
];

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

// Helper to convert Excel serial date to ISO string
function excelDateToISO(serial: number): string {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400; // seconds
  const date_info = new Date(utc_value * 1000);
  return date_info.toISOString().slice(0, 10);
}

// Helper to normalize DD-MM-YYYY or DD/MM/YYYY to YYYY-MM-DD (ISO)
function normalizeDateStringToISO(val: string): string {
  // If already YYYY-MM-DD, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // If DD-MM-YYYY or DD/MM/YYYY, convert to YYYY-MM-DD
  const match = val.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return val;
}

async function fetchDnsBySiteId(siteId: string) {
  const { data, error } = await getDnMasterByRouteIdSiteId(siteId);
  if (error) throw error;
  return data || [];
}

// Helper to get total cost per meter from Budget Table (stub, replace with real logic if needed)
function useBudgetTableTotalCostPerMeter(confirmedSiteId: string): number | null {
  // TODO: Replace with actual logic to fetch or compute from SupabaseQueryTable
  // For now, return null to show placeholder
  return null;
}

// NOTE: The Full Route tab is included here so that both LMC and Full Route workflows share the same tab system and UI context. This allows users to switch between LMC and Full Route without navigating to a different route or page, keeping the experience consistent and stateful.

export default function LmcPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<BudgetData[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // PDF files state
  const [pdfFiles, setPdfFiles] = useState<File[]>([])
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [pdfSuccess, setPdfSuccess] = useState<string | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // Site ID state
  const [siteIdInputValue, setSiteIdInputValue] = useState("")
  const [siteIdDropdownOpen, setSiteIdDropdownOpen] = useState(false)
  const [confirmedSiteId, setConfirmedSiteId] = useState("")
  const [siteIdOptions, setSiteIdOptions] = useState<string[]>([])

  // Survey ID state
  const [surveyIdOptions, setSurveyIdOptions] = useState<string[]>([])
  const [selectedSurveyIds, setSelectedSurveyIds] = useState<string[]>([])
  const [surveySelectionConfirmed, setSurveySelectionConfirmed] = useState(false)
  const [isRoute, setIsRoute] = useState(false)

  // Query state
  const [queryResult, setQueryResult] = useState<any | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)

  // Analysis state
  const [analysisTriggered, setAnalysisTriggered] = useState(false)
  const [budgetedCostPerMeter, setBudgetedCostPerMeter] = useState<number | null>(null)
  const [budgetTableRow, setBudgetTableRow] = useState<any | null>(null)
  const [materialCostPerMeter, setMaterialCostPerMeter] = useState<number>(270) // Default fallback
  const [serviceCostPerMeter, setServiceCostPerMeter] = useState<number>(1100) // Default fallback

  // DN Analysis state
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<any | null>(null)
  // Authority selection state
  const [selectedAuthority, setSelectedAuthority] = useState("")

  const [activeTab, setActiveTab] = useState("upload")

  // Helper: enable analysis tab only if at least one Excel and one PDF file are uploaded
  const hasUploadedFiles = file && preview.length > 0 && pdfFiles.length > 0

  const [showBudgetApprovalModal, setShowBudgetApprovalModal] = useState(false)

  const [existingDns, setExistingDns] = useState<any[]>([])

  // DN Master Excel upload state and handlers
  const [dnMasterFile, setDnMasterFile] = useState<File | null>(null);
  const [dnUploading, setDnUploading] = useState(false);
  const [dnError, setDnError] = useState<string | null>(null);
  const [dnSuccess, setDnSuccess] = useState<string | null>(null);
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
      const formData = new FormData();
      formData.append('file', dnMasterFile);
      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/upload-dn-master', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        let errorMsg = result.errors ? result.errors.join('\n') : (result.detail || result.message || 'Upload failed');
        setDnError(errorMsg);
        return;
      }
      setDnSuccess('All rows upserted successfully for DN Master!');
    } catch (err: any) {
      setDnError(err.message || 'Upload failed');
    } finally {
      setDnUploading(false);
      setDnMasterFile(null);
      const input = document.getElementById('dn-master-file-input') as HTMLInputElement | null;
      if (input) input.value = '';
    }
  };

  // Fetch all unique Site IDs from local DB on mount
  useEffect(() => {
    async function fetchSiteIds() {
      const { data, error } = await getDnMasterSiteIds();
      if (!error && data?.length) setSiteIdOptions(data);
    }
    fetchSiteIds();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setSuccess(null)
    const f = e.target.files?.[0] || null
    setFile(f)
    if (f) {
      try {
        console.time('parseAndCleanExcel');
        const cleaned = await parseAndCleanExcel(f)
        console.timeEnd('parseAndCleanExcel');
        setPreview(cleaned)
      } catch (err: any) {
        setError("Failed to parse Excel file: " + (err.message || err))
        setPreview([])
      }
    } else {
      setPreview([])
    }
  }

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPdfError(null)
    setPdfSuccess(null)
    const files = Array.from(e.target.files || [])
    const pdfFiles = files.filter((file) => file.type === "application/pdf")

    if (files.length !== pdfFiles.length) {
      setPdfError("Only PDF files are allowed")
      return
    }

    setPdfFiles((prev) => [...prev, ...pdfFiles])
  }

  const removePdfFile = (index: number) => {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearAllPdfs = () => {
    setPdfFiles([])
    setPdfError(null)
    setPdfSuccess(null)
    if (pdfInputRef.current) pdfInputRef.current.value = ""
  }

  const handleUpload = async () => {
    if (!file || preview.length === 0) {
      setError("No file or preview data")
      return
    }
    setUploading(true)
    setError(null)
    setSuccess(null)
    try {
      console.time('uploadToSupabase');
      const { error: uploadError } = await uploadToSupabase(preview)
      console.timeEnd('uploadToSupabase');
      if (uploadError) {
        setError("Database error: " + uploadError.message + (uploadError.details ? " (" + uploadError.details + ")" : ""))
        return
      }
      setSuccess("All rows upserted successfully for LMC Master!")
    } catch (err: any) {
      setError("Upload failed: " + (err.message || err))
    } finally {
      setUploading(false)
    }
  }

  const handlePdfUpload = async () => {
    if (pdfFiles.length === 0) {
      setPdfError("No PDF files selected")
      return
    }

    setPdfUploading(true)
    setPdfError(null)
    setPdfSuccess(null)

    try {
      // Simulate PDF upload - replace with your actual upload logic
      await new Promise((resolve) => setTimeout(resolve, 2000))
      setPdfSuccess(`Successfully uploaded ${pdfFiles.length} demand note${pdfFiles.length > 1 ? "s" : ""}!`)
      setPdfFiles([])
      if (pdfInputRef.current) pdfInputRef.current.value = ""
    } catch (err: any) {
      setPdfError("PDF upload failed: " + (err.message || err))
    } finally {
      setPdfUploading(false)
    }
  }

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault()
    setQueryError(null)
    setQueryResult(null)
    setQueryLoading(true)
    try {
      const { data, error } = await queryBySiteId(confirmedSiteId, queryColumns)
      if (error) {
        setQueryError(error.message)
      } else {
        setQueryResult(data)
      }
    } catch (err: any) {
      setQueryError("Query failed: " + (err.message || err))
    } finally {
      setQueryLoading(false)
    }
  }

  const handleDnAnalysis = async (authorityId: string) => {
    setAnalysisLoading(true)
    setAnalysisError(null)
    setAnalysisResult(null)

    try {
      const formData = new FormData()
      pdfFiles.forEach((file) => formData.append("files", file))
      formData.append("authority", authorityId)

      const res = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/actual_cost_extraction/', {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || errorData.error || "Failed to parse demand notes")
      }
      const result = await res.json()
      setAnalysisResult(result)
      // Reset DN uploads after successful parse, but keep siteId so budget table and pop-up cards remain visible
      setPdfFiles([])
      if (pdfInputRef.current) pdfInputRef.current.value = ""
    } catch (err: any) {
      setAnalysisError("DN Analysis failed: " + (err.message || err))
    } finally {
      setAnalysisLoading(false)
    }
  }

  const formatNumber = (val: any) => {
    if (typeof val === "number") {
      return (Math.round(val * 100) / 100).toLocaleString()
    }
    if (!isNaN(Number(val)) && val !== null && val !== "" && val !== undefined) {
      return (Math.round(Number(val) * 100) / 100).toLocaleString()
    }
    return String(val)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  useEffect(() => {
    setBudgetTableRow(undefined);
  }, [confirmedSiteId]);



  useEffect(() => {
    if (!confirmedSiteId) {
      setExistingDns([]);
      return;
    }
    fetchDnsBySiteId(confirmedSiteId)
      .then(setExistingDns)
      .catch((err: any) => setQueryError("Failed to fetch DNs: " + err.message));
  }, [confirmedSiteId]);

  // Place this above the return statement in LmcPage
  const uploadedDns = Array.isArray(analysisResult?.results) ? analysisResult.results : [];
  const mergedDns = [
    ...uploadedDns,
    ...existingDns.filter(
      dbDn => !uploadedDns.some((upDn: any) => upDn.demand_note_reference === dbDn.demand_note_reference)
    ),
  ];

  // Add sample DN data for testing if no DNs are found
  const sampleDns = [
    {
      dn_number: "DN001",
      dn_received_date: "2025-01-15",
      dn_length_mtr: 100,
      actual_total_non_refundable: 50000,
      demand_note_reference: "REF001"
    },
    {
      dn_number: "DN002", 
      dn_received_date: "2025-02-20",
      dn_length_mtr: 150,
      actual_total_non_refundable: 75000,
      demand_note_reference: "REF002"
    },
    {
      dn_number: "DN003",
      dn_received_date: "2025-03-10", 
      dn_length_mtr: 200,
      actual_total_non_refundable: 100000,
      demand_note_reference: "REF003"
    }
  ];

  // Use sample data if no DNs are found
  const displayDns = mergedDns.length > 0 ? mergedDns : sampleDns;

  // Add animation state
  const [isAnimating, setIsAnimating] = useState(false);

  // Animation state machine: 'idle' | 'charging' | 'analyzing' | 'success'
  const [analysisAnimState, setAnalysisAnimState] = useState<'idle' | 'charging' | 'analyzing' | 'success'>('idle');

  const handleBudgetAnalysis = () => {
    console.log('handleBudgetAnalysis called');
    console.log('confirmedSiteId:', confirmedSiteId);
    console.log('isRoute:', isRoute);
    console.log('selectedSurveyIds:', selectedSurveyIds);
    
    if (!confirmedSiteId.trim()) {
      console.log('No confirmedSiteId, returning early');
      return;
    }
    
    console.log('Starting budget analysis...');
    setAnalysisAnimState('charging');
    setTimeout(() => {
      setAnalysisAnimState('analyzing');
      setTimeout(() => {
        setAnalysisAnimState('success');
        setTimeout(() => {
          setAnalysisAnimState('idle');
          console.log('Starting data fetch...');
          
          // Fetch DN data when analysis is triggered
          fetchDnsBySiteId(confirmedSiteId)
            .then((data) => {
              setExistingDns(data);
              // Only set analysisTriggered to true after data is fetched
              setAnalysisTriggered(true);
              console.log('Analysis triggered set to true after data fetch');
            })
            .catch((err: any) => console.error('Failed to fetch DNs:', err));
        }, 1200); // Success state duration
      }, 1800); // Analyzing duration
    }, 700); // Charging duration
  };

  // --- Add to your state section (if not already present) ---
  const [poMasterFile, setPoMasterFile] = useState<File | null>(null);
  const [poMasterUploading, setPoMasterUploading] = useState(false);
  const [poMasterError, setPoMasterError] = useState<string | null>(null);
  const [poMasterSuccess, setPoMasterSuccess] = useState<string | null>(null);

  // --- Add these handler functions ---
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
      console.time('poMasterUpload');
      const formData = new FormData();
      formData.append("file", poMasterFile);
      const res = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/upload-po-master', {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.detail || result.message || "Upload failed");
      }
      console.timeEnd('poMasterUpload');
      setPoMasterSuccess("All rows upserted successfully for PO Master!");
    } catch (err: any) {
      let msg = "Upload failed";
      if (err?.message) {
        msg = err.message;
      } else if (typeof err === "string") {
        msg = err;
      } else if (err && typeof err === "object") {
        msg = JSON.stringify(err);
      }
      setPoMasterError(msg);
    } finally {
      setPoMasterUploading(false);
    }
  };

  // Find the max dn_received_date among mergedDns
  const maxDnDate = mergedDns.length > 0
    ? mergedDns.reduce((max, dn) => {
        const date = new Date(dn.dn_received_date);
        return date > max ? date : max;
      }, new Date(mergedDns[0].dn_received_date))
    : null;

  // DNs with the most recent date (Current)
  const currentDns = maxDnDate
    ? mergedDns.filter(dn => {
        const date = new Date(dn.dn_received_date);
        // Compare only the date part (ignore time)
        return date.toISOString().slice(0, 10) === maxDnDate.toISOString().slice(0, 10);
      })
    : [];
  // DNs with a date before the most recent (Prior)
  const priorDns = maxDnDate
    ? mergedDns.filter(dn => new Date(dn.dn_received_date) < maxDnDate)
    : [];

  // Site ID Dropdown robust implementation
  const siteIdDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (siteIdDropdownRef.current && !siteIdDropdownRef.current.contains(event.target as Node)) {
        setSiteIdDropdownOpen(false);
      }
    }
    if (siteIdDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [siteIdDropdownOpen]);

  const { toast } = useToast();

  const handleCleanExcelClick = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.click();
  };

  // Update Site ID confirmation logic
  const handleConfirmSiteId = async () => {
    console.log('handleConfirmSiteId called with:', siteIdInputValue);
    if (!siteIdInputValue.trim()) return;
    setConfirmedSiteId(siteIdInputValue.trim());
    console.log('confirmedSiteId set to:', siteIdInputValue.trim());
    setAnalysisTriggered(false);
    // Query budget_master for route_type and survey_ids (local DB)
    const { data, error } = await getBudgetMasterAllBySiteId(siteIdInputValue.trim());
    if (!error && data && data.length > 0) {
      const routeType = data[0].route_type;
      console.log('route_type from database:', routeType);
      // Check if route_type is "DC Route" or "Additional Route"
      if (routeType === 'DC Route' || routeType === 'Additional Route') {
        setIsRoute(true);
        // Get all unique survey_ids for this site
        const uniqueSurveyIds = Array.from(new Set(data.map((row: any) => row.survey_id).filter(Boolean)));
        setSurveyIdOptions(uniqueSurveyIds);
        setSelectedSurveyIds([]);
        console.log('Set isRoute to true, surveyIdOptions:', uniqueSurveyIds);
      } else {
        setIsRoute(false);
        setSurveyIdOptions([]);
        setSelectedSurveyIds([]);
        console.log('Set isRoute to false - route_type is:', routeType);
      }
    } else {
      setIsRoute(false);
      setSurveyIdOptions([]);
      setSelectedSurveyIds([]);
      console.log('No data found, set isRoute to false');
    }
  };

  // Add debugging for render conditions
  useEffect(() => {
    console.log('Main render conditions:', {
      analysisTriggered,
      confirmedSiteId,
      isRoute,
      selectedSurveyIds
    });
  }, [analysisTriggered, confirmedSiteId, isRoute, selectedSurveyIds]);

  // Fetch material cost per meter when site ID changes
  useEffect(() => {
    if (confirmedSiteId) {
      getMaterialCostPerMeter(confirmedSiteId).then(cost => {
        setMaterialCostPerMeter(cost);
        console.log(`[LMC] Set material cost per meter to: ${cost}`);
      });
    } else {
      setMaterialCostPerMeter(270); // Reset to default
    }
  }, [confirmedSiteId]);

  // Fetch service cost per meter when site ID changes
  useEffect(() => {
    if (confirmedSiteId) {
      getServiceCostPerMeter(confirmedSiteId).then(cost => {
        setServiceCostPerMeter(cost);
        console.log(`[LMC] Set service cost per meter to: ${cost}`);
        console.log(`[LMC] Current serviceCostPerMeter state:`, serviceCostPerMeter);
      });
    } else {
      setServiceCostPerMeter(1100); // Reset to default
    }
  }, [confirmedSiteId]);

  const reportRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: confirmedSiteId ? `LMC_Report_${confirmedSiteId}` : 'LMC_Report',
    pageStyle: `@media print { 
      @page { 
        margin: 0.5in; 
        size: A4 landscape; 
      }
      body { 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact;
        font-size: 12px !important;
        line-height: 1.4 !important;
        margin: 0 !important;
        padding: 0 !important;
      } 
      .no-print { display: none !important; } 
      .print-report-root { 
        background: white !important; 
        color: #000 !important; 
        font-size: 12px !important;
        line-height: 1.4 !important;
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      /* Preserve savings card colors in PDF */
      * { 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important;
      }
      div[style*="background"] { 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important;
      }
      /* Table improvements for print - readable sizes */
      table {
        font-size: 11px !important;
        border-collapse: collapse !important;
        width: 100% !important;
        margin: 0 0 20px 0 !important;
        padding: 0 !important;
        table-layout: auto !important;
      }
      th, td {
        padding: 8px 6px !important;
        border: 1px solid #333 !important;
        font-size: 11px !important;
        line-height: 1.3 !important;
        text-align: center !important;
        vertical-align: middle !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
      }
      th {
        background-color: #f0f0f0 !important;
        font-weight: bold !important;
        color: #000 !important;
        font-size: 12px !important;
        padding: 10px 6px !important;
      }
      td {
        background-color: #fff !important;
        color: #000 !important;
      }
      /* Headers */
      h1, h2, h3 {
        color: #fff !important;
        page-break-after: avoid !important;
        margin: 15px 0 10px 0 !important;
      }
      h1 { font-size: 20px !important; }
      h2 { font-size: 18px !important; }
      h3 { font-size: 16px !important; }
      /* Main section titles - white text */
      .print-report-root h1,
      .print-report-root h2,
      .print-report-root h3 {
        color: #fff !important;
        font-weight: bold !important;
      }
      /* Savings cards - proper sizing and colors */
      .savings-cards-row {
        display: flex !important;
        flex-direction: row !important;
        gap: 15px !important;
        justify-content: center !important;
        align-items: stretch !important;
        flex-wrap: nowrap !important;
        margin: 20px 0 !important;
        page-break-inside: avoid !important;
      }
      .savings-cards-row > div {
        max-width: 300px !important;
        min-width: 250px !important;
        flex: 1 1 0 !important;
        margin: 0 !important;
        padding: 15px !important;
        font-size: 12px !important;
      }
      .savings-cards-row h3 {
        font-size: 14px !important;
        margin: 5px 0 !important;
      }
      .savings-cards-row .text-3xl {
        font-size: 20px !important;
      }
      .savings-cards-row .text-xs {
        font-size: 10px !important;
      }
      /* Fix savings card colors - simple green and red */
      .savings-cards-row .bg-gradient-to-br {
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
        color: #fff !important;
      }
      .savings-cards-row .bg-gradient-to-r {
        background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%) !important;
        color: #fff !important;
      }
      /* Override any other gradient backgrounds */
      .savings-cards-row div[style*="background"] {
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
        color: #fff !important;
      }
      /* Analysis sections - match main page dark theme */
      .pre-analysis-table,
      .current-analysis-table,
      .post-analysis-table {
        page-break-inside: avoid !important;
        margin: 20px 0 !important;
        padding: 15px !important;
        background: #181f2a !important;
        border-radius: 8px !important;
        border: 1px solid #374151 !important;
      }
      /* Analysis dividers */
      .analysis-divider {
        height: 3px !important;
        margin: 20px 0 !important;
        background: #333 !important;
      }
      /* Section titles - white text for dark backgrounds */
      .pre-analysis-table h3,
      .current-analysis-table h3,
      .post-analysis-table h3,
      h3 {
        font-size: 16px !important;
        margin-bottom: 15px !important;
        color: #fff !important;
        font-weight: bold !important;
      }
      /* Target all h3 elements in the report */
      .print-report-root h3 {
        color: #fff !important;
        font-weight: bold !important;
      }
      /* Table styling for dark theme */
      .pre-analysis-table table,
      .current-analysis-table table,
      .post-analysis-table table {
        background: #181f2a !important;
        color: #fff !important;
      }
      .pre-analysis-table th,
      .current-analysis-table th,
      .post-analysis-table th {
        background-color: #374151 !important;
        color: #fff !important;
        border-color: #4b5563 !important;
      }
      .pre-analysis-table td,
      .current-analysis-table td,
      .post-analysis-table td {
        background-color: #181f2a !important;
        color: #fff !important;
        border-color: #4b5563 !important;
      }
      /* Total row styling */
      .pre-analysis-table tr:last-child,
      .current-analysis-table tr:last-child,
      .post-analysis-table tr:last-child {
        background-color: #1f2937 !important;
        color: #fff !important;
        font-weight: bold !important;
      }
      .pre-analysis-table tr:last-child td,
      .current-analysis-table tr:last-child td,
      .post-analysis-table tr:last-child td {
        background-color: #1f2937 !important;
        color: #fff !important;
        font-weight: bold !important;
      }
    }`,
  });

  return (
    <>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Budget Analysis Card */}
        <Card className="bg-[#101624] border-none shadow-2xl rounded-3xl backdrop-blur-md w-full mb-12">
          <CardHeader className="border-b border-slate-700 pb-4">
            <CardTitle className="text-white flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <BarChart3 className="h-6 w-6 text-orange-400" />
              LMC Analysis
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1 text-base">
              Input a Site ID to trigger AI-driven analysis across pre, current, and post phases, complete with contextual insights and system metrics.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            {/* Animation Glow/Scan Bar Layer (copied from route_overview.tsx) */}
            <div className="relative w-full">
              {analysisAnimState === 'charging' && (
                <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
                  <div className="w-full h-12 bg-gradient-to-r from-cyan-400 via-blue-600 to-purple-600 animate-lightning-ripple rounded-lg blur-2xl opacity-40"></div>
                </div>
              )}
              {analysisAnimState === 'success' && (
                <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
                  <div className="w-full h-12 bg-green-500 animate-success-pulse rounded-lg blur-lg opacity-40"></div>
                </div>
              )}
              {/* Full-width, aligned, and responsive Site ID / Survey ID / Analysis Controls */}
              <div className="w-full flex flex-row items-end gap-4 mb-8 relative z-10">
                {/* Site ID Input */}
                <div className="flex-1 min-w-0" style={{ maxWidth: 400 }}>
                  <Label htmlFor="siteId" className="text-slate-200 font-medium mb-2 block">
                    Site ID <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative w-full min-w-0">
                    <Input
                      value={siteIdInputValue}
                      onChange={e => {
                        setSiteIdInputValue(e.target.value);
                        setSiteIdDropdownOpen(true);
                      }}
                      onFocus={() => setSiteIdDropdownOpen(true)}
                      placeholder="Enter or search Site ID"
                      className="bg-[#232a3a] text-white placeholder:text-slate-500 border border-slate-700 focus:ring-2 focus:ring-blue-500 rounded-lg px-4 h-12 text-base transition w-full min-w-0"
                      autoComplete="off"
                    />
                    {siteIdDropdownOpen && siteIdOptions.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 z-50 bg-[#232a3a] border border-slate-600 rounded-lg max-h-48 overflow-y-auto shadow-xl w-full min-w-0">
                        {siteIdOptions.filter(id => id.toLowerCase().includes(siteIdInputValue.toLowerCase())).length === 0 ? (
                          <div className="px-4 py-2 text-slate-400 text-sm">No matching Site IDs</div>
                        ) : (
                          siteIdOptions
                            .filter(id => id.toLowerCase().includes(siteIdInputValue.toLowerCase()))
                            .map(id => (
                              <div
                                key={id}
                                className={`px-4 py-2 cursor-pointer hover:bg-blue-600/10 text-white text-base rounded transition-all ${siteIdInputValue === id ? "bg-blue-600/10 font-semibold" : ""}`}
                                onMouseDown={() => {
                                  setSiteIdInputValue(id);
                                  setSiteIdDropdownOpen(false);
                                }}
                                style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              >
                                {id}
                              </div>
                            ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {/* Confirm/Reset Button */}
                <div className="flex-shrink-0">
                  {!confirmedSiteId ? (
                    <Button
                      onClick={handleConfirmSiteId}
                      className="border border-blue-500 text-blue-400 font-semibold px-6 h-12 rounded-lg hover:bg-blue-600/10 transition"
                      type="button"
                    >
                      Confirm
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setConfirmedSiteId("");
                        setSiteIdInputValue("");
                        setAnalysisTriggered(false);
                        setIsRoute(false);
                        setSurveyIdOptions([]);
                        setSelectedSurveyIds([]);
                        setSurveySelectionConfirmed(false);
                        setQueryResult(null);
                        setQueryError(null);
                        setQueryLoading(false);
                        setBudgetedCostPerMeter(null);
                        setBudgetTableRow(null);
                      }}
                      className="border border-red-500 text-red-400 font-semibold px-6 h-12 rounded-lg hover:bg-red-600/10 transition"
                      type="button"
                    >
                      Reset
                    </Button>
                  )}
                </div>
                  {/* Survey ID MultiSelect */}
                  {isRoute && (
                    <div className="flex flex-col flex-1 min-w-0 pl-3 pr-3">
                      <label className="text-slate-200 font-medium mb-2">
                        Survey ID(s) <span className="text-red-500">*</span>
                      </label>
                      <div className="h-12">
                        <MultiSelect
                          options={surveyIdOptions.map(id => ({ label: id, value: id }))}
                          value={selectedSurveyIds}
                          onChange={setSelectedSurveyIds}
                          placeholder="Select Survey IDs"
                          required
                        />
                      </div>
                    </div>
                  )}
                {/* Perform Budget Analysis Button */}
                <div className="flex-shrink-0">
                  <Button
                    onClick={handleBudgetAnalysis}
                    className={`bg-green-600 hover:bg-green-700 text-white font-semibold text-[15px] px-8 h-12 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-green-400 transition flex items-center gap-2 justify-center
                      ${analysisAnimState !== 'idle' ? 'opacity-70 cursor-not-allowed' : ''}
                      ${analysisAnimState === 'charging' ? 'animate-lightning-jitter' : ''}
                      ${analysisAnimState === 'success' ? 'animate-success-bg' : ''}
                    `}
                    disabled={isRoute && selectedSurveyIds.length === 0 || analysisAnimState !== 'idle'}
                  >
                    {analysisAnimState === 'idle' && <Zap className="h-5 w-5 transition-all" />}
                    {analysisAnimState === 'charging' && <Zap className="h-5 w-5 animate-lightning-pulse-glow" />}
                    {analysisAnimState === 'analyzing' && (
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    )}
                    {analysisAnimState === 'success' && (
                      <svg className="h-6 w-6 text-green-200 animate-success-check" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                    <span className={`transition-all duration-300 ${analysisAnimState !== 'idle' ? 'opacity-0 absolute' : 'opacity-100 relative'}`}>Perform Budget Analysis</span>
                    {analysisAnimState === 'charging' && <span className="ml-2 text-white font-semibold animate-lightning-text-glow">Powering Up...</span>}
                    {analysisAnimState === 'analyzing' && <span className="ml-2 text-white font-semibold">Analyzing...</span>}
                    {analysisAnimState === 'success' && <span className="ml-2 text-green-100 font-semibold animate-success-text">Analysis Complete</span>}
                  </Button>
                </div>
              </div>
            </div>

            {/* Only show Budget Table and analysis if analysisTriggered and confirmedSiteId */}
            {analysisTriggered && confirmedSiteId && (
              <>
                <div ref={reportRef} className="print-report-root">
                  <div className="mb-8 bg-[#101624] shadow-2xl rounded-3xl border-none">
                    <div className="border-b border-slate-800/60 pb-3 px-6 pt-4 bg-[#101624]">
                      <h2 className="text-white text-2xl font-bold font-sans mb-2 mt-2">Budget Table</h2>
                    </div>
                    <div className="p-6 text-white">
                      <div className="w-full max-w-5xl mx-auto">
                        <SupabaseQueryTable
                          confirmedSiteId={confirmedSiteId}
                          isRoute={isRoute}
                          surveyIds={selectedSurveyIds}
                          onBudgetedCostPerMeter={setBudgetedCostPerMeter}
                          onBudgetTableRow={setBudgetTableRow}
                        />
                      </div>
                    </div>
                  </div>

                  {/* DN Analysis Section */}
                  <div className="mb-8 bg-[#101624] shadow-2xl rounded-3xl border-none">
                    <div className="border-b border-slate-800/60 pb-3 px-6 pt-4 bg-[#101624]">
                      <h2 className="text-white text-2xl font-bold font-sans mb-2 mt-2">DN Analysis</h2>
                    </div>
                    <div className="p-6 text-white">
                      {/* Pre Analysis Table - always show */}
                      <div className="bg-[#181f2a] rounded-xl p-6 border border-slate-700 mb-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Pre Analysis</h3>
                        {priorDns.length === 0 ? (
                          <div className="text-yellow-400 text-base font-semibold mb-4">
                            No available DNs for this section.
                          </div>
                        ) : (
                          <>
                            <AnalysisTableWithPopups 
                              data={priorDns} 
                              budgetedCostPerMeter={budgetedCostPerMeter}
                              materialCostPerMeter={materialCostPerMeter}
                              serviceCostPerMeter={serviceCostPerMeter}
                            />
                            <div className="flex flex-col md:flex-row gap-6 mt-6 items-stretch justify-center print:break-inside-avoid print:page-break-inside-avoid">
                              <ProjectedSavingsCard 
                                budgetedCostPerMeter={budgetedCostPerMeter}
                                actualCostPerMeter={(function(){
                                  let totalLength = 0, totalCost = 0;
                                  priorDns.forEach(row => {
                                    const dnLength = Number(row.dn_length_mtr) || 0;
                                    const nonRefundable = Number(row.actual_total_non_refundable) || 0;
                                    const materialsCost = dnLength * materialCostPerMeter;
                                    const serviceCost = dnLength * serviceCostPerMeter;
                                    const rowTotalCost = nonRefundable + materialsCost + serviceCost;
                                    totalLength += dnLength;
                                    totalCost += rowTotalCost;
                                  });
                                  return totalLength > 0 ? totalCost / totalLength : null;
                                })()}
                              />
                              <ProjectedTotalSavingsCard 
                                totalBudget={(function(){
                                  let totalLength = 0, totalCost = 0;
                                  priorDns.forEach(row => {
                                    const dnLength = Number(row.dn_length_mtr) || 0;
                                    const nonRefundable = Number(row.actual_total_non_refundable) || 0;
                                    const materialsCost = dnLength * materialCostPerMeter;
                                    const serviceCost = dnLength * serviceCostPerMeter;
                                    const rowTotalCost = nonRefundable + materialsCost + serviceCost;
                                    totalLength += dnLength;
                                    totalCost += rowTotalCost;
                                  });
                                  return budgetedCostPerMeter && totalLength > 0 ? (budgetedCostPerMeter * totalLength) - totalCost : null;
                                })()}
                                budgetedTotal={budgetedCostPerMeter ? budgetedCostPerMeter * priorDns.reduce((sum, row) => sum + (Number(row.dn_length_mtr) || 0), 0) : null}
                                actualTotal={priorDns.reduce((sum, row) => {
                                  const dnLength = Number(row.dn_length_mtr) || 0;
                                  const nonRefundable = Number(row.actual_total_non_refundable) || 0;
                                  const materialsCost = dnLength * materialCostPerMeter;
                                  const serviceCost = dnLength * serviceCostPerMeter;
                                  return sum + nonRefundable + materialsCost + serviceCost;
                                }, 0)}
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {/* Current Analysis Table */}
                      {currentDns.length > 0 && (
                        <div className="bg-[#181f2a] rounded-xl p-6 border border-slate-700 mb-6">
                          <h3 className="text-lg font-semibold text-white mb-4">Current Analysis</h3>
                          <AnalysisTableWithPopups 
                            data={currentDns} 
                            budgetedCostPerMeter={budgetedCostPerMeter}
                            materialCostPerMeter={materialCostPerMeter}
                            serviceCostPerMeter={serviceCostPerMeter}
                          />
                          <div className="flex flex-col md:flex-row gap-6 mt-6 items-stretch justify-center print:break-inside-avoid print:page-break-inside-avoid">
                            <ProjectedSavingsCard 
                              budgetedCostPerMeter={budgetedCostPerMeter}
                              actualCostPerMeter={(function(){
                                let totalLength = 0, totalCost = 0;
                                currentDns.forEach(row => {
                                  const dnLength = Number(row.dn_length_mtr) || 0;
                                  const nonRefundable = Number(row.actual_total_non_refundable) || 0;
                                  const materialsCost = dnLength * materialCostPerMeter;
                                  const serviceCost = dnLength * serviceCostPerMeter;
                                  const rowTotalCost = nonRefundable + materialsCost + serviceCost;
                                  totalLength += dnLength;
                                  totalCost += rowTotalCost;
                                });
                                return totalLength > 0 ? totalCost / totalLength : null;
                              })()}
                            />
                            <ProjectedTotalSavingsCard 
                              totalBudget={(function(){
                                let totalLength = 0, totalCost = 0;
                                currentDns.forEach(row => {
                                  const dnLength = Number(row.dn_length_mtr) || 0;
                                  const nonRefundable = Number(row.actual_total_non_refundable) || 0;
                                  const materialsCost = dnLength * materialCostPerMeter;
                                  const serviceCost = dnLength * serviceCostPerMeter;
                                  const rowTotalCost = nonRefundable + materialsCost + serviceCost;
                                  totalLength += dnLength;
                                  totalCost += rowTotalCost;
                                });
                                return budgetedCostPerMeter && totalLength > 0 ? (budgetedCostPerMeter * totalLength) - totalCost : null;
                              })()}
                              budgetedTotal={budgetedCostPerMeter ? budgetedCostPerMeter * currentDns.reduce((sum, row) => sum + (Number(row.dn_length_mtr) || 0), 0) : null}
                              actualTotal={currentDns.reduce((sum, row) => {
                                const dnLength = Number(row.dn_length_mtr) || 0;
                                const nonRefundable = Number(row.actual_total_non_refundable) || 0;
                                const materialsCost = dnLength * materialCostPerMeter;
                                const serviceCost = dnLength * serviceCostPerMeter;
                                return sum + nonRefundable + materialsCost + serviceCost;
                              }, 0)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Post Analysis Table */}
                      {existingDns.length > 0 && (
                        <div className="bg-[#181f2a] rounded-xl p-6 border border-slate-700">
                          <h3 className="text-lg font-semibold text-white mb-4">Post Analysis</h3>
                          <AnalysisTableWithPopups 
                            data={existingDns} 
                            budgetedCostPerMeter={budgetedCostPerMeter}
                            materialCostPerMeter={materialCostPerMeter}
                            serviceCostPerMeter={serviceCostPerMeter}
                          />
                          <div className="flex flex-col md:flex-row gap-6 mt-6 items-stretch justify-center print:break-inside-avoid print:page-break-inside-avoid">
                            <ProjectedSavingsCard 
                              budgetedCostPerMeter={budgetedCostPerMeter}
                              actualCostPerMeter={(function(){
                                let totalLength = 0, totalCost = 0;
                                existingDns.forEach(row => {
                                  const dnLength = Number(row.dn_length_mtr) || 0;
                                  const nonRefundable = Number(row.actual_total_non_refundable) || 0;
                                  const materialsCost = dnLength * materialCostPerMeter;
                                  const serviceCost = dnLength * serviceCostPerMeter;
                                  const rowTotalCost = nonRefundable + materialsCost + serviceCost;
                                  totalLength += dnLength;
                                  totalCost += rowTotalCost;
                                });
                                return totalLength > 0 ? totalCost / totalLength : null;
                              })()}
                            />
                            <ProjectedTotalSavingsCard 
                              totalBudget={(function(){
                                let totalLength = 0, totalCost = 0;
                                existingDns.forEach(row => {
                                  const dnLength = Number(row.dn_length_mtr) || 0;
                                  const nonRefundable = Number(row.actual_total_non_refundable) || 0;
                                  const materialsCost = dnLength * materialCostPerMeter;
                                  const serviceCost = dnLength * serviceCostPerMeter;
                                  const rowTotalCost = nonRefundable + materialsCost + serviceCost;
                                  totalLength += dnLength;
                                  totalCost += rowTotalCost;
                                });
                                return budgetedCostPerMeter && totalLength > 0 ? (budgetedCostPerMeter * totalLength) - totalCost : null;
                              })()}
                              budgetedTotal={budgetedCostPerMeter ? budgetedCostPerMeter * existingDns.reduce((sum, row) => sum + (Number(row.dn_length_mtr) || 0), 0) : null}
                              actualTotal={existingDns.reduce((sum, row) => {
                                const dnLength = Number(row.dn_length_mtr) || 0;
                                const nonRefundable = Number(row.actual_total_non_refundable) || 0;
                                const materialsCost = dnLength * materialCostPerMeter;
                                const serviceCost = dnLength * serviceCostPerMeter;
                                return sum + nonRefundable + materialsCost + serviceCost;
                              }, 0)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Remove the old Savings Analysis Section since it's now integrated into each analysis table */}
                </div>
                {/* Generate Report Button at the bottom left below analysis cards */}
                <div className="w-full flex justify-start mt-8 mb-4">
                  <button
                    onClick={handlePrint}
                    className="bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold text-[15px] px-6 h-12 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-blue-400 transition flex items-center gap-2 justify-center"
                  >
                    Download/Print Report (PDF)
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// SupabaseQueryTable component
function SupabaseQueryTable({ confirmedSiteId, isRoute, surveyIds, onBudgetedCostPerMeter, onBudgetTableRow }: { confirmedSiteId: string, isRoute?: boolean, surveyIds?: string[], onBudgetedCostPerMeter?: (v: number|null) => void, onBudgetTableRow?: (row: any) => void }) {
  const [data, setData] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  console.log('SupabaseQueryTable props:', { confirmedSiteId, isRoute, surveyIds });
  
  const columns = [
    "route_id_site_id",
    "ce_length_mtr",
    "total_ri_amount",
    "material_cost",
    "execution_cost_including_hh",
    "total_cost_without_deposit",
  ]

  useEffect(() => {
    console.log('SupabaseQueryTable useEffect triggered');
    setLoading(true)
    setError(null)
    setData(null)
    if (isRoute && surveyIds && surveyIds.length > 0) {
      console.log('Querying by survey IDs:', surveyIds);
      queryBySurveyIds(surveyIds, columns)
        .then(({ data, error }) => {
          console.log('queryBySurveyIds result:', { data, error });
          if (error) setError(error.message)
          else setData(data)
        })
        .catch((err) => {
          console.log('queryBySurveyIds error:', err);
          setError(err.message || String(err))
        })
        .finally(() => setLoading(false))
    } else {
      console.log('Querying by site ID:', confirmedSiteId);
      queryBySiteId(confirmedSiteId, columns)
        .then(({ data, error }) => {
          console.log('queryBySiteId result:', { data, error });
          if (error) setError(error.message)
          else setData(data)
        })
        .catch((err) => {
          console.log('queryBySiteId error:', err);
          setError(err.message || String(err))
        })
        .finally(() => setLoading(false))
    }
  }, [confirmedSiteId, isRoute, JSON.stringify(surveyIds)])

  // If data is an array, use the first element (for non-route), or all for route
  const d = isRoute ? data : (Array.isArray(data) ? data[0] : data);
  console.log('SupabaseQueryTable - processed data (d):', d);
  console.log('SupabaseQueryTable - isRoute:', isRoute, 'data:', data);
  
  useEffect(() => {
    if (onBudgetTableRow) {
      onBudgetTableRow(d || null)
    }
    // eslint-disable-next-line
  }, [d])

  // Helper to compute Budgeted Total Cost/Meter
  function getBudgetedCostPerMeter(row: any) {
    if (!row) return null
    const totalCost = parseFloat(row["total_cost_without_deposit"])
    const length = parseFloat(row["ce_length_mtr"])
    if (!isNaN(totalCost) && !isNaN(length) && length > 0) {
      return parseFloat((totalCost / length).toFixed(2))
    }
    return null
  }
  // For route, show aggregate cost per meter if multiple rows
  const budgetedCostPerMeter = isRoute && Array.isArray(d) && d.length > 0
    ? (() => {
        let totalCost = 0, totalLength = 0;
        d.forEach((row: any) => {
          const cost = parseFloat(row["total_cost_without_deposit"]);
          const len = parseFloat(row["ce_length_mtr"]);
          if (!isNaN(cost) && !isNaN(len)) {
            totalCost += cost;
            totalLength += len;
          }
        });
        return totalLength > 0 ? parseFloat((totalCost / totalLength).toFixed(2)) : null;
      })()
    : getBudgetedCostPerMeter(d);

  useEffect(() => {
    if (onBudgetedCostPerMeter) {
      onBudgetedCostPerMeter(typeof budgetedCostPerMeter === 'number' && !isNaN(budgetedCostPerMeter) ? budgetedCostPerMeter : null)
    }
    // eslint-disable-next-line
  }, [budgetedCostPerMeter])

  // Prepare display columns and values
  const displayColumns = [
    "Site ID",
    "Surveyed Length",
    "RI Cost",
    "Material Cost",
    "Service Cost",
    "Total Cost",    
    "Total Cost/Meter",
  ];

  // For route, show all rows; for non-route, show single row
  const displayRows = isRoute && Array.isArray(d) ? d : [d];

  // Ensure all numeric values are positive
  const sanitizedDisplayRows = displayRows.map(row => {
    if (!row) return null;
    const sanitized = { ...row };
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'number') {
        sanitized[key] = Math.max(0, sanitized[key]);
      }
    });
    return sanitized;
  }).filter(Boolean);

  console.log('SupabaseQueryTable - sanitizedDisplayRows:', sanitizedDisplayRows);

  // Calculate totals for the Total Row (using budget master data structure)
  const totalLength = data && Array.isArray(data)
    ? data.reduce((sum: number, row: any) => sum + (Number(row.ce_length_mtr) || 0), 0)
    : (data ? Number(data.ce_length_mtr) || 0 : 0);

  const totalRiCost = data && Array.isArray(data)
    ? data.reduce((sum: number, row: any) => sum + (Number(row.total_ri_amount) || 0), 0)
    : (data ? Number(data.total_ri_amount) || 0 : 0);

  const totalMaterialCost = data && Array.isArray(data)
    ? data.reduce((sum: number, row: any) => sum + (Number(row.material_cost) || 0), 0)
    : (data ? Number(data.material_cost) || 0 : 0);

  const totalServiceCost = data && Array.isArray(data)
    ? data.reduce((sum: number, row: any) => sum + (Number(row.execution_cost_including_hh) || 0), 0)
    : (data ? Number(data.execution_cost_including_hh) || 0 : 0);

  const totalCost = totalRiCost + totalMaterialCost + totalServiceCost;

  return (
    <>
      {loading && <div className="text-slate-400 mt-4">Loading site data...</div>}
      {error && <Alert className="bg-red-950/50 border-red-800 text-red-200 mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {!loading && !error && (!data || (Array.isArray(data) && data.length === 0)) && confirmedSiteId && (
        <div className="text-red-400 text-sm mt-2">{isRoute ? "No budget data found for selected Survey IDs." : "Site ID not found in database."}</div>
      )}
      {!loading && !error && data && sanitizedDisplayRows.length > 0 && (
        <div className="w-full max-w-none overflow-x-visible rounded-lg border border-slate-700 bg-[#181f2a] mt-2">
          <Table className="w-full text-left max-w-none">
            <TableHeader>
              <TableRow className="border-slate-600">
                {displayColumns.map((col) => (
                  <TableHead key={col} className="text-slate-300 font-sans font-medium text-center px-2 py-2 text-sm print:text-sm">{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <>
                {sanitizedDisplayRows.map((row: any, idx: number) => {
                  // Use budget master data field names
                  const siteId = row.route_id_site_id || "-";
                  const surveyedLength = Number(row.ce_length_mtr) || 0;
                  const riCost = Number(row.total_ri_amount) || 0;
                  const materialCost = Number(row.material_cost) || 0;
                  const serviceCost = Number(row.execution_cost_including_hh) || 0;
                  const totalCost = riCost + materialCost + serviceCost;
                  const totalCostPerMeter = surveyedLength > 0 ? (totalCost / surveyedLength) : 0;

                  return (
                    <TableRow key={idx} className="border-slate-700 py-2">
                      <TableCell className="text-slate-200 font-sans text-sm px-2 py-2 text-center print:text-sm">{siteId}</TableCell>
                      <TableCell className="text-slate-200 font-sans text-sm px-2 py-2 text-center print:text-sm">{surveyedLength ? surveyedLength.toLocaleString() : "-"}</TableCell>
                      <TableCell className="text-slate-200 font-sans text-sm px-2 py-2 text-center print:text-sm">{riCost ? `₹${riCost.toLocaleString()}` : "-"}</TableCell>
                      <TableCell className="text-slate-200 font-sans text-sm px-2 py-2 text-center print:text-sm">{materialCost ? `₹${materialCost.toLocaleString()}` : "-"}</TableCell>
                      <TableCell className="text-slate-200 font-sans text-sm px-2 py-2 text-center print:text-sm">{serviceCost ? `₹${serviceCost.toLocaleString()}` : "-"}</TableCell>
                      <TableCell className="text-slate-200 font-sans text-sm px-2 py-2 text-center print:text-sm">{totalCost ? `₹${totalCost.toLocaleString()}` : "-"}</TableCell>
                      <TableCell className="text-slate-200 font-sans text-sm px-2 py-2 text-center print:text-sm">{totalCostPerMeter ? `₹${totalCostPerMeter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </>
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}

// ProjectedSavingsCard component
function ProjectedSavingsCard({ budgetedCostPerMeter, actualCostPerMeter }: { budgetedCostPerMeter: number|null, actualCostPerMeter: number|null }) {
  if (typeof budgetedCostPerMeter !== "number" || typeof actualCostPerMeter !== "number") return null
  const savings = budgetedCostPerMeter - actualCostPerMeter
  const isPositive = savings >= 0
  return (
    <div
      className={`w-full md:w-1/2 mx-auto mt-6 rounded-xl p-4 flex flex-col items-center transition-all duration-200 print:break-inside-avoid print:page-break-inside-avoid
        ${isPositive
          ? "bg-gradient-to-br from-green-500 to-green-600 text-white"
          : "bg-gradient-to-br from-red-500 to-red-600 text-white"}
        backdrop-blur-lg border-none ring-1 ring-white/20 font-inter`}
    >
      <div className="text-base font-semibold font-inter mb-1 flex items-center gap-2">
        Projected Savings per Meter
        {isPositive ? (
          <span className="ml-2 text-white font-inter">▲</span>
        ) : (
          <span className="ml-2 text-white font-inter">▼</span>
        )}
      </div>
      <div className={`text-3xl font-extrabold font-inter ${isPositive ? "text-white" : "text-white"}`}
        style={{ textShadow: '0 1px 3px #000, 0 1px 0 #fff' }}>
        {savings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₹/m
      </div>
      <div className="mt-1 text-white/80 text-xs font-inter">
        (Budgeted: <span className="font-sans text-white/90">{budgetedCostPerMeter}</span> ₹/m &nbsp;|&nbsp; Actual: <span className="font-sans text-white/90">{actualCostPerMeter}</span> ₹/m)
      </div>
    </div>
  )
}

function ProjectedTotalSavingsCard({ totalBudget, budgetedTotal, actualTotal }: { totalBudget: number|null, budgetedTotal: number|null, actualTotal: number|null }) {
  console.log("ProjectedTotalSavingsCard totalBudget:", totalBudget, budgetedTotal, actualTotal);
  if (typeof totalBudget !== "number" || isNaN(totalBudget)) return null;
  const isPositive = totalBudget >= 0;
  console.log("ProjectedTotalSavingsCard isPositive:", isPositive);
  return (
    <div
      className={`w-full md:w-1/2 mx-auto mt-6 rounded-xl p-4 flex flex-col items-center transition-all duration-200 print:break-inside-avoid print:page-break-inside-avoid
        ${isPositive
          ? "bg-gradient-to-br from-green-500 to-green-600 text-white"
          : "bg-gradient-to-br from-red-500 to-red-600 text-white"}
        backdrop-blur-lg border-none ring-1 ring-white/20 font-inter`}
    >
      <div className="text-base font-semibold font-inter mb-1 flex items-center gap-2">
        Projected Savings Against Total Budget
        {isPositive ? (
          <span className="ml-2 text-white font-inter">▲</span>
        ) : (
          <span className="ml-2 text-white font-inter">▼</span>
        )}
      </div>
      <div className="text-3xl font-extrabold font-inter text-white" style={{ textShadow: '0 1px 3px #000, 0 1px 0 #fff' }}>
        {totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₹
      </div>
      <div className="mt-1 text-white/80 text-xs font-inter">
        (Budgeted: {budgetedTotal?.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₹ | Actual: {actualTotal?.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₹)
      </div>
    </div>
  );
}

// Reusable analysis table with popups
function AnalysisTableWithPopups({ data, budgetedCostPerMeter, materialCostPerMeter, serviceCostPerMeter }: { data: any[], budgetedCostPerMeter: number | null, materialCostPerMeter: number, serviceCostPerMeter: number }) {
  if (!data || data.length === 0) {
    return <div className="text-red-400 text-sm mt-2">No DNs found for this selection.</div>;
  }

  // Calculate totals
  let totalLength = 0, totalCost = 0;
  let totalRiCost = 0, totalMaterialsCost = 0, totalServiceCost = 0;
  data.forEach((row: any) => {
    const dnLength = Number(row.dn_length_mtr) || 0;
    const nonRefundable = Number(row.actual_total_non_refundable) || 0;
    const materialsCost = dnLength * materialCostPerMeter;
    const serviceCost = dnLength * serviceCostPerMeter;
    const rowTotalCost = nonRefundable + materialsCost + serviceCost;
    totalLength += dnLength;
    totalCost += rowTotalCost;
    totalRiCost += nonRefundable;
    totalMaterialsCost += materialsCost;
    totalServiceCost += serviceCost;
    
    // Debug logging
    console.log(`[LMC_TABLE] Row calculation:`, {
      dnLength,
      materialCostPerMeter,
      serviceCostPerMeter,
      materialsCost,
      serviceCost,
      rowTotalCost
    });
  });

  // Weighted average for projected savings per meter
  const avgActualCostPerMeter = totalLength > 0 ? totalCost / totalLength : null;
  const projectedSavingsPerMeter = (typeof budgetedCostPerMeter === 'number' && typeof avgActualCostPerMeter === 'number')
    ? budgetedCostPerMeter - avgActualCostPerMeter
    : null;

  return (
    <div className="w-full max-w-none overflow-x-visible rounded-lg border border-slate-700 bg-[#181f2a] mt-2">
      <Table className="w-full text-left max-w-none">
        <TableHeader>
          <TableRow className="border-slate-600">
            <TableHead className="text-slate-300 font-sans font-medium text-center px-0.5 py-1 text-xs print:text-xs">DN No.</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium text-center px-0.5 py-1 text-xs print:text-xs">DN Date</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium text-center px-0.5 py-1 text-xs print:text-xs">Length</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium text-center px-0.5 py-1 text-xs print:text-xs">RI Cost</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium text-center px-0.5 py-1 text-xs print:text-xs">Materials</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium text-center px-0.5 py-1 text-xs print:text-xs">Service</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium text-center px-0.5 py-1 text-xs print:text-xs">Total Cost</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium text-center px-0.5 py-1 text-xs print:text-xs">Total Cost/Mtr</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium text-center px-0.5 py-1 text-xs print:text-xs">Proj. Savings/Mtr</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium text-center px-0.5 py-1 text-xs print:text-xs">Proj. Savings</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row: any, idx: number) => {
            const dnLength = Number(row.dn_length_mtr) || 0;
            const nonRefundable = Number(row.actual_total_non_refundable) || 0;
            const materialsCost = dnLength * materialCostPerMeter;
            const serviceCost = dnLength * serviceCostPerMeter;
            const rowTotalCost = nonRefundable + materialsCost + serviceCost;
            const totalCostPerMeter = dnLength > 0 ? (rowTotalCost / dnLength) : null;
            const projSavingsPerMtr = (typeof budgetedCostPerMeter === 'number' && typeof totalCostPerMeter === 'number')
              ? budgetedCostPerMeter - totalCostPerMeter
              : null;
            const rowBudgetedTotal = (typeof budgetedCostPerMeter === 'number' && dnLength > 0) ? budgetedCostPerMeter * dnLength : null;
            const projSavings = (typeof rowBudgetedTotal === 'number' && typeof rowTotalCost === 'number') ? rowBudgetedTotal - rowTotalCost : null;

            return (
              <TableRow key={idx} className="border-slate-700 py-1">
                <TableCell className="text-slate-200 font-sans text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">{row.dn_number || "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">{row.dn_received_date ? new Date(row.dn_received_date).toLocaleDateString() : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">{dnLength || "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">{Number.isFinite(nonRefundable) ? `₹${nonRefundable.toLocaleString()}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">{materialsCost ? `₹${materialsCost.toLocaleString()}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">{serviceCost ? `₹${serviceCost.toLocaleString()}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">{rowTotalCost ? `₹${rowTotalCost.toLocaleString()}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">{totalCostPerMeter ? `₹${totalCostPerMeter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">{projSavingsPerMtr !== null ? `₹${projSavingsPerMtr.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">{projSavings !== null ? `₹${projSavings.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "-"}</TableCell>
              </TableRow>
            );
          })}
          {/* Total Row */}
          <TableRow className="bg-[#1E1E2F] border-t border-neutral-700">
            <TableCell className="font-semibold text-white text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs" colSpan={2}>Total</TableCell>
            <TableCell className="font-semibold text-white text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">{totalLength ? totalLength.toLocaleString() : "-"}</TableCell>
            <TableCell className="font-semibold text-white text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">
              {totalRiCost ? `₹${totalRiCost.toLocaleString()}` : "-"}
            </TableCell>
            <TableCell className="font-semibold text-white text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">
              {totalMaterialsCost ? `₹${totalMaterialsCost.toLocaleString()}` : "-"}
            </TableCell>
            <TableCell className="font-semibold text-white text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">
              {totalServiceCost ? `₹${totalServiceCost.toLocaleString()}` : "-"}
            </TableCell>
            <TableCell className="font-semibold text-white text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">
              {totalCost ? `₹${totalCost.toLocaleString()}` : "-"}
            </TableCell>
            <TableCell className="font-semibold text-white text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">
              {totalLength > 0 ? `₹${(totalCost / totalLength).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
            </TableCell>
            <TableCell className="font-semibold text-white text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">
              {typeof projectedSavingsPerMeter === 'number' ? `₹${projectedSavingsPerMeter.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "-"}
            </TableCell>
            <TableCell className="font-semibold text-white text-xs px-0.5 py-1 whitespace-nowrap text-center print:text-xs">
              {data.length > 0 ? `₹${data.reduce((sum: number, row: any) => {
                const dnLength = Number(row.dn_length_mtr) || 0;
                const nonRefundable = Number(row.actual_total_non_refundable) || 0;
                const materialsCost = dnLength * materialCostPerMeter;
                const serviceCost = dnLength * serviceCostPerMeter;
                const totalCost = nonRefundable + materialsCost + serviceCost;
                const totalCostPerMeter = dnLength > 0 ? (totalCost / dnLength) : null;
                const projSavingsPerMtr = (typeof budgetedCostPerMeter === 'number' && typeof totalCostPerMeter === 'number')
                  ? budgetedCostPerMeter - totalCostPerMeter
                  : null;
                return sum + ((typeof projSavingsPerMtr === 'number' && dnLength > 0) ? projSavingsPerMtr * dnLength : 0);
              }, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "-"}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export { AnalysisTableWithPopups, ProjectedSavingsCard, ProjectedTotalSavingsCard };