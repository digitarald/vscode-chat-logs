import type {
  ParsedSession,
  ChatMessage,
  ContentSegment,
  TextSegment,
  CodeBlockSegment,
  ThinkingSegment,
  ToolCall,
  ToolCallType,
  VariableData,
  FileEdit,
} from './types';

interface JsonChatExport {
  requesterUsername: string;
  responderUsername: string;
  requests: JsonRequest[];
}

interface JsonRequest {
  requestId: string;
  message: {
    text: string;
  };
  variableData?: {
    variables: JsonVariable[];
  };
  response: JsonResponseItem[];
}

interface JsonVariable {
  kind: string;
  name: string;
  modelDescription?: string;
  value?: string | number | boolean | Record<string, unknown> | null;
}

interface JsonResponseItem {
  kind?: string;
  value?: string;
  name?: string;
  toolInvocationSerialized?: JsonToolCall;
  inlineReference?: {
    name?: string;
  };
  supportThemeIcons?: boolean;
  supportHtml?: boolean;
}

interface JsonToolCall {
  invocationMessage: string | { value: string };
  pastTenseMessage: string | { value: string };
  toolId: string;
  toolCallId: string;
  toolName?: string;
  isComplete: boolean;
  isConfirmed?: { type: number };
  source?: {
    type: string;
    label?: string;
    serverLabel?: string;
  };
  resultDetails?: {
    input?: string;
    output?: Array<{ type: string; value: string; mimeType?: string }>;
  };
  toolSpecificData?: Record<string, unknown>;
  fromSubAgent?: boolean;
}

