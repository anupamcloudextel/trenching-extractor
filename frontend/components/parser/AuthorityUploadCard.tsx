"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input as UITextInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Sparkles, Download } from "lucide-react";
import { FiMail } from "react-icons/fi";
import type { AuthorityConfig } from "@/types";
// Update the import to match the actual exports from useFileProcessing
import { processNonRefundableWithBackend, processSDWithBackend } from "@/hooks/useFileProcessing";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import GenerateEmailDraftModal from "@/components/email/GenerateEmailDraftModal";
import ReactMarkdown from 'react-markdown';
import * as XLSX from "xlsx";
import { toast } from "@/hooks/use-toast";
import { getTableColumns, ensureAllFieldsPresent } from "@/constants/comprehensive_field_mapping";

interface AuthorityUploadCardProps {
  authority: AuthorityConfig;
  files: File[];
  isProcessing: boolean;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onStartProcessing: () => void;
}

function SimulatedProgressBar({ parsingDone, parsingStarted }: { parsingDone: boolean, parsingStarted: boolean }) {
  const [progress, setProgress] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let finishTimer: NodeJS.Timeout | null = null;
    if (parsingStarted && !parsingDone) {
      setShow(true);
      setProgress(0);
      timer = setInterval(() => {
        setProgress((old) => {
          if (old < 99) return Math.min(old + Math.random() * 0.8 + 0.2, 99);
          return old;
        });
      }, 420);
    } else if (parsingStarted && parsingDone) {
      setProgress(100);
      setShow(true);
      finishTimer = setTimeout(() => {
        setShow(false);
      }, 500);
    } else {
      setShow(false);
      setProgress(0);
    }
    return () => {
      if (timer) clearInterval(timer);
      if (finishTimer) clearTimeout(finishTimer);
    };
  }, [parsingStarted, parsingDone]);

  if (!show) return null;
  return (
    <div style={{ width: '100%', margin: '16px 0', transition: 'opacity 0.3s' }}>
      <div style={{
        height: 12,
        background: '#232f47',
        borderRadius: 6,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 0 12px #fff6, 0 0 2px #fff',
      }}>
        <div style={{
          width: `${progress}%`,
          height: 12,
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 6,
          boxShadow: '0 0 16px #fff, 0 0 2px #fff',
          transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
      <div style={{ fontSize: 13, color: '#eaeaea', marginTop: 6, fontFamily: 'Segoe UI, Arial, sans-serif', letterSpacing: 0.2, textAlign: 'right', textShadow: '0 0 4px #fff' }}>{`Parsing... ${Math.floor(progress)}%`}</div>
    </div>
  );
}

export function AuthorityUploadCard({
  authority,
  files,
  isProcessing,
  onFileUpload,
  onStartProcessing,
}: AuthorityUploadCardProps) {
  // Manual field config for each authority and output type
const manualFieldConfig: {
  [authorityId: string]: {
    non_refundable: string[];
    sd: string[];
  };
} = {
  mcgm: {
    non_refundable: [
      "LM/BB/FTTH", "GO RATE", "Total Route (MTR)", "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)",
      "REASON FOR DELAY (>2 DAYS)", "PO No.", "Route Name(As per CWIP)", "Section Name for ROW(As per CWIP)"
    ],
    sd: [
      "Execution Partner GBPA PO No.", "Partner PO circle", "Unique route id", "NFA no."
    ],
  },
  mbmc: {
    non_refundable: [
      "LM/BB/FTTH",
      "GO RATE",
      "Total Route (MTR)",
      "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)",
      "REASON FOR DELAY (>2 DAYS)",
      "PO No.",
      "Route Name(As per CWIP)",
      "Section Name for ROW(As per CWIP)"
    ],
    sd: [
      "Execution Partner GBPA PO No.",
      "Partner PO circle",
      "Unique route id",
      "NFA no."
    ],
  },
  kdmc: {
    non_refundable: [
      "LM/BB/FTTH", "GO RATE", "Total Route (MTR)", "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)",
      "REASON FOR DELAY (>2 DAYS)", "PO No.", "Route Name(As per CWIP)", "Section Name for ROW(As per CWIP)"
    ],
    sd: [
      "Execution Partner GBPA PO No.", "Partner PO circle", "Unique route id", "NFA no."
    ],
  },
  // Add more authorities as needed
};

// Patch: treat NMMC the same as MCGM for manual fields and download logic
const isNmmcOrMcgm = ["mcgm", "nmmc"].includes(authority.id);
const manualFieldsNonRefundList = isNmmcOrMcgm
  ? manualFieldConfig["mcgm"].non_refundable
  : manualFieldConfig[authority.id]?.non_refundable || [];
const manualFieldsSDList = isNmmcOrMcgm
  ? manualFieldConfig["mcgm"].sd
  : manualFieldConfig[authority.id]?.sd || [];
const showManualFields = ["mcgm", "mbmc", "nmmc", "kdmc"].includes(authority.id);
const [manualFieldsNonRefund, setManualFieldsNonRefund] = useState<{ [key: string]: string }>({});
const [manualFieldsSD, setManualFieldsSD] = useState<{ [key: string]: string }>({});
const [showManualFieldsState, setShowManualFieldsState] = useState(false);
const [parsedFile, setParsedFile] = useState<File | null>(null);
const [isParsing, setIsParsing] = useState(false);
const [previewNonRefund, setPreviewNonRefund] = useState<any[] | null>(null);
const [previewSD, setPreviewSD] = useState<any[] | null>(null);
const [previewIdNonRefund, setPreviewIdNonRefund] = useState<string | null>(null);
const [previewIdSD, setPreviewIdSD] = useState<string | null>(null);
// State to track if parsing is in progress or done
const [parsingDone, setParsingDone] = useState(false);
const [parsingStarted, setParsingStarted] = useState(false);
const [showEmailModal, setShowEmailModal] = useState(false);
const [pdfImages, setPdfImages] = useState<string[]>([]);
const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);

// Patch: Reset parsing state only when a new file is uploaded
useEffect(() => {
  if (files.length > 0) {
    setParsingDone(false);
    setParsingStarted(false);
  }
}, [files]);

// Reset all output/preview state when switching authorities
useEffect(() => {
  setManualFieldsNonRefund({});
  setManualFieldsSD({});
  setShowManualFieldsState(false);
  setParsedFile(null);
  setIsParsing(false);
  setPreviewNonRefund(null);
  setPreviewSD(null);
  setPreviewIdNonRefund(null);
  setPreviewIdSD(null);
  setParsingDone(false);
  setParsingStarted(false);
}, [authority.id]);

  // Dummy preview data for Non-Refundable and SD outputs
const previewDataNonRefund = [
  {
    "Demand Note No.": "783339212",
    "LM/BB/FTTH": manualFieldsNonRefund["LM/BB/FTTH"] || "Airtel",
    "GO RATE": manualFieldsNonRefund["GO RATE"] || "Yes",
    "Total Route (MTR)": manualFieldsNonRefund["Total Route (MTR)"] || "375",
    // ... add more columns as needed ...
  },
];
const previewDataSD = [
  {
    "Demand Note No.": "783339212",
    "Execution Partner GBPA PO No.": manualFieldsSD["Execution Partner GBPA PO No."] || "PO1234",
    "Partner PO circle": manualFieldsSD["Partner PO circle"] || "Circle1",
    "Unique route id": manualFieldsSD["Unique route id"] || "URID001",
    // ... add more columns as needed ...
  },
];

// Helper to render an editable preview table
const renderEditablePreviewTable = (
  data: any[],
  setData: (rows: any[]) => void,
  title?: string,
  compactHeaders: boolean = false
) => {
  console.log("[TABLE DEBUG] renderEditablePreviewTable called with:", { data, title, compactHeaders });
  if (!data || data.length === 0) {
    console.log("[TABLE DEBUG] No data to render");
    return null;
  }
  console.log("[TABLE DEBUG] Data[0] keys:", Object.keys(data[0] || {}));
  console.log("[TABLE DEBUG] Data[0] values:", data[0]);
  const chopHeader = (header: string): string => {
    if (!compactHeaders) return header;
    if (header.length > 12) return header.slice(0, 10) + '…';
    return header;
  };
  const handleCellChange = (rowIdx: number, colKey: string, value: string) => {
    const updated = [...data];
    updated[rowIdx] = { ...updated[rowIdx], [colKey]: value };
    setData(updated);
  };
  return (
    <div className="overflow-x-auto hide-scrollbar mb-6 w-full">
      <table className="preview-table w-full min-w-0 text-[11px] text-left text-white font-inter rounded-lg" style={{ tableLayout: 'auto' }}>
        <thead>
          <tr>
            {Object.keys(data[0] || {}).map((header) => {
              console.log("[TABLE DEBUG] Rendering header:", header);
              return (
                <th
                  key={header}
                  title={header}
                  className="px-2 py-1 bg-[#232f47] text-white font-medium border-b border-[#232f47] font-inter tracking-tight rounded-t whitespace-nowrap"
                  style={{ minWidth: '180px', width: 'auto' }}
                >
                  {header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            console.log("[TABLE DEBUG] Rendering row:", i, row);
            return (
              <tr
                key={i}
                className={
                  (i % 2 === 0 ? "bg-[#232f47]/40" : "bg-[#181e29]/40") +
                  " hover:bg-[#232f47]/60 transition-colors"
                }
              >
                {Object.entries(row).map(([col, val], j) => {
                  console.log("[TABLE DEBUG] Rendering cell:", col, val);
                  return (
                    <td
                      key={j}
                      className="px-2 py-4 border-b border-[#232f47] font-inter align-top text-white"
                      style={{ minWidth: 0, maxWidth: '140px', width: 'auto', paddingTop: '16px', paddingBottom: '16px' }}
                    >
                      <input
                        value={String(val ?? '')}
                        onChange={e => handleCellChange(i, col, e.target.value)}
                        className="bg-transparent border-b border-gray-500 text-white w-full focus:outline-none focus:bg-[#232f47]/80 text-base py-3"
                        style={{ minWidth: 0, fontSize: '12px', paddingTop: '8px', paddingBottom: '8px' }}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Add this helper function near the top of the component
function mapToColumns(raw: any, columns: string[]) {
  const mapped: any = {};
  columns.forEach(col => {
    mapped[col] = raw[col] ?? "";
  });
  return mapped;
}

// === COLUMN CONSTANTS (from comprehensive field mapping) ===
const PREVIEW_NON_REFUNDABLE_COLUMNS = getTableColumns("non_refundable");
const PREVIEW_SD_COLUMNS = getTableColumns("sd");

// Add this near the top of the file:
const SUMMARY_NON_REFUNDABLE_COLUMNS = [
  "Demand Note Reference number",
  "Section Length (Mtr.)",
  "Execution Partner Name",
  "Route Name(As per CWIP)",
  "Section Name for ROW(As per CWIP)",
  "Project Name"
];

// --- LIVE PREVIEW LOGIC ---
// For live preview, always map preview data to the correct columns for ALL authorities
const getLivePreviewNonRefund = () => {
  if (!previewNonRefund || previewNonRefund.length === 0) return [];
  return previewNonRefund.map((row) => mapToColumns(row, PREVIEW_NON_REFUNDABLE_COLUMNS));
};
const getLivePreviewSD = () => {
  if (!previewSD || previewSD.length === 0) return [];
  return previewSD.map((row) => mapToColumns(row, PREVIEW_SD_COLUMNS));
};

// Fetch preview from backend
const fetchPreview = async (type: "non_refundable" | "sd", file: File, manualFields: { [key: string]: string }) => {
  // Use authority-specific endpoints for NMMC and KDMC, fallback to generic preview endpoints
  let endpoint;
  if (authority.id === "nmmc") {
    endpoint = process.env.NEXT_PUBLIC_BACKEND_URL + "/api/nmmc-extract";
  } else if (authority.id === "kdmc") {
    endpoint = process.env.NEXT_PUBLIC_BACKEND_URL + "/api/kdmc-extract";
  } else {
    endpoint = type === "non_refundable"
      ? process.env.NEXT_PUBLIC_BACKEND_URL + "/api/preview/non_refundable"
      : process.env.NEXT_PUBLIC_BACKEND_URL + "/api/preview/sd";
  }
  
  const formData = new FormData();
  formData.append("file", file); // FIXED: must be 'file' to match backend
  formData.append("authority", authority.id);
  formData.append("manualFields", JSON.stringify(manualFields)); // FIXED: must be 'manualFields' to match backend
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to fetch preview");
    const data = await res.json();
    // Handle different response formats
    let rows = [];
    if (data.rows) {
      rows = data.rows;
    } else if (Array.isArray(data)) {
      rows = data;
    } else if (data.error) {
      console.error(`Backend returned error:`, data.error);
      rows = [];
    } else if (data.non_refundable && authority.id === "kdmc") {
      // Handle KDMC-specific response format
      if (type === "non_refundable") {
        rows = [data.non_refundable];
        console.log("[KDMC FRONTEND DEBUG] KDMC non_refundable data received:", data.non_refundable);
        console.log("[KDMC FRONTEND DEBUG] KDMC non_refundable keys:", Object.keys(data.non_refundable));
        console.log("[KDMC FRONTEND DEBUG] KDMC Section Length value:", data.non_refundable["Section Length (Mtr.)"]);
      } else {
        // For SD, create rows from headers and row data
        const sdHeaders = data.sd_headers || [];
        const sdRow = data.sd_row || [];
        const sdData: Record<string, string> = {};
        sdHeaders.forEach((header: string, index: number) => {
          sdData[header] = sdRow[index] || "";
        });
        rows = [sdData];
      }
    } else if (data.non_refundable && authority.id === "nmmc") {
      // Handle NMMC-specific response format
      if (type === "non_refundable") {
        rows = data.non_refundable;
      } else {
        // For SD, create rows from headers and row data
        const sdHeaders = data.sd_headers || [];
        const sdRow = data.sd_row || [];
        const sdData: Record<string, string> = {};
        sdHeaders.forEach((header: string, index: number) => {
          sdData[header] = sdRow[index] || "";
        });
        rows = [sdData];
      }
    } else {
      console.warn(`Unexpected response format:`, data);
      rows = [];
    }
    if (type === "non_refundable") {
      console.log("[FRONTEND DEBUG] Raw data received:", data);
      console.log("[FRONTEND DEBUG] Rows received for non_refundable:", rows);
      console.log("[FRONTEND DEBUG] PREVIEW_NON_REFUNDABLE_COLUMNS:", PREVIEW_NON_REFUNDABLE_COLUMNS);
      
      setPreviewNonRefund(rows);
      setPreviewIdNonRefund(data.preview_id || null);
      
      // Log clean non-refundable table data
      if (rows && rows.length > 0) {
        console.log("\n" + "=".repeat(80));
        console.log("FRONTEND NON-REFUNDABLE TABLE DATA");
        console.log("=".repeat(80));
        const row = rows[0];
        console.log("[FRONTEND DEBUG] First row keys:", Object.keys(row));
        const columns = PREVIEW_NON_REFUNDABLE_COLUMNS;
        for (const column of columns) {
          const value = row[column] || "";
          if (value) {
            console.log(`✓ ${column}: ${value}`);
          } else {
            console.log(`✗ ${column}: (blank)`);
          }
        }
        console.log("=".repeat(80) + "\n");
      }
    } else {
      console.log("[FRONTEND DEBUG] Raw data received for SD:", data);
      console.log("[FRONTEND DEBUG] Rows received for SD:", rows);
      console.log("[FRONTEND DEBUG] PREVIEW_SD_COLUMNS:", PREVIEW_SD_COLUMNS);
      
      setPreviewSD(rows);
      setPreviewIdSD(data.preview_id || null);
      
      // Log clean SD table data
      if (rows && rows.length > 0) {
        console.log("\n" + "=".repeat(80));
        console.log("FRONTEND SD TABLE DATA");
        console.log("=".repeat(80));
        const row = rows[0];
        console.log("[FRONTEND DEBUG] First row keys for SD:", Object.keys(row));
        const columns = PREVIEW_SD_COLUMNS;
        for (const column of columns) {
          const value = row[column] || "";
          if (value) {
            console.log(`✓ ${column}: ${value}`);
          } else {
            console.log(`✗ ${column}: (blank)`);
          }
        }
        console.log("=".repeat(80) + "\n");
      }
    }
      } catch (err: any) {
      console.error(`Failed to fetch ${type} preview:`, err.message);
      if (type === "non_refundable") setPreviewNonRefund([]);
      else setPreviewSD([]);
    }
};

// Helper to robustly extract demand note number from preview data
function getDemandNoteNumber(data: any[], type: 'non_refundable' | 'sd'): string {
  if (!data || data.length === 0) return 'Output';
  const row = data[0];
  const keys = type === 'non_refundable'
    ? ["Demand Note Reference number", "Demand Note No.", "DN No", "Demand Note Number"]
    : ["DN No", "Demand Note Reference number", "Demand Note No.", "Demand Note Number"];
  for (const key of keys) {
    if (row[key] && typeof row[key] === 'string' && row[key].trim()) {
      return row[key].replace(/[^a-zA-Z0-9_-]/g, "_"); // sanitize for filename
    }
  }
  return 'Output';
}

// Helper to POST preview data to backend and trigger Excel download
async function downloadExcelFromBackend(rows: any[], type: 'non_refundable' | 'sd') {
  if (!rows || rows.length === 0) {
    alert('No preview data to download.');
    return;
  }
  const endpoint = type === 'non_refundable'
    ? process.env.NEXT_PUBLIC_BACKEND_URL + '/api/excel/non_refundable'
    : process.env.NEXT_PUBLIC_BACKEND_URL + '/api/excel/sd';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    if (!response.ok) {
      const err = await response.text();
      alert('Failed to generate Excel: ' + err);
      return;
    }
    const blob = await response.blob();
    // Try to get filename from Content-Disposition
    let filename = 'output.xlsx';
    const disposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition');
    if (disposition) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match) filename = match[1];
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert('Failed to download Excel: ' + err);
  }
}

// Handlers and logic
const handleManualFieldChangeNonRefund = (field: string, value: string) => {
  setManualFieldsNonRefund((prev: { [key: string]: string }) => ({ ...prev, [field]: value }));
  setPreviewNonRefund((prev: any[] | null) => {
    if (!prev || prev.length === 0) return prev;
    const updated = [...prev];
    updated[0] = { ...updated[0], [field]: value };
    return updated;
  });
};
const handleManualFieldChangeSD = (field: string, value: string) => {
  setManualFieldsSD((prev: { [key: string]: string }) => ({ ...prev, [field]: value }));
  setPreviewSD((prev: any[] | null) => {
    if (!prev || prev.length === 0) return prev;
    const updated = [...prev];
    updated[0] = { ...updated[0], [field]: value };
    return updated;
  });
};
const handleParseFile = async () => {
  if (!files.length) return;
  setIsParsing(true);
  setParsingStarted(true);
  setParsedFile(files[0]);
  setShowManualFieldsState(true);
  const formData = new FormData();
  formData.append("file", files[0]);
  try {
    // Non-Refundable & SD (single call for NMMC)
    let nonRefundData = null;
    let sdData = null;
    if (authority.id === "nmmc") {
      const res = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/nmmc-extract', { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        if (data.non_refundable) {
          nonRefundData = [mapToColumns(data.non_refundable, PREVIEW_NON_REFUNDABLE_COLUMNS)];
        } else {
          nonRefundData = [{ error: "Parse failed" }];
        }
        // FIX: Use sd_headers and sd_row to build SD preview object
        if (data.sd_headers && data.sd_row) {
          const sdObj: { [key: string]: any } = {};
          data.sd_headers.forEach((h: string, i: number) => { sdObj[h] = data.sd_row[i]; });
          sdData = [mapToColumns(sdObj, PREVIEW_SD_COLUMNS)];
        } else {
          sdData = [{ error: "No SD data" }];
        }
      } else {
        nonRefundData = [{ error: "Parse failed" }];
        sdData = [{ error: "Parse failed" }];
      }
    } else {
      await fetchPreview("non_refundable", files[0], manualFieldsNonRefund);
      // fetchPreview will set previewNonRefund, so skip setting here
      await fetchPreview("sd", files[0], manualFieldsSD);
      // fetchPreview will set previewSD, so skip setting here
    }
    if (nonRefundData) setPreviewNonRefund(nonRefundData);
    if (sdData) setPreviewSD(sdData);
    setParsingDone(true);
  } catch (err: any) {
    setPreviewNonRefund([{ error: err.message || "Parse failed" }]);
    setPreviewSD([{ error: err.message || "Parse failed" }]);
  } finally {
    setIsParsing(false);
  }
};
const handleDownloadNonRefund = async () => {
  if (["mcgm", "nmmc"].includes(authority.id)) {
    if (!previewNonRefund || previewNonRefund.length === 0) {
      alert("No preview data to download.");
      return;
    }
    await downloadExcelFromBackend(previewNonRefund, 'non_refundable');
    return;
  }
  // Default: backend logic for other authorities
  if (!parsedFile) return;
  try {
    await processNonRefundableWithBackend({
      authority: authority.id,
      file: parsedFile,
      manualFields: manualFieldsNonRefund,
      previewId: previewIdNonRefund,
    });
  } catch (err) {
    alert("Processing failed: " + err);
  }
};
const handleDownloadSD = async () => {
  if (["mcgm", "nmmc"].includes(authority.id)) {
    if (!previewSD || previewSD.length === 0) {
      alert("No preview data to download.");
      return;
    }
    await downloadExcelFromBackend(previewSD, 'sd');
    return;
  }
  // Default: backend logic for other authorities
  if (!parsedFile) return;
  try {
    await processSDWithBackend({
      authority: authority.id,
      file: parsedFile,
      manualFields: manualFieldsSD,
      previewId: previewIdSD,
    });
  } catch (err) {
    alert("Processing failed: " + err);
  }
};
const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  onFileUpload(event);
  setManualFieldsNonRefund({});
  setManualFieldsSD({});
  setShowManualFieldsState(false);
  setParsedFile(null);
  setIsParsing(false);
  setPreviewNonRefund(null);
  setPreviewSD(null);
  setPreviewIdNonRefund(null);
  setPreviewIdSD(null);
  setParsingDone(false);
  setParsingStarted(false);
};





// List of implemented authority IDs (add more as you implement them)
const implementedAuthorities = ["mcgm", "mbmc", "nmmc", "kdmc"];
const isImplemented = implementedAuthorities.includes(authority.id);

// The function should return the JSX here
return (
  <Card className="border border-gray-800 bg-gray-900">
    <CardHeader>
      <CardTitle className="flex items-center gap-3 text-white font-inter font-semibold tracking-tight text-lg">
        <div className={`w-3 h-3 rounded-full ${authority.color}`} />
        {authority.fullName}
      </CardTitle>
      <CardDescription className="text-gray-400">
        Specialized parser for {authority.name} demand notes
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {!isImplemented ? (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-800/60 rounded-xl border-2 border-dashed border-gray-700 text-center">
          <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <span className="text-lg text-gray-300 font-semibold mb-2">Coming Soon</span>
          <span className="text-gray-400">The parser for <b>{authority.name}</b> is not yet available.<br/>Please check back later.</span>
        </div>
      ) : (
        <>
          <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-gray-600 transition-colors bg-gray-800/50">
            <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <Label htmlFor={`file-upload-${authority.id}`} className="cursor-pointer">
              <span className="font-medium text-white text-lg">Upload {authority.fullName} Demand Notes</span>
              {authority.id === "nmmc" && (
                <p className="text-sm text-gray-400 mt-2">Optimized for NMMC format</p>
              )}
            </Label>
            <UITextInput
              id={`file-upload-${authority.id}`}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
              disabled={!isImplemented}
            />
            {files.length > 0 && (
              <div className="mt-4 text-[#6b8cbc] text-sm font-mono truncate">{files[0].name}</div>
            )}
          </div>
          <SimulatedProgressBar parsingDone={parsingDone} parsingStarted={parsingStarted} />
          {files.length > 0 && !showManualFieldsState && (
            <Button
              onClick={handleParseFile}
              disabled={isParsing}
              className="w-full mt-4 bg-white hover:bg-gray-100 text-[#181e29] font-inter font-semibold flex items-center justify-center gap-2 rounded-lg border border-[#232f47] shadow-none text-base px-6 py-3 transition-colors"
              style={{ boxShadow: "none" }}
            >
              {isParsing ? <Loader2 className="animate-spin h-5 w-5 mr-2 text-black" /> : <FileText className="h-5 w-5 mr-2 text-black" />}
              Parse File
            </Button>
          )}

          {/* Show manual fields and preview tables for all authorities after parsing */}
          {parsingDone && (
            <div className="w-full mt-6 flex flex-col gap-8 items-start">
              {/* Preview Tables (full width, stacked vertically) */}
              <div className="flex flex-col gap-8 w-full">
                {/* --- NMMC Non-Refundable Output Preview --- */}
                {previewNonRefund && previewNonRefund.length > 0 && (
                  <div className="mb-4 w-full">
                    <h4 className="text-white font-bold text-2xl mb-4">Non-Refundable Output Preview</h4>
                    {renderEditablePreviewTable(
                      previewNonRefund,
                      setPreviewNonRefund
                    )}
                    <div className="flex justify-center mt-2">
                      <Button
                        onClick={handleDownloadNonRefund}
                        disabled={isProcessing}
                        className="h-12 bg-white hover:bg-gray-100 text-[#1d2636] font-inter font-semibold tracking-tight shadow-sm transition-all border-0 px-8 max-w-xs w-full"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Download Non-Refundable Excel
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                {/* --- NMMC SD Output Preview --- */}
                {previewSD && previewSD.length > 0 && (
                  <div className="mb-4 w-full">
                    <h4 className="text-white font-bold text-2xl mb-4">SD Output Preview</h4>
                    {renderEditablePreviewTable(previewSD, setPreviewSD)}
                    <div className="flex justify-center mt-2">
                      <Button
                        onClick={handleDownloadSD}
                        disabled={isProcessing}
                        className="h-12 bg-white hover:bg-gray-100 text-[#1d2636] font-inter font-semibold tracking-tight shadow-sm transition-all border-0 px-8 max-w-xs w-full"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Download SD Excel
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                {/* Summary Table and Generate Email Button moved here */}
                <div className="w-full">
                  <h4 className="text-white font-inter font-bold mb-4 text-2xl tracking-tight">Summary Table</h4>
                  {previewNonRefund && previewNonRefund.length > 0 ? (
                    renderEditablePreviewTable(
                      // Create summary data with only the 6 required fields
                      [{
                        'Demand Note Reference number': previewNonRefund[0]['Demand Note Reference number'] || '',
                        'Section Length (Mtr.)': previewNonRefund[0]['Section Length (Mtr.)'] || '',
                        'EXECUTION PARTNER NAME': 'Excel Telesonic India Private Limited',
                        'Route Name(As per CWIP)': previewNonRefund[0]['Route Name(As per CWIP)'] || '',
                        'Section Name for ROW(As per CWIP)': previewNonRefund[0]['Section Name for ROW(As per CWIP)'] || '',
                        'Project Name': 'Mumbai Fiber Refresh LMC'
                      }],
                      (rows) => {
                        // Update the summary data if needed
                        if (rows.length > 0) {
                          const updatedNonRefund = [...previewNonRefund];
                          updatedNonRefund[0] = { ...updatedNonRefund[0], ...rows[0] };
                          setPreviewNonRefund(updatedNonRefund);
                        }
                      },
                      "Summary Table"
                    )
                  ) : (
                    <div className="text-center py-4 text-gray-400">
                      No data available yet. Parse a file to see the summary.
                    </div>
                  )}
                  {/* Generate Email Draft Button */}
                  {previewNonRefund && previewNonRefund.length > 0 && (
                    <div className="flex justify-center mt-4">
                      <Button
                        className="h-12 bg-white hover:bg-gray-100 text-[#1d2636] font-inter font-semibold tracking-tight text-[15px] rounded-lg border border-[#232f47] flex items-center gap-2 shadow-sm px-8 max-w-xs w-full transition-colors justify-center"
                        onClick={() => setShowEmailModal(true)}
                      >
                        <FiMail className="text-black text-lg" />
                        Generate Email Draft
                      </Button>
                    </div>
                  )}
                  <GenerateEmailDraftModal
                    open={showEmailModal}
                    onClose={() => setShowEmailModal(false)}
                    defaultSubject={(() => {
                      if (!previewNonRefund || previewNonRefund.length === 0) return "";
                      const row = previewNonRefund[0];
                      return `Request Payment for Demand Note: ${row["Demand Note Reference number"] || ""}`;
                    })()}
                    defaultBody={(() => {
                      if (!previewNonRefund || previewNonRefund.length === 0) return "";
                      const row = previewNonRefund[0];
                      return `Hello, I hope you're doing well. I'm writing to request payment for Demand Note: ${row["Demand Note Reference number"] || ""} from ${authority.fullName}.`;
                    })()}
                    summaryRow={previewNonRefund && previewNonRefund.length > 0 ? previewNonRefund[0] : {}}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </CardContent>
  </Card>
);
}