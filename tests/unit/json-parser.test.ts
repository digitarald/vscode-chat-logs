import { describe, it, expect } from 'vitest';
import { parseJsonLog } from '@/lib/parser/json-parser';
import { detectLogFormat } from '@/lib/parser/format-detector';

describe('JSON Parser', () => {
  describe('detectLogFormat', () => {
    it('should detect JSON format', () => {
      const jsonLog = JSON.stringify({
        requesterUsername: 'test',
        responderUsername: 'Copilot',
        requests: [],
      });
      expect(detectLogFormat(jsonLog)).toBe('json');
    });

    it('should detect text format', () => {
      const textLog = 'digitarald: Hello\nGitHub Copilot: Hi there';
      expect(detectLogFormat(textLog)).toBe('text');
    });

    it('should handle invalid JSON as text', () => {
      const invalidJson = '{ invalid json }';
      expect(detectLogFormat(invalidJson)).toBe('text');
    });
  });

  describe('parseJsonLog', () => {
    it('should parse basic user and assistant messages', () => {
      const jsonLog = JSON.stringify({
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'req-1',
            message: {
              text: 'Test message',
            },
            response: [
              {
                value: 'Response text',
              },
            ],
          },
        ],
      });

      const result = parseJsonLog(jsonLog);
      
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].contentSegments[0]).toMatchObject({
        type: 'text',
        content: 'Test message',
      });
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[1].contentSegments[0]).toMatchObject({
        type: 'text',
        content: 'Response text',
      });
    });

    it('should parse tool calls from serialized format', () => {
      const jsonLog = JSON.stringify({
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'req-1',
            message: { text: 'Navigate to URL' },
            response: [
              {
                kind: 'toolInvocationSerialized',
                toolId: 'mcp_microsoft_pla_browser_navigate',
                toolCallId: 'call-123',
                invocationMessage: { value: 'Running Navigate to a URL' },
                pastTenseMessage: { value: 'Ran Navigate to a URL' },
                isComplete: true,
                source: {
                  type: 'mcp',
                  serverLabel: 'Playwright',
                  label: 'microsoft/playwright-mcp',
                },
                resultDetails: {
                  input: '{\n  "url": "http://localhost:3000"\n}',
                  output: [
                    {
                      type: 'embed',
                      value: '### Ran Playwright code\n```js\nawait page.goto(\'http://localhost:3000\');\n```\n',
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      const result = parseJsonLog(jsonLog);
      
      expect(result.messages[1].contentSegments).toHaveLength(1);
      const toolSegment = result.messages[1].contentSegments[0];
      expect(toolSegment.type).toBe('tool_call');
      
      if (toolSegment.type === 'tool_call') {
        expect(toolSegment.toolCall.type).toBe('navigate');
        expect(toolSegment.toolCall.action).toBe('Ran Navigate to a URL');
        expect(toolSegment.toolCall.toolCallId).toBe('call-123');
        expect(toolSegment.toolCall.mcpServer).toBe('Playwright');
        expect(toolSegment.toolCall.status).toBe('completed');
      }
    });

    it('should extract screenshots from tool results', () => {
      const jsonLog = JSON.stringify({
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'req-1',
            message: { text: 'Take screenshot' },
            response: [
              {
                kind: 'toolInvocationSerialized',
                toolId: 'mcp_microsoft_pla_browser_take_screenshot',
                toolCallId: 'call-456',
                invocationMessage: 'Running Take a screenshot',
                isComplete: true,
                resultDetails: {
                  output: [
                    {
                      type: 'embed',
                      mimeType: 'image/png',
                      value: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      const result = parseJsonLog(jsonLog);
      const toolSegment = result.messages[1].contentSegments[0];
      
      if (toolSegment.type === 'tool_call') {
        expect(toolSegment.toolCall.screenshot).toBeDefined();
        expect(toolSegment.toolCall.screenshot).toContain('iVBOR');
      }
    });

    it('should extract console output from tool results', () => {
      const jsonLog = JSON.stringify({
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'req-1',
            message: { text: 'Click button' },
            response: [
              {
                kind: 'toolInvocationSerialized',
                toolId: 'mcp_microsoft_pla_browser_click',
                toolCallId: 'call-789',
                pastTenseMessage: 'Ran Click',
                isComplete: true,
                resultDetails: {
                  output: [
                    {
                      type: 'embed',
                      value: '### New console messages\n- [ERROR] Failed to load resource\n- [LOG] App loaded\n- [WARN] Deprecated API',
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      const result = parseJsonLog(jsonLog);
      const toolSegment = result.messages[1].contentSegments[0];
      
      if (toolSegment.type === 'tool_call') {
        expect(toolSegment.toolCall.consoleOutput).toBeDefined();
        expect(toolSegment.toolCall.consoleOutput).toHaveLength(3);
        expect(toolSegment.toolCall.consoleOutput![0]).toContain('[ERROR]');
        expect(toolSegment.toolCall.consoleOutput![1]).toContain('[LOG]');
        expect(toolSegment.toolCall.consoleOutput![2]).toContain('[WARN]');
      }
    });

    it('should extract page snapshots from tool results', () => {
      const jsonLog = JSON.stringify({
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'req-1',
            message: { text: 'Verify page' },
            response: [
              {
                kind: 'toolInvocationSerialized',
                toolId: 'mcp_microsoft_pla_browser_click',
                toolCallId: 'call-abc',
                pastTenseMessage: 'Ran Click',
                isComplete: true,
                resultDetails: {
                  output: [
                    {
                      type: 'embed',
                      value: '### Page state\n```yaml\n- button [ref=e1]:\n  - text: "Click me"\n```\n',
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      const result = parseJsonLog(jsonLog);
      const toolSegment = result.messages[1].contentSegments[0];
      
      if (toolSegment.type === 'tool_call') {
        expect(toolSegment.toolCall.pageSnapshot).toBeDefined();
        expect(toolSegment.toolCall.pageSnapshot).toContain('button [ref=e1]');
      }
    });

    it('should parse variable data attached to user messages', () => {
      const jsonLog = JSON.stringify({
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'req-1',
            message: { text: 'Fix this code' },
            variableData: {
              variables: [
                {
                  kind: 'file',
                  name: 'file:cart-context.tsx',
                  modelDescription: "User's active selection",
                  value: { uri: { path: '/path/to/file.tsx' } },
                },
                {
                  kind: 'promptFile',
                  name: 'prompt:AGENTS.md',
                  modelDescription: 'Prompt instructions file',
                },
              ],
            },
            response: [],
          },
        ],
      });

      const result = parseJsonLog(jsonLog);
      
      expect(result.messages[0].variableData).toBeDefined();
      expect(result.messages[0].variableData).toHaveLength(2);
      expect(result.messages[0].variableData![0]).toMatchObject({
        kind: 'file',
        name: 'file:cart-context.tsx',
        description: "User's active selection",
      });
    });

    it('should interleave text and tool calls correctly', () => {
      const jsonLog = JSON.stringify({
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'req-1',
            message: { text: 'Test' },
            response: [
              { value: 'Starting test' },
              {
                kind: 'toolInvocationSerialized',
                toolId: 'copilot_readFile',
                toolCallId: 'call-1',
                pastTenseMessage: 'Read file.tsx',
                isComplete: true,
              },
              { value: 'File read successfully' },
              {
                kind: 'toolInvocationSerialized',
                toolId: 'mcp_navigate',
                toolCallId: 'call-2',
                pastTenseMessage: 'Navigated to URL',
                isComplete: true,
              },
              { value: 'Done' },
            ],
          },
        ],
      });

      const result = parseJsonLog(jsonLog);
      const segments = result.messages[1].contentSegments;
      
      expect(segments).toHaveLength(5);
      expect(segments[0].type).toBe('text');
      expect(segments[1].type).toBe('tool_call');
      expect(segments[2].type).toBe('text');
      expect(segments[3].type).toBe('tool_call');
      expect(segments[4].type).toBe('text');
    });

    it('should mark subagent tool calls', () => {
      const jsonLog = JSON.stringify({
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'req-1',
            message: { text: 'Run tests' },
            response: [
              {
                kind: 'toolInvocationSerialized',
                toolId: 'copilot_readFile',
                toolCallId: 'call-sub',
                pastTenseMessage: 'Read test file',
                isComplete: true,
                fromSubAgent: true,
              },
            ],
          },
        ],
      });

      const result = parseJsonLog(jsonLog);
      const toolSegment = result.messages[1].contentSegments[0];
      
      if (toolSegment.type === 'tool_call') {
        expect(toolSegment.toolCall.action).toContain('[Subagent]');
      }
    });

    it('should handle empty requests array', () => {
      const jsonLog = JSON.stringify({
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [],
      });

      const result = parseJsonLog(jsonLog);
      expect(result.messages).toHaveLength(0);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => parseJsonLog('invalid json')).toThrow('Invalid JSON chat export format');
    });

    it('should handle missing response array', () => {
      const jsonLog = JSON.stringify({
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'req-1',
            message: { text: 'Question' },
          },
        ],
      });

      const result = parseJsonLog(jsonLog);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
    });

    it('should extract filename from read file actions', () => {
      const jsonLog = JSON.stringify({
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'req-1',
            message: { text: 'Read file' },
            response: [
              {
                kind: 'toolInvocationSerialized',
                toolId: 'vscode_copilot_read_file',
                toolCallId: 'call-789',
                pastTenseMessage: 'Read [](file:///Users/test/project/src/components/Button.tsx)',
                isComplete: true,
              },
            ],
          },
        ],
      });

      const result = parseJsonLog(jsonLog);
      const toolSegment = result.messages[1].contentSegments[0];
      
      if (toolSegment.type === 'tool_call') {
        expect(toolSegment.toolCall.type).toBe('read');
        expect(toolSegment.toolCall.action).toBe('Read Button.tsx');
        expect(toolSegment.toolCall.input).toBe('/Users/test/project/src/components/Button.tsx');
      }
    });

    it('should handle read file actions without markdown links', () => {
      const jsonLog = JSON.stringify({
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'req-1',
            message: { text: 'Read file' },
            response: [
              {
                kind: 'toolInvocationSerialized',
                toolId: 'vscode_copilot_read_file',
                toolCallId: 'call-790',
                pastTenseMessage: 'Read the file',
                isComplete: true,
              },
            ],
          },
        ],
      });

      const result = parseJsonLog(jsonLog);
      const toolSegment = result.messages[1].contentSegments[0];
      
      if (toolSegment.type === 'tool_call') {
        expect(toolSegment.toolCall.type).toBe('read');
        expect(toolSegment.toolCall.action).toBe('Read the file');
      }
    });
  });
});
