import type {
  ChatMessage,
  CodeBlock,
  ContentSegment,
  FileReference,
  ParsedSession,
  TaskStatus,
  ToolCall,
  ToolCallType,
} from './types';
import { detectLogFormat } from './format-detector';
import { parseJsonLog } from './json-parser';

/**
 * Main entry point for parsing Copilot logs.
 * Automatically detects format (text vs JSON) and routes to appropriate parser.
 */
export function parseLog(content: string): ParsedSession {
  const format = detectLogFormat(content);
  
  if (format === 'json') {
    return parseJsonLog(content);
  }
  
  // Default to text parser
  const parser = new CopilotLogParser();
  return parser.parse(content);
}

export class CopilotLogParser {
  private messageIdCounter = 0;
  private segmentOrderCounter = 0;

  parse(logText: string): ParsedSession {
    const messages: ChatMessage[] = [];
    const lines = logText.split('\n');
    
    let currentMessage: Partial<ChatMessage> | null = null;
    let currentContent: string[] = [];
    let contentSegments: ContentSegment[] = [];
    let inCodeBlock = false;
    let currentCodeBlock: Partial<CodeBlock> | null = null;
    let codeLines: string[] = [];
    let inToolInput = false;
    let toolInputLines: string[] = [];
    let lastToolCall: ToolCall | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle combined multi-search lines containing pipe-separated searches
      // Example: "Searched for regex `search.*icon`|Searched (**/src/components/**), no results"
      if (line.startsWith('Searched ') && line.includes('|Searched ')) {
        if (currentMessage) {
          // Flush accumulated content once before adding multiple tool calls
          if (currentContent.length > 0) {
            const textContent = currentContent.join('\n').trim();
            if (textContent) {
              contentSegments.push({
                type: 'text',
                content: textContent,
                order: this.segmentOrderCounter++,
              });
            }
            currentContent = [];
          }

          const segments = line
            .split('|Searched')
            .map((part, idx) => (idx === 0 ? part : 'Searched' + part));
          for (const seg of segments) {
            const searchToolCall = this.parseToolCall(seg);
            if (searchToolCall) {
              contentSegments.push({
                type: 'tool_call',
                toolCall: searchToolCall,
                order: this.segmentOrderCounter++,
              });
              lastToolCall = searchToolCall; // track last if next line provides input
            }
          }
          continue;
        }
      }

      // Detect code block boundaries
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          const language = line.trim().slice(3).trim() || 'plaintext';
          currentCodeBlock = { language, code: '' };
          codeLines = [];
        } else {
          inCodeBlock = false;
          if (currentCodeBlock) {
            currentCodeBlock.code = codeLines.join('\n');
            if (currentMessage) {
              currentMessage.codeBlocks = currentMessage.codeBlocks || [];
              currentMessage.codeBlocks.push(currentCodeBlock as CodeBlock);
            }
          }
          currentCodeBlock = null;
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // Handle multi-line tool call input
      if (inToolInput) {
        toolInputLines.push(line);
        // Check if we've reached the end of JSON input
        const joinedInput = toolInputLines.join('\n');
        try {
          // Try to parse as JSON to see if it's complete
          JSON.parse(joinedInput);
          // Successfully parsed, attach to last tool call
          if (lastToolCall && currentMessage) {
            lastToolCall.input = joinedInput;
            inToolInput = false;
            toolInputLines = [];
            lastToolCall = null;
          }
          continue;
        } catch {
          // Not valid JSON yet, continue collecting lines
          // But if we hit an empty line or new section, stop
          if (
            line.trim() === '' ||
            line.match(/^(digitarald:|GitHub Copilot:|Ran |Searched |Read |Got output)/)
          ) {
            // Malformed JSON, just store what we have
            if (lastToolCall) {
              lastToolCall.input = toolInputLines.slice(0, -1).join('\n'); // Don't include the new section line
            }
            inToolInput = false;
            toolInputLines = [];
            lastToolCall = null;
            // Don't continue, process this line normally
          } else {
            continue;
          }
        }
      }

      // Detect user messages (digitarald:)
      const userMatch = line.match(/^(\w+):\s*(.+)/);
      if (userMatch && userMatch[1] === 'digitarald') {
        if (currentMessage) {
          this.finalizeMessage(currentMessage, currentContent, contentSegments, messages);
        }
        currentMessage = {
          id: this.generateId(),
          role: 'user',
          contentSegments: [],
        };
        currentContent = [userMatch[2]];
        contentSegments = [];
        this.segmentOrderCounter = 0;
        continue;
      }

      // Detect assistant messages (GitHub Copilot:)
      if (line.startsWith('GitHub Copilot:')) {
        if (currentMessage) {
          this.finalizeMessage(currentMessage, currentContent, contentSegments, messages);
        }
        currentMessage = {
          id: this.generateId(),
          role: 'assistant',
          contentSegments: [],
        };
        currentContent = [line.replace('GitHub Copilot:', '').trim()];
        contentSegments = [];
        this.segmentOrderCounter = 0;
        continue;
      }

      // Parse file references first (before tool calls)
      const fileRef = this.parseFileReference(line);
      if (fileRef && currentMessage) {
        currentMessage.fileReferences = currentMessage.fileReferences || [];
        currentMessage.fileReferences.push(fileRef);

        // Also create a tool call for "Read" actions
        if (line.startsWith('Read')) {
          // Flush any accumulated content before tool call
          if (currentContent.length > 0) {
            const textContent = currentContent.filter(Boolean).join('\n').trim();
            if (textContent) {
              contentSegments.push({
                type: 'text',
                content: textContent,
                order: this.segmentOrderCounter++,
              });
            }
            currentContent = [];
          }

          const toolCall: ToolCall = {
            type: 'read',
            action: `Read ${fileRef.path.split('/').pop()}`,
            input: fileRef.path,
            status: 'completed',
          };

          contentSegments.push({
            type: 'tool_call',
            toolCall,
            order: this.segmentOrderCounter++,
          });
        }
        continue;
      }

      // Check if this is "Completed with input:" line
      if (line.match(/^Completed with input:/)) {
        const inputMatch = line.match(/^Completed with input:\s*(.*)/);
        if (inputMatch && lastToolCall) {
          const inlineInput = inputMatch[1].trim();
          if (inlineInput) {
            // Check if input starts with { or [ (likely JSON)
            if (inlineInput.startsWith('{') || inlineInput.startsWith('[')) {
              // Try to parse as complete JSON
              try {
                JSON.parse(inlineInput);
                // It's valid JSON on one line
                lastToolCall.input = inlineInput;
                lastToolCall = null;
              } catch {
                // Incomplete JSON, start multi-line collection
                inToolInput = true;
                toolInputLines = [inlineInput];
              }
            } else {
              // Plain text input
              lastToolCall.input = inlineInput;
              lastToolCall = null;
            }
          } else {
            // No inline input, expecting multi-line
            inToolInput = true;
            toolInputLines = [];
          }
        }
        continue;
      }

      // Parse tool calls
      const toolCall = this.parseToolCall(line);
      if (toolCall && currentMessage) {
        // Flush any accumulated content before tool call
        if (currentContent.length > 0) {
          // Join all lines (including empty ones) to preserve formatting
          const textContent = currentContent.join('\n').trim();
          if (textContent) {
            contentSegments.push({
              type: 'text',
              content: textContent,
              order: this.segmentOrderCounter++,
            });
          }
          currentContent = [];
        }

        // Add tool call segment
        contentSegments.push({
          type: 'tool_call',
          toolCall,
          order: this.segmentOrderCounter++,
        });

        lastToolCall = toolCall; // Track for potential "Completed with input:"
        continue;
      }

      // Parse task status
      const task = this.parseTaskStatus(line);
      if (task && currentMessage) {
        currentMessage.tasks = currentMessage.tasks || [];
        currentMessage.tasks.push(task);
        continue;
      }

      // Regular content line
      if (currentMessage) {
        // Always push the line (including empty lines) to preserve formatting
        currentContent.push(line);
      }
    }

