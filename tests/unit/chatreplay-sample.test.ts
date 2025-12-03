import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseLog } from '../../src/lib/parser';

describe('ChatReplay Sample File', () => {
  it('parses the actual chatreplay sample file', () => {
    const samplePath = join(process.cwd(), 'samples', 'remove-tests.chatreplay.json');
    const content = readFileSync(samplePath, 'utf-8');

    const result = parseLog(content);

    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.totalMessages).toBeGreaterThan(0);
  });

  it('detects tool calls in chatreplay sample', () => {
    const samplePath = join(process.cwd(), 'samples', 'remove-tests.chatreplay.json');
    const content = readFileSync(samplePath, 'utf-8');

    const result = parseLog(content);

    const toolCalls = result.messages.flatMap((msg) =>
      msg.contentSegments.filter((seg) => seg.type === 'tool_call')
    );

    expect(toolCalls.length).toBeGreaterThan(0);
  });

  it('parses user prompts from chatreplay', () => {
    const samplePath = join(process.cwd(), 'samples', 'remove-tests.chatreplay.json');
    const content = readFileSync(samplePath, 'utf-8');

    const result = parseLog(content);

    const userMessages = result.messages.filter((msg) => msg.role === 'user');
    expect(userMessages.length).toBeGreaterThan(0);

    // Check that user messages have content
    userMessages.forEach((msg) => {
      expect(msg.contentSegments.length).toBeGreaterThan(0);
      const firstSegment = msg.contentSegments[0];
      expect(firstSegment.type).toBe('text');
      if (firstSegment.type === 'text') {
        expect(firstSegment.content).toBeTruthy();
      }
    });
  });

  it('maintains proper segment ordering in chatreplay', () => {
    const samplePath = join(process.cwd(), 'samples', 'remove-tests.chatreplay.json');
    const content = readFileSync(samplePath, 'utf-8');

    const result = parseLog(content);

    result.messages.forEach((msg) => {
      const orders = msg.contentSegments.map((seg) => seg.order);
      // Check that orders are sequential starting from 0
      orders.forEach((order, index) => {
        expect(order).toBe(index);
      });
    });
  });
});
