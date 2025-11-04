// Centralized example Gist definitions for the homepage.
// Keeping this separate makes the homepage component lean and allows
// easy addition of labels, metadata, or future categorization.

export interface ExampleGist {
  id: string; // Raw Gist ID
  label?: string; // Optional human-friendly label
}

export const EXAMPLE_GISTS: readonly ExampleGist[] = [
  {
    id: '3c4369b6b19b509d40460413c8b3a333',
    label: 'UI Review Agent (Log)',
  },
  {
    id: 'bf919251c0c46492ec9b7706cae6b61d',
    label: 'Fix Prod (Log)',
  },
  {
    id: '3acef16f14d94244d1541e62ed2a14ba',
    label: 'Fix Prod (Export)',
  },
  {
    id: '7abc0e372154857152778765a599fea7',
    label: 'Parser Work (Log)',
  },
  {
    id: 'cd0f7f7960921f67255d650b4e70e6bb',
    label: 'Plan (Log)',
  },
  {
    id: 'f46e2bd45968b1b7ca66be00620bea5c',
    label: 'Plan (Export)',
  },
] as const;

/**
 * Truncate a Gist ID for pill display when no label is provided.
 */
export function formatGistId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-5)}`;
}

/**
 * Resolve display label prioritizing explicit label over truncated ID.
 */
export function getExampleLabel(example: ExampleGist): string {
  return example.label ?? formatGistId(example.id);
}