    // Finalize last message
    if (currentMessage) {
      this.finalizeMessage(currentMessage, currentContent, contentSegments, messages);
    }

    return {
      messages,
      metadata: {
        totalMessages: messages.length,
        toolCallCount: messages.reduce((acc, m) => 
          acc + m.contentSegments.filter(s => s.type === 'tool_call').length, 0),
        fileCount: messages.reduce((acc, m) => acc + (m.fileReferences?.length || 0), 0),
      },
    };
  }

  private parseToolCall(line: string): ToolCall | null {
    // Match patterns like:
    // "Ran Navigate to a URL"
    // "Searched for files matching ..."
    // "Starting: *Task Name* (1/5)" - treat as todo tool call
    // "Using \"Multi-Replace String in Files\"" - multi file replace tool call
    // Note: "Read" patterns are handled by parseFileReference

    // Match "Starting: *Task Name* (1/5)" as todo tool call
    const startingMatch = line.match(/^Starting:\s+\*?(.+?)\*?\s+\((\d+\/\d+)\)/);
    if (startingMatch) {
      return {
        type: 'todo',
        action: `Starting ${startingMatch[1]} ${startingMatch[2]}`,
        status: 'completed',
      };
    }

    // Multi-Replace invocation
    const multiReplaceMatch = line.match(/^Using\s+"Multi-Replace String in Files"/);
    if (multiReplaceMatch) {
      return {
        type: 'replace',
        action: 'Multi-Replace String in Files',
        status: 'completed',
      };
    }
    // Sometimes serialized logs may only contain the bare phrase
    if (line.trim() === 'Multi-Replace String in Files') {
      return {
        type: 'replace',
        action: 'Multi-Replace String in Files',
        status: 'completed',
      };
    }

    // Apply Patch invocation
    const applyPatchMatch = line.match(/^Using\s+"Apply Patch"/);
    if (applyPatchMatch) {
      return {
        type: 'patch',
        action: 'Apply Patch',
        status: 'completed',
      };
    }
    if (line.trim() === 'Apply Patch') {
      return {
        type: 'patch',
        action: 'Apply Patch',
        status: 'completed',
      };
    }

    // Test discovery and execution summary
    const discoveringTests = line.match(/^Discovering tests\.\.\.$/);
    if (discoveringTests) {
      return {
        type: 'test',
        action: 'Discovering tests',
        status: 'pending',
      };
    }
    const testSummary = line.match(/^(\d+)\/(\d+)\s+tests\s+passed\s+\((\d+)%\)/);
    if (testSummary) {
      const passed = testSummary[1];
      const total = testSummary[2];
      const pct = testSummary[3];
      return {
        type: 'test',
        action: 'Tests passed',
        output: `${passed}/${total} (${pct}%)`,
        status: 'completed',
      };
    }

    const ranMatch = line.match(/^Ran\s+(.+?)(?:\s*-\s*(.+))?$/);
    if (ranMatch) {
      const action = ranMatch[1].trim();
      const toolType = this.extractToolType(action);
      return {
        type: toolType,
        action: action,
        status: 'completed',
      };
    }

    // Match "Searched ..." pattern (both "Searched X, N results" and "Searched for files matching ...")
    const searchMatch = line.match(/^Searched\s+(.+?),\s*(\d+)\s*results?/);
    if (searchMatch) {
      return {
        type: 'search',
        action: searchMatch[1],
        output: `${searchMatch[2]} results`,
        status: 'completed',
      };
    }

    // Match "Searched for files matching ..." pattern
    const searchFilesMatch = line.match(/^Searched\s+(.+?)$/);
    if (searchFilesMatch && searchFilesMatch[1].includes('for files matching')) {
      // If the line includes a trailing result phrase (no matches/results), extract it
      // Example: Searched for files matching `**/Footer*`, no matches
      // We trim the action to exclude the trailing ", no matches" part and set output accordingly.
      const rawAction = searchFilesMatch[1];
      const trailingResult = rawAction.match(/^(.*),\s*(no matches|no results)$/);
      let action = rawAction;
      let output: string | undefined;
      if (trailingResult) {
        action = trailingResult[1].trim();
        output = '0 results';
      }
      return {
        type: 'search',
        action,
        status: 'completed',
        ...(output ? { output } : {}),
      };
    }

    // Enhanced search patterns
    // Regex search with count: Searched for regex `pattern`, 6 results
    const regexSearchCount = line.match(/^Searched\s+for\s+regex\s+`([^`]+)`,\s*(\d+)\s*results?/);
    if (regexSearchCount) {
      return {
        type: 'search',
        action: `regex ${regexSearchCount[1]}`,
        output: `${regexSearchCount[2]} results`,
        status: 'completed',
      };
    }

    // Bare regex search (no count/no results) used in multi-search combined lines:
    // Example segment: "Searched for regex `search.*icon`"
    const regexSearchBare = line.match(/^Searched\s+for\s+regex\s+`([^`]+)`$/);
    if (regexSearchBare) {
      return {
        type: 'search',
        // Keep the phrase "for regex" so tests asserting action contains it will pass
        action: `for regex ${regexSearchBare[1]}`,
        status: 'completed',
      };
    }

    // Regex/text search with no results (unquoted pattern, may include path filter in parentheses)
    // Examples:
    // Searched for regex search|Search (**/tests/unit/**), no results
    // Searched for text no results (**/samples/**), no matches
    const regexOrTextNoResults = line.match(
      /^Searched\s+for\s+(regex|text)\s+(.+?),\s*(no results|no matches)$/
    );
    if (regexOrTextNoResults) {
      const kind = regexOrTextNoResults[1];
      const pattern = regexOrTextNoResults[2];
      return {
        type: 'search',
        action: `${kind} ${pattern}`,
        output: '0 results',
        status: 'completed',
      };
    }

    // Regex/file/glob search with no results/no matches
    const searchNoResults = line.match(
      /^Searched\s+(?:for\s+(?:regex|text)\s+)?`?([^`,]+?)`?(?:\s*|\s+for\s+files\s+matching\s+`?([^`]+)`?)?,\s*(no results|no matches)$/
    );
    if (searchNoResults) {
      // Determine pattern from capture groups; first non-empty
      const pattern = searchNoResults[2] ? searchNoResults[2] : searchNoResults[1];
      return {
        type: 'search',
        action: pattern,
        output: '0 results',
        status: 'completed',
      };
    }

    // Parentheses form: Searched (**/src/components/**), no results|3 results
    const parenSearch = line.match(
      /^Searched\s+\(([^)]+)\),\s*(no results|no matches|(\d+)\s*results?)$/
    );
    if (parenSearch) {
      const outcome = parenSearch[2];
      const count = parenSearch[3];
      return {
        type: 'search',
        action: parenSearch[1],
        output: outcome.startsWith('no') ? '0 results' : `${count} results`,
        status: 'completed',
      };
    }

    // Match "Got output for `Task Name` task"
    const gotOutputMatch = line.match(/^Got output for `(.+?)` task/);
    if (gotOutputMatch) {
      return {
        type: 'run',
        action: gotOutputMatch[1],
        status: 'completed',
      };
    }

    // Don't create separate tool calls for "Completed with input:"
    // Instead, mark that we're starting to collect input
    const completedMatch = line.match(/^Completed with input:\s*(.*)/);
    if (completedMatch) {
      return null; // Will be handled by state machine above
    }

    return null;
  }

  private extractToolType(action: string): ToolCallType {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('navigate')) return 'navigate';
    if (actionLower.includes('click')) return 'click';
    if (actionLower.includes('type')) return 'type';
    if (actionLower.includes('screenshot')) return 'screenshot';
    if (actionLower.includes('snapshot')) return 'screenshot';
    if (actionLower.includes('search')) return 'search';
    return 'run';
  }

  private parseFileReference(line: string): FileReference | null {
    const match = line.match(/\[\]\(file:\/\/([^)#]+?)(?:#(\d+-\d+))?\)/);
    if (match) {
      return {
        path: match[1],
        lines: match[2],
      };
    }
    return null;
  }

  private parseTaskStatus(line: string): TaskStatus | null {
    // Match: "Created 5 todos"
    const createdMatch = line.match(/^Created\s+(\d+)\s+todos?/);
    if (createdMatch) {
      return {
        title: `Created ${createdMatch[1]} todos`,
        status: 'completed',
      };
    }

    // Match: "Starting: *Task Name* (1/5)"
    const startingMatch = line.match(/^Starting:\s+\*?(.+?)\*?\s+\((\d+\/\d+)\)/);
    if (startingMatch) {
      return {
        title: startingMatch[1],
        status: 'started',
        index: startingMatch[2],
      };
    }

    // Match: "Completed: *Task Name* (5/5)"
    const completedMatch = line.match(/^Completed:\s+\*?(.+?)\*?\s+\((\d+\/\d+)\)/);
    if (completedMatch) {
      return {
        title: completedMatch[1],
        status: 'completed',
        index: completedMatch[2],
      };
    }

    return null;
  }

  private finalizeMessage(
    message: Partial<ChatMessage>,
    content: string[],
    contentSegments: ContentSegment[],
    messages: ChatMessage[]
  ) {
    // Add any remaining content as final text segment
    if (content.length > 0) {
      // Join all lines (including empty ones) to preserve formatting
      const textContent = content.join('\n').trim();
      if (textContent) {
        contentSegments.push({
          type: 'text',
          content: textContent,
          order: this.segmentOrderCounter++,
        });
      }
    }
    
    message.contentSegments = contentSegments;
    
    if (contentSegments.length > 0 || message.fileReferences?.length) {
      messages.push(message as ChatMessage);
    }
  }

  private generateId(): string {
    return `msg_${++this.messageIdCounter}`;
  }
}

export type { ChatMessage, CodeBlock, FileReference, ParsedSession, TaskStatus, ToolCall, VariableData } from './types';
