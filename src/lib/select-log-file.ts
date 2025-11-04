import type { GistData, GistFile } from '@/lib/gist-fetcher';

// Prioritized extensions for log-like content.
const PRIORITY_EXTENSIONS = ['.log', '.txt', '.json'] as const;

/**
 * Select the most appropriate log file from a gist's files.
 * Strategy:
 * 1. Filter files by prioritized extensions (.log, .txt, .json)
 * 2. If multiple with same extension group, pick the largest by content length.
 * 3. Extension precedence order as listed in PRIORITY_EXTENSIONS.
 * 4. Fallback: first file (Object.values order) if no prioritized extensions found.
 */
export function selectLogFile(files: Record<string, GistFile>): GistFile | null {
  const allFiles = Object.values(files);
  if (allFiles.length === 0) return null;

  // Group candidates by extension priority.
  const candidatesByExt: Record<string, GistFile[]> = {};
  for (const file of allFiles) {
    const match = PRIORITY_EXTENSIONS.find(ext => file.filename.endsWith(ext));
    if (match) {
      if (!candidatesByExt[match]) candidatesByExt[match] = [];
      candidatesByExt[match].push(file);
    }
  }

  for (const ext of PRIORITY_EXTENSIONS) {
    const group = candidatesByExt[ext];
    if (group && group.length > 0) {
      // Pick largest by content length in this extension group.
      return group.reduce((best, current) =>
        current.content.length > best.content.length ? current : best
      );
    }
  }

  // Fallback to first file (existing behavior baseline).
  return allFiles[0];
}

/** Truncate a filename with a centered ellipsis if it exceeds max length. */
export function truncateFilename(filename: string, maxLength = 40): string {
  if (filename.length <= maxLength) return filename;
  // Keep more at start than end for typical descriptive prefixes.
  const keepStart = Math.floor((maxLength - 1) * 0.6); // 60% start
  const keepEnd = maxLength - 1 - keepStart;
  return `${filename.slice(0, keepStart)}…${filename.slice(-keepEnd)}`;
}

/**
 * Derive display title for a gist view.
 * Order of precedence:
 * 1. Selected log file's (possibly truncated) filename
 * 2. Gist description (if non-empty)
 * 3. Fallback: Truncated gist id
 */
export function deriveDisplayTitle(gist: GistData, selectedFile: GistFile | null): string {
  if (selectedFile) {
    return truncateFilename(selectedFile.filename);
  }
  if (gist.description && gist.description.trim().length > 0) {
    return gist.description.trim();
  }
  return `Gist ${gist.id.slice(0, 8)}…`;
}
