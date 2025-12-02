import { describe, it, expect } from 'vitest';
import { parseLog } from '@/lib/parser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Thinking Sample Parsing (thinking.json)', () => {
  const getThinkingSample = () => {
    const samplePath = join(process.cwd(), 'samples', 'thinking.json');
    return readFileSync(samplePath, 'utf-8');
  };

  it('should parse thinking.json and produce messages', () => {
    const jsonContent = getThinkingSample();
    const result = parseLog(jsonContent);

    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.totalMessages).toBe(result.messages.length);
  });

  it('should extract thinking segments from response', () => {
    const jsonContent = getThinkingSample();
    const result = parseLog(jsonContent);

    // Find all thinking segments
    const thinkingSegments = result.messages
      .flatMap((m) => m.contentSegments)
      .filter((seg) => seg.type === 'thinking');

    // Should have thinking segments (each request has thinking content)
    expect(thinkingSegments.length).toBeGreaterThan(0);
  });

  it('should have thinking segments in assistant messages only', () => {
    const jsonContent = getThinkingSample();
    const result = parseLog(jsonContent);

    // User messages should not have thinking segments
    const userMessages = result.messages.filter((m) => m.role === 'user');
    for (const msg of userMessages) {
      const hasThinking = msg.contentSegments.some((seg) => seg.type === 'thinking');
      expect(hasThinking).toBe(false);
    }

    // Assistant messages may have thinking segments
    const assistantMessages = result.messages.filter((m) => m.role === 'assistant');
    const assistantThinkingSegments = assistantMessages.flatMap((m) =>
      m.contentSegments.filter((seg) => seg.type === 'thinking')
    );

    expect(assistantThinkingSegments.length).toBeGreaterThan(0);
  });

  it('should have non-empty content in thinking segments', () => {
    const jsonContent = getThinkingSample();
    const result = parseLog(jsonContent);

    const thinkingSegments = result.messages
      .flatMap((m) => m.contentSegments)
      .filter((seg) => seg.type === 'thinking');

    for (const seg of thinkingSegments) {
      if (seg.type === 'thinking') {
        expect(seg.content).toBeDefined();
        expect(typeof seg.content).toBe('string');
        expect(seg.content.length).toBeGreaterThan(0);
      }
    }
  });

  it('should preserve order of thinking, tool_call, and text segments', () => {
    const jsonContent = getThinkingSample();
    const result = parseLog(jsonContent);

    // First assistant message should have: thinking, tool_call(s), text
    const firstAssistant = result.messages.find((m) => m.role === 'assistant');
    expect(firstAssistant).toBeDefined();

    if (firstAssistant) {
      const segments = firstAssistant.contentSegments;
      expect(segments.length).toBeGreaterThan(0);

      // First segment should be thinking
      expect(segments[0].type).toBe('thinking');

      // Should have tool calls
      const hasToolCall = segments.some((seg) => seg.type === 'tool_call');
      expect(hasToolCall).toBe(true);

      // Should have text
      const hasText = segments.some((seg) => seg.type === 'text');
      expect(hasText).toBe(true);
    }
  });

  it('should skip empty thinking items and done markers', () => {
    const jsonContent = getThinkingSample();

    // Parse raw JSON to count all thinking items
    const rawData = JSON.parse(jsonContent);
    const firstRequest = rawData.requests[0];
    const allThinkingItems = firstRequest.response.filter(
      (item: { kind?: string }) => item.kind === 'thinking'
    );

    // There are 4 thinking items in the first response:
    // - 1 with actual content
    // - 2 with empty value
    // - 1 with empty value and vscodeReasoningDone: true
    expect(allThinkingItems.length).toBe(4);

    // Parse with our parser
    const result = parseLog(jsonContent);

    // First assistant message thinking segments
    const firstAssistant = result.messages.find((m) => m.role === 'assistant');
    const thinkingSegments = firstAssistant?.contentSegments.filter(
      (seg) => seg.type === 'thinking'
    );

    // Should only have 1 thinking segment (the one with actual content)
    expect(thinkingSegments?.length).toBe(1);
  });

  it('should handle subagent tool calls with nested fromSubAgent calls', () => {
    const jsonContent = getThinkingSample();
    const result = parseLog(jsonContent);

    const toolCallSegments = result.messages
      .flatMap((m) => m.contentSegments)
      .filter((seg) => seg.type === 'tool_call')
      .map((seg) => (seg.type === 'tool_call' ? seg.toolCall : null))
      .filter((tc) => tc !== null);

    // Should have tool calls
    expect(toolCallSegments.length).toBeGreaterThan(0);

    // Should have subagent tool call
    const subagentCalls = toolCallSegments.filter((tc) => tc?.type === 'subagent');
    expect(subagentCalls.length).toBeGreaterThan(0);

    // Subagent call should have nested subAgentCalls
    const firstSubagent = subagentCalls[0];
    expect(firstSubagent).toBeDefined();

    if (firstSubagent) {
      // The subagent call should have nested calls marked with fromSubAgent
      expect(firstSubagent.subAgentCalls).toBeDefined();
      expect(Array.isArray(firstSubagent.subAgentCalls)).toBe(true);
      expect(firstSubagent.subAgentCalls!.length).toBeGreaterThan(0);

      // Each nested call should be marked as fromSubAgent
      for (const nestedCall of firstSubagent.subAgentCalls!) {
        expect(nestedCall.fromSubAgent).toBe(true);
      }
    }
  });
});
