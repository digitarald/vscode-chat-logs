import { describe, it, expect } from 'vitest';
import { parseLog } from '@/lib/parser';

describe('search & replace parsing', () => {
  it('parses multi-replace invocation', () => {
    const log = 'GitHub Copilot: Starting\nUsing "Multi-Replace String in Files"\nFinished';
    const result = parseLog(log);
    const assistant = result.messages.find(m => m.role === 'assistant');
    expect(assistant).toBeTruthy();
    const toolSegments = assistant!.contentSegments.filter(s => s.type === 'tool_call');
    expect(toolSegments.length).toBeGreaterThanOrEqual(1);
    const replaceSeg = toolSegments.find(s => s.type === 'tool_call' && s.toolCall.type === 'replace');
    expect(replaceSeg).toBeTruthy();
    if (replaceSeg?.type === 'tool_call') {
      expect(replaceSeg.toolCall.action).toBe('Multi-Replace String in Files');
    }
  });

  it('parses regex search with count', () => {
    const log = 'GitHub Copilot: Search phase\nSearched for regex `View on GitHub|Footer`, 6 results';
    const { messages } = parseLog(log);
    const segs = messages[0].contentSegments.filter(s => s.type === 'tool_call');
    expect(segs).toHaveLength(1);
    if (segs[0].type === 'tool_call') {
      expect(segs[0].toolCall.type).toBe('search');
      expect(segs[0].toolCall.output).toBe('6 results');
      expect(segs[0].toolCall.action).toContain('regex');
    }
  });

  it('parses search with no matches', () => {
    const log = 'GitHub Copilot: Search phase\nSearched for files matching `**/Footer*`, no matches';
    const { messages } = parseLog(log);
    const segs = messages[0].contentSegments.filter(s => s.type === 'tool_call');
    expect(segs).toHaveLength(1);
    if (segs[0].type === 'tool_call') {
      expect(segs[0].toolCall.type).toBe('search');
      expect(segs[0].toolCall.output).toBe('0 results');
    }
  });

  it('splits multi-search line into multiple tool calls', () => {
    const line = 'Searched for regex `search.*icon`|Searched (**/src/components/**), no results';
    const log = `GitHub Copilot: Multi search test\n${line}`;
    const { messages } = parseLog(log);
    const segs = messages[0].contentSegments.filter(s => s.type === 'tool_call');
    expect(segs.length).toBe(2); // Should create two tool calls
    const first = segs[0];
    const second = segs[1];
    if (first.type === 'tool_call') {
      expect(first.toolCall.type).toBe('search');
      expect(first.toolCall.action).toContain('for regex');
    }
    if (second.type === 'tool_call') {
      expect(second.toolCall.type).toBe('search');
      expect(second.toolCall.output).toBe('0 results');
      expect(second.toolCall.action).toContain('src/components');
    }
  });

  it('parses regex search with path filter and no results (unquoted pattern)', () => {
    const log = 'GitHub Copilot: Search phase\nSearched for regex search|Search (**/tests/unit/**), no results';
    const { messages } = parseLog(log);
    const segs = messages[0].contentSegments.filter(s => s.type === 'tool_call');
    expect(segs).toHaveLength(1);
    if (segs[0].type === 'tool_call') {
      expect(segs[0].toolCall.type).toBe('search');
      expect(segs[0].toolCall.output).toBe('0 results');
      expect(segs[0].toolCall.action).toContain('regex search|Search');
      expect(segs[0].toolCall.action).toContain('tests/unit');
    }
  });

  it('parses text search with path filter and no results (pattern contains phrase "no results")', () => {
    const log = 'GitHub Copilot: Search phase\nSearched for text no results (**/samples/**), no results';
    const { messages } = parseLog(log);
    const segs = messages[0].contentSegments.filter(s => s.type === 'tool_call');
    expect(segs).toHaveLength(1);
    if (segs[0].type === 'tool_call') {
      expect(segs[0].toolCall.type).toBe('search');
      expect(segs[0].toolCall.output).toBe('0 results');
      expect(segs[0].toolCall.action).toContain('text no results');
      expect(segs[0].toolCall.action).toContain('samples');
    }
  });
});
