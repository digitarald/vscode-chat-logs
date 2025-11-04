import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseLog } from '@/lib/parser';
import type { ParsedSession, ToolCall } from '@/lib/parser/types';

// Helper: flatten tool calls including subagent nested calls
function flattenToolCalls(session: ParsedSession): ToolCall[] {
  const calls: ToolCall[] = [];
  for (const m of session.messages) {
    for (const seg of m.contentSegments) {
      if (seg.type === 'tool_call') {
        calls.push(seg.toolCall);
        if (seg.toolCall.subAgentCalls && seg.toolCall.subAgentCalls.length) {
          calls.push(...seg.toolCall.subAgentCalls);
        }
      }
    }
  }
  return calls;
}

function countByType(calls: ToolCall[]): Record<string, number> {
  return calls.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {});
}

function isSearchLike(c: ToolCall): boolean {
  return c.type === 'search' || /^Searched\b/.test(c.action || '');
}

describe('sample parity – plan session', () => {
  const samplesDir = path.join(process.cwd(), 'samples');
  const planLogPath = path.join(samplesDir, 'plan.log');
  const planJsonPath = path.join(samplesDir, 'plan.json');

  // Guard: ensure sample files exist
  it('sample files should exist', () => {
    expect(fs.existsSync(planLogPath)).toBe(true);
    expect(fs.existsSync(planJsonPath)).toBe(true);
  });

  const logText = fs.readFileSync(planLogPath, 'utf-8');
  const jsonText = fs.readFileSync(planJsonPath, 'utf-8');

  const parsedText = parseLog(logText);
  const parsedJson = parseLog(jsonText); // auto-detected as JSON

  it('parses both formats producing messages', () => {
    expect(parsedText.messages.length).toBeGreaterThan(0);
    expect(parsedJson.messages.length).toBeGreaterThan(0);
  });

  it('has comparable read/search tool call counts (allowing multi-search splitting)', () => {
    const textCalls = flattenToolCalls(parsedText);
    const jsonCalls = flattenToolCalls(parsedJson);
    const textCounts = countByType(textCalls);
    const jsonCounts = countByType(jsonCalls);

    // Reads: text may include directory or index scans represented as read lines not present in JSON export
    expect(textCounts.read).toBeGreaterThanOrEqual(jsonCounts.read);

    // Searches: compute search-like in JSON (toolId lacks "search" keyword) vs explicit search type in text
    const textSearchCalls = textCalls.filter(c => c.type === 'search');
    const jsonSearchLike = jsonCalls.filter(isSearchLike);
    expect(textSearchCalls.length).toBeGreaterThanOrEqual(jsonSearchLike.length);

    // No unexpected regression: ensure at least one search present
    expect(textSearchCalls.length).toBeGreaterThan(0);
    expect(jsonSearchLike.length).toBeGreaterThan(0);
  });

  it('attaches rawAction and normalizedResultCount parity metadata to search tool calls', () => {
    const textSearchCalls = flattenToolCalls(parsedText).filter(c => c.type === 'search');
    const jsonSearchCalls = flattenToolCalls(parsedJson).filter(c => c.type === 'search' || /^Searched\b/.test(c.rawAction || ''));

    // rawAction should exist for all
    textSearchCalls.forEach(c => expect(c.rawAction).toBeDefined());
    jsonSearchCalls.forEach(c => expect(c.rawAction).toBeDefined());

    // At least one search call in each format should have a numeric normalizedResultCount
    expect(textSearchCalls.some(c => typeof c.normalizedResultCount === 'number')).toBe(true);
    expect(jsonSearchCalls.some(c => typeof c.normalizedResultCount === 'number')).toBe(true);

    // Any zero-result searches should have normalizedResultCount = 0
    const zeroText = textSearchCalls.filter(c => /no results|no matches|0 results/i.test((c.output || c.rawAction || '')));
    zeroText.forEach(c => expect(c.normalizedResultCount).toBe(0));
    const zeroJson = jsonSearchCalls.filter(c => /no results|no matches|0 results/i.test((c.output || c.rawAction || '')));
    zeroJson.forEach(c => expect(c.normalizedResultCount).toBe(0));
  });

  it('normalizes no-results/no-matches outputs in text parser', () => {
    const textCalls = flattenToolCalls(parsedText).filter(c => c.type === 'search');
    // At least one search with 0 results normalization
    const zeroes = textCalls.filter(c => c.output?.startsWith('0 results'));
    expect(zeroes.length).toBeGreaterThan(0);
  });

  it('JSON parser search-like outputs may be absent or raw; tolerate undefined output', () => {
    const jsonSearchLike = flattenToolCalls(parsedJson).filter(isSearchLike);
    const acceptable = jsonSearchLike.some(c => {
      if (!c.output) return true;
      return /(\d+) results/.test(c.output) || c.output.includes('no results');
    });
    expect(acceptable).toBe(true);
  });

  it('subagent calls appear nested only in JSON parsing', () => {
    const textCalls = flattenToolCalls(parsedText);
    const jsonCalls = flattenToolCalls(parsedJson);
    // JSON should include at least one subagent call
    const jsonSub = jsonCalls.filter(c => c.fromSubAgent);
    expect(jsonSub.length).toBeGreaterThan(0);
    // Text version currently should not tag subagent calls
    const textSub = textCalls.filter(c => c.fromSubAgent);
    expect(textSub.length).toBe(0);
  });
});

describe('sample structure – fix-deploy JSON', () => {
  const samplesDir = path.join(process.cwd(), 'samples');
  const fixDeployJsonPath = path.join(samplesDir, 'fix-deploy.json');

  it('sample file exists', () => {
    expect(fs.existsSync(fixDeployJsonPath)).toBe(true);
  });

  const jsonText = fs.readFileSync(fixDeployJsonPath, 'utf-8');
  const parsed = parseLog(jsonText); // JSON detection

  it('parses into a single assistant message containing tool calls', () => {
    expect(parsed.messages.length).toBeGreaterThan(0);
    const toolCalls = flattenToolCalls(parsed).filter(c => c.type);
    expect(toolCalls.length).toBeGreaterThan(5); // heuristic
  });

  it('includes navigate and replace tool calls', () => {
    const calls = flattenToolCalls(parsed);
    expect(calls.some(c => c.type === 'navigate')).toBe(true);
    expect(calls.some(c => c.type === 'replace')).toBe(true);
  });

  it('captures at least one screenshot and page snapshot artifact', () => {
    const calls = flattenToolCalls(parsed);
    const screenshotCall = calls.find(c => c.type === 'screenshot');
    expect(screenshotCall).toBeTruthy();
    const navigateWithSnapshot = calls.find(c => c.type === 'navigate' && c.pageSnapshot);
    expect(navigateWithSnapshot).toBeTruthy();
  });

  it('includes run/terminal tool calls for build/deploy steps', () => {
    const calls = flattenToolCalls(parsed);
    expect(calls.some(c => c.type === 'run')).toBe(true);
  });

  it('replace tool calls (JSON) expose fileEdits when available', () => {
    const calls = flattenToolCalls(parsed);
    const replaceCalls = calls.filter(c => c.type === 'replace');
    // Some replace operations may not produce fileEdits array, but at least one should
    const withEdits = replaceCalls.filter(c => c.fileEdits && c.fileEdits.length > 0);
    expect(replaceCalls.length).toBeGreaterThan(0);
    expect(withEdits.length).toBeGreaterThan(0);
  });
});
