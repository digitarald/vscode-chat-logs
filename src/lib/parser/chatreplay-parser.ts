import type {
  ParsedSession,
  ChatMessage,
  ContentSegment,
  TextSegment,
  ToolCall,
  ToolCallType,
} from './types';

interface ChatReplayExport {
  exportedAt: string;
  totalPrompts: number;
  totalLogEntries: number;
  prompts: ChatReplayPrompt[];
}

interface ChatReplayPrompt {
  prompt: string;
  hasSeen: boolean;
  logCount: number;
  logs: ChatReplayLog[];
}

type ChatReplayLog =
  | ChatReplayElementLog
  | ChatReplayRequestLog
  | ChatReplayToolCallLog;

interface ChatReplayElementLog {
  id: string;
  kind: 'element';
  name: string;
  tokens?: number;
  maxTokens?: number;
}

interface ChatReplayRequestLog {
  id: string;
  kind: 'request';
  type: 'ChatMLSuccess' | 'ChatMLCancelation';
  name: string;
  metadata?: {
    model?: string;
    startTime?: string;
    endTime?: string;
    duration?: number;
  };
  requestMessages?: {
    messages: Array<{
      role?: number;
      content?: Array<{
        type?: number;
        value?: {
          type?: string;
          thinking?: {
            id?: string;
            text?: string;
          };
        };
        text?: string;
      }>;
    }>;
  };
  response?: {
    type: string;
    message?: string[];
    content?: Array<{
      type?: number;
      value?: {
        type?: string;
        thinking?: {
          id?: string;
          text?: string;
        };
      };
    }>;
  };
}

interface ChatReplayToolCallLog {
  id: string;
  kind: 'toolCall';
  tool: string;
  args: string; // JSON string
  time?: string;
  response?: unknown;
  thinking?: {
    thought?: string;
  };
}

export class ChatReplayParser {
  parse(jsonText: string): ParsedSession {
    try {
      const data: ChatReplayExport = JSON.parse(jsonText);
      const messages: ChatMessage[] = [];

      for (const prompt of data.prompts) {
        // User message from prompt
        const userMessage: ChatMessage = {
          id: `prompt_${messages.length}`,
          role: 'user',
          contentSegments: [
            {
              type: 'text',
              content: prompt.prompt,
              order: 0,
            },
          ],
        };
        messages.push(userMessage);

        // Assistant response - collect all successful responses and tool calls
        const assistantSegments: ContentSegment[] = [];
        let currentOrder = 0;
        let accumulatedText = '';
        let lastTopLevelToolCall: ToolCall | null = null;

        for (const log of prompt.logs) {
          if (log.kind === 'request' && log.type === 'ChatMLSuccess') {
            // Flush any accumulated text before adding request response
            if (accumulatedText.trim()) {
              assistantSegments.push({
                type: 'text',
                content: accumulatedText.trim(),
                order: currentOrder++,
              } as TextSegment);
              accumulatedText = '';
            }

            // Check for thinking content in response or request messages
            const requestLog = log as ChatReplayRequestLog;

            // Check response content for thinking
            if (requestLog.response?.content) {
              for (const item of requestLog.response.content) {
                if (
                  item.type === 2 &&
                  item.value?.type === 'thinking' &&
                  item.value.thinking?.text
                ) {
                  assistantSegments.push({
                    type: 'thinking',
                    content: item.value.thinking.text,
                    order: currentOrder++,
                  });
                }
              }
            }

            // Check request messages for thinking (from previous turns)
            if (requestLog.requestMessages?.messages) {
              for (const msg of requestLog.requestMessages.messages) {
                if (msg.content && Array.isArray(msg.content)) {
                  for (const item of msg.content) {
                    if (
                      item.type === 2 &&
                      item.value?.type === 'thinking' &&
                      item.value.thinking?.text
                    ) {
                      assistantSegments.push({
                        type: 'thinking',
                        content: item.value.thinking.text,
                        order: currentOrder++,
                      });
                    }
                  }
                }
              }
            }

            // Add response message if present
            if (log.response?.message && Array.isArray(log.response.message)) {
              const responseText = log.response.message.join('').trim();
              if (responseText) {
                accumulatedText += responseText + '\n';
              }
            }
          } else if (log.kind === 'toolCall') {
            // Flush any accumulated text before tool call
            if (accumulatedText.trim()) {
              assistantSegments.push({
                type: 'text',
                content: accumulatedText.trim(),
                order: currentOrder++,
              } as TextSegment);
              accumulatedText = '';
            }

            const toolCall = this.parseToolCall(log);
            if (toolCall) {
              if (toolCall.fromSubAgent && lastTopLevelToolCall) {
                lastTopLevelToolCall.subAgentCalls = lastTopLevelToolCall.subAgentCalls || [];
                lastTopLevelToolCall.subAgentCalls.push(toolCall);
              } else {
                assistantSegments.push({
                  type: 'tool_call',
                  toolCall,
                  order: currentOrder++,
                });
                if (!toolCall.fromSubAgent) {
                  lastTopLevelToolCall = toolCall;
                }
              }
            }
          }
        }

        // Flush any remaining text
        if (accumulatedText.trim()) {
          assistantSegments.push({
            type: 'text',
            content: accumulatedText.trim(),
            order: currentOrder++,
          } as TextSegment);
        }

        // Add assistant message if there are any segments
        if (assistantSegments.length > 0) {
          messages.push({
            id: `response_${messages.length}`,
            role: 'assistant',
            contentSegments: assistantSegments,
          });
        }
      }

      return {
        messages,
        metadata: {
          totalMessages: messages.length,
          toolCallCount: this.countToolCalls(messages),
          fileCount: 0,
        },
      };
    } catch (error) {
      console.error('Failed to parse chatreplay log:', error);
      throw new Error('Invalid chatreplay format');
    }
  }

