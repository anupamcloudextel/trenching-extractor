"use client"

import type React from "react"

import { useState } from "react"
import type { ExtractedData, AuthorityConfig } from "@/types"

export function useFileProcessing() {
  const [files, setFiles] = useState<{ [key: string]: File[] }>({})
  const [isProcessing, setIsProcessing] = useState<{ [key: string]: boolean }>({})
  const [progress, setProgress] = useState<{ [key: string]: number }>({})
  const [extractedData, setExtractedData] = useState<ExtractedData[]>([])
  const [processingStatus, setProcessingStatus] = useState<{ [key: string]: string }>({})

  const handleFileUpload = (authorityId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    setFiles((prev) => ({
      ...prev,
      [authorityId]: selectedFiles,
    }))
  }

  const simulateProcessing = async (authority: AuthorityConfig) => {
    setIsProcessing((prev) => ({ ...prev, [authority.id]: true }))
    setProgress((prev) => ({ ...prev, [authority.id]: 0 }))

    for (let i = 0; i < authority.processingSteps.length; i++) {
      setProcessingStatus((prev) => ({ ...prev, [authority.id]: authority.processingSteps[i] }))
      setProgress((prev) => ({ ...prev, [authority.id]: (i + 1) * (100 / authority.processingSteps.length) }))
      await new Promise((resolve) => setTimeout(resolve, 1200))
    }

    // Simulate extracted data
    const mockData: ExtractedData[] = [
      {
        id: `${authority.id}-${Date.now()}`,
        authority: authority.name,
        demandNoteNumber: `${authority.name.toUpperCase()}-2024-${Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, "0")}`,
        municipality: authority.fullName,
        projectLocation: "Main Infrastructure Project Site",
        trenchingType: "Utility Installation & Road Development",
        permitNumber: `PRM-${Math.floor(Math.random() * 10000)}`,
        applicantName: "Cloud_Extel Infrastructure Solutions",
        contactInfo: "permits@cloudextel.com",
        workDescription: `${authority.name} approved infrastructure development project`,
        estimatedCost: `₹${(Math.random() * 500000 + 100000).toFixed(0)}`,
        dueDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: Math.random() > 0.3 ? "Approved" : "Under Review",
        confidence: Math.random() * 10 + 90,
        extractedAt: new Date().toISOString(),
      },
    ]

    setExtractedData((prev) => [...prev, ...mockData])
    setIsProcessing((prev) => ({ ...prev, [authority.id]: false }))
  }

  // New: Connect to FastAPI backend
  const processWithBackend = async ({
    authority,
    file,
    manualFields
  }: {
    authority: string;
    file: File;
    manualFields: Record<string, any>;
  }) => {
    const formData = new FormData();
    formData.append("authority", authority);
    formData.append("file", file);
    formData.append("manual_fields", JSON.stringify(manualFields || {}));

    const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/process', {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error("Failed to process file: " + (await response.text()));
    }
    // Download Excel file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `output_${authority}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  return {
    files,
    isProcessing,
    progress,
    extractedData,
    processingStatus,
    handleFileUpload,
    simulateProcessing,
    processWithBackend,
  }
}

// Move these exports OUTSIDE the useFileProcessing function, at the top level of the file

function getFilenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  // Try RFC 5987 (filename*=utf-8''...)
  const matchStar = disposition.match(/filename\*=utf-8''([^;\n]*)/i);
  if (matchStar) return decodeURIComponent(matchStar[1]);
  // Try regular filename=
  const match = disposition.match(/filename="?([^";\n]*)"?/i);
  if (match) return match[1];
  return fallback;
}

export const processNonRefundableWithBackend = async ({
  authority,
  file,
  manualFields,
  previewId,
}: {
  authority: string;
  file: File;
  manualFields: Record<string, any>;
  previewId?: string | null;
}) => {
  const formData = new FormData();
  formData.append("authority", authority);
  formData.append("file", file);
  formData.append("manual_fields", JSON.stringify(manualFields || {}));
  if (previewId) formData.append("preview_id", previewId);

  const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/process/non_refundable', {
    method: "POST",
    body: formData,
  });
  console.log("[DEBUG] Fetching: /process/non_refundable");
  const contentDisposition = response.headers.get("Content-Disposition") || response.headers.get("content-disposition");
  console.log("[DEBUG] Content-Disposition:", contentDisposition);
  if (!response.ok) {
    throw new Error("Failed to process file: " + (await response.text()));
  }
  const blob = await response.blob();
  const filename = getFilenameFromDisposition(contentDisposition, "output_non_refundable.xlsx");
  console.log("[DEBUG] Using download filename:", filename);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

// SD
export const processSDWithBackend = async ({
  authority,
  file,
  manualFields,
  previewId,
}: {
  authority: string;
  file: File;
  manualFields: Record<string, any>;
  previewId?: string | null;
}) => {
  const formData = new FormData();
  formData.append("authority", authority);
  formData.append("file", file);
  formData.append("sd_manual_fields", JSON.stringify(manualFields || {}));
  if (previewId) formData.append("preview_id", previewId);

  const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/process/sd', {
    method: "POST",
    body: formData,
  });
  console.log("[DEBUG] Fetching: /process/sd");
  const contentDisposition = response.headers.get("Content-Disposition") || response.headers.get("content-disposition");
  console.log("[DEBUG] Content-Disposition:", contentDisposition);
  if (!response.ok) {
    throw new Error("Failed to process file: " + (await response.text()));
  }
  const blob = await response.blob();
  const filename = getFilenameFromDisposition(contentDisposition, "output_sd.xlsx");
  console.log("[DEBUG] Using download filename:", filename);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
