import { describe, it, expect } from 'vitest';
import { parseLog } from '@/lib/parser';

// Inline JSON fixtures to validate toolId -> ToolCallType mapping for JSON parser

describe('JSON toolId to ToolCallType mapping', () => {
  it('maps applyPatch toolId to patch', () => {
    const fixture = {
      requesterUsername: 'digitarald',
      responderUsername: 'GitHub Copilot',
      requests: [
        {
          requestId: 'req-1',
          message: { text: 'Apply a patch please' },
          response: [
            {
              kind: 'toolInvocationSerialized',
              invocationMessage: 'Using "Apply Patch"',
              pastTenseMessage: 'Using "Apply Patch"',
              toolId: 'copilot_applyPatch',
              toolCallId: 'tc-1',
              isComplete: true,
            },
          ],
        },
      ],
    };

    const result = parseLog(JSON.stringify(fixture));
    const toolCalls = result.messages.flatMap(m => m.contentSegments).filter(s => s.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    const seg = toolCalls[0];
    if (seg.type === 'tool_call') {
      expect(seg.toolCall.type).toBe('patch');
      expect(seg.toolCall.action).toBe('Apply Patch');
    }
  });

  it('maps multiReplaceString toolId to replace', () => {
    const fixture = {
      requesterUsername: 'digitarald',
      responderUsername: 'GitHub Copilot',
      requests: [
        {
          requestId: 'req-2',
          message: { text: 'Do multi replace' },
          response: [
            {
              kind: 'toolInvocationSerialized',
              invocationMessage: 'Using "Multi-Replace String in Files"',
              pastTenseMessage: 'Using "Multi-Replace String in Files"',
              toolId: 'copilot_multiReplaceString',
              toolCallId: 'tc-2',
              isComplete: true,
            },
          ],
        },
      ],
    };

    const result = parseLog(JSON.stringify(fixture));
    const toolCalls = result.messages.flatMap(m => m.contentSegments).filter(s => s.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    const seg = toolCalls[0];
    if (seg.type === 'tool_call') {
      expect(seg.toolCall.type).toBe('replace');
      expect(seg.toolCall.action).toBe('Multi-Replace String in Files');
    }
  });

  it('maps runTests toolId to test (discovering tests)', () => {
    const fixture = {
      requesterUsername: 'digitarald',
      responderUsername: 'GitHub Copilot',
      requests: [
        {
          requestId: 'req-3',
          message: { text: 'Run tests' },
          response: [
            {
              kind: 'toolInvocationSerialized',
              invocationMessage: 'Running tests...',
              pastTenseMessage: 'Discovering tests...',
              toolId: 'runTests',
              toolCallId: 'tc-3',
              isComplete: true,
            },
          ],
        },
      ],
    };

    const result = parseLog(JSON.stringify(fixture));
    const toolCalls = result.messages.flatMap(m => m.contentSegments).filter(s => s.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    const seg = toolCalls[0];
    if (seg.type === 'tool_call') {
      expect(seg.toolCall.type).toBe('test');
      expect(seg.toolCall.action).toBe('Discovering tests...');
    }
  });

  it('maps runTests summary to test type and preserves output formatting', () => {
    const fixture = {
      requesterUsername: 'digitarald',
      responderUsername: 'GitHub Copilot',
      requests: [
        {
          requestId: 'req-4',
          message: { text: 'Run tests summary' },
          response: [
            {
              kind: 'toolInvocationSerialized',
              invocationMessage: 'Running tests...',
              pastTenseMessage: '45/45 tests passed (100%)',
              toolId: 'runTests',
              toolCallId: 'tc-4',
              isComplete: true,
            },
          ],
        },
      ],
    };

    const result = parseLog(JSON.stringify(fixture));
    const toolCalls = result.messages.flatMap(m => m.contentSegments).filter(s => s.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    const seg = toolCalls[0];
    if (seg.type === 'tool_call') {
      expect(seg.toolCall.type).toBe('test');
      expect(seg.toolCall.action).toBe('45/45 tests passed (100%)');
    }
  });
});
