import { describe, it, expect } from 'vitest';
import { parseLog } from '@/lib/parser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('fix-deploy.log ordering', () => {
  const samplePath = join(process.cwd(), 'samples', 'fix-deploy.log');
  const logText = readFileSync(samplePath, 'utf-8');
  const parsed = parseLog(logText);

  it('should include an inline code_block segment in correct position', () => {
    const assistantMessages = parsed.messages.filter(m => m.role === 'assistant');
    expect(assistantMessages.length).toBeGreaterThan(0);
    // Use the last assistant message which contains the summary + code block
    const lastAssistant = assistantMessages[assistantMessages.length - 1];
    const segments = lastAssistant.contentSegments;

    const updateTextIndex = segments.findIndex(s => s.type === 'text' && s.content.includes('Updated next.config.js to change:'));
    expect(updateTextIndex).toBeGreaterThan(-1);
    const changesDeployedIndex = segments.findIndex(s => s.type === 'text' && s.content.includes('Changes Deployed'));
    expect(changesDeployedIndex).toBeGreaterThan(updateTextIndex);

    const codeBlockIndex = segments.findIndex((s, i) => s.type === 'code_block' && i > updateTextIndex && i < changesDeployedIndex);
    expect(codeBlockIndex).toBeGreaterThan(-1);

    const hasBasePathBetween = segments.some((s, i) => i >= updateTextIndex && i <= changesDeployedIndex && ((s.type === 'code_block' && s.code.includes("basePath: process.env.NODE_ENV")) || (s.type === 'text' && s.content.includes("basePath: process.env.NODE_ENV"))));
    expect(hasBasePathBetween).toBe(true);
  });
});
