import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Zap } from "lucide-react";

export default function DepositReturn() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [generatedFilename, setGeneratedFilename] = useState<string>("deposit_return.docx");

  const handleGenerate = async () => {
    if (!pdfFile) return;
    setLoading(true);
    setError(null);
    setGeneratedBlob(null);
    try {
      const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
      const fd = new FormData();
      fd.append("permit_pdf", pdfFile);

      const res = await fetch(`${backendUrl}/api/deposit-return/docx`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.detail || "Failed to generate docx");
      }
      const blob = await res.blob();
      setGeneratedBlob(blob);
      const cd = res.headers.get("content-disposition") || "";
      const filenameStarMatch = cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
      const filenameMatch = cd.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i);
      const parsedFilename =
        (filenameStarMatch?.[1] ? decodeURIComponent(filenameStarMatch[1]) : "") ||
        filenameMatch?.[1] ||
        filenameMatch?.[2] ||
        "";
      setGeneratedFilename(parsedFilename.trim() || `Deposit_Return_${Date.now()}.docx`);
    } catch (e: any) {
      setError(e?.message || "Failed to generate docx");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedBlob) return;
    const url = window.URL.createObjectURL(generatedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = generatedFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full bg-[#101624] py-8" style={{ overflowX: "hidden" }}>
      <Card className="w-full bg-[#101624] border-none shadow-2xl rounded-3xl backdrop-blur-md mb-12">
        <CardHeader className="border-b border-slate-700 pb-4">
          <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="h-7 w-7 text-green-400 drop-shadow-lg" />
            Deposit Refund
          </CardTitle>
          <CardDescription className="text-slate-400 mt-1 text-base font-normal leading-snug">
            Upload Permit PDF to generate a Word file. Ward address is read from root
            <code className="mx-1 text-slate-300">ward-address/Mumbai_Ward Address.xlsx</code>.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 pb-8 px-12">
          <div className="flex flex-col md:flex-row items-end gap-4">
            <div className="w-full md:w-[380px]">
              <Label className="text-white text-base font-semibold mb-1 block">Permit PDF</Label>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => {
                  setPdfFile(e.target.files?.[0] || null);
                  setGeneratedBlob(null);
                  setGeneratedFilename("deposit_return.docx");
                }}
                className="w-full bg-[#181e2b] border border-slate-700 text-slate-200 h-12 px-3 text-sm rounded-lg file:mr-3 file:border-0 file:bg-[#232f47] file:text-slate-200 file:px-3 file:py-2"
              />
            </div>
            <div className="flex items-end gap-3">
              <Button
                className="h-12 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-lg"
                disabled={!pdfFile || loading}
                onClick={handleGenerate}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Upload className="h-5 w-5 mr-2" />}
                {loading ? "Generating..." : "Generate Word"}
              </Button>
              <Button
                className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg"
                disabled={!generatedBlob || loading}
                onClick={handleDownload}
              >
                Download Word
              </Button>
            </div>
          </div>

          {error && <div className="text-red-400 text-sm mt-4">{error}</div>}
        </CardContent>
      </Card>
    </div>
  );
}

