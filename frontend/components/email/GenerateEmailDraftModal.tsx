"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input as UITextInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "@/msalConfig";
import { FiMail } from "react-icons/fi";

// Utility to generate HTML table from summary data
function generateSummaryTableHTML(summaryRow: Record<string, any>) {
  if (!summaryRow) return '';
  const headers = [
    'Demand Note Reference number',
    'Section Length (Mtr.)',
    'EXECUTION PARTNER NAME',
    'Route Name(As per CWIP)',
    'Section Name for ROW(As per CWIP)',
    'Project Name',
  ];
  const headerLabels = [
    'Demand Note Reference number',
    'Section Length (Mtr.)',
    'Execution Partner Name',
    'Route Name (CWIP)',
    'Section Name for ROW (CWIP)',
    'Project Name',
  ];
  const values = [
    summaryRow['Demand Note Reference number'] || '',
    summaryRow['Section Length (Mtr.)'] || '',
    'Excel Telesonic India Private Limited',
    summaryRow['Route Name(As per CWIP)'] || '',
    summaryRow['Section Name for ROW(As per CWIP)'] || '',
    'Mumbai Fiber Refresh LMC',
  ];
  return `
    <table style="border-collapse:collapse;width:100%;font-family:Inter,Segoe UI,sans-serif;font-size:13px;background:#f8fafc;margin:16px 0;">
      <thead>
        <tr>
          ${headerLabels.map(h => `<th style='border:1px solid #d1d5db;padding:6px 8px;background:#e5e7eb;color:#181e29;text-align:left;'>${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        <tr>
          ${values.map(v => `<td style='border:1px solid #d1d5db;padding:6px 8px;color:#232f47;background:#fff;'>${v}</td>`).join('')}
        </tr>
      </tbody>
    </table>
  `;
}

export default function GenerateEmailDraftModal({ open, onClose, defaultSubject, defaultBody, summaryRow }: {
  open: boolean;
  onClose: () => void;
  defaultSubject?: string;
  defaultBody?: string;
  summaryRow?: Record<string, any>;
}) {
  console.log("[MODAL RENDER] GenerateEmailDraftModal rendered. open:", open);
  const { instance, accounts } = useMsal();
  const [to, setTo] = useState("r.sashwat@cloudextel.com");
  const [cc, setCc] = useState("r.sashwat@cloudextel.com");
  const [subject, setSubject] = useState(defaultSubject || "");
  const [body, setBody] = useState(defaultBody || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Autosize textarea on modal open or when defaultBody changes
  useEffect(() => {
    if (open && bodyRef.current) {
      bodyRef.current.style.height = 'auto';
      bodyRef.current.style.height = bodyRef.current.scrollHeight + 'px';
    }
  }, [open, defaultBody]);

  const handleCreateDraft = async () => {
    console.log("handleCreateDraft called");
    try {
      // Split, trim, and filter valid emails (basic check for @)
      const toArr = to
        ? to.split(",").map((email) => email.trim()).filter(email => email && email.includes("@"))
        : [];
      const ccArr = cc
        ? cc.split(",").map((email) => email.trim()).filter(email => email && email.includes("@"))
        : [];
      if (toArr.length === 0) {
        setError("Please enter at least one valid recipient in the To field.");
        return;
      }
      setLoading(true);
      setError("");
      setSuccess(false);
      try {
        const response = await instance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
        const accessToken = response.accessToken;
        console.log("[Graph Access Token]", accessToken);
        // Compose HTML body with summary table
        const tableHTML = generateSummaryTableHTML(summaryRow || {});
        const ending = `Thank you.`;
        // Use the user's input as the main body, append table and ending
        const htmlBody = `${body || ""}<br><br>${tableHTML}<br>${ending}`;
        // Build the correct payload for POST /me/messages
        const toRecipients = toArr.map((address) => ({ emailAddress: { address } }));
        const ccRecipients = ccArr.map((address) => ({ emailAddress: { address } }));
        const emailPayload: any = {
          subject,
          body: {
            contentType: "HTML",
            content: htmlBody,
          },
          toRecipients,
        };
        if (ccRecipients.length > 0) emailPayload.ccRecipients = ccRecipients;
        console.log("[Graph Email Payload]", JSON.stringify(emailPayload, null, 2));
        const res = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailPayload),
        });
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Graph API error:", errorText);
          throw new Error("Failed to create draft: " + errorText);
        }
        setSuccess(true);
      } catch (err: any) {
        setError(err.message || "Unknown error");
        console.error("Draft creation error:", err);
      } finally {
        setLoading(false);
      }
    } catch (outerErr) {
      console.error("handleCreateDraft outer error:", outerErr);
      alert("handleCreateDraft outer error: " + ((outerErr as any)?.message || outerErr));
    }
  };

  if (!open) return null;
  console.log("[MODAL RENDER] Modal JSX will be returned");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-[#151922] rounded-2xl p-8 w-full max-w-lg border border-[#232f47] shadow-xl">
        <h2 className="text-2xl font-semibold text-white mb-6 tracking-tight">Generate Email Draft</h2>
        <div className="space-y-4">
          <div>
            <Label className="text-gray-300 text-sm mb-1 block">To</Label>
            <UITextInput
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="recipient@example.com, recipient2@example.com"
              className="bg-transparent border border-[#232f47] focus:border-blue-500 text-white placeholder-gray-500 rounded-lg px-4 py-2 transition-colors outline-none shadow-none"
              autoFocus
            />
            <div className="text-xs text-gray-400 mt-1 ml-1">Separate multiple addresses with commas</div>
          </div>
          <div>
            <Label className="text-gray-300 text-sm mb-1 block">CC</Label>
            <UITextInput
              value={cc}
              onChange={e => setCc(e.target.value)}
              placeholder="cc1@example.com, cc2@example.com"
              className="bg-transparent border border-[#232f47] focus:border-blue-500 text-white placeholder-gray-500 rounded-lg px-4 py-2 transition-colors outline-none shadow-none"
            />
            <div className="text-xs text-gray-400 mt-1 ml-1">Separate multiple addresses with commas</div>
          </div>
          <div>
            <Label className="text-gray-300 text-sm mb-1 block">Subject</Label>
            <UITextInput
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="bg-transparent border border-[#232f47] focus:border-blue-500 text-white placeholder-gray-500 rounded-lg px-4 py-2 transition-colors outline-none shadow-none"
            />
          </div>
          <div>
            <Label className="text-gray-300 text-sm mb-1 block">Body</Label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={e => {
                setBody(e.target.value);
                if (bodyRef.current) {
                  bodyRef.current.style.height = 'auto';
                  bodyRef.current.style.height = bodyRef.current.scrollHeight + 'px';
                }
              }}
              className="w-full min-h-[80px] max-h-[300px] rounded-lg border border-[#232f47] bg-transparent text-white placeholder-gray-500 px-4 py-2 focus:border-[#232f47] focus:ring-0 outline-none shadow-none resize-none scrollbar-hide"
              style={{ overflow: 'hidden' }}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-8">
          <Button
            onClick={() => { handleCreateDraft(); }}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-white text-[#181e29] font-inter font-medium text-base rounded-lg border-none hover:bg-blue-50 transition-colors px-6 py-3 shadow-none focus:ring-0 focus:border-[#232f47]"
            style={{ boxShadow: "none" }}
          >
            <FiMail className="text-black text-xl" />
            {loading ? "Creating..." : "Create Draft"}
          </Button>
          <Button onClick={onClose} variant="outline" className="border border-[#232f47] text-gray-300 bg-transparent hover:bg-[#232f47]">Cancel</Button>
        </div>
        {success && <div className="mt-4 text-green-400 text-center">Draft created in your Outlook!</div>}
        {error && <div className="mt-4 text-red-400 text-center">{error}</div>}
      </div>
    </div>
  );
}
