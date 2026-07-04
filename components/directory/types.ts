import type { GroupChip } from "@/lib/types";

/** Group row loaded for the directory page (chips + Groups view) */
export interface DirectoryGroup extends GroupChip {
  description: string | null;
  show_in_directory_filter: boolean;
}
