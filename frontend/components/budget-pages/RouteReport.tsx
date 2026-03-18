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
import { ChevronDown } from "lucide-react";

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
  const [routeOptions, setRouteOptions] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
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
    try {
      let backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      backendUrl = backendUrl.replace(/\/$/, "");

      // 1) JSON for on-screen table
      const jsonRes = await fetch(
        `${backendUrl}/api/route-report?route_id_site_id=${encodeURIComponent(routeAnalysisId)}`
      );
      const json = await jsonRes.json();
      setReportRows(json.rows || []);

      // 2) Trigger Excel download in new tab
      window.open(
        `${backendUrl}/api/route-report/xlsx?route_id_site_id=${encodeURIComponent(routeAnalysisId)}`,
        "_blank"
      );
    } catch (e: any) {
      setReportError(e?.message || "Failed to create report");
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 pb-10">
      <Card className="bg-[#101624] border border-slate-800 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-white">Route Report</CardTitle>
          <CardDescription className="text-slate-300">
            Select a Route ID to view or export detailed reports in other tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-end gap-4 w-full mb-4 relative">
            {/* Route ID Dropdown (same look as Route Analysis) */}
            <div className="flex-1 w-full relative" ref={dropdownRef} style={{ maxWidth: 320 }}>
              <Label
                htmlFor="route-report-id-input"
                className="text-white text-base font-semibold mb-1 block"
              >
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
            <div>
              <Button
                className="h-12 px-6 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg"
                disabled={!routeAnalysisId || reportLoading}
                onClick={handleCreateReport}
              >
                {reportLoading ? "Creating..." : "Create Report"}
              </Button>
            </div>
          </div>
          {reportError && (
            <div className="text-red-400 text-sm mt-2">{reportError}</div>
          )}
          {reportRows.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <Table className="w-full mx-auto text-xs bg-[#0f1626] rounded-lg overflow-hidden">
                <TableHeader>
                  <TableRow className="border-slate-600 bg-[#141c2e]">
                    <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-sm text-center">
                      Route ID
                    </TableHead>
                    <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-sm text-center">
                      DN Number
                    </TableHead>
                    <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-sm text-center">
                      DN Length (m)
                    </TableHead>
                    <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-sm text-center">
                      Non-Refundable
                    </TableHead>
                    <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-sm text-center">
                      Budget CE Length (m)
                    </TableHead>
                    <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-sm text-center">
                      Budget RI Cost/m
                    </TableHead>
                    <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-sm text-center">
                      PO No (IP1)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportRows.map((r, idx) => (
                    <TableRow
                      key={idx}
                      className={`border-slate-700 ${idx % 2 === 0 ? "bg-[#0f1626]" : "bg-[#111b2d]"}`}
                    >
                      <TableCell className="text-slate-200 font-sans text-sm px-2 py-2 text-center">
                        {r.route_id_site_id ?? "-"}
                      </TableCell>
                      <TableCell className="text-slate-200 font-sans text-sm px-2 py-2 text-center">
                        {r.dn_number ?? "-"}
                      </TableCell>
                      <TableCell className="text-slate-200 font-sans text-sm px-2 py-2 text-center">
                        {r.dn_length_mtr != null ? String(r.dn_length_mtr) : "-"}
                      </TableCell>
                      <TableCell className="text-slate-200 font-sans text-sm px-2 py-2 text-center">
                        {r.actual_total_non_refundable != null ? String(r.actual_total_non_refundable) : "-"}
                      </TableCell>
                      <TableCell className="text-slate-200 font-sans text-sm px-2 py-2 text-center">
                        {r.budget_ce_length_mtr != null ? String(r.budget_ce_length_mtr) : "-"}
                      </TableCell>
                      <TableCell className="text-slate-200 font-sans text-sm px-2 py-2 text-center">
                        {r.budget_ri_cost_per_meter != null ? String(r.budget_ri_cost_per_meter) : "-"}
                      </TableCell>
                      <TableCell className="text-slate-200 font-sans text-sm px-2 py-2 text-center">
                        {r.po_no_ip1 != null ? String(r.po_no_ip1) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


