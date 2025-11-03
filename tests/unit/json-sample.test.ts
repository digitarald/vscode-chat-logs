import { describe, it, expect } from 'vitest';
import { parseLog } from '@/lib/parser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Real JSON Sample Parsing', () => {
  it('should parse small.json sample file', () => {
    // Read the actual sample file
    const samplePath = join(process.cwd(), 'samples', 'small.json');
    const jsonContent = readFileSync(samplePath, 'utf-8');
    
    const result = parseLog(jsonContent);
    
    // Verify basic structure
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.totalMessages).toBe(result.messages.length);
    
    // Check for user and assistant messages
    const userMessages = result.messages.filter(m => m.role === 'user');
    const assistantMessages = result.messages.filter(m => m.role === 'assistant');
    
    expect(userMessages.length).toBeGreaterThan(0);
    expect(assistantMessages.length).toBeGreaterThan(0);
  });

  it('should parse multi-replace tool calls with file edits from small.json', () => {
    const samplePath = join(process.cwd(), 'samples', 'small.json');
    const jsonContent = readFileSync(samplePath, 'utf-8');
    
    const result = parseLog(jsonContent);
    
    // Find all tool calls
    const toolCalls = result.messages
      .flatMap(m => m.contentSegments)
      .filter(seg => seg.type === 'tool_call')
      .map(seg => seg.type === 'tool_call' ? seg.toolCall : null)
      .filter(tc => tc !== null);
    
    // Should have tool calls
    expect(toolCalls.length).toBeGreaterThan(0);
    
    // Find multi-replace tool calls (should have fileEdits)
    const multiReplaceToolCalls = toolCalls.filter(tc => tc?.fileEdits && tc.fileEdits.length > 0);
    
    // Should have at least one multi-replace tool call with file edits
    expect(multiReplaceToolCalls.length).toBeGreaterThan(0);
    
    // Verify structure of file edits
    const firstMultiReplace = multiReplaceToolCalls[0];
    expect(firstMultiReplace?.fileEdits).toBeDefined();
    expect(Array.isArray(firstMultiReplace?.fileEdits)).toBe(true);
    
    if (firstMultiReplace?.fileEdits && firstMultiReplace.fileEdits.length > 0) {
      const firstEdit = firstMultiReplace.fileEdits[0];
      
      // Should have file path
      expect(firstEdit.filePath).toBeDefined();
      expect(typeof firstEdit.filePath).toBe('string');
      expect(firstEdit.filePath.length).toBeGreaterThan(0);
      
      // Should have text content
      expect(firstEdit.text).toBeDefined();
      expect(typeof firstEdit.text).toBe('string');
      
      // May have range information
      if (firstEdit.range) {
        expect(typeof firstEdit.range.startLine).toBe('number');
        expect(typeof firstEdit.range.endLine).toBe('number');
      }
    }
  });

  it('should correctly associate file edits with multi-replace tool calls', () => {
    const samplePath = join(process.cwd(), 'samples', 'small.json');
    const jsonContent = readFileSync(samplePath, 'utf-8');
    
    const result = parseLog(jsonContent);
    
    // Find assistant messages with tool calls
    const assistantMessages = result.messages.filter(m => m.role === 'assistant');
    
    for (const message of assistantMessages) {
      const toolCallSegments = message.contentSegments.filter(seg => seg.type === 'tool_call');
      
      for (const segment of toolCallSegments) {
        if (segment.type === 'tool_call' && segment.toolCall.fileEdits) {
          const toolCall = segment.toolCall;
          
          // If has file edits, verify they're properly structured
          expect(Array.isArray(toolCall.fileEdits)).toBe(true);
          
          if (toolCall.fileEdits) {
            for (const fileEdit of toolCall.fileEdits) {
              // Each file edit should have a path
              expect(fileEdit.filePath).toBeDefined();
              expect(typeof fileEdit.filePath).toBe('string');
              
              // Should have text
              expect(fileEdit.text).toBeDefined();
              
              // File path should be readable (not just URI object)
              expect(fileEdit.filePath).not.toContain('[object Object]');
            }
          }
        }
      }
    }
  });

  it('should parse multiple file edits for a single multi-replace tool call', () => {
    const samplePath = join(process.cwd(), 'samples', 'small.json');
    const jsonContent = readFileSync(samplePath, 'utf-8');
    
    const result = parseLog(jsonContent);
    
    // Find multi-replace tool calls
    const multiReplaceToolCalls = result.messages
      .flatMap(m => m.contentSegments)
      .filter(seg => seg.type === 'tool_call')
      .map(seg => seg.type === 'tool_call' ? seg.toolCall : null)
      .filter(tc => tc?.fileEdits && tc.fileEdits.length > 0);
    
    if (multiReplaceToolCalls.length > 0) {
      // Check if any multi-replace has multiple file edits
      const multiFileEdit = multiReplaceToolCalls.find(tc => tc && tc.fileEdits && tc.fileEdits.length > 1);
      
      if (multiFileEdit && multiFileEdit.fileEdits) {
        // Should have at least 2 edits
        expect(multiFileEdit.fileEdits.length).toBeGreaterThanOrEqual(2);
        
        // Each edit should reference a file
        const filePaths = multiFileEdit.fileEdits.map(e => e.filePath);
        expect(filePaths.every(path => path && path.length > 0)).toBe(true);
      }
    }
  });

  it('should skip code block markers and not create empty content segments', () => {
    const samplePath = join(process.cwd(), 'samples', 'small.json');
    const jsonContent = readFileSync(samplePath, 'utf-8');
    
    const result = parseLog(jsonContent);
    
    // Find all text segments
    const textSegments = result.messages
      .flatMap(m => m.contentSegments)
      .filter(seg => seg.type === 'text');
    
    // None should be empty or contain only code block markers
    for (const segment of textSegments) {
      if (segment.type === 'text') {
        const trimmed = segment.content.trim();
        
        // Should not be empty
        expect(trimmed.length).toBeGreaterThan(0);
        
        // Should not be just code block markers
        const onlyCodeBlocks = /^(```\w*\s*)+$/.test(trimmed);
        expect(onlyCodeBlocks).toBe(false);
      }
    }
  });

  it('should skip metadata items (codeblockUri, textEditGroup, prepareToolInvocation, undoStop)', () => {
    const samplePath = join(process.cwd(), 'samples', 'small.json');
    const jsonContent = readFileSync(samplePath, 'utf-8');
    
    // Parse the raw JSON to inspect response items
    const rawData = JSON.parse(jsonContent);
    const response = rawData.requests[0].response;
    
    // Count metadata items in raw data
    const metadataItems = response.filter((item: Record<string, unknown>) => 
      typeof item.kind === 'string' && ['codeblockUri', 'textEditGroup', 'prepareToolInvocation', 'undoStop'].includes(item.kind)
    );
    
    expect(metadataItems.length).toBeGreaterThan(0);
    
    // Parse with our parser
    const result = parseLog(jsonContent);
    
    // Count content segments
    const totalSegments = result.messages
      .flatMap(m => m.contentSegments)
      .length;
    
    // Total segments should be less than total response items
    // because we skip metadata items
    expect(totalSegments).toBeLessThan(response.length);
  });

  it('should collect file edits for single replaceString tool calls (inline fixture)', () => {
    // Inline JSON fixture simulating a single replaceString tool invocation followed by a textEditGroup
    const jsonFixture = {
      requesterUsername: 'digitarald',
      responderUsername: 'GitHub Copilot',
      requests: [
        {
          requestId: 'req-inline-1',
          message: { text: 'Perform a single replace.' },
          response: [
            {
              kind: 'toolInvocationSerialized',
              invocationMessage: 'Replace String in File',
              pastTenseMessage: 'Replace String in File (app.ts) lines 1-1',
              toolId: 'copilot_replaceString',
              toolCallId: 'tc-inline-1',
              isComplete: true,
            },
            {
              kind: 'textEditGroup',
              uri: 'file:///workspace/app.ts',
              edits: [
                [
                  {
                    text: 'console.log("updated");',
                    range: {
                      startLineNumber: 1,
                      startColumn: 1,
                      endLineNumber: 1,
                      endColumn: 30,
                    },
                  },
                ],
              ],
            },
            {
              value: 'Replacement done.',
            },
          ],
        },
      ],
    };

    const result = parseLog(JSON.stringify(jsonFixture));

    // Find all tool calls
    const toolCalls = result.messages
      .flatMap((m) => m.contentSegments)
      .filter((seg) => seg.type === 'tool_call')
      .map((seg) => (seg.type === 'tool_call' ? seg.toolCall : null))
      .filter((tc) => tc !== null);

    expect(toolCalls.length).toBeGreaterThan(0);

    // Find single replace string tool calls (not multi-replace)
    const singleReplaceToolCalls = toolCalls.filter(
      (tc) =>
        tc?.action && tc.action.includes('Replace String in File') && !tc.action.includes('Multi')
    );

    expect(singleReplaceToolCalls.length).toBeGreaterThan(0);

    const withFileEdits = singleReplaceToolCalls.filter(
      (tc) => tc?.fileEdits && tc.fileEdits.length > 0
    );
    expect(withFileEdits.length).toBeGreaterThan(0);

    const firstWithEdits = withFileEdits[0];
    expect(firstWithEdits?.fileEdits).toBeDefined();
    expect(Array.isArray(firstWithEdits?.fileEdits)).toBe(true);

    if (firstWithEdits?.fileEdits && firstWithEdits.fileEdits.length > 0) {
      const firstEdit = firstWithEdits.fileEdits[0];
      expect(firstEdit.filePath).toBeDefined();
      expect(typeof firstEdit.filePath).toBe('string');
      expect(firstEdit.text).toBeDefined();
    }
  });
});
