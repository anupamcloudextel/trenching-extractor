import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
import { ChevronDown } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { getDnMasterByRouteIdSiteId } from "@/lib/localDb";
import { getMaterialCostPerMeter, getServiceCostPerMeter } from '@/lib/lmcLogic';
import { AnalysisTableWithPopups, ProjectedSavingsCard, ProjectedTotalSavingsCard } from "../budget-pages/lmc";
import { Loader2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, ReferenceLine, Area
} from 'recharts';

// Debug: Minimal hardcoded Recharts chart
import { LineChart as DebugLineChart, Line as DebugLine, XAxis as DebugXAxis, YAxis as DebugYAxis, CartesianGrid as DebugCartesianGrid } from 'recharts';

import { ResponsiveLine } from '@nivo/line';
import html2canvas from 'html2canvas';
import { useReactToPrint } from "react-to-print";

const ROUTE_OVERVIEW_STORAGE_KEY = "route_overview_analysis";

function loadPersistedAnalysis(): { analysisRows: any[]; lastAnalyzedRouteId: string | null; lockedRoute: string | null } {
  if (typeof window === "undefined") return { analysisRows: [], lastAnalyzedRouteId: null, lockedRoute: null };
  try {
    const raw = sessionStorage.getItem(ROUTE_OVERVIEW_STORAGE_KEY);
    if (!raw) return { analysisRows: [], lastAnalyzedRouteId: null, lockedRoute: null };
    const j = JSON.parse(raw);
    const analysisRows = Array.isArray(j.analysisRows) ? j.analysisRows : [];
    const lastAnalyzedRouteId = j.lastAnalyzedRouteId && typeof j.lastAnalyzedRouteId === "string" ? j.lastAnalyzedRouteId : null;
    const lockedRoute = j.lockedRoute && typeof j.lockedRoute === "string" ? j.lockedRoute : lastAnalyzedRouteId;
    return { analysisRows, lastAnalyzedRouteId, lockedRoute };
  } catch {
    return { analysisRows: [], lastAnalyzedRouteId: null, lockedRoute: null };
  }
}

function savePersistedAnalysis(analysisRows: any[], lastAnalyzedRouteId: string | null, lockedRoute: string | null) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ROUTE_OVERVIEW_STORAGE_KEY, JSON.stringify({ analysisRows, lastAnalyzedRouteId, lockedRoute }));
  } catch (_) {}
}

// Duplicated components for Route Overview (decoupled from lmc.tsx)
function RouteOverviewAnalysisTable({ data, budgetedCostPerMeter, materialCostPerMeter, serviceCostPerMeter, tableStyle }: { data: any[], budgetedCostPerMeter: number | null, materialCostPerMeter: number, serviceCostPerMeter: number, tableStyle?: React.CSSProperties }) {
  if (!data || data.length === 0) {
    return <div className="text-red-400 text-sm mt-2">No DNs found for this selection.</div>;
  }
  let totalLength = 0, totalCost = 0, totalSavings = 0;
  let totalRiCost = 0, totalMaterialsCost = 0, totalServiceCost = 0;
  data.forEach(row => {
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
    const rowBudgetedTotal = (typeof budgetedCostPerMeter === 'number' && dnLength > 0) ? budgetedCostPerMeter * dnLength : 0;
    totalSavings += rowBudgetedTotal - rowTotalCost;
    
    // Debug logging
    console.log(`[ROUTE_OVERVIEW_TABLE] Row calculation:`, {
      dnLength,
      materialCostPerMeter,
      serviceCostPerMeter,
      materialsCost,
      serviceCost,
      rowTotalCost
    });
  });
  const totalCostPerMeterCurrent = totalLength > 0 ? totalCost / totalLength : null;
  const totalCostPerMeterBudget = budgetedCostPerMeter;
  const weightedAvgSavingsPerMeter = (typeof totalCostPerMeterBudget === 'number' && typeof totalCostPerMeterCurrent === 'number')
    ? totalCostPerMeterBudget - totalCostPerMeterCurrent
    : null;
  return (
    <>
      <Table className="w-full mx-auto text-xs" style={tableStyle}>
        <TableHeader>
          <TableRow className="border-slate-600">
            <TableHead className="text-slate-300 font-sans font-medium px-1 py-2 text-sm text-center" style={{ whiteSpace: 'nowrap', minWidth: '80px' }}>DN No.</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-1 py-2 text-sm text-center" style={{ whiteSpace: 'nowrap', minWidth: '90px' }}>DN Date</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-1 py-2 text-sm text-center" style={{ whiteSpace: 'nowrap', minWidth: '80px' }}>DN Length</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-1 py-2 text-sm text-center" style={{ whiteSpace: 'nowrap', minWidth: '100px' }}>RI Cost</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-1 py-2 text-sm text-center" style={{ whiteSpace: 'nowrap', minWidth: '90px' }}>Materials</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-1 py-2 text-sm text-center" style={{ whiteSpace: 'nowrap', minWidth: '80px' }}>Service</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-1 py-2 text-sm text-center" style={{ whiteSpace: 'nowrap', minWidth: '100px' }}>Total Cost</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-1 py-2 text-sm text-center" style={{ whiteSpace: 'nowrap', minWidth: '120px' }}>Total Cost/Mtr</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-1 py-2 text-sm text-center" style={{ whiteSpace: 'nowrap', minWidth: '130px' }}>Proj. Savings/Mtr</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-1 py-2 text-sm text-center" style={{ whiteSpace: 'nowrap', minWidth: '130px' }}>Proj. Savings</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => {
            const dnLength = Number(row.dn_length_mtr) || 0;
            const nonRefundable = Number(row.actual_total_non_refundable) || 0;
            const materialsCost = dnLength * materialCostPerMeter;
            const serviceCost = dnLength * serviceCostPerMeter;
            const totalCost = nonRefundable + materialsCost + serviceCost;
            const totalCostPerMeter = dnLength > 0 ? (totalCost / dnLength) : null;
            // Per-row savings per meter: (budgeted cost per meter - actual cost per meter for that DN)
            const projSavingsPerMtr = (typeof totalCostPerMeterBudget === 'number' && typeof totalCostPerMeter === 'number')
              ? totalCostPerMeterBudget - totalCostPerMeter
              : null;
            // Per-row savings: (budgeted cost per meter * DN length) - (actual total cost for that DN)
            const rowBudgetedTotal = (typeof totalCostPerMeterBudget === 'number' && dnLength > 0) ? totalCostPerMeterBudget * dnLength : null;
            const projSavings = (typeof rowBudgetedTotal === 'number' && typeof totalCost === 'number') ? rowBudgetedTotal - totalCost : null;
            return (
              <TableRow key={idx} className="border-slate-700 py-2">
                <TableCell className="text-slate-200 font-sans text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{row.dn_number || "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{row.dn_received_date ? new Date(row.dn_received_date).toLocaleDateString() : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{dnLength || "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{Number.isFinite(nonRefundable) ? `₹${nonRefundable.toLocaleString()}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{materialsCost ? `₹${materialsCost.toLocaleString()}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{serviceCost ? `₹${serviceCost.toLocaleString()}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{totalCost ? `₹${totalCost.toLocaleString()}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{totalCostPerMeter ? `₹${totalCostPerMeter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{projSavingsPerMtr !== null ? `₹${projSavingsPerMtr.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{projSavings !== null ? `₹${projSavings.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "-"}</TableCell>
              </TableRow>
            );
          })}
          {/* Total Row */}
          <TableRow className="bg-[#1E1E2F] border-t border-neutral-700">
            <TableCell className="font-semibold text-white text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }} colSpan={2}>Total</TableCell>
            <TableCell className="font-semibold text-white text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{totalLength ? totalLength.toLocaleString() : "-"}</TableCell>
            <TableCell className="font-semibold text-white text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{totalRiCost ? `₹${totalRiCost.toLocaleString()}` : "-"}</TableCell>
            <TableCell className="font-semibold text-white text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{totalMaterialsCost ? `₹${totalMaterialsCost.toLocaleString()}` : "-"}</TableCell>
            <TableCell className="font-semibold text-white text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{totalServiceCost ? `₹${totalServiceCost.toLocaleString()}` : "-"}</TableCell>
            <TableCell className="font-semibold text-white text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{totalCost ? `₹${totalCost.toLocaleString()}` : "-"}</TableCell>
            <TableCell className="text-slate-200 font-sans text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{totalLength > 0 ? `₹${(totalCost / totalLength).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}</TableCell>
            <TableCell className="text-slate-200 font-sans text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{weightedAvgSavingsPerMeter !== null ? `₹${weightedAvgSavingsPerMeter.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "-"}</TableCell>
            <TableCell className="text-slate-200 font-sans text-sm px-1 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>{totalSavings !== null ? `₹${totalSavings.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "-"}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </>
  );
}

