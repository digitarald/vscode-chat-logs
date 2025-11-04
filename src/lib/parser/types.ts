export type MessageRole = 'user' | 'assistant';

export type ToolCallType =
  | 'read'
  | 'search'
  | 'navigate'
  | 'click'
  | 'type'
  | 'screenshot'
  | 'snapshot'
  | 'run'
  | 'todo'
  // Parent subagent orchestration call (e.g. runSubagent)
  | 'subagent'
  // Multiple file/string replacement operations
  | 'replace'
  // Apply Patch operations
  | 'patch'
  // Test discovery / execution summary
  | 'test'
  | 'other';

export interface FileEdit {
  filePath: string;
  text: string;
  range?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

export interface ToolCall {
  type: ToolCallType;
  action: string;
  // Original, unnormalized action text as it appeared in the log (e.g. starts with "Ran ", "Using ", etc.)
  rawAction?: string;
  input?: string | Record<string, unknown>;
  output?: string;
  status?: 'pending' | 'completed' | 'failed';
  ref?: string;
  toolCallId?: string;
  mcpServer?: string;
  subAgentCalls?: ToolCall[];
  screenshot?: string; // base64 encoded image
  consoleOutput?: string[];
  pageSnapshot?: string; // YAML DOM snapshot
  fileEdits?: FileEdit[]; // For multi-replace operations
  // Number of skipped tests in a test summary tool call (optional)
  skipped?: number;
  // True if this tool call originated from a subagent execution context
  fromSubAgent?: boolean;
  // True if this tool call is the root/orchestrator spawning subagents
  isSubagentRoot?: boolean;
  // Normalized numeric result count for search operations (derived from output or rawAction)
  normalizedResultCount?: number;
}

export interface CodeBlock {
  language: string;
  code: string;
  diff?: boolean;
}

export interface FileReference {
  path: string;
  lines?: string;
  url?: string;
}

export interface TaskStatus {
  title: string;
  status: 'pending' | 'started' | 'completed';
  index?: string;
}

export type ContentSegmentType = 'text' | 'tool_call';

export interface TextSegment {
  type: 'text';
  content: string;
  order: number;
}

export interface ToolCallSegment {
  type: 'tool_call';
  toolCall: ToolCall;
  order: number;
}

export type ContentSegment = TextSegment | ToolCallSegment;

export interface ChatMessage {
  id: string;
  role: MessageRole;
  contentSegments: ContentSegment[];
  timestamp?: Date;
  codeBlocks?: CodeBlock[];
  fileReferences?: FileReference[];
  tasks?: TaskStatus[];
  variableData?: VariableData[];
}

export interface VariableData {
  kind: string;
  name: string;
  description?: string;
  value?: string | number | boolean | Record<string, unknown> | null;
}

export interface ParsedSession {
  messages: ChatMessage[];
  metadata?: {
    totalMessages: number;
    toolCallCount: number;
    fileCount: number;
  };
}
