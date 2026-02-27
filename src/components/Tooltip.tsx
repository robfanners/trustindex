"use client";

import { useState, type ReactNode } from "react";

type Props = {
  content: string;
  children: ReactNode;
};

export default function Tooltip({ content, children }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded bg-foreground text-background text-xs whitespace-nowrap z-50 shadow-lg pointer-events-none">
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
        </span>
      )}
    </span>
  );
}
