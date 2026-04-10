"use client";

import { BlockEditor } from "@/components/editor";
import type { PartialBlock } from "@blocknote/core";

interface PageRendererProps {
  body: string;
}

export function PageRenderer({ body }: PageRendererProps) {
  let blocks: PartialBlock[] | undefined;
  try {
    blocks = JSON.parse(body) as PartialBlock[];
  } catch {
    blocks = undefined;
  }

  if (!blocks?.length) {
    return <p className="text-lg text-muted-foreground">This page has no content yet.</p>;
  }

  return <BlockEditor initialContent={blocks} editable={false} />;
}