  private parseToolCall(log: ChatReplayToolCallLog): ToolCall | null {
    try {
      const args = JSON.parse(log.args);
      const type = this.mapToolNameToType(log.tool);
      const action = this.generateActionLabel(log.tool, args);

      // Extract input and output
      let input: string | undefined;
      let output: string | undefined;

      // Input is typically the first argument
      if (args.path) input = args.path;
      else if (args.filePath) input = args.filePath;
      else if (args.query) input = args.query;
      else if (args.command) input = args.command;
      else if (args.prompt) input = args.prompt;

      // Output from response
      if (log.response) {
        if (Array.isArray(log.response)) {
          output = log.response.join('\n');
        } else if (typeof log.response === 'string') {
          output = log.response;
        } else if (typeof log.response === 'object') {
          output = JSON.stringify(log.response, null, 2);
        }
      }

      // Calculate normalized result count for search operations
      let normalizedResultCount: number | undefined;
      if (type === 'search') {
        const countSource = output || action;
        const countMatch = countSource.match(/(\d+)\s+results?/);
        if (countMatch) {
          normalizedResultCount = parseInt(countMatch[1], 10);
        } else if (/\b(no results|no matches)\b/i.test(countSource)) {
          normalizedResultCount = 0;
        }
      }

      const toolCall: ToolCall = {
        type,
        action,
        rawAction: action,
        status: 'completed',
        toolCallId: log.id,
        input,
        output,
        ...(normalizedResultCount !== undefined ? { normalizedResultCount } : {}),
      };

      // Mark subagent calls
      if (type === 'subagent') {
        toolCall.isSubagentRoot = true;
      }

      return toolCall;
    } catch (error) {
      console.error('Failed to parse tool call:', error, log);
      return null;
    }
  }

  private generateActionLabel(toolName: string, args: Record<string, unknown>): string {
    // Generate human-readable action labels
    switch (toolName) {
      case 'read_file':
        return args.filePath ? `Read ${this.extractFileName(args.filePath as string)}` : 'Read file';
      case 'list_dir':
        return args.path ? `List ${this.extractFileName(args.path as string)}` : 'List directory';
      case 'grep_search':
      case 'semantic_search':
        return args.query ? `Search for "${args.query}"` : 'Search';
      case 'replace_string_in_file':
        return args.filePath ? `Edit ${this.extractFileName(args.filePath as string)}` : 'Edit file';
      case 'multi_replace_string_in_file':
        return 'Edit multiple files';
      case 'run_in_terminal':
        return args.command ? `Run ${args.command}` : 'Run command';
      case 'runSubagent':
        return args.description ? `${args.description}` : 'Run subagent';
      case 'manage_todo_list':
        return 'Update tasks';
      case 'runTests':
        return 'Run tests';
      default:
        return toolName.replace(/_/g, ' ');
    }
  }

  private extractFileName(path: string): string {
    // Extract filename from full path
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  }

  private mapToolNameToType(toolName: string): ToolCallType {
    if (toolName === 'runSubagent') return 'subagent';
    if (toolName.includes('replace') || toolName.includes('edit')) return 'replace';
    if (toolName.includes('test')) return 'test';
    if (toolName.includes('read')) return 'read';
    if (toolName.includes('search')) return 'search';
    if (toolName.includes('navigate')) return 'navigate';
    if (toolName.includes('click')) return 'click';
    if (toolName.includes('type')) return 'type';
    if (toolName.includes('screenshot') || toolName.includes('snapshot')) return 'screenshot';
    if (toolName.includes('run') || toolName.includes('terminal')) return 'run';
    if (toolName.includes('todo')) return 'todo';
    return 'other';
  }

  private countToolCalls(messages: ChatMessage[]): number {
    return messages.reduce(
      (count, msg) => count + msg.contentSegments.filter((seg) => seg.type === 'tool_call').length,
      0
    );
  }
}

export function parseChatReplayLog(jsonText: string): ParsedSession {
  return new ChatReplayParser().parse(jsonText);
}