function RouteOverviewProjectedSavingsCard({ budgetedCostPerMeter, actualCostPerMeter }: { budgetedCostPerMeter: number|null, actualCostPerMeter: number|null }) {
  if (typeof budgetedCostPerMeter !== "number" || typeof actualCostPerMeter !== "number") return null;
  const savings = budgetedCostPerMeter - actualCostPerMeter;
  const isPositive = savings >= 0;
  function format2Dec(val: number | null | undefined): string {
    if (val === null || val === undefined || isNaN(Number(val))) return '-';
    return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return (
    <div
      className={`w-full md:w-1/2 mx-auto mt-6 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all duration-200 backdrop-blur-lg border-none ring-1 ring-white/20 font-inter`}
      style={{
        background: isPositive 
          ? 'linear-gradient(to bottom right, #22c55e, #16a34a)' 
          : 'linear-gradient(to bottom right, #ef4444, #dc2626)',
        color: 'white'
      }}
    >
      <div className="text-base font-semibold font-inter mb-1 flex items-center gap-2 justify-center text-center">
        Projected Savings per Meter
        {isPositive ? (
          <span className="ml-2 text-white font-inter">▲</span>
        ) : (
          <span className="ml-2 text-white font-inter">▼</span>
        )}
      </div>
      <div className={`text-3xl font-extrabold font-inter ${isPositive ? "text-white" : "text-white"}`}
        style={{ textShadow: '0 1px 3px #000, 0 1px 0 #fff', textAlign: 'center' }}>
        {format2Dec(savings)} ₹/m
      </div>
      <div className="mt-1 text-white/80 text-xs font-inter text-center">
        (Budgeted: <span className="font-sans text-white/90">{format2Dec(budgetedCostPerMeter)}</span> ₹/m &nbsp;|&nbsp; Actual: <span className="font-sans text-white/90">{format2Dec(actualCostPerMeter)}</span> ₹/m)
      </div>
    </div>
  );
}

function RouteOverviewProjectedTotalSavingsCard({ budgetedCostPerMeter, data, materialCostPerMeter, serviceCostPerMeter }: { budgetedCostPerMeter: number|null, data: any[], materialCostPerMeter: number, serviceCostPerMeter: number }) {
  if (typeof budgetedCostPerMeter !== "number" || !Array.isArray(data) || data.length === 0) return null;
  // Calculate total savings: (budgeted cost per meter * total DN length) - (sum of all DN total costs)
  let totalLength = 0, totalActualCost = 0;
  data.forEach(row => {
    const dnLength = Number(row.dn_length_mtr) || 0;
    const nonRefundable = Number(row.actual_total_non_refundable) || 0;
    const materialsCost = dnLength * materialCostPerMeter;
    const serviceCost = dnLength * serviceCostPerMeter;
    const rowTotalCost = nonRefundable + materialsCost + serviceCost;
    totalLength += dnLength;
    totalActualCost += rowTotalCost;
  });
  const budgetedTotal = budgetedCostPerMeter * totalLength;
  const projectedSavings = budgetedTotal - totalActualCost;
  function format2Dec(val: number | null | undefined): string {
    if (val === null || val === undefined || isNaN(Number(val))) return '-';
    return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const isPositive = projectedSavings >= 0;
  console.log("RouteOverviewProjectedTotalSavingsCard projectedSavings:", projectedSavings, "isPositive:", isPositive);
  return (
    <div
      className={`w-full md:w-1/2 mx-auto mt-6 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all duration-200 backdrop-blur-lg border-none ring-1 ring-white/20 font-inter`}
      style={{
        background: isPositive 
          ? 'linear-gradient(to bottom right, #22c55e, #16a34a)' 
          : 'linear-gradient(to bottom right, #ef4444, #dc2626)',
        color: 'white'
      }}
    >
      <div className="text-base font-semibold font-inter mb-1 flex items-center gap-2 justify-center text-center">
        Projected Savings Against Total Budget
        {isPositive ? (
          <span className="ml-2 text-white font-inter">▲</span>
        ) : (
          <span className="ml-2 text-white font-inter">▼</span>
        )}
      </div>
      <div className="text-3xl font-extrabold font-inter text-white" style={{ textShadow: '0 1px 3px #000, 0 1px 0 #fff', textAlign: 'center' }}>
        {format2Dec(projectedSavings)} ₹
      </div>
      <div className="mt-1 text-white/80 text-xs font-inter text-center">
        (Budgeted: {format2Dec(budgetedTotal)} ₹ | Actual: {format2Dec(totalActualCost)} ₹)
      </div>
    </div>
  );
}

export default function RouteOverview() {
  const [routeAnalysisId, setRouteAnalysisId] = useState("");
  const [routeOptions, setRouteOptions] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedRoute, setLockedRoute] = useState<string | null>(null);
  const [analysisRows, setAnalysisRows] = useState<any[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [preDns, setPreDns] = useState<any[]>([]);
  const [currentDns, setCurrentDns] = useState<any[]>([]);
  const [postDns, setPostDns] = useState<any[]>([]);
  // Add hasAnalyzed state
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [budgetedCostPerMeter, setBudgetedCostPerMeter] = useState<number | null>(null);
  const [analysisAnimState, setAnalysisAnimState] = useState<'idle' | 'charging' | 'analyzing' | 'success'>('idle');
  const [lastAnalyzedRouteId, setLastAnalyzedRouteId] = useState<string | null>(null);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [materialCostPerMeter, setMaterialCostPerMeter] = useState<number>(270); // Default fallback
  const [serviceCostPerMeter, setServiceCostPerMeter] = useState<number>(1100); // Default fallback
  const reportRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `Route_Report_${lockedRoute}`,
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

  useEffect(() => {
    console.log("[ROUTE_OVERVIEW] Component mounted");
    setLoading(true);
    // Always use /api/route-ids, never /route-ids
    let backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
    backendUrl = backendUrl.replace(/\/$/, '');
    fetch(backendUrl + "/api/route-ids")
      .then((res) => res.json())
      .then((data) => {
        // Deduplicate route_ids
        const uniqueRoutes = Array.from(new Set((data.route_ids || []).filter(Boolean)));
        setRouteOptions(uniqueRoutes as string[]);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load route IDs");
        setLoading(false);
      });
  }, []);

  // Restore analysis from sessionStorage after mount (survives remounts e.g. Strict Mode / auth wrapper)
  useEffect(() => {
    const saved = loadPersistedAnalysis();
    if (saved.analysisRows.length > 0) {
      setAnalysisRows(saved.analysisRows);
      setLastAnalyzedRouteId(saved.lastAnalyzedRouteId);
      setLockedRoute(saved.lockedRoute);
      setHasAnalyzed(true);
    }
  }, []);

  useEffect(() => {
    console.log("[ROUTE_OVERVIEW] lockedRoute:", lockedRoute);
  }, [lockedRoute]);

  useEffect(() => {
    console.log("[ROUTE_OVERVIEW] analysisRows:", analysisRows);
    console.log("[ROUTE_OVERVIEW] preDns:", preDns);
    console.log("[ROUTE_OVERVIEW] currentDns:", currentDns);
    console.log("[ROUTE_OVERVIEW] postDns:", postDns);
    console.log("[ROUTE_OVERVIEW] budgetedCostPerMeter:", budgetedCostPerMeter);
  }, [analysisRows, preDns, currentDns, postDns, budgetedCostPerMeter]);

  useEffect(() => {
    if (analysisRows && analysisRows.length > 0) {
      const summary = getBudgetSummary(analysisRows);
      console.log("[ROUTE_OVERVIEW] Budget Summary:", summary);
      setBudgetedCostPerMeter(summary.totalCostPerMeter ?? null);
      console.log("[ROUTE_OVERVIEW] Set budgetedCostPerMeter:", summary.totalCostPerMeter);
    } else {
      setBudgetedCostPerMeter(null);
      console.log("[ROUTE_OVERVIEW] No analysisRows, set budgetedCostPerMeter to null");
    }
  }, [analysisRows]);

  // Fetch material cost per meter when route changes
  useEffect(() => {
    if (lockedRoute) {
      getMaterialCostPerMeter(lockedRoute).then(cost => {
        setMaterialCostPerMeter(cost);
        console.log(`[ROUTE_OVERVIEW] Set material cost per meter to: ${cost}`);
      });
    } else {
      setMaterialCostPerMeter(270); // Reset to default
    }
  }, [lockedRoute]);

  // Fetch service cost per meter when route changes
  useEffect(() => {
    if (lockedRoute) {
      getServiceCostPerMeter(lockedRoute).then(cost => {
        setServiceCostPerMeter(cost);
        console.log(`[ROUTE_OVERVIEW] Set service cost per meter to: ${cost}`);
        console.log(`[ROUTE_OVERVIEW] Current serviceCostPerMeter state:`, serviceCostPerMeter);
      });
    } else {
      setServiceCostPerMeter(1100); // Reset to default
    }
  }, [lockedRoute]);

  const getBudgetSummary = (rows: any[]) => {
    const surveyedLength = rows.reduce((sum, row) => sum + (parseFloat(row.ce_length_mtr) || 0), 0);
    const riCost = rows.reduce((sum, row) => sum + (parseFloat(row.total_ri_amount) || 0), 0);
    const materialCost = rows.reduce((sum, row) => sum + (parseFloat(row.material_cost) || 0), 0);
    const serviceCost = rows.reduce((sum, row) => sum + (parseFloat(row.execution_cost_including_hh) || 0), 0);
    const totalCost = riCost + materialCost + serviceCost;
    const totalCostPerMeter = surveyedLength > 0 ? totalCost / surveyedLength : null;
    return { surveyedLength, riCost, materialCost, serviceCost, totalCost, totalCostPerMeter };
  };

  useEffect(() => {
    if (!lockedRoute) {
      setPreDns([]); setCurrentDns([]); setPostDns([]); setBudgetedCostPerMeter(null);
      return;
    }
    // Query dn_master for all rows with route_id_site_id === lockedRoute (local DB)
    getDnMasterByRouteIdSiteId(lockedRoute).then(({ data, error }) => {
      if (error) return;
      const list = data || [];
      setPostDns(list);
      if (list.length > 0) {
        const { totalCostPerMeter } = getBudgetSummary(list);
        setBudgetedCostPerMeter(totalCostPerMeter);
      } else {
        setBudgetedCostPerMeter(null);
      }
    });
  }, [lockedRoute]);

  // Helper to normalize DD-MM-YYYY or DD/MM/YYYY to YYYY-MM-DD (ISO)
  function normalizeDateStringToISO(val: string): string {
    if (!val) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const match = val.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    return val;
  }

  // Compute most recent dn_received_date and filter DNs accordingly
  useEffect(() => {
    if (!postDns || postDns.length === 0) return;
    // Normalize all dn_received_date values to ISO
    const allDates = postDns
      .map(dn => normalizeDateStringToISO(dn.dn_received_date))
      .filter(Boolean);
    if (allDates.length === 0) return;
    // Find the most recent date (string compare is safe for ISO)
    const mostRecentDate = allDates.reduce((max, d) => d > max ? d : max, allDates[0]);
    // Filter
    const current = postDns.filter(dn => normalizeDateStringToISO(dn.dn_received_date) === mostRecentDate);
    const pre = postDns.filter(dn => normalizeDateStringToISO(dn.dn_received_date) < mostRecentDate);
    setCurrentDns(current);
    setPreDns(pre);
    // postDns remains unchanged
    console.log("[ROUTE_OVERVIEW] Most recent dn_received_date (ISO):", mostRecentDate);
    console.log("[ROUTE_OVERVIEW] currentDns:", current);
    console.log("[ROUTE_OVERVIEW] preDns:", pre);
  }, [postDns]);

  // Filter options based on input
  const filteredOptions = routeOptions.filter((option) =>
    option.toLowerCase().includes(routeAnalysisId.toLowerCase())
  );

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  // Helper to round numbers to 2 decimals only if not integer
  const round2 = (val: any) => {
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    if (Number.isInteger(num)) return num;
    return num.toFixed(2);
  };

  // Table totals
  const getTotals = (rows: any[]) => {
    const fields = ["ce_length_mtr", "total_ri_amount", "material_cost", "execution_cost_including_hh"];
    const totals: any = {};
    fields.forEach(f => {
      totals[f] = rows.reduce((sum, row) => sum + (parseFloat(row[f]) || 0), 0);
    });
    return totals;
  };

  const handleConfirm = () => {
    if (routeAnalysisId) {
      setLockedRoute(routeAnalysisId);
      setHasAnalyzed(false); // Reset hasAnalyzed when confirming
      setDropdownOpen(false);
    }
  };

  const handleReset = () => {
    setLockedRoute(null);
    setRouteAnalysisId("");
    setLastAnalyzedRouteId(null);
    setAnalysisRows([]);
    setAnalysisError(null);
    setHasAnalyzed(false);
    try {
      if (typeof window !== "undefined") sessionStorage.removeItem(ROUTE_OVERVIEW_STORAGE_KEY);
    } catch (_) {}
  };

  const handleRouteAnalysis = async () => {
    const routeToUse = lockedRoute || routeAnalysisId?.trim() || null;
    if (!routeToUse) return;
    if (!lockedRoute && routeAnalysisId?.trim()) setLockedRoute(routeAnalysisId.trim());
    setAnalysisAnimState('charging');
    setAnalysisError(null);
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:8000` : "");
    if (!backendUrl) {
      setAnalysisError("Backend URL not configured. Set NEXT_PUBLIC_BACKEND_URL.");
      setAnalysisAnimState('idle');
      return;
    }
    setAnalysisLoading(true);
    setAnalysisRows([]);
    try {
      const res = await fetch(`${backendUrl}/api/route-analysis?route_id_site_id=${encodeURIComponent(routeToUse)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Request failed (${res.status})`);
      }
      const raw = await res.json();
      const rows = Array.isArray(raw) ? raw : (raw?.data ?? raw?.rows ?? []);
      const list = Array.isArray(rows) ? rows : [];
      setAnalysisAnimState('success');
      setLastAnalyzedRouteId(routeToUse);
      setAnalysisRows(list);
      setHasAnalyzed(true);
      savePersistedAnalysis(list, routeToUse, routeToUse);
      setTimeout(() => setAnalysisAnimState('idle'), 1200);
    } catch (err: any) {
      setAnalysisError(err?.message || "Failed to fetch route analysis");
      setAnalysisAnimState('idle');
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Utility to format numbers to 2 decimals
  function format2Dec(val: number | null | undefined): string {
    if (val === null || val === undefined || isNaN(Number(val))) return '-';
    return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <div className="w-full min-h-screen bg-[#101624] py-8" style={{ overflowX: 'hidden' }}>
      {/* Route Analysis Title, Dropdown, Button, etc. */}
      <div className="w-full bg-[#101624] border-none shadow-2xl rounded-3xl backdrop-blur-md w-full mb-12">
        <CardHeader className="border-b border-slate-700 pb-4">
          <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="h-7 w-7 text-green-400 drop-shadow-lg" />
            Route Analysis
          </CardTitle>
          <CardDescription className="text-slate-400 mt-1 text-base font-normal leading-snug">
            Enter a Route ID and click "Perform Route Analysis" to view budget and actuals for that route.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 pb-8 px-12">
          {/* Animation Glow/Scan Bar Layer */}
          <div className="relative w-full">
            {(analysisAnimState === 'charging') && (
              <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
                <div className="w-full h-12 bg-gradient-to-r from-cyan-400 via-blue-600 to-purple-600 animate-lightning-ripple rounded-lg blur-2xl opacity-40"></div>
              </div>
            )}
            {(analysisAnimState === 'success') && (
              <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
                <div className="w-full h-12 bg-green-500 animate-success-pulse rounded-lg blur-lg opacity-40"></div>
              </div>
            )}
            {/* Horizontal flex row for dropdown and buttons */}
            <div className="flex flex-col md:flex-row items-end gap-4 w-full mb-8 relative z-10 justify-between">
              {/* Route ID Dropdown */}
              <div className="flex-1 w-full relative" ref={dropdownRef} style={{ maxWidth: 320 }}>
                <Label htmlFor="route-analysis-id-input" className="text-white text-base font-semibold mb-1 block">Route ID <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <div
                    className={`bg-[#181e2b] border ${dropdownOpen ? 'border-blue-600' : 'border-slate-700'} text-white h-12 px-4 text-base rounded-lg flex items-center cursor-pointer transition-all duration-150 ${dropdownOpen ? 'shadow-lg' : ''} ${lockedRoute ? 'opacity-60 pointer-events-none' : ''}`}
                    onClick={() => !lockedRoute && setDropdownOpen(true)}
                    tabIndex={0}
                    role="button"
                    aria-haspopup="listbox"
                    aria-expanded={dropdownOpen}
                    style={{ minHeight: 48 }}
                  >
                    <span className={routeAnalysisId ? "" : "text-slate-400"}>
                      {lockedRoute || routeAnalysisId || "Select or search Route ID"}
                    </span>
                    <ChevronDown className={`ml-auto h-5 w-5 transition-transform ${dropdownOpen ? 'rotate-180' : ''} text-slate-400`} />
                  </div>
                  {dropdownOpen && (
                    <div className="absolute z-20 mt-1 w-full bg-[#181e2b] border border-blue-600 rounded-lg shadow-2xl max-h-64 animate-fade-in">
                      <Command shouldFilter={false} className="bg-[#181e2b]">
                        <CommandInput
                          placeholder="Type to search..."
                          value={routeAnalysisId}
                          onValueChange={setRouteAnalysisId}
                          autoFocus
                          className="bg-[#181e2b] text-white border-none focus:ring-0 focus:outline-none px-3 py-2 text-base rounded-t-lg"
                          style={{ minHeight: 40 }}
                        />
                        <CommandList className="py-1 overflow-y-auto max-h-48">
                          {loading ? (
                            <div className="py-4 text-center text-slate-400">Loading...</div>
                          ) : error ? (
                            <div className="py-4 text-center text-red-400">{error}</div>
                          ) : filteredOptions.length === 0 ? (
                            <CommandEmpty>No routes found.</CommandEmpty>
                          ) : (
                            filteredOptions.map((option) => (
                              <CommandItem
                                key={option}
                                value={option}
                                onSelect={() => {
                                  setRouteAnalysisId(option);
                                  setDropdownOpen(false);
                                }}
                                className={`cursor-pointer px-4 py-2 rounded-md text-base transition-colors duration-100 ${routeAnalysisId === option ? 'bg-blue-900 text-white' : 'hover:bg-blue-800 hover:text-white text-slate-200'}`}
                                style={{ margin: '2px 4px' }}
                              >
                                {option}
                              </CommandItem>
                            ))
                          )}
                        </CommandList>
                      </Command>
                    </div>
                  )}
                </div>
              </div>
              {/* Button Group */}
              <div className="flex flex-row gap-2 items-end ml-auto">
                {/* Confirm/Reset Button */}
                {!lockedRoute ? (
                  <Button
                    type="button"
                    className="h-12 px-6 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-md text-base shadow-lg"
                    onClick={handleConfirm}
                    disabled={!routeAnalysisId}
                  >
                    Confirm
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="h-12 px-6 bg-gray-700 hover:bg-gray-800 text-white font-semibold rounded-md text-base shadow-lg"
                    onClick={handleReset}
                  >
                    Reset
                  </Button>
                )}
                {/* Perform Route Analysis Button */}
                <Button
                  type="button"
                  className={`h-12 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md text-base shadow-lg flex items-center gap-2 transition-all duration-200 ${analysisLoading || analysisAnimState !== 'idle' ? 'opacity-70 cursor-not-allowed' : ''} ${analysisAnimState === 'charging' ? 'animate-lightning-jitter' : ''} ${analysisAnimState === 'success' ? 'animate-success-bg' : ''}`}
                  onClick={handleRouteAnalysis}
                  disabled={!(lockedRoute || routeAnalysisId?.trim()) || analysisLoading || analysisAnimState !== 'idle'}
                >
                  {/* Icon logic */}
                  {analysisAnimState === 'idle' && <Zap className="h-5 w-5 transition-all" />}
                  {analysisAnimState === 'charging' && <Zap className="h-5 w-5 animate-lightning-pulse-glow" />}
                  {analysisAnimState === 'analyzing' && (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  )}
                  {analysisAnimState === 'success' && (
                    <svg className="h-6 w-6 text-green-200 animate-success-check" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                  {/* Text logic */}
                  <span className={`transition-all duration-300 ${analysisAnimState !== 'idle' ? 'opacity-0 absolute' : 'opacity-100 relative'}`}>Perform Route Analysis</span>
                  {analysisAnimState === 'charging' && <span className="ml-2 text-white font-semibold animate-lightning-text-glow">Powering Up...</span>}
                  {analysisAnimState === 'analyzing' && <span className="ml-2 text-white font-semibold">Analyzing...</span>}
                  {analysisAnimState === 'success' && <span className="ml-2 text-green-100 font-semibold animate-success-text">Analysis Complete</span>}
                </Button>
              </div>
            </div>
          </div>
          {/* Analysis Table */}
          {analysisLoading ? (
            <div className="text-center text-slate-300 py-8">Loading analysis...</div>
          ) : analysisError ? (
            <div className="text-center text-red-400 py-8">{analysisError}</div>
          ) : hasAnalyzed && analysisRows.length === 0 && !analysisError ? (
            <div className="text-center text-slate-300 py-8">
              No budget data found for this route. Upload the Master Budget file in Data Management, or add budget rows for this Route ID.
            </div>
          ) : analysisRows.length > 0 ? (
            <>
              {/* Main Report Content to Print - show whenever we have budget rows */}
              <div ref={reportRef} className="print-report-root">
                {/* Main Report Heading - use lastAnalyzedRouteId so it's set when data loads */}
                <div className="w-full mb-12">
                  <h1 className="text-white text-3xl font-bold font-sans mb-4 mt-2">Route Report for Route ID: {lockedRoute || lastAnalyzedRouteId || routeAnalysisId || "—"}</h1>
                </div>
                
                {/* Full Route Budget Table */}
                <div className="w-full mb-12">
                  <h2 className="text-white text-2xl font-bold font-sans mb-4 mt-2">Full Route Budget ({analysisRows.length} row{analysisRows.length !== 1 ? "s" : ""})</h2>
                  <div className="w-full">
                    <Table className="w-full text-left">
                      <TableHeader>
                        <TableRow className="border-slate-600">
                          <TableHead className="text-slate-300 font-sans font-medium text-center px-2 py-2 text-base">Route ID</TableHead>
                          <TableHead className="text-slate-300 font-sans font-medium text-center px-2 py-2 text-base">Surveyed Length</TableHead>
                          <TableHead className="text-slate-300 font-sans font-medium text-center px-2 py-2 text-base">RI Cost (₹)</TableHead>
                          <TableHead className="text-slate-300 font-sans font-medium text-center px-2 py-2 text-base">Material Cost (₹)</TableHead>
                          <TableHead className="text-slate-300 font-sans font-medium text-center px-2 py-2 text-base">Service Cost (₹)</TableHead>
                          <TableHead className="text-slate-300 font-sans font-medium text-center px-2 py-2 text-base">Total Cost (₹)</TableHead>
                          <TableHead className="text-slate-300 font-sans font-medium text-center px-2 py-2 text-base">Total Cost/Meter (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="text-slate-200">
                          <TableCell className="py-2 px-4 text-center">{lockedRoute || lastAnalyzedRouteId || routeAnalysisId || "—"}</TableCell>
                          <TableCell className="py-2 px-4 text-center">{round2(getTotals(analysisRows).ce_length_mtr)}</TableCell>
                          <TableCell className="py-2 px-4 text-center">{round2(getTotals(analysisRows).total_ri_amount)}</TableCell>
                          <TableCell className="py-2 px-4 text-center">{round2(getTotals(analysisRows).material_cost)}</TableCell>
                          <TableCell className="py-2 px-4 text-center">{round2(getTotals(analysisRows).execution_cost_including_hh)}</TableCell>
                          <TableCell className="py-2 px-4 text-center font-semibold">{(() => {
                            const t = getTotals(analysisRows);
                            const total = (parseFloat(t.total_ri_amount) || 0) + (parseFloat(t.material_cost) || 0) + (parseFloat(t.execution_cost_including_hh) || 0);
                            return round2(total);
                          })()}</TableCell>
                          <TableCell className="py-2 px-4 text-center font-semibold">{(() => {
                            const t = getTotals(analysisRows);
                            const total = (parseFloat(t.total_ri_amount) || 0) + (parseFloat(t.material_cost) || 0) + (parseFloat(t.execution_cost_including_hh) || 0);
                            const length = parseFloat(t.ce_length_mtr) || 0;
                            if (!length) return "";
                            return round2(total / length);
                          })()}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="analysis-divider" />
                {/* Pre Analysis Table - always show */}
                <div className="w-full m-0 pre-analysis-table" style={{ width: '100%', margin: 0, padding: 0, overflowX: 'visible' }}>
                  <h2 className="text-white text-2xl font-bold font-sans mb-4 mt-2">Pre Analysis</h2>
                  <div className="p-6 text-white" style={{ width: '100%', overflowX: 'visible', padding: 0 }}>
                    {preDns.length === 0 ? (
                      <div className="text-yellow-400 text-base font-semibold mb-4">
                        No DNs available for Pre Analysis.
                      </div>
                    ) : (
                      <>
                        {budgetedCostPerMeter === null && (
                          <div className="text-yellow-400 text-base font-semibold mb-4">
                            No Budget Values have been set for this route.
                          </div>
                        )}
                        <RouteOverviewAnalysisTable data={preDns} budgetedCostPerMeter={budgetedCostPerMeter} materialCostPerMeter={materialCostPerMeter} serviceCostPerMeter={serviceCostPerMeter} />
                        <div className="flex flex-col md:flex-row gap-6 mt-6 items-stretch justify-center savings-cards-row">
                          <RouteOverviewProjectedSavingsCard
                            budgetedCostPerMeter={budgetedCostPerMeter}
                            actualCostPerMeter={(function(){
                              let totalLength = 0, totalCost = 0;
                              preDns.forEach(row => {
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
                          <RouteOverviewProjectedTotalSavingsCard
                            budgetedCostPerMeter={budgetedCostPerMeter}
                            data={preDns}
                            materialCostPerMeter={materialCostPerMeter}
                            serviceCostPerMeter={serviceCostPerMeter}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="analysis-divider" />
                {/* Current Analysis Table */}
                {currentDns.length > 0 && (
                  <div className="w-full m-0 current-analysis-table" style={{ width: '100%', margin: 0, padding: 0, overflowX: 'visible' }}>
                    <h2 className="text-white text-2xl font-bold font-sans mb-4 mt-2">Current Analysis</h2>
                    <div className="p-6 text-white" style={{ width: '100%', overflowX: 'visible', padding: 0 }}>
                      {budgetedCostPerMeter === null && (
                        <div className="text-yellow-400 text-base font-semibold mb-4">
                          No Budget Values have been set for this route.
                        </div>
                      )}
                      <RouteOverviewAnalysisTable data={currentDns} budgetedCostPerMeter={budgetedCostPerMeter} materialCostPerMeter={materialCostPerMeter} serviceCostPerMeter={serviceCostPerMeter} />
                      <div className="flex flex-col md:flex-row gap-6 mt-6 items-stretch justify-center savings-cards-row">
                        <RouteOverviewProjectedSavingsCard
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
                        <RouteOverviewProjectedTotalSavingsCard
                          budgetedCostPerMeter={budgetedCostPerMeter}
                          data={currentDns}
                          materialCostPerMeter={materialCostPerMeter}
                          serviceCostPerMeter={serviceCostPerMeter}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="analysis-divider" />
                {/* Post Analysis Table */}
                {postDns.length > 0 && (
                  <div className="w-full m-0 post-analysis-table" style={{ width: '100%', margin: 0, padding: 0, overflowX: 'visible' }}>
                    <h2 className="text-white text-2xl font-bold font-sans mb-4 mt-2">Post Analysis</h2>
                    <div className="p-6 text-white" style={{ width: '100%', overflowX: 'visible', padding: 0 }}>
                      {budgetedCostPerMeter === null && (
                        <div className="text-yellow-400 text-base font-semibold mb-4">
                          No Budget Values have been set for this route.
                        </div>
                      )}
                      <RouteOverviewAnalysisTable data={postDns} budgetedCostPerMeter={budgetedCostPerMeter} materialCostPerMeter={materialCostPerMeter} serviceCostPerMeter={serviceCostPerMeter} />
                      <div className="flex flex-col md:flex-row gap-6 mt-6 items-stretch justify-center savings-cards-row">
                        <RouteOverviewProjectedSavingsCard
                          budgetedCostPerMeter={budgetedCostPerMeter}
                          actualCostPerMeter={(function(){
                            let totalLength = 0, totalCost = 0;
                            postDns.forEach(row => {
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
                        <RouteOverviewProjectedTotalSavingsCard
                          budgetedCostPerMeter={budgetedCostPerMeter}
                          data={postDns}
                          materialCostPerMeter={materialCostPerMeter}
                          serviceCostPerMeter={serviceCostPerMeter}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="analysis-divider" />
                {/* Remaining Route Analysis Section */}
                {(() => {
                  // Get values from budget summary (analysisRows) and post analysis (postDns)
                  const budgetTotals = getTotals(analysisRows);
                  const postTotals = getTotals(postDns);
                  const surveyedLength = parseFloat(budgetTotals.ce_length_mtr) || 0;
                  const totalDnLength = parseFloat(postTotals.dn_length_mtr) || 0;
                  // If dn_length_mtr is not present in postDns, sum up manually
                  const postDnLength = postDns && postDns.length > 0 ? postDns.reduce((sum, row) => sum + (Number(row.dn_length_mtr) || 0), 0) : 0;
                  const totalCostBudget = (parseFloat(budgetTotals.total_ri_amount) || 0) + (parseFloat(budgetTotals.material_cost) || 0) + (parseFloat(budgetTotals.execution_cost_including_hh) || 0);
                  const totalCostPost = postDns && postDns.length > 0 ? postDns.reduce((sum, row) => {
                    const dnLength = Number(row.dn_length_mtr) || 0;
                    const nonRefundable = Number(row.actual_total_non_refundable) || 0;
                    const materialsCost = dnLength * materialCostPerMeter;
                    const serviceCost = dnLength * serviceCostPerMeter;
                    return sum + (nonRefundable + materialsCost + serviceCost);
                  }, 0) : 0;
                  const remainingRouteLength = surveyedLength - postDnLength;
                  const remainingBudget = totalCostBudget - totalCostPost;
                  const remainingBudgetPerMtr = remainingRouteLength > 0 ? remainingBudget / remainingRouteLength : 0;
                  function format2Dec(val: number | null | undefined) {
                    if (val === null || val === undefined || isNaN(Number(val))) return '-';
                    return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  }
                  return (
                    <div className="w-full m-0 remaining-route-analysis-section" style={{ background: '#181e2b', color: '#fff', borderRadius: 16, padding: 24, margin: '32px 0' }}>
                      <div className="flex flex-row gap-4 items-center justify-center w-full mb-8">
                        <div className="flex-1 flex flex-col items-center justify-center">
                          <div className="text-2xl font-bold mb-1 text-white">Remaining Route Length</div>
                          <div className="text-4xl font-extrabold text-white" style={{letterSpacing: '1px', textShadow: '0 0 4px #fff, 0 0 1px #fff'}}>{format2Dec(remainingRouteLength)} m</div>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center">
                          <div className="text-2xl font-bold mb-1 text-white">Remaining Budget</div>
                          <div className="text-4xl font-extrabold text-white" style={{letterSpacing: '1px', textShadow: '0 0 4px #fff, 0 0 1px #fff'}}>₹{format2Dec(remainingBudget)}</div>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center">
                          <div className="text-2xl font-bold mb-1 text-white">Remaining Budget / Meter</div>
                          <div className="text-4xl font-extrabold text-white" style={{letterSpacing: '1px', textShadow: '0 0 4px #fff, 0 0 1px #fff'}}>₹{format2Dec(remainingBudgetPerMtr)} /m</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div className="analysis-divider" />
                {/* S Curve Chart Section */}
                {hasAnalyzed && analysisRows.length > 0 && postDns.length > 0 && (
                  <div className="w-full flex items-center justify-center mt-12 s-curve-chart-section" style={{ breakInside: 'avoid', pageBreakInside: 'avoid', background: '#181e2b', borderRadius: 16, padding: 24, margin: '32px 0' }}>
                    <div className="nivo-cumulative-line-chart" style={{ width: '100%', height: 600, background: '#181e2b', borderRadius: 16, padding: 24, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                      <h2 className="text-white text-xl font-bold mb-4">S Chart (Budget vs Actuals)</h2>
                      <NivoCumulativeLineChart budgetSummary={getBudgetSummary(analysisRows)} postDns={postDns} materialCostPerMeter={materialCostPerMeter} serviceCostPerMeter={serviceCostPerMeter} />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
        {/* Move Download/Print Report (PDF) Button below the graph, bottom left */}
        {hasAnalyzed && (preDns.length > 0 || currentDns.length > 0 || postDns.length > 0) && !analysisLoading && !analysisError && (
          <div className="relative w-full" style={{ minHeight: 80 }}>
            <div className="absolute left-0 bottom-8 ml-16">
              <Button
                className="bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold hover:from-blue-600 hover:to-blue-800 px-6 py-3 rounded-lg shadow-lg"
                onClick={handlePrint}
              >
                Download/Print Report (PDF)
              </Button>
            </div>
          </div>
        )}
      </div>
      <style jsx global>{`
@keyframes futuristic-glow {
  0% { opacity: 0.2; filter: blur(8px); }
  30% { opacity: 0.7; filter: blur(16px); }
  60% { opacity: 1; filter: blur(24px); }
  100% { opacity: 0; filter: blur(32px); }
}
.animate-futuristic-glow {
  animation: futuristic-glow 1s cubic-bezier(0.4,0,0.2,1);
}
@keyframes scan-bar {
  0% { transform: translateX(-120%); opacity: 0.2; }
  20% { opacity: 1; }
  60% { opacity: 1; }
  100% { transform: translateX(120%); opacity: 0; }
}
.animate-scan-bar {
  animation: scan-bar 1s cubic-bezier(0.4,0,0.2,1);
}
@keyframes lightning-pulse-glow {
  0% { filter: drop-shadow(0 0 0px #fff) brightness(1); transform: scale(1); }
  30% { filter: drop-shadow(0 0 8px #0ff) brightness(1.5); transform: scale(1.2) rotate(-5deg); }
  60% { filter: drop-shadow(0 0 16px #0ff) brightness(2); transform: scale(1.1) rotate(5deg); }
  100% { filter: drop-shadow(0 0 0px #fff) brightness(1); transform: scale(1); }
}
.animate-lightning-pulse-glow {
  animation: lightning-pulse-glow 0.7s cubic-bezier(0.4,0,0.2,1);
}
@keyframes lightning-jitter {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-2px); }
  40% { transform: translateX(2px); }
  60% { transform: translateX(-1px); }
  80% { transform: translateX(1px); }
}
.animate-lightning-jitter {
  animation: lightning-jitter 0.7s linear;
}
@keyframes lightning-ripple {
  0% { opacity: 0.2; transform: scale(0.9); }
  50% { opacity: 0.7; transform: scale(1.05); }
  100% { opacity: 0; transform: scale(1.2); }
}
.animate-lightning-ripple {
  animation: lightning-ripple 0.7s cubic-bezier(0.4,0,0.2,1);
}
@keyframes success-pulse {
  0% { opacity: 0.2; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
  100% { opacity: 0; transform: scale(1.2); }
}
.animate-success-pulse {
  animation: success-pulse 1.2s cubic-bezier(0.4,0,0.2,1);
}
@keyframes success-check {
  0% { stroke-dasharray: 0 24; }
  100% { stroke-dasharray: 24 0; }
}
.animate-success-check path {
  stroke-dasharray: 24 0;
  animation: success-check 0.8s cubic-bezier(0.4,0,0.2,1) forwards;
}
@keyframes success-text {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}
.animate-success-text {
  animation: success-text 0.6s cubic-bezier(0.4,0,0.2,1);
}
@keyframes lightning-text-glow {
  0% { text-shadow: 0 0 0px #0ff; }
  50% { text-shadow: 0 0 8px #0ff, 0 0 16px #0ff; }
  100% { text-shadow: 0 0 0px #0ff; }
}
.animate-lightning-text-glow {
  animation: lightning-text-glow 0.7s cubic-bezier(0.4,0,0.2,1);
}
.analysis-divider { width: 100%; height: 4px; background: #fff; border-radius: 2px; margin: 32px 0; }
@media print {
  html, body {
    background: #101624 !important;
    color: #fff !important;
    width: 100vw !important;
    height: 100vh !important;
    min-width: 0 !important;
    min-height: 0 !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
  }
  .print-report-root, .print-report-root * {
    box-sizing: border-box !important;
  }
  .print-report-root {
    position: absolute; left: 0; top: 0; width: 100vw !important; height: 100vh !important; min-width: 0 !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important;
    background: #101624 !important;
    color: #fff !important;
    overflow: visible !important;
  }
  .no-print { display: none !important; }
  .print-report-root,
  .print-report-root * {
    color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .pre-analysis-table,
  .current-analysis-table,
  .post-analysis-table {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    width: 100% !important;
    background: #101624 !important;
    color: #fff !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .pre-analysis-table table,
  .current-analysis-table table,
  .post-analysis-table table {
    background: #101624 !important;
    color: #fff !important;
    width: 100% !important;
    font-size: 1.1em !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .pre-analysis-table th,
  .current-analysis-table th,
  .post-analysis-table th,
  .pre-analysis-table td,
  .current-analysis-table td,
  .post-analysis-table td {
    max-width: 120px !important;
    width: auto !important;
    font-size: 0.95em !important;
    white-space: normal !important;
    overflow-wrap: break-word !important;
    word-break: break-word !important;
    overflow: visible !important;
    text-overflow: unset !important;
    padding: 6px 6px !important;
    text-align: center !important;
    margin: 0 !important;
  }
  /* Make only the last row (Total row) extremely small in print, force override */
  .pre-analysis-table tr:last-child td,
  .current-analysis-table tr:last-child td,
  .post-analysis-table tr:last-child td {
    font-weight: 900 !important;
    font-size: 8px !important;
    color: #fff !important;
    background: #181e2b !important;
    max-width: 80px !important;
    width: auto !important;
    white-space: normal !important;
    word-break: break-word !important;
    overflow: visible !important;
    text-overflow: unset !important;
    padding: 4px 4px !important;
    text-align: center !important;
    margin: 0 !important;
  }
  /* Even more specific selector to guarantee override for print */
  .print-report-root .pre-analysis-table tr:last-child td,
  .print-report-root .current-analysis-table tr:last-child td,
  .print-report-root .post-analysis-table tr:last-child td {
    font-size: 14px !important;
  }
  .analysis-divider {
    height: 4px !important;
    background: #222 !important;
    margin: 32px 0 !important;
    break-after: avoid-page !important;
    page-break-after: avoid !important;
  }
  .print-section {
    page-break-before: always !important;
    width: 100% !important;
  }
  .print-section:first-child {
    page-break-before: auto !important;
  }
  .print-report-root h2, .print-report-root h1 {
    color: #fff !important;
    font-size: 2em !important;
    font-weight: 800 !important;
    margin-top: 24px !important;
    margin-bottom: 12px !important;
  }
  .print-report-root .text-green-200, .print-report-root .text-green-400, .print-report-root .text-white {
    color: #fff !important;
    font-weight: 700 !important;
  }
  /* Savings cards: force same green gradient and white text as on screen, but restrict width and center */
  .print-report-root .bg-gradient-to-r, .print-report-root .bg-gradient-to-br, .print-report-root .bg-green-500, .print-report-root .bg-green-400, .print-report-root .bg-green-600, .print-report-root .bg-green-700 {
    background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%) !important;
    color: #fff !important;
    box-shadow: 0 4px 24px #16a34a33 !important;
    border: none !important;
    max-width: 600px !important;
    margin-left: auto !important;
    margin-right: auto !important;
    display: block !important;
  }
  .print-report-root .bg-blue-500, .print-report-root .bg-blue-700 {
    background: #181e2b !important;
    color: #fff !important;
    box-shadow: none !important;
    border: none !important;
  }
  /* FORCE Remaining Route Analysis section to be visible in print: dark background and white text */
  .print-report-root .remaining-route-analysis-section,
  .print-report-root .remaining-route-analysis-section *,
  .remaining-route-analysis-section,
  .remaining-route-analysis-section * {
    background: #181e2b !important;
    color: #fff !important;
    border-color: #222 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    box-shadow: none !important;
  }
  /* Prevent S Chart from being split across pages in print */
  .print-report-root .s-curve-chart-section,
  .print-report-root .nivo-cumulative-line-chart,
  .s-curve-chart-section,
  .nivo-cumulative-line-chart {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    -webkit-column-break-inside: avoid !important;
    overflow: visible !important;
    width: 100% !important;
    background: #181e2b !important;
    border-radius: 16px !important;
    padding: 24px !important;
    margin: 32px 0 !important;
  }
  /* Make savings cards always appear side by side, never stacked, in print and on screen */
  .savings-cards-row {
    display: flex !important;
    flex-direction: row !important;
    gap: 24px !important;
    justify-content: center !important;
    align-items: stretch !important;
    flex-wrap: nowrap !important;
  }
  .savings-cards-row > div {
    max-width: 340px !important;
    min-width: 240px !important;
    flex: 1 1 0 !important;
    margin: 0 !important;
    display: flex !important;
    flex-direction: column !important;
  }
  @media print {
    .savings-cards-row {
      display: flex !important;
      flex-direction: row !important;
      gap: 24px !important;
      justify-content: center !important;
      align-items: stretch !important;
      flex-wrap: nowrap !important;
      width: 100% !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .savings-cards-row > div {
      max-width: 340px !important;
      min-width: 240px !important;
      flex: 1 1 0 !important;
      margin: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .s-curve-chart-section,
    .nivo-cumulative-line-chart {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      -webkit-column-break-inside: avoid !important;
      overflow: visible !important;
      width: 100% !important;
      background: #181e2b !important;
      border-radius: 16px !important;
      padding: 24px !important;
      margin: 32px 0 !important;
    }
  }
}
.pre-analysis-table table,
.current-analysis-table table,
.post-analysis-table table {
  table-layout: auto !important;
  width: 100% !important;
  border-spacing: 0;
  overflow-x: visible !important;
}
.pre-analysis-table td,
.pre-analysis-table th,
.current-analysis-table td,
.current-analysis-table th,
.post-analysis-table td,
.post-analysis-table th {
  word-break: normal !important;
  font-size: 1.18em !important;
  padding-top: 14px !important;
  padding-bottom: 14px !important;
  padding-left: 12px !important;
  padding-right: 12px !important;
  height: 48px !important;
  line-height: 1.3 !important;
  vertical-align: middle !important;
  text-overflow: ellipsis !important;
  overflow: hidden !important;
}
/* Make DN Number column much narrower */
.pre-analysis-table th:first-child,
.pre-analysis-table td:first-child,
.current-analysis-table th:first-child,
.current-analysis-table td:first-child,
.post-analysis-table th:first-child,
.post-analysis-table td:first-child {
  max-width: 120px !important;
  min-width: 80px !important;
  width: 100px !important;
  text-overflow: ellipsis !important;
  overflow: hidden !important;
}
.pre-analysis-table th,
.current-analysis-table th,
.post-analysis-table th {
  height: 60px !important;
  font-size: 1.28em !important;
  font-weight: 700 !important;
  background: #181e2b !important;
  z-index: 1;
}
.pre-analysis-table tr:last-child,
.current-analysis-table tr:last-child,
.post-analysis-table tr:last-child {
  font-weight: 900 !important;
  background: #181e2b !important;
  color: #fff !important;
  border-top: 2px solid #444 !important;
}
.pre-analysis-table td,
.current-analysis-table td,
.post-analysis-table td {
  font-weight: 500 !important;
}
.pre-analysis-table tr:last-child td,
.current-analysis-table tr:last-child td,
.post-analysis-table tr:last-child td {
  font-weight: 900 !important;
  font-size: 1.5em !important;
  color: #fff !important;
}
@media (max-width: 1200px) {
  .pre-analysis-table td,
  .pre-analysis-table th,
  .current-analysis-table td,
  .current-analysis-table th,
  .post-analysis-table td,
  .post-analysis-table th {
    font-size: 0.95em !important;
    max-width: 120px !important;
  }
}
@media (max-width: 900px) {
  .pre-analysis-table td,
  .pre-analysis-table th,
  .current-analysis-table td,
  .current-analysis-table th,
  .post-analysis-table td,
  .post-analysis-table th {
    font-size: 0.85em !important;
    max-width: 80px !important;
  }
}
`}</style>
    </div>
  );
}

function NivoCumulativeLineChart({ budgetSummary, postDns, materialCostPerMeter, serviceCostPerMeter }: { budgetSummary: { surveyedLength: number, riCost: number, materialCost: number, serviceCost: number }, postDns: any[], materialCostPerMeter: number, serviceCostPerMeter: number }) {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; mouseX: number; mouseY: number } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const surveyedLength = Number(budgetSummary?.surveyedLength) || 0;
  const totalCostBudget = (Number(budgetSummary?.riCost) || 0) + (Number(budgetSummary?.materialCost) || 0) + (Number(budgetSummary?.serviceCost) || 0);
  // Budget line
  const budgetLine = {
    id: 'Budget Line',
    color: '#FFD600',
    data: [
      { x: 0, y: 0 },
      { x: surveyedLength, y: totalCostBudget },
    ],
  };
  // Actuals line (cumulative)
  const sortedDns = [...postDns].sort((a, b) => {
    const da = a.dn_received_date ? new Date(a.dn_received_date).getTime() : 0;
    const db = b.dn_received_date ? new Date(b.dn_received_date).getTime() : 0;
    return da - db;
  });
  let cumLength = 0;
  let cumCost = 0;
  const actualsData = sortedDns.map((row, idx) => {
    const dnLength = Number(row.dn_length_mtr) || 0;
    const actualCost = (Number(row.actual_total_non_refundable) || 0) + dnLength * materialCostPerMeter + dnLength * serviceCostPerMeter;
    cumLength += dnLength;
    cumCost += actualCost;
    return {
      x: cumLength,
      y: cumCost,
      dn_number: row.dn_number,
      dn_date: row.dn_received_date,
    };
  });
  const actualsPoints = [{ x: 0, y: 0 }, ...actualsData];
  // Pass both lines to the chart for default rendering
  const actualsLine = {
    id: 'Actuals',
    color: '#00FF6A',
    data: [{ x: 0, y: 0 }, ...actualsData],
  };
  const chartData = [budgetLine, actualsLine];
  // Dot size
  const dotSize = 8;
  return (
    <div style={{ position: 'relative', width: '100%', height: 600 }}>
      <ResponsiveLine
        data={chartData}
        margin={{ top: 40, right: 40, bottom: 110, left: 160 }}
        xScale={{ type: 'linear' }}
        yScale={{ type: 'linear', min: 0 }}
        axisBottom={{
          legend: 'Cumulative Length (m)',
          legendOffset: 80,
          legendPosition: 'middle',
          tickSize: 8,
          tickPadding: 8,
          format: (v: number) => Number(v).toLocaleString(),
        }}
        axisLeft={{
          legend: 'Cumulative Cost (₹)',
          legendOffset: -140,
          legendPosition: 'middle',
          tickSize: 8,
          tickPadding: 8,
          format: (v: number) => Number(v).toLocaleString(),
        }}
        colors={["#FFD600", "#00FF6A"]}
        pointSize={8}
        pointColor="#fff"
        pointBorderWidth={2}
        pointBorderColor={{ from: 'serieColor' }}
        enableSlices={false}
        useMesh={true}
        enableArea={false}
        lineWidth={5}
        theme={{
          axis: {
            ticks: {
              text: {
                fill: '#fff',
                fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
                fontSize: 15,
                shapeRendering: 'geometricPrecision',
              },
            },
            legend: {
              text: {
                fill: '#fff',
                fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
                fontSize: 16,
                shapeRendering: 'geometricPrecision',
              },
            },
          },
          grid: {
            line: { stroke: '#232b3a', strokeWidth: 1 },
          },
          tooltip: {
            container: {
              background: 'rgba(35,43,58,0.85)',
              color: '#fff',
              fontSize: 12,
              fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
              fontWeight: 500,
              shapeRendering: 'geometricPrecision',
              padding: '4px 10px',
              borderRadius: 6,
              boxShadow: '0 2px 8px #0002',
            },
          },
          legends: {
            text: {
              fill: '#fff',
              fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
              fontSize: 15,
              shapeRendering: 'geometricPrecision',
            },
          },
        }}
        tooltip={({ point }: { point: any }) => (
          <div style={{ background: 'rgba(35,43,58,0.85)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontFamily: 'Inter, Segoe UI, Arial, sans-serif', fontWeight: 500, fontSize: 12, boxShadow: '0 2px 8px #0002' }}>
            <div><b>Cumulative Length:</b> {Number(point.data.x).toLocaleString()} m</div>
            <div><b>Cumulative Cost:</b> ₹{Number(point.data.y).toLocaleString()}</div>
          </div>
        )}
        legends={[
          {
            anchor: 'top-left',
            direction: 'row',
            justify: false,
            translateY: -30,
            itemWidth: 120,
            itemHeight: 20,
            itemsSpacing: 8,
            symbolSize: 16,
            symbolShape: 'circle',
            itemTextColor: '#fff',
            data: [
              { id: 'Actuals', label: 'Actuals', color: '#00FF6A' },
              { id: 'Budget Line', label: 'Budget Line', color: '#FFD600' },
            ],
          },
        ]}
      />
    </div>
  );
} 