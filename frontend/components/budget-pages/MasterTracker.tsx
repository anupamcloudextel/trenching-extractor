import React, { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Upload, FileText, Loader2, CheckCircle } from "lucide-react";

const PERMIT_FIELDS = [
  { key: 'permission_receipt_date', label: 'Permission Receipt Date' },
  { key: 'permit_no', label: 'Permit No' },
  { key: 'permit_start_date', label: 'Permit Start Date' },
  { key: 'permit_end_date', label: 'Permit End Date' },
  { key: 'permitted_length_by_ward_mts', label: 'Permitted Length by Ward (mts)' },
];

export default function MasterTrackerSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [masterTrackerFile, setMasterTrackerFile] = useState<File | null>(null);
  const [masterTrackerUploading, setMasterTrackerUploading] = useState(false);
  const [masterTrackerUploadStatus, setMasterTrackerUploadStatus] = useState<string | null>(null);
  const [downloadingMasterTracker, setDownloadingMasterTracker] = useState(false);
  const [downloadMasterTrackerStatus, setDownloadMasterTrackerStatus] = useState<string | null>(null);

  // Permit PDF upload state
  const [permitFile, setPermitFile] = useState<File | null>(null);
  const [permitUploadStatus, setPermitUploadStatus] = useState<string | null>(null);
  const [permitUploading, setPermitUploading] = useState(false);
  const [permitPreview, setPermitPreview] = useState<any | null>(null);
  const [permitEdit, setPermitEdit] = useState<any | null>(null);
  const [permitSaving, setPermitSaving] = useState(false);
  const [permitSaveStatus, setPermitSaveStatus] = useState<string | null>(null);

  const handleButtonClick = () => {
    if (!masterTrackerFile) {
      fileInputRef.current?.click();
    } else {
      handleMasterTrackerUpload();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMasterTrackerFile(e.target.files[0]);
      setMasterTrackerUploadStatus(null);
    }
  };

  const handleMasterTrackerUpload = async () => {
    if (!masterTrackerFile) return;
    setMasterTrackerUploading(true);
    setMasterTrackerUploadStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", masterTrackerFile);
      const res = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/upload-master-tracker', {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setMasterTrackerUploadStatus(`Upload successful! Rows processed: ${data.rows}`);
      } else {
        setMasterTrackerUploadStatus(data.errors?.[0] || "Upload failed");
      }
    } catch (err) {
      setMasterTrackerUploadStatus("Upload failed");
    } finally {
      setMasterTrackerUploading(false);
      setMasterTrackerFile(null);
    }
  };

  const handleDownloadMasterTracker = async () => {
    setDownloadingMasterTracker(true);
    setDownloadMasterTrackerStatus(null);
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/generate-master-tracker');
      if (!res.ok) throw new Error('Failed to download master tracker');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'MasterTracker.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setDownloadMasterTrackerStatus('Download successful!');
    } catch (err: any) {
      setDownloadMasterTrackerStatus('Error downloading master tracker.');
    } finally {
      setDownloadingMasterTracker(false);
    }
  };

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
        setPermitSaveStatus('Error saving permit fields.');
      }
    } catch (err) {
      setPermitSaveStatus('Error saving permit fields.');
    } finally {
      setPermitSaving(false);
    }
  };

  return (
    <div className="w-full mb-8">
      <Card className="bg-[#101624] shadow-2xl border-none p-0 rounded-3xl flex flex-col">
        <CardHeader className="pb-2 flex flex-col gap-2 border-b border-slate-800/60 bg-[#101624]">
          <CardTitle className="text-2xl font-semibold text-white flex items-center gap-2 tracking-normal">
            <FileSpreadsheet className="h-7 w-7 text-blue-400 drop-shadow-lg" />
            <span>Master Tracker Management</span>
          </CardTitle>
          <CardDescription className="text-slate-400 mt-1 text-base font-normal leading-snug">
            Download or upload the consolidated Master Tracker Excel file for all DN, Budget, and PO data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center flex-1 pt-0 pb-8 px-6">
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Download Master Tracker Card */}
            <div className="bg-[#181e2b] rounded-2xl shadow-lg p-4 flex flex-col items-center flex-1 w-full h-full min-w-0 justify-between">
              <FileSpreadsheet className="h-8 w-8 text-white mb-2" />
              <div className="font-bold text-base text-white mb-1">Download Master Tracker</div>
              <div className="text-blue-100 text-xs mb-3 text-center">Download a consolidated Master Tracker Excel file for all DN, Budget, and PO data.</div>
              <a
                href={process.env.NEXT_PUBLIC_BACKEND_URL + '/api/generate-master-tracker'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold hover:from-blue-600 hover:to-blue-800">
                  Download
                </Button>
              </a>
              {downloadMasterTrackerStatus && (
                <div className={`mt-2 text-xs ${downloadMasterTrackerStatus.includes('success') ? 'text-green-400' : 'text-red-400'}`}>{downloadMasterTrackerStatus}</div>
              )}
            </div>
            {/* Upload Master Tracker Card (single button) */}
            <div className="bg-[#181e2b] rounded-2xl shadow-lg p-4 flex flex-col items-center flex-1 w-full h-full min-w-0 justify-between">
              <FileSpreadsheet className="h-8 w-8 text-white mb-2" />
              <div className="font-bold text-base text-white mb-1">Upload Master Tracker</div>
              <div className="text-blue-100 text-xs mb-3 text-center">Upload a Master Tracker Excel file to bulk update all values in the database.</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              {masterTrackerUploadStatus && (
                <div className={`mb-2 text-xs w-full text-center ${masterTrackerUploadStatus.startsWith("Upload successful") ? "text-green-400" : "text-red-400"}`}>
                  {masterTrackerUploadStatus}
                </div>
              )}
              {masterTrackerFile && (
                <div className="mb-2 text-xs text-white truncate w-full text-center font-semibold">{masterTrackerFile.name}</div>
              )}
              <Button
                onClick={handleButtonClick}
                disabled={masterTrackerUploading}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold hover:from-blue-600 hover:to-blue-800"
              >
                {masterTrackerUploading
                  ? "Uploading..."
                  : masterTrackerFile
                  ? "Upload File"
                  : "Choose File"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-[#101624] shadow-2xl border-none p-0 rounded-3xl flex flex-col mb-8 mt-8">
        <CardHeader className="pb-2 flex flex-col gap-2 border-b border-slate-800/60 bg-[#101624]">
          <CardTitle className="text-2xl font-semibold text-white flex items-center gap-2 tracking-normal">
            <Upload className="h-7 w-7 text-blue-400 drop-shadow-lg" />
            <span>Upload Permit PDF</span>
          </CardTitle>
          <CardDescription className="text-slate-400 mt-1 text-base font-normal leading-snug">
            Upload a Permit PDF to extract and review permit details before saving to the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center flex-1 pt-0 pb-8 px-6">
          <form onSubmit={handlePermitUpload} className="w-full flex flex-col items-center gap-4">
            <div
              className="w-full max-w-md bg-[#101624] border-2 border-dashed border-blue-400 rounded-2xl flex flex-col items-center justify-center py-8 px-6 cursor-pointer transition hover:bg-[#16203a] mt-8"
              onClick={() => document.getElementById('permit-file-input')?.click()}
              tabIndex={0}
              role="button"
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { document.getElementById('permit-file-input')?.click(); } }}
            >
              <FileText className="h-12 w-12 text-blue-400 mb-2" />
              <div className="font-semibold text-lg text-white mb-1">Upload Permit PDF</div>
              <div className="text-xs text-slate-400">Supports .pdf files</div>
              <input
                id="permit-file-input"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handlePermitFileChange}
                disabled={permitUploading}
              />
            </div>
            {permitFile && (
              <div className="text-xs text-blue-300 mt-2 truncate w-full text-center">{permitFile.name}</div>
            )}
            <Button
              type="submit"
              className="w-full max-w-md bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold rounded-md px-8 py-4 flex items-center justify-center gap-3 shadow-2xl transition text-lg tracking-wide drop-shadow-lg mt-2"
              disabled={permitUploading}
            >
              {permitUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6 mr-2" />}
              {permitUploading ? 'Uploading...' : 'Upload to Database'}
            </Button>
          </form>
          {permitUploadStatus && (
            <div className={`mt-4 text-sm ${permitUploadStatus.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
              {permitUploadStatus}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Permit Preview Table Section */}
      {permitPreview && permitEdit && (
        <Card className="bg-[#101624] shadow-2xl border-none p-0 rounded-3xl flex flex-col mb-8">
          <CardHeader className="pb-2 flex flex-col gap-2 border-b border-slate-800/60 bg-[#101624]">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2 tracking-normal">
              <FileText className="h-6 w-6 text-blue-400 drop-shadow-lg" />
              <span>Review & Edit Extracted Permit Fields</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-1 pt-0 pb-8 px-6">
            <table className="w-full text-sm text-gray-200 mb-4">
              <thead>
                <tr>
                  <th className="text-left py-2 px-4">Field</th>
                  <th className="text-left py-2 px-4">Value</th>
                </tr>
              </thead>
              <tbody>
                {PERMIT_FIELDS.map(({ key, label }) => (
                  <tr key={key}>
                    <td className="py-2 px-4 font-medium">{label}</td>
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        value={permitEdit[key] ?? ''}
                        onChange={e => handlePermitEditChange(key, e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 w-full text-white"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button
              onClick={handlePermitSave}
              className="mt-2 w-full max-w-xs bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white font-bold rounded-md px-8 py-3 flex items-center justify-center gap-3 shadow-2xl transition text-lg tracking-wide drop-shadow-lg"
              disabled={permitSaving}
            >
              {permitSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <CheckCircle className="h-6 w-6 mr-2" />}
              {permitSaving ? 'Saving...' : 'Save to Database'}
            </Button>
            {permitSaveStatus && (
              <div className={`mt-4 text-sm ${permitSaveStatus.includes('saved') ? 'text-green-400' : 'text-red-400'}`}>
                {permitSaveStatus}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
} 