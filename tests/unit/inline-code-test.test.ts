import { describe, it, expect } from 'vitest';
import { parseLog } from '@/lib/parser';

describe('Inline code blocks in messages', () => {
  describe('Regular inline code (backticks in text)', () => {
    it('should preserve inline backticks in user messages', () => {
      const jsonLog = {
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'test-1',
            message: {
              text: 'Built with ❤️ by `@digitarald` (link to x and github profile)',
            },
            response: [
              {
                value: 'I will help you with that.',
              },
            ],
          },
        ],
      };

      const result = parseLog(JSON.stringify(jsonLog));
      
      expect(result.messages).toHaveLength(2);
      
      // User message should preserve backticks exactly as written
      const userMessage = result.messages[0];
      expect(userMessage.role).toBe('user');
      expect(userMessage.contentSegments).toHaveLength(1);
      expect(userMessage.contentSegments[0].type).toBe('text');
      
      if (userMessage.contentSegments[0].type === 'text') {
        expect(userMessage.contentSegments[0].content).toBe(
          'Built with ❤️ by `@digitarald` (link to x and github profile)'
        );
      }
    });

    it('should preserve inline backticks in assistant messages for markdown rendering', () => {
      const jsonLog = {
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'test-1',
            message: {
              text: 'Test',
            },
            response: [
              {
                value: 'You can use the `console.log()` function to debug.',
              },
            ],
          },
        ],
      };

      const result = parseLog(JSON.stringify(jsonLog));
      
      const assistantMessage = result.messages[1];
      expect(assistantMessage.role).toBe('assistant');
      expect(assistantMessage.contentSegments).toHaveLength(1);
      
      const textSegment = assistantMessage.contentSegments[0];
      expect(textSegment.type).toBe('text');
      if (textSegment.type === 'text') {
        // Backticks preserved for react-markdown to render as <code>
        expect(textSegment.content).toBe('You can use the `console.log()` function to debug.');
      }
    });

    it('should handle multiple inline code blocks in same message', () => {
      const jsonLog = {
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'test-1',
            message: {
              text: 'Use `npm install` then run `npm start` to begin',
            },
            response: [
              {
                value: 'Run `git add .` and then `git commit -m "message"` to commit.',
              },
            ],
          },
        ],
      };

      const result = parseLog(JSON.stringify(jsonLog));
      
      // User message
      const userMessage = result.messages[0];
      const userTextSegment = userMessage.contentSegments[0];
      expect(userTextSegment.type).toBe('text');
      if (userTextSegment.type === 'text') {
        expect(userTextSegment.content).toContain('`npm install`');
        expect(userTextSegment.content).toContain('`npm start`');
      }
      
      // Assistant message
      const assistantMessage = result.messages[1];
      const assistantTextSegment = assistantMessage.contentSegments[0];
      expect(assistantTextSegment.type).toBe('text');
      if (assistantTextSegment.type === 'text') {
        expect(assistantTextSegment.content).toContain('`git add .`');
        expect(assistantTextSegment.content).toContain('`git commit -m "message"`');
      }
    });
  });

  describe('JSON inlineReference kind (VS Code export format)', () => {
    it('should merge inlineReference segments into continuous text without line breaks', () => {
      const jsonLog = {
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'test-1',
            message: {
              text: 'Test',
            },
            response: [
              {
                value: 'The function queries a non-existent ',
              },
              {
                kind: 'inlineReference',
                inlineReference: {
                  name: 'stock',
                },
              },
              {
                value: ' column from the table.',
              },
            ],
          },
        ],
      };

      const result = parseLog(JSON.stringify(jsonLog));
      
      expect(result.messages).toHaveLength(2);
      
      const assistantMessage = result.messages[1];
      expect(assistantMessage.role).toBe('assistant');
      
      // CRITICAL: Should have 1 merged segment, not 3 separate ones
      // This prevents extra line breaks in rendering
      expect(assistantMessage.contentSegments).toHaveLength(1);
      expect(assistantMessage.contentSegments[0].type).toBe('text');
      
      // Content should be continuous with inline code
      const textSegment = assistantMessage.contentSegments[0];
      if (textSegment.type === 'text') {
        expect(textSegment.content).toBe('The function queries a non-existent `stock` column from the table.');
      }
    });

    it('should handle multiple inlineReference segments in sequence', () => {
      const jsonLog = {
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'test-1',
            message: {
              text: 'Test',
            },
            response: [
              {
                value: 'Compare ',
              },
              {
                kind: 'inlineReference',
                inlineReference: {
                  name: 'oldValue',
                },
              },
              {
                value: ' with ',
              },
              {
                kind: 'inlineReference',
                inlineReference: {
                  name: 'newValue',
                },
              },
              {
                value: ' to see changes.',
              },
            ],
          },
        ],
      };

      const result = parseLog(JSON.stringify(jsonLog));
      
      const assistantMessage = result.messages[1];
      
      // Should merge all segments into one
      expect(assistantMessage.contentSegments).toHaveLength(1);
      
      const textSegment = assistantMessage.contentSegments[0];
      if (textSegment.type === 'text') {
        expect(textSegment.content).toBe('Compare `oldValue` with `newValue` to see changes.');
      }
    });

    it('should handle inlineReference with empty name gracefully', () => {
      const jsonLog = {
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'test-1',
            message: {
              text: 'Test',
            },
            response: [
              {
                value: 'The ',
              },
              {
                kind: 'inlineReference',
                inlineReference: {
                  name: '',
                },
              },
              {
                value: 'value is missing.',
              },
            ],
          },
        ],
      };

      const result = parseLog(JSON.stringify(jsonLog));
      
      const assistantMessage = result.messages[1];
      expect(assistantMessage.contentSegments).toHaveLength(1);
      
      const textSegment = assistantMessage.contentSegments[0];
      if (textSegment.type === 'text') {
        // Empty inlineReference should not add backticks
        expect(textSegment.content).toBe('The value is missing.');
      }
    });

    it('should flush accumulated text when tool call is encountered', () => {
      const jsonLog = {
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'test-1',
            message: {
              text: 'Test',
            },
            response: [
              {
                value: 'Checking the ',
              },
              {
                kind: 'inlineReference',
                inlineReference: {
                  name: 'stock',
                },
              },
              {
                value: ' column.',
              },
              {
                kind: 'toolInvocationSerialized',
                invocationMessage: 'Reading file',
                pastTenseMessage: 'Read file',
                toolId: 'copilot_readFile',
                toolCallId: 'test-tool-1',
                isComplete: true,
              },
              {
                value: 'Found the issue.',
              },
            ],
          },
        ],
      };

      const result = parseLog(JSON.stringify(jsonLog));
      
      const assistantMessage = result.messages[1];
      
      // Should have 3 segments: text, tool_call, text
      expect(assistantMessage.contentSegments).toHaveLength(3);
      expect(assistantMessage.contentSegments[0].type).toBe('text');
      expect(assistantMessage.contentSegments[1].type).toBe('tool_call');
      expect(assistantMessage.contentSegments[2].type).toBe('text');
      
      // First text segment should be merged
      const firstText = assistantMessage.contentSegments[0];
      if (firstText.type === 'text') {
        expect(firstText.content).toBe('Checking the `stock` column.');
      }
      
      // Last text segment
      const lastText = assistantMessage.contentSegments[2];
      if (lastText.type === 'text') {
        expect(lastText.content).toBe('Found the issue.');
      }
    });
  });

  describe('Real-world scenarios from chat.json', () => {
    it('should handle inline code in error messages and explanations', () => {
      const jsonLog = {
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'test-1',
            message: {
              text: 'Fix the error',
            },
            response: [
              {
                value: '**Root Cause:** The ',
              },
              {
                kind: 'inlineReference',
                inlineReference: {
                  name: 'syncCartFromDatabase',
                },
              },
              {
                value: ' function queries a non-existent ',
              },
              {
                kind: 'inlineReference',
                inlineReference: {
                  name: 'stock',
                },
              },
              {
                value: ' column from the table.',
              },
            ],
          },
        ],
      };

      const result = parseLog(JSON.stringify(jsonLog));
      
      const assistantMessage = result.messages[1];
      
      // Should be one continuous text segment
      expect(assistantMessage.contentSegments).toHaveLength(1);
      
      const textSegment = assistantMessage.contentSegments[0];
      if (textSegment.type === 'text') {
        expect(textSegment.content).toBe(
          '**Root Cause:** The `syncCartFromDatabase` function queries a non-existent `stock` column from the table.'
        );
        // Verify markdown formatting is preserved
        expect(textSegment.content).toContain('**Root Cause:**');
        expect(textSegment.content).toContain('`syncCartFromDatabase`');
        expect(textSegment.content).toContain('`stock`');
      }
    });
  });

  describe('File path inlineReferences as markdown links', () => {
    it('should render file paths with slashes as markdown links', () => {
      const jsonLog = {
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'test-1',
            message: {
              text: 'What does this file do?',
            },
            response: [
              {
                value: 'The ',
              },
              {
                kind: 'inlineReference',
                inlineReference: {
                  uri: { scheme: 'file', path: '/Users/test/src/components/ChatMessage.tsx' },
                },
                name: 'src/components/ChatMessage.tsx',
              },
              {
                value: ' component renders chat messages.',
              },
            ],
          },
        ],
      };

      const result = parseLog(JSON.stringify(jsonLog));

      const assistantMessage = result.messages[1];
      expect(assistantMessage.contentSegments).toHaveLength(1);

      const textSegment = assistantMessage.contentSegments[0];
      if (textSegment.type === 'text') {
        // File paths should be rendered as markdown links
        expect(textSegment.content).toBe(
          'The [src/components/ChatMessage.tsx](src/components/ChatMessage.tsx) component renders chat messages.'
        );
      }
    });

    it('should render file paths with line numbers as markdown links', () => {
      const jsonLog = {
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'test-1',
            message: {
              text: 'Check this line',
            },
            response: [
              {
                value: 'Look at ',
              },
              {
                kind: 'inlineReference',
                inlineReference: {
                  uri: { scheme: 'file', path: '/Users/test/src/lib/parser/index.ts' },
                },
                name: 'src/lib/parser/index.ts#L42',
              },
              {
                value: ' for the parsing logic.',
              },
            ],
          },
        ],
      };

      const result = parseLog(JSON.stringify(jsonLog));

      const assistantMessage = result.messages[1];
      expect(assistantMessage.contentSegments).toHaveLength(1);

      const textSegment = assistantMessage.contentSegments[0];
      if (textSegment.type === 'text') {
        // File paths with line numbers should be markdown links
        expect(textSegment.content).toBe(
          'Look at [src/lib/parser/index.ts#L42](src/lib/parser/index.ts#L42) for the parsing logic.'
        );
      }
    });

    it('should render file extensions like .tsx as markdown links even without slash', () => {
      const jsonLog = {
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'test-1',
            message: {
              text: 'Check file',
            },
            response: [
              {
                value: 'See ',
              },
              {
                kind: 'inlineReference',
                inlineReference: {
                  name: 'page.tsx',
                },
              },
              {
                value: ' for details.',
              },
            ],
          },
        ],
      };

      const result = parseLog(JSON.stringify(jsonLog));

      const assistantMessage = result.messages[1];
      expect(assistantMessage.contentSegments).toHaveLength(1);

      const textSegment = assistantMessage.contentSegments[0];
      if (textSegment.type === 'text') {
        // Single file names with extensions should be markdown links
        expect(textSegment.content).toBe('See [page.tsx](page.tsx) for details.');
      }
    });

    it('should keep simple variable names as inline code', () => {
      const jsonLog = {
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'test-1',
            message: {
              text: 'Fix it',
            },
            response: [
              {
                value: 'The ',
              },
              {
                kind: 'inlineReference',
                inlineReference: {
                  name: 'oldValue',
                },
              },
              {
                value: ' variable is undefined.',
              },
            ],
          },
        ],
      };

      const result = parseLog(JSON.stringify(jsonLog));

      const assistantMessage = result.messages[1];
      expect(assistantMessage.contentSegments).toHaveLength(1);

      const textSegment = assistantMessage.contentSegments[0];
      if (textSegment.type === 'text') {
        // Simple variable names should stay as inline code
        expect(textSegment.content).toBe('The `oldValue` variable is undefined.');
      }
    });

    it('should handle mixed file paths and variable names', () => {
      const jsonLog = {
        requesterUsername: 'digitarald',
        responderUsername: 'GitHub Copilot',
        requests: [
          {
            requestId: 'test-1',
            message: {
              text: 'Fix',
            },
            response: [
              {
                value: 'In ',
              },
              {
                kind: 'inlineReference',
                inlineReference: {
                  uri: { scheme: 'file', path: '/src/utils.ts' },
                },
                name: 'src/utils.ts',
              },
              {
                value: ', the ',
              },
              {
                kind: 'inlineReference',
                inlineReference: {
                  name: 'formatDate',
                },
              },
              {
                value: ' function has a bug.',
              },
            ],
          },
        ],
      };

      const result = parseLog(JSON.stringify(jsonLog));

      const assistantMessage = result.messages[1];
      expect(assistantMessage.contentSegments).toHaveLength(1);

      const textSegment = assistantMessage.contentSegments[0];
      if (textSegment.type === 'text') {
        // Mix of file path (link) and function name (inline code)
        expect(textSegment.content).toBe(
          'In [src/utils.ts](src/utils.ts), the `formatDate` function has a bug.'
        );
      }
    });
  });
});
