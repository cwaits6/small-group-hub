"use server";

import { ServerBlockNoteEditor } from "@blocknote/server-util";
import type { PartialBlock } from "@blocknote/core";

// `ServerBlockNoteEditor` renders blocks to HTML using jsdom, which depends on
// Node built-ins and therefore cannot be bundled into a client component. This
// server action keeps that work on the server; callers sanitize the returned
// HTML on the client before injecting it.
export async function renderBlocksToFullHTML(
  blocks: PartialBlock[],
): Promise<string> {
  return ServerBlockNoteEditor.create().blocksToFullHTML(blocks);
}
