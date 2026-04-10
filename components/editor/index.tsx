"use client";

import dynamic from "next/dynamic";

export const BlockEditor = dynamic(() => import("./BlockEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-64 rounded-lg border border-input bg-muted/30 animate-pulse" />
  ),
});
