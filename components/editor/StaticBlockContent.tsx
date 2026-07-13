"use client";

import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import type { PartialBlock } from "@blocknote/core";
import { renderBlocksToFullHTML } from "./renderBlocks";
import "./StaticBlockContent.css";

interface StaticBlockContentProps {
  blocks: PartialBlock[];
}

export function StaticBlockContent({ blocks }: StaticBlockContentProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    renderBlocksToFullHTML(blocks).then((raw) => {
      if (!cancelled) setHtml(DOMPurify.sanitize(raw));
    });
    return () => {
      cancelled = true;
    };
  }, [blocks]);

  if (html === null) {
    return <div className="h-64 rounded-lg border border-input bg-muted/30 animate-pulse" />;
  }

  return <div className="bn-static" dangerouslySetInnerHTML={{ __html: html }} />;
}
