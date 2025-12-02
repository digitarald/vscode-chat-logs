export type LogFormat = 'text' | 'json' | 'chatreplay';

export function detectLogFormat(content: string): LogFormat {
  const trimmed = content.trim();

  // Check if it starts with { and looks like JSON
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(content);

      // Check for chatreplay format (VS Code chat replay export)
      if (parsed.prompts && Array.isArray(parsed.prompts) && parsed.exportedAt) {
        return 'chatreplay';
      }

      // Check for JSON export structure (older format)
      if (parsed.requests && Array.isArray(parsed.requests)) {
        return 'json';
      }
    } catch {
      // Not valid JSON, fall through to text
    }
  }

  return 'text';
}
