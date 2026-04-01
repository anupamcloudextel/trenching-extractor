"use client"

import { useState, useRef } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useFileProcessing } from "@/hooks/useFileProcessing"
import { authorities } from "@/constants/authorities"
import { exportToExcel } from "@/utils/export"
import { SignInPage } from "@/components/auth/SignInPage"
import { Header } from "@/components/layout/Header"
import { AnalyticsCards } from "@/components/dashboard/AnalyticsCards"
import { AuthorityUploadCard } from "@/components/parser/AuthorityUploadCard"
import { ResultsTable } from "@/components/results/ResultsTable"
import { AuthoritySidebar } from "@/components/layout/AuthoritySidebar"
import * as XLSX from "xlsx"
import LmcPage from '@/components/budget-pages/lmc'
import React from "react"
import MasterTrackerSection from '@/components/budget-pages/MasterTracker';
import RouteOverview from "@/components/budget-pages/route_overview";
import RouteReport from "@/components/budget-pages/RouteReport";
import PoPdfExtractor from "@/components/budget-pages/PoPdfExtractor";
import DepositReturn from "@/components/budget-pages/DepositReturn";
import DnManagementSection from "@/components/budget-pages/data_management";
import ClientParserV2 from "@/components/budget-pages/ClientParserV2";

export default function Home() {
  const { user, isAuthenticated, isLoggingIn, handleMicrosoftLogin, handleLogout } = useAuth()
  const { files, isProcessing, progress, extractedData, processingStatus, handleFileUpload, simulateProcessing } =
    useFileProcessing()

  const [activeAuthority, setActiveAuthority] = useState("kdmc")
  const [analytics] = useState({
    totalProcessed: 1247,
    avgProcessingTime: 2.3,
    activeAuthorities: 6,
  })

  // LMC Budget Upload UI state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
   const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        setPreview(json as any[]);
      };
      reader.readAsArrayBuffer(f);
    } else {
      setPreview([]);
    }
  };

  const handleUpload = async () => {
    if (!file || preview.length === 0) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      // Budget upload: use Data Management or LMC page to upload to local DB
      setSuccess("Budget uploaded successfully!");
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const selectedAuthority = authorities.find(a => a.id === activeAuthority);

  // Reset files for new authority to prevent state leakage
  // (This effect runs whenever the activeAuthority changes)
  React.useEffect(() => {
    if (selectedAuthority) {
      // Clear files for the new authority
      handleFileUpload(selectedAuthority.id, { target: { files: [] } } as any);
    }
  }, [activeAuthority]);

  if (!isAuthenticated) {
    return <SignInPage />
  }

  // Ensure user is not null and name is always a string
  const safeUser = user ? { ...user, name: user.name || user.email || "" } : undefined;

  return (
    <div className="min-h-screen bg-blue flex overflow-x-hidden">
      <AuthoritySidebar selected={activeAuthority} onSelect={setActiveAuthority} />
      <div className="flex-1 transition-all duration-300 sidebar-margin bg-[#101624] min-h-screen min-w-0">
          <Header 
          user={safeUser!} 
          analytics={analytics} 
          pageTitle={selectedAuthority ? selectedAuthority.name : (
            activeAuthority === 'budget-lmc' ? 'LMC Budget Upload' :
            activeAuthority === 'data-management' ? 'Data Management' :
            activeAuthority === 'route-overview' ? 'Route Analysis' :
            activeAuthority === 'route-report' ? 'Route Report' :
            activeAuthority === 'po-pdf-extractor' ? 'PO PDF Extractor' :
            activeAuthority === 'deposit-return' ? 'Deposit Refund' :
            activeAuthority === 'client-parser-v2' ? 'Client Parser V2' :
            "Master Dashboard"
          )} 
          onLogout={handleLogout} 
        />
        <div className="pt-6 space-y-8">
          {/* Show LMC Budget Upload UI if budget-lmc tab is selected */}
          {activeAuthority === 'data-management' ? (
            <DnManagementSection />
          ) : activeAuthority === 'budget-lmc' ? (
            <LmcPage />
          ) : activeAuthority === 'master-tracker' ? (
            <MasterTrackerSection />
          ) : activeAuthority === 'route-overview' ? (
            <RouteOverview />
          ) : activeAuthority === 'route-report' ? (
            <RouteReport />
          ) : activeAuthority === 'po-pdf-extractor' ? (
            <PoPdfExtractor />
          ) : activeAuthority === 'deposit-return' ? (
            <DepositReturn />
          ) : activeAuthority === 'client-parser-v2' ? (
            <ClientParserV2 />
          ) : (
            <>
              {/* Only show analytics for authority tabs */}
              {selectedAuthority && (
                <AnalyticsCards analytics={analytics} />
              )}
              {/* Render the selected authority's upload card full width */}
              {selectedAuthority && (
                <AuthorityUploadCard
                  key={selectedAuthority.id} // Force remount on authority change
                  authority={selectedAuthority}
                  files={files[selectedAuthority.id] || []}
                  isProcessing={isProcessing[selectedAuthority.id] || false}
                  onFileUpload={(e) => handleFileUpload(selectedAuthority.id, e)}
                  onStartProcessing={() => simulateProcessing(selectedAuthority)}
                />
              )}
              <ResultsTable data={extractedData} authorities={authorities} onExport={() => exportToExcel(extractedData)} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
