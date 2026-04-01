import React, { useEffect, useRef, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
import { ChevronDown, Zap } from "lucide-react";

/**
 * Route Report (minimal)
 *
 * This tab ONLY shows the Route ID dropdown (same styling and backend
 * data source as Route Analysis) and intentionally hides all analysis
 * tables / charts. It is meant to be a lightweight entry point where
 * users can pick a Route ID.
 */
export default function RouteReport() {
  const [routeAnalysisId, setRouteAnalysisId] = useState("");
  const [modality, setModality] = useState<"IP1" | "Co-build">("IP1");
  const [routeOptions, setRouteOptions] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportWarnings, setReportWarnings] = useState<string[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [summaryGrid, setSummaryGrid] = useState<any[][]>([]);
  const [projectionGrid, setProjectionGrid] = useState<any[][]>([]);
  const [lastReportParams, setLastReportParams] = useState<{ route_id_site_id: string; modality: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch Route IDs from the same backend endpoint used by Route Analysis
  useEffect(() => {
    setLoading(true);
    let backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    backendUrl = backendUrl.replace(/\/$/, "");
    fetch(backendUrl + "/api/route-ids")
      .then((res) => res.json())
      .then((data) => {
        const uniqueRoutes = Array.from(new Set((data.route_ids || []).filter(Boolean)));
        setRouteOptions(uniqueRoutes as string[]);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load route IDs");
        setLoading(false);
      });
  }, []);

  const filteredOptions = routeOptions.filter((opt) =>
    routeAnalysisId ? opt.toLowerCase().includes(routeAnalysisId.toLowerCase()) : true
  );

  const handleCreateReport = async () => {
    if (!routeAnalysisId) return;
    setReportLoading(true);
    setReportError(null);
    setReportWarnings([]);
    try {
      let backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      backendUrl = backendUrl.replace(/\/$/, "");

      const params = new URLSearchParams({
        route_id_site_id: routeAnalysisId,
        modality,
      });

      // 1) JSON for on-screen table
      const jsonRes = await fetch(`${backendUrl}/api/route-report?${params.toString()}`);
      const json = await jsonRes.json();
      setReportRows(json.rows || []);
      setSummaryGrid(Array.isArray(json.summaryGrid) ? json.summaryGrid : []);
      setProjectionGrid(Array.isArray(json.projectionGrid) ? json.projectionGrid : []);
      setReportWarnings(Array.isArray(json.warnings) ? json.warnings.map((w: any) => String(w)) : []);
      setLastReportParams({ route_id_site_id: routeAnalysisId, modality });
    } catch (e: any) {
      setReportError(e?.message || "Failed to create report");
    } finally {
      setReportLoading(false);
    }
  };

  const handleDownloadReport = () => {
    if (!lastReportParams) return;
    let backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    backendUrl = backendUrl.replace(/\/$/, "");
    const params = new URLSearchParams(lastReportParams);
    window.open(`${backendUrl}/api/route-report/xlsx?${params.toString()}`, "_blank");
  };

  function ExcelMergedGridTable({ grid }: { grid: any[][] }) {
    if (!grid || grid.length === 0) return null;
    const colCount = Math.max(...grid.map((r) => (Array.isArray(r) ? r.length : 0)));
    if (colCount === 0) return null;

    const parseNumeric = (val: any): number | null => {
      if (val === null || val === undefined) return null;
      if (typeof val === "number") return Number.isFinite(val) ? val : null;
      const s = String(val).trim();
      if (!s) return null;
      const cleaned = s.replace(/,/g, "");
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    };

    const formatCellValue = (val: any, rowIdx: number, colIdx: number): string => {
      if (val === null || val === undefined) return "";
      const s = String(val);
      const n = parseNumeric(val);
      if (n === null) return s;

      const headerRow = grid[1] || [];
      const headerText = String(headerRow[colIdx] ?? "").toLowerCase();
      const looksLikeMoneyHeader = /cost|amount|budget|difference|payable|ri|total/.test(headerText);
      if (!looksLikeMoneyHeader && Math.abs(n) < 1000) return s;

      // Preserve up to 2 decimals where present; add thousands separators.
      const hasDecimals = String(val).includes(".");
      return n.toLocaleString("en-IN", {
        minimumFractionDigits: hasDecimals ? 0 : 0,
        maximumFractionDigits: 2,
      });
    };

    return (
      <div className="w-full overflow-x-auto">
        <table className="w-full text-xs bg-[#0f1626] rounded-lg overflow-hidden border border-slate-700/60 border-separate border-spacing-0">
          <tbody>
            {grid.map((row, rIdx) => {
              return (
                <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-[#0f1626]" : "bg-[#111b2d]"}>
                  {(() => {
                    let cells: JSX.Element[] = [];
                    let c = 0;
                    while (c < colCount) {
                      const current = row?.[c] ?? "";
                      const currentStr = current === null || current === undefined ? "" : String(current);

                      // Merge contiguous blank cells and avoid vertical borders on those runs.
                      // This removes stray divider lines near the right side of merged sections.
                      if (currentStr.trim() === "") {
                        let blankSpan = 1;
                        while (c + blankSpan < colCount) {
                          const next = row?.[c + blankSpan] ?? "";
                          const nextStr = next === null || next === undefined ? "" : String(next);
                          if (nextStr.trim() === "") {
                            blankSpan += 1;
                            continue;
                          }
                          break;
                        }
                        cells.push(
                          <td
                            key={`${rIdx}-${c}`}
                            colSpan={blankSpan}
                            className="text-slate-200 font-sans text-sm px-2 py-2 text-center border-y border-slate-700/60"
                          >
                            {formatCellValue(currentStr, rIdx, c)}
                          </td>
                        );
                        c += blankSpan;
                        continue;
                      }

                      // Merge only label/header-like cells (avoid merging numeric columns).
                      const isNumericOnly = /^-?\d+(\.\d+)?$/.test(currentStr.trim());
                      const allowBlankMerge = rIdx < 2; // headers typically live near the top

                      let span = 1;
                      if (!isNumericOnly) {
                        while (c + span < colCount) {
                          const next = row?.[c + span] ?? "";
                          const nextStr = next === null || next === undefined ? "" : String(next);
                          if (nextStr === currentStr) {
                            span += 1;
                            continue;
                          }
                          if (allowBlankMerge && nextStr.trim() === "") {
                            span += 1;
                            continue;
                          }
                          break;
                        }
                      }

                      const onlyBlanksAfterSpan = (() => {
                        for (let k = c + span; k < colCount; k += 1) {
                          const tail = row?.[k] ?? "";
                          const tailStr = tail === null || tail === undefined ? "" : String(tail);
                          if (tailStr.trim() !== "") return false;
                        }
                        return true;
                      })();

                      cells.push(
                        <td
                          key={`${rIdx}-${c}`}
                          colSpan={span}
                          className={`text-slate-200 font-sans text-sm px-2 py-2 text-center border border-slate-700/60 ${
                            onlyBlanksAfterSpan ? "border-r-0" : ""
                          }`}
                        >
                          {formatCellValue(currentStr, rIdx, c)}
                        </td>
                      );
                      c += span;
                    }
                    return cells;
                  })()}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#101624] py-8" style={{ overflowX: "hidden" }}>
      <Card className="w-full bg-[#101624] border-none shadow-2xl rounded-3xl backdrop-blur-md w-full mb-12">
        <CardHeader className="border-b border-slate-700 pb-4">
          <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="h-7 w-7 text-green-400 drop-shadow-lg" />
            Route Report
          </CardTitle>
          <CardDescription className="text-slate-400 mt-1 text-base font-normal leading-snug">
            Select a Route ID and export the Excel report.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 pb-8 px-12">
          <div className="flex flex-col md:flex-row items-end gap-4 w-full mb-8 relative z-10 md:justify-start">
            {/* Route ID Dropdown (same look as Route Analysis) */}
            <div className="w-full md:w-[320px] relative" ref={dropdownRef}>
              <Label htmlFor="route-report-id-input" className="text-white text-base font-semibold mb-1 block">
                Route ID <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div
                  className={`bg-[#181e2b] border ${
                    dropdownOpen ? "border-blue-600" : "border-slate-700"
                  } text-white h-12 px-4 text-base rounded-lg flex items-center cursor-pointer transition-all duration-150 ${
                    dropdownOpen ? "shadow-lg" : ""
                  }`}
                  onClick={() => setDropdownOpen(true)}
                  tabIndex={0}
                  role="button"
                  aria-haspopup="listbox"
                  aria-expanded={dropdownOpen}
                  style={{ minHeight: 48 }}
                >
                  <span className={routeAnalysisId ? "" : "text-slate-400"}>
                    {routeAnalysisId || "Select or search Route ID"}
                  </span>
                  <ChevronDown
                    className={`ml-auto h-5 w-5 transition-transform ${
                      dropdownOpen ? "rotate-180" : ""
                    } text-slate-400`}
                  />
                </div>
                {dropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full bg-[#181e2b] border border-blue-600 rounded-lg shadow-2xl max-h-64 animate-fade-in">
                    <Command shouldFilter={false} className="bg-[#181e2b]">
                      <CommandInput
                        id="route-report-id-input"
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
                              className={`cursor-pointer px-4 py-2 rounded-md text-base transition-colors duration-100 ${
                                routeAnalysisId === option
                                  ? "bg-blue-900 text-white"
                                  : "hover:bg-blue-800 hover:text-white text-slate-200"
                              }`}
                              style={{ margin: "2px 4px" }}
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

            {/* Modality Dropdown */}
            <div className="w-full md:w-[190px]">
              <Label className="text-white text-base font-semibold mb-1 block">Modality</Label>
              <div className="relative">
                <select
                  value={modality}
                  onChange={(e) => setModality(e.target.value as "IP1" | "Co-build")}
                  className="w-full appearance-none bg-[#181e2b] border border-slate-700 text-white h-12 px-4 pr-10 text-base rounded-lg"
                  style={{ minHeight: 48 }}
                >
                  <option value="IP1">IP1</option>
                  <option value="Co-build">Co-build</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              </div>
            </div>

            <div className="flex items-end md:ml-2">
              <Button
                className="h-12 px-6 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg shadow-lg"
                disabled={!routeAnalysisId || reportLoading}
                onClick={handleCreateReport}
              >
                {reportLoading ? "Creating..." : "Create Report"}
              </Button>
            </div>
            {lastReportParams && (
              <div className="flex items-end">
                <Button
                  className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-lg"
                  onClick={handleDownloadReport}
                >
                  Download Excel
                </Button>
              </div>
            )}
          </div>
          {reportError && (
            <div className="text-red-400 text-sm mt-2">{reportError}</div>
          )}
          {reportWarnings.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              <div className="text-amber-300 text-sm font-semibold">Warning</div>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                {reportWarnings.map((w, i) => (
                  <li key={i} className="text-amber-200 text-sm">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {summaryGrid.length > 0 && (
            <div className="mt-6 space-y-6">
              <div>
                <div className="text-white text-sm font-semibold mb-2">Summary</div>
                <ExcelMergedGridTable grid={summaryGrid} />
              </div>
              <div>
                <div className="text-white text-sm font-semibold mb-2">Projection</div>
                <ExcelMergedGridTable grid={projectionGrid} />
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}


