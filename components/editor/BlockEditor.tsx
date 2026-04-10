"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";
import "./BlockEditor.css";
import { BlockNoteEditor, type Block, type PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/shadcn";
import { useMemo } from "react";

interface BlockEditorProps {
  initialContent?: PartialBlock[];
  onChange?: (blocks: Block[]) => void;
  editable?: boolean;
}

export default function BlockEditor({
  initialContent,
  onChange,
  editable = true,
}: BlockEditorProps) {
  const editor = useMemo(() => {
    return BlockNoteEditor.create({
      initialContent: initialContent?.length ? initialContent : undefined,
    });
  }, []);

  return (
    <BlockNoteView
      editor={editor}
      editable={editable}
      onChange={() => onChange?.(editor.document)}
      theme="light"
    />
  );
}
