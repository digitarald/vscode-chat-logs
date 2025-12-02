import { describe, it, expect } from 'vitest';
import { parseChatReplayLog } from '../../src/lib/parser/chatreplay-parser';
import { detectLogFormat } from '../../src/lib/parser/format-detector';

describe('ChatReplayParser', () => {
  it('detects chatreplay format correctly', () => {
    const chatreplay = JSON.stringify({
      exportedAt: '2025-12-02T08:45:40.568Z',
      totalPrompts: 1,
      totalLogEntries: 5,
      prompts: [],
    });

    expect(detectLogFormat(chatreplay)).toBe('chatreplay');
  });

  it('parses basic chatreplay structure', () => {
    const chatreplay = {
      exportedAt: '2025-12-02T08:45:40.568Z',
      totalPrompts: 1,
      totalLogEntries: 3,
      prompts: [
        {
          prompt: 'What is the meaning of life?',
          hasSeen: false,
          logCount: 2,
          logs: [
            {
              id: 'req_1',
              kind: 'request',
              type: 'ChatMLSuccess',
              name: 'panel/editAgent',
              metadata: {
                model: 'gpt-4',
              },
              response: {
                type: 'success',
                message: ['The meaning of life is 42.'],
              },
            },
          ],
        },
      ],
    };

    const result = parseChatReplayLog(JSON.stringify(chatreplay));

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].contentSegments).toHaveLength(1);
    expect(result.messages[0].contentSegments[0].type).toBe('text');
    expect(result.messages[0].contentSegments[0]).toHaveProperty(
      'content',
      'What is the meaning of life?'
    );

    expect(result.messages[1].role).toBe('assistant');
    expect(result.messages[1].contentSegments).toHaveLength(1);
    expect(result.messages[1].contentSegments[0].type).toBe('text');
    expect(result.messages[1].contentSegments[0]).toHaveProperty(
      'content',
      'The meaning of life is 42.'
    );
  });

  it('parses tool calls in chatreplay format', () => {
    const chatreplay = {
      exportedAt: '2025-12-02T08:45:40.568Z',
      totalPrompts: 1,
      totalLogEntries: 3,
      prompts: [
        {
          prompt: 'Read the README file',
          hasSeen: false,
          logCount: 2,
          logs: [
            {
              id: 'tool_1',
              kind: 'toolCall',
              tool: 'read_file',
              args: JSON.stringify({ filePath: '/workspace/README.md' }),
              time: '2025-12-02T08:30:00.000Z',
              response: ['# My Project\n\nThis is a sample README.'],
            },
          ],
        },
      ],
    };

    const result = parseChatReplayLog(JSON.stringify(chatreplay));

    expect(result.messages).toHaveLength(2);
    expect(result.messages[1].role).toBe('assistant');
    expect(result.messages[1].contentSegments).toHaveLength(1);
    expect(result.messages[1].contentSegments[0].type).toBe('tool_call');

    const toolCall = result.messages[1].contentSegments[0];
    if (toolCall.type === 'tool_call') {
      expect(toolCall.toolCall.type).toBe('read');
      expect(toolCall.toolCall.action).toBe('Read README.md');
      expect(toolCall.toolCall.input).toBe('/workspace/README.md');
      expect(toolCall.toolCall.output).toBe('# My Project\n\nThis is a sample README.');
      expect(toolCall.toolCall.status).toBe('completed');
    }
  });

  it('parses search tool calls with result counts', () => {
    const chatreplay = {
      exportedAt: '2025-12-02T08:45:40.568Z',
      totalPrompts: 1,
      totalLogEntries: 2,
      prompts: [
        {
          prompt: 'Search for function definitions',
          hasSeen: false,
          logCount: 1,
          logs: [
            {
              id: 'tool_search',
              kind: 'toolCall',
              tool: 'grep_search',
              args: JSON.stringify({ query: 'function', isRegexp: false }),
              response: ['Found 5 results'],
            },
          ],
        },
      ],
    };

    const result = parseChatReplayLog(JSON.stringify(chatreplay));

    const toolCall = result.messages[1].contentSegments[0];
    if (toolCall.type === 'tool_call') {
      expect(toolCall.toolCall.type).toBe('search');
      expect(toolCall.toolCall.normalizedResultCount).toBe(5);
    }
  });

  it('handles multiple prompts in one chatreplay', () => {
    const chatreplay = {
      exportedAt: '2025-12-02T08:45:40.568Z',
      totalPrompts: 2,
      totalLogEntries: 4,
      prompts: [
        {
          prompt: 'First question',
          hasSeen: false,
          logCount: 1,
          logs: [
            {
              id: 'req_1',
              kind: 'request',
              type: 'ChatMLSuccess',
              name: 'panel/editAgent',
              response: {
                type: 'success',
                message: ['First answer'],
              },
            },
          ],
        },
        {
          prompt: 'Second question',
          hasSeen: false,
          logCount: 1,
          logs: [
            {
              id: 'req_2',
              kind: 'request',
              type: 'ChatMLSuccess',
              name: 'panel/editAgent',
              response: {
                type: 'success',
                message: ['Second answer'],
              },
            },
          ],
        },
      ],
    };

    const result = parseChatReplayLog(JSON.stringify(chatreplay));

    expect(result.messages).toHaveLength(4);
    expect(result.messages[0].contentSegments[0]).toHaveProperty('content', 'First question');
    expect(result.messages[1].contentSegments[0]).toHaveProperty('content', 'First answer');
    expect(result.messages[2].contentSegments[0]).toHaveProperty('content', 'Second question');
    expect(result.messages[3].contentSegments[0]).toHaveProperty('content', 'Second answer');
  });

  it('handles terminal commands', () => {
    const chatreplay = {
      exportedAt: '2025-12-02T08:45:40.568Z',
      totalPrompts: 1,
      totalLogEntries: 1,
      prompts: [
        {
          prompt: 'Run npm test',
          hasSeen: false,
          logCount: 1,
          logs: [
            {
              id: 'tool_run',
              kind: 'toolCall',
              tool: 'run_in_terminal',
              args: JSON.stringify({ command: 'npm test', explanation: 'Running tests' }),
              response: ['All tests passed'],
            },
          ],
        },
      ],
    };

    const result = parseChatReplayLog(JSON.stringify(chatreplay));

    const toolCall = result.messages[1].contentSegments[0];
    if (toolCall.type === 'tool_call') {
      expect(toolCall.toolCall.type).toBe('run');
      expect(toolCall.toolCall.action).toBe('Run npm test');
      expect(toolCall.toolCall.input).toBe('npm test');
      expect(toolCall.toolCall.output).toBe('All tests passed');
    }
  });

  it('handles subagent tool calls', () => {
    const chatreplay = {
      exportedAt: '2025-12-02T08:45:40.568Z',
      totalPrompts: 1,
      totalLogEntries: 1,
      prompts: [
        {
          prompt: 'Analyze the codebase',
          hasSeen: false,
          logCount: 1,
          logs: [
            {
              id: 'tool_subagent',
              kind: 'toolCall',
              tool: 'runSubagent',
              args: JSON.stringify({
                prompt: 'Find all TypeScript files',
                description: 'Search for TS files',
              }),
              response: ['Found 42 TypeScript files'],
            },
          ],
        },
      ],
    };

    const result = parseChatReplayLog(JSON.stringify(chatreplay));

    const toolCall = result.messages[1].contentSegments[0];
    if (toolCall.type === 'tool_call') {
      expect(toolCall.toolCall.type).toBe('subagent');
      expect(toolCall.toolCall.action).toBe('Search for TS files');
      expect(toolCall.toolCall.isSubagentRoot).toBe(true);
      expect(toolCall.toolCall.input).toBe('Find all TypeScript files');
    }
  });

  it('preserves segment ordering', () => {
    const chatreplay = {
      exportedAt: '2025-12-02T08:45:40.568Z',
      totalPrompts: 1,
      totalLogEntries: 4,
      prompts: [
        {
          prompt: 'Mixed content test',
          hasSeen: false,
          logCount: 3,
          logs: [
            {
              id: 'req_1',
              kind: 'request',
              type: 'ChatMLSuccess',
              name: 'panel/editAgent',
              response: {
                type: 'success',
                message: ['First text'],
              },
            },
            {
              id: 'tool_1',
              kind: 'toolCall',
              tool: 'read_file',
              args: JSON.stringify({ filePath: '/test.txt' }),
              response: ['file content'],
            },
            {
              id: 'req_2',
              kind: 'request',
              type: 'ChatMLSuccess',
              name: 'panel/editAgent',
              response: {
                type: 'success',
                message: ['Second text'],
              },
            },
          ],
        },
      ],
    };

    const result = parseChatReplayLog(JSON.stringify(chatreplay));

    expect(result.messages[1].contentSegments).toHaveLength(3);
    expect(result.messages[1].contentSegments[0].type).toBe('text');
    expect(result.messages[1].contentSegments[0].order).toBe(0);
    expect(result.messages[1].contentSegments[1].type).toBe('tool_call');
    expect(result.messages[1].contentSegments[1].order).toBe(1);
    expect(result.messages[1].contentSegments[2].type).toBe('text');
    expect(result.messages[1].contentSegments[2].order).toBe(2);
  });

  it('parses thinking segments from response content', () => {
    const chatreplay = {
      exportedAt: '2025-12-02T08:45:40.568Z',
      totalPrompts: 1,
      totalLogEntries: 1,
      prompts: [
        {
          prompt: 'Test thinking',
          hasSeen: false,
          logCount: 1,
          logs: [
            {
              id: 'req_1',
              kind: 'request',
              type: 'ChatMLSuccess',
              name: 'panel/editAgent',
              response: {
                type: 'success',
                message: [],
                content: [
                  {
                    type: 2,
                    value: {
                      type: 'thinking',
                      thinking: {
                        id: 'think_1',
                        text: 'This is my reasoning process...',
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = parseChatReplayLog(JSON.stringify(chatreplay));

    expect(result.messages).toHaveLength(2);
    expect(result.messages[1].contentSegments).toHaveLength(1);
    expect(result.messages[1].contentSegments[0].type).toBe('thinking');
    if (result.messages[1].contentSegments[0].type === 'thinking') {
      expect(result.messages[1].contentSegments[0].content).toBe('This is my reasoning process...');
    }
  });
});
