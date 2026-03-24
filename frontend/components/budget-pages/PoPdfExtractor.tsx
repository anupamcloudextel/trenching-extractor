import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Zap } from "lucide-react";

type ExtractedPO = {
  po_number: string;
  route_id_site_id: string;
  po_value: string;
  entry_count?: number;
  entries?: Array<{
    sr_no: string;
    po_number: string;
    route_id_site_id: string;
    qty: string;
    uom: string;
    unit_price: string;
    po_value: string;
  }>;
};

export default function PoPdfExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractedPO | null>(null);

  const handleExtract = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch((process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "") + "/api/parse-po-pdf", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.detail || "Failed to parse PDF");
      }
      setResult({
        po_number: String(json?.po_number || ""),
        route_id_site_id: String(json?.route_id_site_id || ""),
        po_value: String(json?.po_value || ""),
        entry_count: Number(json?.entry_count || 0),
        entries: Array.isArray(json?.entries) ? json.entries : [],
      });
    } catch (e: any) {
      setError(e?.message || "Failed to parse PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-[#101624] py-8" style={{ overflowX: "hidden" }}>
      <Card className="w-full bg-[#101624] border-none shadow-2xl rounded-3xl backdrop-blur-md mb-12">
        <CardHeader className="border-b border-slate-700 pb-4">
          <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="h-7 w-7 text-green-400 drop-shadow-lg" />
            PO PDF Extractor
          </CardTitle>
          <CardDescription className="text-slate-400 mt-1 text-base font-normal leading-snug">
            Upload PO PDF and extract PO Number, Route ID/Site ID, and PO Value.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 pb-8 px-12">
          <div className="flex flex-col md:flex-row items-end gap-4">
            <div className="w-full md:w-[420px]">
              <Label className="text-white text-base font-semibold mb-1 block">PO PDF</Label>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full bg-[#181e2b] border border-slate-700 text-slate-200 h-12 px-3 text-sm rounded-lg file:mr-3 file:border-0 file:bg-[#232f47] file:text-slate-200 file:px-3 file:py-2"
              />
            </div>
            <div className="flex items-end">
              <Button
                className="h-12 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-lg"
                disabled={!file || loading}
                onClick={handleExtract}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Upload className="h-5 w-5 mr-2" />}
                {loading ? "Extracting..." : "Extract"}
              </Button>
            </div>
          </div>

          {error && <div className="text-red-400 text-sm mt-4">{error}</div>}

          {result && (
            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#141c2e] border border-slate-700 rounded-lg p-4">
                  <div className="text-slate-400 text-xs mb-1">PO Number</div>
                  <div className="text-white text-lg font-semibold">{result.po_number || "-"}</div>
                </div>
                <div className="bg-[#141c2e] border border-slate-700 rounded-lg p-4">
                  <div className="text-slate-400 text-xs mb-1">Route ID / Site ID</div>
                  <div className="text-white text-lg font-semibold">{result.route_id_site_id || "-"}</div>
                </div>
                <div className="bg-[#141c2e] border border-slate-700 rounded-lg p-4">
                  <div className="text-slate-400 text-xs mb-1">Total PO Value (All Rows)</div>
                  <div className="text-white text-lg font-semibold">{result.po_value || "-"}</div>
                </div>
                <div className="bg-[#141c2e] border border-slate-700 rounded-lg p-4">
                  <div className="text-slate-400 text-xs mb-1">Rows Extracted</div>
                  <div className="text-white text-lg font-semibold">{result.entry_count ?? 0}</div>
                </div>
              </div>

              <div>
                <div className="text-slate-300 text-sm mb-2 font-semibold">Extracted Rows (Full PDF)</div>
                <div className="overflow-x-auto border border-slate-700 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-[#0f1626]">
                      <tr>
                        <th className="text-slate-300 font-semibold text-left px-3 py-2">S.No</th>
                        <th className="text-slate-300 font-semibold text-left px-3 py-2">PO Number</th>
                        <th className="text-slate-300 font-semibold text-left px-3 py-2">Route ID / Site ID</th>
                        <th className="text-slate-300 font-semibold text-right px-3 py-2">Qty</th>
                        <th className="text-slate-300 font-semibold text-left px-3 py-2">UOM</th>
                        <th className="text-slate-300 font-semibold text-right px-3 py-2">Unit Price</th>
                        <th className="text-slate-300 font-semibold text-right px-3 py-2">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result.entries && result.entries.length > 0 ? result.entries : [{
                        sr_no: "1",
                        po_number: result.po_number || "",
                        route_id_site_id: result.route_id_site_id || "",
                        qty: "",
                        uom: "",
                        unit_price: "",
                        po_value: result.po_value || "",
                      }]).map((row, idx) => (
                        <tr key={`${row.sr_no}-${idx}`} className={`border-t border-slate-700/70 ${idx % 2 === 0 ? "bg-[#0f1626]" : "bg-[#111b2d]"}`}>
                          <td className="text-slate-100 px-3 py-2">{row.sr_no}</td>
                          <td className="text-slate-100 px-3 py-2">{row.po_number || "-"}</td>
                          <td className="text-slate-100 px-3 py-2">{row.route_id_site_id || "-"}</td>
                          <td className="text-slate-100 px-3 py-2 text-right">{row.qty || "-"}</td>
                          <td className="text-slate-100 px-3 py-2">{row.uom || "-"}</td>
                          <td className="text-slate-100 px-3 py-2 text-right">{row.unit_price || "-"}</td>
                          <td className="text-slate-100 px-3 py-2 text-right">{row.po_value || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

