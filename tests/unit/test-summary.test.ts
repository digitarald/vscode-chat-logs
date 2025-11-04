import { describe, it, expect } from 'vitest';
import { parseLog } from '@/lib/parser';

describe('test discovery and summary parsing', () => {
  it('parses discovering tests line', () => {
    const log = 'GitHub Copilot: Phase\nDiscovering tests...';
    const result = parseLog(log);
    const segs = result.messages[0].contentSegments.filter(s => s.type === 'tool_call');
    expect(segs).toHaveLength(1);
    if (segs[0].type === 'tool_call') {
      expect(segs[0].toolCall.type).toBe('test');
      expect(segs[0].toolCall.action).toBe('Discovering tests');
      expect(segs[0].toolCall.status).toBe('pending');
    }
  });

  it('parses test summary line', () => {
    const log = 'GitHub Copilot: Results\n45/45 tests passed (100%)';
    const { messages } = parseLog(log);
    const segs = messages[0].contentSegments.filter(s => s.type === 'tool_call');
    expect(segs).toHaveLength(1);
    if (segs[0].type === 'tool_call') {
      expect(segs[0].toolCall.type).toBe('test');
      expect(segs[0].toolCall.output).toBe('45/45 (100%)');
      expect(segs[0].toolCall.status).toBe('completed');
    }
  });

  it('parses apply patch invocation', () => {
    const log = 'GitHub Copilot: Patch\nUsing "Apply Patch"';
    const { messages } = parseLog(log);
    const segs = messages[0].contentSegments.filter(s => s.type === 'tool_call');
    expect(segs).toHaveLength(1);
    if (segs[0].type === 'tool_call') {
      expect(segs[0].toolCall.type).toBe('patch');
      expect(segs[0].toolCall.action).toBe('Apply Patch');
    }
  });
});
