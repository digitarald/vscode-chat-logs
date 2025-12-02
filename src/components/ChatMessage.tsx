'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, ToolCall } from '@/lib/parser/types';

// Thinking Component for displaying AI reasoning
function ThinkingItem({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="rounded"
      style={{
        backgroundColor: '#2d2d30',
        border: '1px solid #3e3e42',
      }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 text-left transition-colors px-3 py-2"
        style={{ color: '#969696' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#37373d')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        aria-expanded={isExpanded}
        aria-label="Toggle AI reasoning"
      >
        <span className="text-xs select-none">{isExpanded ? '▼' : '▶'}</span>
        <span className="text-sm">🧠</span>
        <span className="text-xs font-semibold">Thinking</span>
      </button>
      {isExpanded && (
        <div
          className="px-3 pb-3 text-xs leading-relaxed select-text"
          style={{
            color: '#b0b0b0',
            borderTop: '1px solid #3e3e42',
            paddingTop: '12px',
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }: { children?: React.ReactNode }) => (
                <p className="mb-2 last:mb-0">{children}</p>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold" style={{ color: '#cccccc' }}>
                  {children}
                </strong>
              ),
              em: ({ children }) => <em>{children}</em>,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

// FileEdit Component for displaying file edits from multi-replace operations
function FileEditItem({ fileEdit, index }: { fileEdit: { filePath: string; text: string; range?: { startLine: number; endLine: number; startColumn: number; endColumn: number } }; index: number }) {
  const [isFileExpanded, setIsFileExpanded] = useState(false);
  const fileName = fileEdit.filePath.split('/').pop() || fileEdit.filePath;
  
  return (
    <div key={index} className="rounded" style={{ backgroundColor: '#1e1e1e', border: '1px solid #3e3e42' }}>
      <div
        onClick={() => setIsFileExpanded(!isFileExpanded)}
        className="w-full flex items-center gap-2 cursor-pointer transition-colors select-text"
        style={{ padding: '8px 12px' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2d2d30'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsFileExpanded(!isFileExpanded);
          }
        }}
        aria-expanded={isFileExpanded}
        aria-label={`Toggle file ${fileName} details`}
      >
        {/* Arrow icon remains non-selectable */}
        <span className="text-xs select-none" style={{ color: '#969696' }}>
          {isFileExpanded ? '▼' : '▶'}
        </span>
        <span className="text-xs font-mono" style={{ color: '#4fc3f7' }}>{fileName}</span>
        <span className="text-xs" style={{ color: '#606060' }}>•</span>
        <span className="text-xs" style={{ color: '#969696' }}>
          {fileEdit.range 
            ? `Lines ${fileEdit.range.startLine}-${fileEdit.range.endLine}`
            : 'Full file'}
        </span>
      </div>
      
      {isFileExpanded && (
        <div className="border-t select-text" style={{ borderColor: '#3e3e42', padding: '12px' }}>
          <pre className="text-xs font-mono overflow-x-auto select-text" style={{ color: '#cccccc', whiteSpace: 'pre-wrap' }}>
            {fileEdit.text}
          </pre>
        </div>
      )}
    </div>
  );
}

// ToolCall Component
function ToolCallItem({ toolCall, depth = 0 }: { toolCall: ToolCall; depth?: number }) {
  // Expand by default if this tool call has nested subagent calls
  const [isExpanded, setIsExpanded] = useState(
    Boolean(toolCall.subAgentCalls && toolCall.subAgentCalls.length > 0)
  );
  // Separate state for subagent I/O section collapse
  const [isSubagentIOExpanded, setIsSubagentIOExpanded] = useState(false);

  const getIcon = () => {
    switch (toolCall.type) {
      case 'subagent':
        return '🤖';
      case 'read':
        return '📄';
      case 'search':
        return '🔎';
      case 'navigate':
        return '🌐';
      case 'click':
        return '🖱️';
      case 'type':
        return '⌨️';
      case 'screenshot':
      case 'snapshot':
        return '📸';
      case 'run':
        return '▶️';
      case 'todo':
        return '✓';
      case 'patch':
        return '🩹';
      case 'replace':
        return '✏️';
      case 'test':
        return '🧪';
      default:
        return '⚙️';
    }
  };

  // Status icon reflects completion state
  const statusIcon =
    toolCall.status === 'pending' ? '…' : toolCall.status === 'failed' ? '⚠' : '✓';

  // For subagent orchestrator, always show details if there's input/output OR nested calls
  const isSubagentRoot = toolCall.type === 'subagent';
  const hasSubagentIO = isSubagentRoot && (toolCall.input || toolCall.output);

  const hasDetails =
    toolCall.input ||
    toolCall.output ||
    toolCall.screenshot ||
    toolCall.consoleOutput ||
    toolCall.pageSnapshot ||
    (toolCall.subAgentCalls && toolCall.subAgentCalls.length > 0) ||
    (toolCall.fileEdits && toolCall.fileEdits.length > 0);

  // Extract filename from file path for read operations
  const getFileDisplay = () => {
    if (toolCall.type === 'read' && toolCall.input) {
      const filePath = typeof toolCall.input === 'string' ? toolCall.input : '';
      const match = filePath.match(/\/([^/]+)$/);
      return match ? match[1] : null;
    }
    return null;
  };

  const filename = getFileDisplay();
  // Remove legacy "[Subagent]" prefix if present
  const sanitizedAction = toolCall.action.replace(/^\[Subagent\]\s*/, '');
  const displayAction = toolCall.type === 'read' && filename ? 'Read' : sanitizedAction;

  // Get unique file names from fileEdits
  const editedFiles = toolCall.fileEdits
    ? Array.from(
        new Set(
          toolCall.fileEdits.map((edit) => {
            const parts = edit.filePath.split('/');
            return parts[parts.length - 1] || edit.filePath;
          })
        )
      )
    : [];

  // Determine if this is a file edit tool call
  const isFileEditToolCall = toolCall.fileEdits && toolCall.fileEdits.length > 0;

  return (
    <div
      className="mb-0.5 rounded"
      style={{
        backgroundColor: '#252526',
        border: '1px solid #3e3e42',
        // Indent nested subagent calls
        marginLeft: depth > 0 ? depth * 12 : 0,
      }}
    >
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 cursor-pointer transition-colors select-text"
        style={{ padding: '6px 12px' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2d2d30')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        aria-expanded={isExpanded}
        aria-label={`Toggle details for ${toolCall.action}`}
        aria-controls={`tool-details-${toolCall.toolCallId || toolCall.action}`}
      >
        {/* Status and main icon remain non-selectable */}
        <span
          className="text-xs select-none"
          style={{
            color:
              toolCall.status === 'failed'
                ? '#f48771'
                : toolCall.status === 'pending'
                  ? '#cca700'
                  : '#89d185',
          }}
        >
          {statusIcon}
        </span>
        {/* Show robot indicator for nested subagent calls in addition to their tool-specific icon */}
        {toolCall.fromSubAgent && toolCall.type !== 'subagent' && (
          <span className="text-sm select-none" data-testid="subagent-icon" title="Subagent call">
            🤖
          </span>
        )}
        <span
          className="text-sm select-none"
          data-testid={toolCall.type === 'subagent' ? 'subagent-root-icon' : undefined}
        >
          {isFileEditToolCall ? '✏️' : getIcon()}
        </span>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: '#cccccc' }}>
            {displayAction}
          </span>
          {filename && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                backgroundColor: 'rgba(96, 96, 96, 0.2)',
                color: '#969696',
                border: '1px solid rgba(96, 96, 96, 0.3)',
              }}
            >
              {filename}
            </span>
          )}
          {editedFiles.map((file, idx) => (
            <span
              key={idx}
              className="text-xs px-2 py-0.5 rounded font-mono"
              style={{
                backgroundColor: 'rgba(79, 195, 247, 0.15)',
                color: '#4fc3f7',
                border: '1px solid rgba(79, 195, 247, 0.3)',
              }}
            >
              {file}
            </span>
          ))}
          {toolCall.mcpServer && (
            <span className="text-xs" style={{ color: '#4fc3f7' }}>
              {toolCall.mcpServer}
            </span>
          )}
        </div>
        {hasDetails && (
          <span className="text-xs select-none" style={{ color: '#969696' }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
      </div>

      {isExpanded && hasDetails && (
        <div
          className="text-xs space-y-2 select-text"
          style={{ padding: '8px 12px', borderTop: '1px solid #3e3e42' }}
        >
          {/* For subagent orchestrator, show input/output in collapsible section */}
          {isSubagentRoot && hasSubagentIO && (
            <div className="mb-2">
              <button
                onClick={() => setIsSubagentIOExpanded(!isSubagentIOExpanded)}
                className="flex items-center gap-2 w-full text-left hover:bg-gray-700/30 rounded px-2 py-1"
                style={{ color: '#969696' }}
                aria-label={`Toggle subagent call details`}
                aria-expanded={isSubagentIOExpanded}
              >
                <span className="text-xs select-none">{isSubagentIOExpanded ? '▼' : '▶'}</span>
                <span className="font-semibold text-xs">Subagent call</span>
              </button>

              {isSubagentIOExpanded && (
                <div className="mt-2 space-y-2">
                  {toolCall.input && (
                    <div>
                      <span
                        className="font-semibold block mb-1 text-xs"
                        style={{ color: '#969696' }}
                      >
                        Prompt:
                      </span>
                      <pre
                        className="rounded overflow-x-auto select-text"
                        style={{
                          padding: '12px',
                          color: '#cccccc',
                          backgroundColor: '#1e1e1e',
                          border: '1px solid #3e3e42',
                          maxHeight: '400px',
                          overflowY: 'auto',
                          fontSize: '11px',
                        }}
                      >
                        {typeof toolCall.input === 'string'
                          ? toolCall.input
                          : JSON.stringify(toolCall.input, null, 2)}
                      </pre>
                    </div>
                  )}
                  {toolCall.output && (
                    <div>
                      <span
                        className="font-semibold block mb-1 text-xs"
                        style={{ color: '#969696' }}
                      >
                        Result:
                      </span>
                      <div
                        className="rounded overflow-x-auto select-text"
                        style={{
                          padding: '12px',
                          color: '#cccccc',
                          backgroundColor: '#1e1e1e',
                          border: '1px solid #3e3e42',
                          maxHeight: '600px',
                          overflowY: 'auto',
                        }}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }: { children?: React.ReactNode }) => (
                              <p className="mb-2">{children}</p>
                            ),
                            h2: ({ children }) => (
                              <h2
                                className="text-sm font-bold mb-1 mt-2 first:mt-0"
                                style={{ color: '#cccccc' }}
                              >
                                {children}
                              </h2>
                            ),
                            code: ({
                              inline,
                              children,
                            }: {
                              inline?: boolean;
                              children?: React.ReactNode;
                            }) =>
                              inline ? (
                                <code
                                  className="px-1.5 py-0.5 rounded font-mono"
                                  style={{
                                    backgroundColor: '#2d2d30',
                                    color: '#d7ba7d',
                                    fontSize: '11px',
                                  }}
                                >
                                  {children}
                                </code>
                              ) : (
                                <code
                                  className="font-mono"
                                  style={{ color: '#cccccc', fontSize: '11px' }}
                                >
                                  {children}
                                </code>
                              ),
                            pre: ({ children }: { children?: React.ReactNode }) => (
                              <pre
                                className="rounded overflow-x-auto my-1"
                                style={{
                                  padding: '6px',
                                  backgroundColor: '#252526',
                                  border: '1px solid #3e3e42',
                                  fontSize: '11px',
                                }}
                              >
                                {children}
                              </pre>
                            ),
                            ul: ({ children }: { children?: React.ReactNode }) => (
                              <ul className="list-disc ml-4 mb-1 space-y-0.5">{children}</ul>
                            ),
                            li: ({ children }: { children?: React.ReactNode }) => (
                              <li style={{ color: '#cccccc' }}>{children}</li>
                            ),
                          }}
                        >
                          {toolCall.output}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* For non-subagent tool calls, show input/output as before */}
          {!isSubagentRoot && toolCall.input && (
            <div>
              <span className="font-semibold block mb-1" style={{ color: '#969696' }}>
                Input:
              </span>
              <pre
                className="rounded overflow-x-auto select-text"
                style={{
                  padding: '12px',
                  color: '#cccccc',
                  backgroundColor: '#1e1e1e',
                  border: '1px solid #3e3e42',
                }}
              >
                {typeof toolCall.input === 'string'
                  ? toolCall.input
                  : JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
          )}

          {!isSubagentRoot &&
            toolCall.output &&
            !toolCall.screenshot &&
            !toolCall.consoleOutput && (
              <div>
                <span className="font-semibold block mb-1" style={{ color: '#969696' }}>
                  Output:
                </span>
                <pre
                  className="rounded overflow-x-auto whitespace-pre-wrap break-words select-text"
                  style={{
                    padding: '12px',
                    color: '#cccccc',
                    backgroundColor: '#1e1e1e',
                    border: '1px solid #3e3e42',
                  }}
                >
                  {toolCall.output}
                </pre>
              </div>
            )}

          {toolCall.screenshot && (
            <div>
              <span className="font-semibold block mb-2" style={{ color: '#969696' }}>
                Screenshot:
              </span>
              <details className="group">
                <summary
                  className="cursor-pointer mb-2"
                  style={{ color: '#4fc3f7' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#1a8dd8')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#4fc3f7')}
                >
                  Click to expand screenshot
                </summary>
                <img
                  src={`data:image/png;base64,${toolCall.screenshot}`}
                  alt="Screenshot"
                  className="max-w-full rounded"
                  style={{ border: '1px solid #3e3e42' }}
                />
              </details>
            </div>
          )}

          {toolCall.consoleOutput && toolCall.consoleOutput.length > 0 && (
            <div>
              <span className="font-semibold block mb-1" style={{ color: '#969696' }}>
                Console Output ({toolCall.consoleOutput.length}):
              </span>
              <div
                className="p-3 rounded space-y-1 max-h-48 overflow-y-auto select-text"
                style={{ backgroundColor: '#1e1e1e', border: '1px solid #3e3e42' }}
              >
                {toolCall.consoleOutput.map((log, idx) => (
                  <div
                    key={idx}
                    className="text-xs font-mono"
                    style={{
                      color: log.includes('[ERROR]')
                        ? '#f48771'
                        : log.includes('[WARN]')
                          ? '#cca700'
                          : '#cccccc',
                    }}
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {toolCall.pageSnapshot && (
            <div>
              <span className="font-semibold block mb-1" style={{ color: '#969696' }}>
                Page State:
              </span>
              <details className="group">
                <summary
                  className="cursor-pointer"
                  style={{ color: '#4fc3f7' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#1a8dd8')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#4fc3f7')}
                >
                  View DOM snapshot
                </summary>
                <pre
                  className="p-3 rounded overflow-x-auto text-xs mt-2 max-h-96 overflow-y-auto select-text"
                  style={{
                    color: '#cccccc',
                    backgroundColor: '#1e1e1e',
                    border: '1px solid #3e3e42',
                  }}
                >
                  {toolCall.pageSnapshot}
                </pre>
              </details>
            </div>
          )}
          {toolCall.fileEdits && toolCall.fileEdits.length > 0 && (
            <div>
              <span className="font-semibold block mb-2" style={{ color: '#969696' }}>
                Files Modified ({toolCall.fileEdits.length}):
              </span>
              <div className="space-y-2">
                {toolCall.fileEdits.map((fileEdit, idx) => (
                  <FileEditItem key={idx} fileEdit={fileEdit} index={idx} />
                ))}
              </div>
            </div>
          )}

          {toolCall.subAgentCalls && toolCall.subAgentCalls.length > 0 && (
            <div className="space-y-2">
              {toolCall.subAgentCalls.map((subCall, idx) => (
                <ToolCallItem key={idx} toolCall={subCall} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatMessageComponent({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  
  return (
    <div className="py-2 px-4" style={{ backgroundColor: '#1e1e1e' }} data-testid="chat-message">
      <div
        className={
          isUser ? 'max-w-[95%] md:max-w-[80%] lg:max-w-[70%] ml-auto rounded-2xl py-3 px-4' : ''
        }
        style={isUser ? { backgroundColor: '#2b5278' } : {}}
      >
        {/* Render interleaved content segments */}
        {message.contentSegments && message.contentSegments.length > 0 && (
          <div>
            {message.contentSegments.map((segment, idx) => {
              if (segment.type === 'text') {
                // Add margin if previous segment was a tool call
                const prevIsToolCall =
                  idx > 0 && message.contentSegments[idx - 1]?.type === 'tool_call';

                // User messages: preserve whitespace with <pre>
                if (isUser) {
                  return (
                    <pre
                      key={idx}
                      className={`text-sm leading-normal whitespace-pre-wrap ${prevIsToolCall ? 'mt-3' : ''}`}
                      style={{ fontFamily: 'inherit', color: '#cccccc' }}
                    >
                      {segment.content}
                    </pre>
                  );
                }

                // Assistant messages: render markdown
                return (
                  <div
                    key={idx}
                    className={`text-sm leading-normal ${prevIsToolCall ? 'mt-3' : ''}`}
                    style={{ color: '#cccccc' }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Style markdown elements to match VS Code theme
                        p: ({ children }: { children?: React.ReactNode }) => (
                          <p className="mb-3">{children}</p>
                        ),
                        a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
                          <a
                            href={href}
                            className="underline"
                            style={{ color: '#4fc3f7' }}
                            target="_blank"
                            rel="noopener noreferrer"
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#1a8dd8')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#4fc3f7')}
                          >
                            {children}
                          </a>
                        ),
                        code: ({
                          inline,
                          children,
                        }: {
                          inline?: boolean;
                          children?: React.ReactNode;
                        }) =>
                          inline ? (
                            <code
                              className="px-1.5 py-0.5 rounded font-mono text-xs"
                              style={{ backgroundColor: '#2d2d30', color: '#d7ba7d' }}
                            >
                              {children}
                            </code>
                          ) : (
                            <code className="font-mono text-xs" style={{ color: '#cccccc' }}>
                              {children}
                            </code>
                          ),
                        pre: ({ children }: { children?: React.ReactNode }) => (
                          <pre
                            className="rounded overflow-x-auto my-1"
                            style={{
                              padding: '8px',
                              backgroundColor: '#252526',
                              border: '1px solid #3e3e42',
                            }}
                          >
                            {children}
                          </pre>
                        ),
                        ul: ({ children }: { children?: React.ReactNode }) => (
                          <ul className="list-disc ml-4 mb-1 space-y-0.5">{children}</ul>
                        ),
                        ol: ({ children }: { children?: React.ReactNode }) => (
                          <ol className="list-decimal ml-4 mb-1 space-y-0.5">{children}</ol>
                        ),
                        li: ({ children }: { children?: React.ReactNode }) => (
                          <li style={{ color: '#cccccc' }}>{children}</li>
                        ),
                        blockquote: ({ children }: { children?: React.ReactNode }) => (
                          <blockquote
                            className="border-l-2 pl-3 py-0.5 italic my-1"
                            style={{
                              borderColor: '#007acc',
                              color: '#969696',
                              backgroundColor: 'rgba(37, 37, 38, 0.3)',
                            }}
                          >
                            {children}
                          </blockquote>
                        ),
                        h1: ({ children }) => (
                          <h1
                            className="text-xl font-bold mb-1 mt-2 first:mt-0"
                            style={{ color: '#cccccc' }}
                          >
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2
                            className="text-lg font-bold mb-1 mt-2 first:mt-0"
                            style={{ color: '#cccccc' }}
                          >
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3
                            className="text-base font-bold mb-1 mt-2 first:mt-0"
                            style={{ color: '#cccccc' }}
                          >
                            {children}
                          </h3>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold" style={{ color: '#cccccc' }}>
                            {children}
                          </strong>
                        ),
                        em: ({ children }) => <em className="italic">{children}</em>,
                        hr: () => <hr className="my-2" style={{ borderColor: '#3e3e42' }} />,
                        table: ({ children }) => (
                          <div className="my-1 overflow-x-auto">
                            <table
                              className="border-collapse w-full"
                              style={{ border: '1px solid #3e3e42' }}
                            >
                              {children}
                            </table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th
                            className="px-3 py-2 text-left font-semibold"
                            style={{
                              border: '1px solid #3e3e42',
                              backgroundColor: '#252526',
                              color: '#cccccc',
                            }}
                          >
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-3 py-2" style={{ border: '1px solid #3e3e42' }}>
                            {children}
                          </td>
                        ),
                      }}
                    >
                      {segment.content}
                    </ReactMarkdown>
                  </div>
                );
              } else if (segment.type === 'tool_call') {
                // Add margin if previous segment was text
                const prevIsText = idx > 0 && message.contentSegments[idx - 1]?.type === 'text';
                return (
                  <div key={idx} className={prevIsText ? 'mt-3' : ''}>
                    <ToolCallItem toolCall={segment.toolCall} />
                  </div>
                );
              } else if (segment.type === 'code_block') {
                // Margin if previous segment was text or tool call
                const prevType = idx > 0 ? message.contentSegments[idx - 1]?.type : null;
                const addMargin =
                  prevType === 'text' || prevType === 'tool_call' || prevType === 'code_block';
                return (
                  <div key={idx} className={addMargin ? 'mt-2' : ''}>
                    <div
                      className="rounded overflow-hidden"
                      style={{ border: '1px solid #3e3e42' }}
                    >
                      <div
                        className="text-xs font-mono"
                        style={{
                          padding: '4px 12px',
                          backgroundColor: '#252526',
                          color: '#969696',
                          borderBottom: '1px solid #3e3e42',
                        }}
                      >
                        {segment.language}
                      </div>
                      <pre
                        className="overflow-x-auto"
                        style={{ padding: '8px', backgroundColor: '#1e1e1e' }}
                      >
                        <code className="text-xs font-mono" style={{ color: '#cccccc' }}>
                          {segment.code}
                        </code>
                      </pre>
                    </div>
                  </div>
                );
              } else if (segment.type === 'thinking') {
                const prevType = idx > 0 ? message.contentSegments[idx - 1]?.type : null;
                const addMargin = prevType === 'text' || prevType === 'tool_call';
                return (
                  <div key={idx} className={addMargin ? 'mt-3' : 'mt-2'}>
                    <ThinkingItem content={segment.content} />
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
