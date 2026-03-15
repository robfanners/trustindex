"use client";

import { useState, useRef, useEffect } from "react";
import { exportElementToPdf, exportElementToPng } from "@/lib/pdfExport";
import { showActionToast } from "@/components/ui/Toast";

type ExportMenuProps = {
  /** DOM element ID to capture for PDF/PNG export */
  elementId: string;
  /** Base filename (without extension) */
  filename: string;
  /** Function that returns CSV string data */
  csvData?: () => string;
  /** Whether the user's plan allows export */
  planAllowsExport?: boolean;
  /** Optional email subject for share */
  emailSubject?: string;
  /** Optional email body for share */
  emailBody?: string;
};

export default function ExportMenu({
  elementId,
  filename,
  csvData,
  planAllowsExport = true,
  emailSubject = "Verisum Report",
  emailBody = "",
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!planAllowsExport) {
    return (
      <a
        href="/upgrade"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        Upgrade to export
      </a>
    );
  }

  const handleCsv = () => {
    if (!csvData) return;
    const data = csvData();
    const blob = new Blob([data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showActionToast("CSV downloaded");
    setOpen(false);
  };

  const handlePdf = async () => {
    setExporting(true);
    try {
      await exportElementToPdf(elementId, `${filename}.pdf`);
      showActionToast("PDF downloaded");
    } catch {
      showActionToast("PDF export failed");
    } finally {
      setExporting(false);
      setOpen(false);
    }
  };

  const handlePng = async () => {
    setExporting(true);
    try {
      await exportElementToPng(elementId, `${filename}.png`);
      showActionToast("PNG downloaded");
    } catch {
      showActionToast("PNG export failed");
    } finally {
      setExporting(false);
      setOpen(false);
    }
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody || `View the latest ${filename} report at ${window.location.href}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
    setOpen(false);
  };

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        disabled={exporting}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {exporting ? "Exporting..." : "Export"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-lg shadow-lg z-20 py-1 min-w-[180px]">
          {csvData && (
            <button onClick={handleCsv} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export as CSV
            </button>
          )}
          <button onClick={handlePdf} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Export as PDF
          </button>
          <button onClick={handlePng} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Export as PNG
          </button>
          <div className="border-t border-border my-1" />
          <button onClick={handleEmail} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Share via Email
          </button>
        </div>
      )}
    </div>
  );
}