export class JsonLogParser {
  parse(jsonText: string): ParsedSession {
    try {
      const data: JsonChatExport = JSON.parse(jsonText);
      const messages: ChatMessage[] = [];

      for (const request of data.requests) {
        // User message
        if (request.message.text) {
          const userMessage: ChatMessage = {
            id: request.requestId,
            role: 'user',
            contentSegments: [
              {
                type: 'text',
                content: request.message.text,
                order: 0,
              },
            ],
            variableData: this.parseVariableData(request.variableData),
          };
          messages.push(userMessage);
        }

        // Assistant message with response items
        if (request.response && request.response.length > 0) {
          // Extract toolCallResults and toolCallRounds from result.metadata (if present)
          const requestData = request as unknown as {
            result?: {
              metadata?: {
                toolCallResults?: Record<string, { content?: Array<{ value?: string }> }>;
                toolCallRounds?: Array<{ toolCalls?: Array<{ id?: string; arguments?: string }> }>;
              };
            };
          };

          const toolCallResults = requestData.result?.metadata?.toolCallResults;
          const toolCallRounds = requestData.result?.metadata?.toolCallRounds;

          const assistantMessage = this.parseResponse(
            request.requestId,
            request.response,
            0,
            toolCallResults,
            toolCallRounds
          );
          if (assistantMessage) {
            messages.push(assistantMessage);
          }
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
      console.error('Failed to parse JSON log:', error);
      throw new Error('Invalid JSON chat export format');
    }
  }

  private parseVariableData(variableData?: { variables: JsonVariable[] }): VariableData[] | undefined {
    if (!variableData?.variables) return undefined;
    return variableData.variables.map((v) => ({
      kind: v.kind,
      name: v.name,
      description: v.modelDescription,
      value: v.value,
    }));
  }

  private parseResponse(
    requestId: string,
    responseItems: JsonResponseItem[],
    startOrder: number,
    toolCallResults?: Record<string, { content?: Array<{ value?: string }> }>,
    toolCallRounds?: Array<{ toolCalls?: Array<{ id?: string; arguments?: string }> }>
  ): ChatMessage | null {
    const contentSegments: ContentSegment[] = [];
    let order = startOrder;
    let accumulatedText = '';
    let lastTopLevelToolCall: ToolCall | null = null;

    // Track thinking IDs to prevent duplicates
    const seenThinkingIds = new Set<string>();

    const flushAccumulatedText = () => {
      if (!accumulatedText) return;
      const split = this.splitTextIntoSegments(accumulatedText);
      for (const seg of split) {
        if (seg.type === 'text') {
          contentSegments.push({ ...seg, order: order++ } as TextSegment);
        } else if (seg.type === 'code_block') {
          contentSegments.push({ ...seg, order: order++ } as CodeBlockSegment);
        }
      }
      accumulatedText = '';
    };

    for (let i = 0; i < responseItems.length; i++) {
      const item = responseItems[i];
      const itemData = item as {
        kind?: string;
        inlineReference?: { name?: string };
        id?: string;
        metadata?: { vscodeReasoningDone?: boolean };
      };

      // Skip metadata / structural items
      const skipKinds = [
        'codeblockUri',
        'textEditGroup',
        'prepareToolInvocation',
        'undoStop',
        'mcpServersStarting',
      ];
      if (itemData.kind && skipKinds.includes(itemData.kind)) continue;

      // Handle thinking items (AI reasoning/analysis)
      if (itemData.kind === 'thinking') {
        const thinkingItem = item as {
          value?: string;
          id?: string;
          metadata?: { vscodeReasoningDone?: boolean };
        };
        // Skip empty thinking items or "done" markers
        if (!thinkingItem.value || thinkingItem.metadata?.vscodeReasoningDone) continue;
        // Deduplicate by ID
        const thinkingId = thinkingItem.id;
        if (thinkingId && seenThinkingIds.has(thinkingId)) continue;
        if (thinkingId) seenThinkingIds.add(thinkingId);

        flushAccumulatedText();
        contentSegments.push({
          type: 'thinking',
          content: thinkingItem.value,
          order: order++,
        } as ThinkingSegment);
        continue;
      }

      // Inline file references - render as markdown links for file paths, backticks for code
      if (item.kind === 'inlineReference' && itemData.inlineReference) {
        // Name can be at top level of item or inside inlineReference
        const refName = item.name || itemData.inlineReference.name || '';
        if (refName) {
          // If it looks like a file path (contains / or file extension), render as link
          // Otherwise render as inline code with backticks
          if (refName.includes('/') || /\.\w+#?L?\d*$/.test(refName)) {
            accumulatedText += `[${refName}](${refName})`;
          } else {
            accumulatedText += `\`${refName}\``;
          }
        }
        continue;
      }

      if (item.value && typeof item.value === 'string') {
        const trimmed = item.value.trim();
        const onlyCodeBlocks = /^(```\w*\s*)+$/.test(trimmed);
        if (trimmed && !onlyCodeBlocks) accumulatedText += item.value;
      } else if (item.kind === 'toolInvocationSerialized') {
        flushAccumulatedText();
        const toolCallData = item as Record<string, unknown>;
        const toolCall = this.parseToolCallFromItem(toolCallData, toolCallResults, toolCallRounds);
        if (toolCall) {
          if (
            toolCallData.toolId === 'copilot_multiReplaceString' ||
            toolCallData.toolId === 'copilot_replaceString'
          ) {
            const fileEdits = this.collectFileEdits(responseItems, i + 1);
            if (fileEdits.length) toolCall.fileEdits = fileEdits;
          }
          if (toolCall.fromSubAgent && lastTopLevelToolCall) {
            lastTopLevelToolCall.subAgentCalls = lastTopLevelToolCall.subAgentCalls || [];
            lastTopLevelToolCall.subAgentCalls.push(toolCall);
          } else {
            contentSegments.push({ type: 'tool_call', toolCall, order: order++ });
            if (!toolCall.fromSubAgent) lastTopLevelToolCall = toolCall;
          }
        }
      }
    }

    flushAccumulatedText();
    if (!contentSegments.length) return null;
    return { id: `${requestId}_response`, role: 'assistant', contentSegments };
  }

  private splitTextIntoSegments(text: string): Array<Omit<ContentSegment, 'order'>> {
    const segments: Array<Omit<ContentSegment, 'order'>> = [];
    const fenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = fenceRegex.exec(text)) !== null) {
      const preceding = text.slice(lastIndex, match.index).trim();
      if (preceding) segments.push({ type: 'text', content: preceding } as Omit<ContentSegment, 'order'>);
      const language = match[1] || 'plaintext';
      const code = match[2];
      segments.push({ type: 'code_block', language, code } as Omit<ContentSegment, 'order'>);
      lastIndex = fenceRegex.lastIndex;
    }

    const trailing = text.slice(lastIndex).trim();
    if (trailing) segments.push({ type: 'text', content: trailing } as Omit<ContentSegment, 'order'>);
    if (!segments.length) return [{ type: 'text', content: text } as Omit<ContentSegment, 'order'>];
    return segments;
  }

  private parseToolCallFromItem(
    item: Record<string, unknown>,
    toolCallResults?: Record<string, { content?: Array<{ value?: string }> }>,
    toolCallRounds?: Array<{ toolCalls?: Array<{ id?: string; arguments?: string }> }>
  ): ToolCall | null {
    const toolId = item.toolId as string;
    const toolCallId = item.toolCallId as string;
    const invocationMsg = item.invocationMessage as string | { value: string } | undefined;
    const pastMsg = item.pastTenseMessage as string | { value: string } | undefined;
    const source = item.source as { type?: string; serverLabel?: string; label?: string } | undefined;
    const resultDetails = item.resultDetails as { input?: string; output?: Array<{ type: string; value: string; mimeType?: string }> } | undefined;
    const fromSubAgent = item.fromSubAgent === true;

    const rawAction = this.extractMessage(pastMsg || invocationMsg);
    let action = rawAction.replace(/^Ran\s+/, '');
    let type = this.mapToolIdToType(toolId);

    let input: string | undefined;
    let output: string | undefined;

    if (type === 'subagent' && toolCallRounds) {
      for (const round of toolCallRounds) {
        if (!round.toolCalls) continue;
        for (const call of round.toolCalls) {
          const callData = call as { id?: string; name?: string; arguments?: string };
            if (callData.name === 'runSubagent') {
              if (callData.arguments) {
                try {
                  const args = JSON.parse(callData.arguments);
                  input = args.prompt || callData.arguments;
                } catch {
                  input = callData.arguments;
                }
              }
              if (toolCallResults && callData.id) {
                const result = toolCallResults[callData.id];
                if (result?.content?.length) output = result.content[0].value;
              }
              break;
            }
        }
        if (input) break;
      }
    }

    let screenshot: string | undefined;
    let consoleOutput: string[] | undefined;
    let pageSnapshot: string | undefined;

    if (type === 'read' && action) {
      const fileMatch = action.match(/\[\]\(file:\/\/([^)]+)\)/);
      if (fileMatch) {
        const filePath = fileMatch[1];
        const filename = filePath.split('/').pop();
        action = `Read ${filename}`;
        if (!input) input = filePath;
      }
    }

    if (resultDetails) {
      if (resultDetails.input) input = resultDetails.input;
      if (resultDetails.output && Array.isArray(resultDetails.output)) {
        for (const outputItem of resultDetails.output) {
          if (outputItem.type === 'embed' && outputItem.mimeType === 'image/png') {
            screenshot = outputItem.value;
          } else if (outputItem.type === 'embed' && outputItem.value) {
            const value = outputItem.value as string;
            output = value;
            const consoleMatch = value.match(/### New console messages\n([\s\S]*?)(?=\n###|$)/);
            if (consoleMatch) {
              consoleOutput = consoleMatch[1]
                .split('\n')
                .filter((line) => line.trim().startsWith('-'))
                .map((line) => line.replace(/^-\s*/, '').trim());
            }
            const snapshotMatch = value.match(/### Page state[\s\S]*?```yaml\n([\s\S]*?)\n```/);
            if (snapshotMatch) pageSnapshot = snapshotMatch[1];
          }
        }
      }
    }

    if (type !== 'search' && /^Searched\b/.test(rawAction)) type = 'search';

    let normalizedResultCount: number | undefined;
    const countSource = output || rawAction;
    const countMatch = countSource.match(/(\d+)\s+results?/);
    if (countMatch) {
      normalizedResultCount = parseInt(countMatch[1], 10);
    } else if (/\b(no results|no matches)\b/i.test(countSource) || output === '0 results') {
      normalizedResultCount = 0;
    }

    const toolCall: ToolCall = {
      type,
      action,
      rawAction,
      status:
        (typeof (item as { isComplete?: boolean }).isComplete === 'boolean' &&
          (item as { isComplete?: boolean }).isComplete)
          ? 'completed'
          : 'pending',
      toolCallId,
      input,
      output,
      screenshot,
      consoleOutput,
      pageSnapshot,
      ...(normalizedResultCount !== undefined ? { normalizedResultCount } : {}),
    };

    if (/runSubagent/i.test(toolId)) toolCall.isSubagentRoot = true;
    if (source?.type === 'mcp') toolCall.mcpServer = source.serverLabel || source.label;
    if (fromSubAgent) toolCall.fromSubAgent = true;
    return toolCall;
  }

  private extractMessage(msg: string | { value: string } | undefined): string {
    if (!msg) return 'Unknown action';
    const text = typeof msg === 'string' ? msg : msg.value || 'Unknown action';
    return text.replace(/^Using\s*["'](.+?)["']\s*\.?$/, '$1');
  }

  private mapToolIdToType(toolId: string): ToolCallType {
    const id = toolId || '';
    if (id.match(/runSubagent/i)) return 'subagent';
    if (id.match(/applyPatch/i)) return 'patch';
    if (id.match(/multiReplaceString|replaceString/i)) return 'replace';
    if (id.match(/runTests|test/i)) return 'test';
    if (id.match(/read/i)) return 'read';
    if (id.match(/search/i)) return 'search';
    if (id.match(/navigate/i)) return 'navigate';
    if (id.match(/click/i)) return 'click';
    if (id.match(/type/i)) return 'type';
    if (id.match(/screenshot|snapshot/i)) return 'screenshot';
    if (id.match(/run/i)) return 'run';
    if (id.match(/todo/i)) return 'todo';
    return 'other';
  }

  private collectFileEdits(responseItems: JsonResponseItem[], startIndex: number): FileEdit[] {
    const fileEdits: FileEdit[] = [];
    for (let i = startIndex; i < responseItems.length; i++) {
      const item = responseItems[i] as Record<string, unknown>;
      if (item.value && typeof item.value === 'string') {
        const trimmed = item.value.trim();
        if (trimmed && trimmed !== '```' && !trimmed.match(/^```\w*$/)) break;
      }
      if (item.kind === 'textEditGroup' && item.uri && item.edits) {
        const filePath = this.extractFilePath(item.uri);
        const edits = item.edits as Array<
          Array<{
            text?: string;
            range?: {
              startLineNumber?: number;
              startColumn?: number;
              endLineNumber?: number;
              endColumn?: number;
            };
          }>
        >;
        for (const editArray of edits) {
          if (!Array.isArray(editArray) || !editArray.length) continue;
          const editData = editArray[0];
          if (editData && typeof editData === 'object') {
            fileEdits.push({
              filePath,
              text: editData.text || '',
              range: editData.range
                ? {
                    startLine: editData.range.startLineNumber || 0,
                    startColumn: editData.range.startColumn || 0,
                    endLine: editData.range.endLineNumber || 0,
                    endColumn: editData.range.endColumn || 0,
                  }
                : undefined,
            });
          }
        }
      }
    }
    return fileEdits;
  }

  private extractFilePath(uri: string | { path?: string; fsPath?: string } | undefined): string {
    if (typeof uri === 'string') return uri.replace('file://', '');
    const obj = uri as { path?: string; fsPath?: string } | undefined;
    if (obj?.path) return obj.path;
    if (obj?.fsPath) return obj.fsPath;
    return 'Unknown file';
  }

  private countToolCalls(messages: ChatMessage[]): number {
    return messages.reduce(
      (count, msg) => count + msg.contentSegments.filter((seg) => seg.type === 'tool_call').length,
      0
    );
  }
}

export function parseJsonLog(jsonText: string): ParsedSession {
  return new JsonLogParser().parse(jsonText);
}
