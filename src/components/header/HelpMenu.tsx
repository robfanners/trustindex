"use client";

import { useState, useRef, useEffect } from "react";

export default function HelpMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Help"
        title="Help"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-background border border-border rounded-lg shadow-lg z-50 py-1">
          <a
            href="https://docs.verisum.org"
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            Documentation
          </a>
          <a
            href="mailto:hello@verisum.org"
            className="block px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            Contact Support
          </a>
          <button
            disabled
            className="w-full text-left px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
          >
            {"What's New"}
          </button>
        </div>
      )}
    </div>
  );
}
