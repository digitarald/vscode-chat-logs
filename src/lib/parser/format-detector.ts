export type LogFormat = 'text' | 'json';

export function detectLogFormat(content: string): LogFormat {
  const trimmed = content.trim();
  
  // Check if it starts with { and looks like JSON
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      // Check for JSON export structure
      if (parsed.requests && Array.isArray(parsed.requests)) {
        return 'json';
      }
    } catch {
      // Not valid JSON, fall through to text
    }
  }
  
  return 'text';
}
