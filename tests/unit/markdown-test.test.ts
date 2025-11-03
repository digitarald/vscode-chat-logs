import { describe, it, expect } from 'vitest';
import { parseLog } from '../../src/lib/parser';
import fs from 'fs';
import path from 'path';

describe('Markdown Log Parsing', () => {
  it('should parse the test markdown log correctly', () => {
    const logPath = path.join(process.cwd(), 'samples', 'test-markdown.log');
    const logContent = fs.readFileSync(logPath, 'utf-8');
    
    const result = parseLog(logContent);
    
    // Should have 2 messages: user and assistant
    expect(result.messages).toHaveLength(2);
    
    // User message
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].contentSegments).toHaveLength(1);
    expect(result.messages[0].contentSegments[0].type).toBe('text');
    
    // Assistant message
    const assistantMsg = result.messages[1];
    expect(assistantMsg.role).toBe('assistant');
    
    // Should have multiple segments with interleaved text and tool calls
    expect(assistantMsg.contentSegments.length).toBeGreaterThan(5);
    
    // Verify the order: text, tool, text, tool, text, tool, text
    const segmentTypes = assistantMsg.contentSegments.map(s => s.type);
    expect(segmentTypes.filter(t => t === 'text').length).toBeGreaterThan(0);
    expect(segmentTypes.filter(t => t === 'tool_call').length).toBe(3);
    
    // First segment should be text with markdown
    expect(assistantMsg.contentSegments[0].type).toBe('text');
    if (assistantMsg.contentSegments[0].type === 'text') {
      expect(assistantMsg.contentSegments[0].content).toContain('**markdown rendering**');
      expect(assistantMsg.contentSegments[0].content).toContain('1. First');
    }
    
    // Should have "Read" tool call
    const toolCalls = assistantMsg.contentSegments.filter(s => s.type === 'tool_call');
    expect(toolCalls.some(tc => 
      tc.type === 'tool_call' && tc.toolCall.type === 'read'
    )).toBe(true);
    
    // Should have "Navigate" tool call
    expect(toolCalls.some(tc => 
      tc.type === 'tool_call' && tc.toolCall.type === 'navigate'
    )).toBe(true);
    
    // Should have "Click" tool call
    expect(toolCalls.some(tc => 
      tc.type === 'tool_call' && tc.toolCall.type === 'click'
    )).toBe(true);
    
    // Text after tool calls should contain markdown elements
    const textSegments = assistantMsg.contentSegments.filter(s => s.type === 'text');
    const allText = textSegments.map(s => s.type === 'text' ? s.content : '').join('\n');
    
    expect(allText).toContain('### Test Results');
    expect(allText).toContain('`inline code`');
    expect(allText).toContain('[links](https://github.com)');
    expect(allText).toContain('> **Note:**');
    
    // Code blocks are parsed separately, not in text segments
    expect(assistantMsg.codeBlocks).toBeDefined();
    expect(assistantMsg.codeBlocks!.length).toBeGreaterThan(0);
    expect(assistantMsg.codeBlocks![0].language).toBe('typescript');
  });
  
  it('should maintain correct order of content segments', () => {
    const log = `GitHub Copilot: Text before tool

Ran Click

Text after tool`;
    
    const result = parseLog(log);
    const msg = result.messages[0];
    
    expect(msg.contentSegments).toHaveLength(3);
    expect(msg.contentSegments[0].type).toBe('text');
    expect(msg.contentSegments[1].type).toBe('tool_call');
    expect(msg.contentSegments[2].type).toBe('text');
    
    // Verify order values are sequential
    expect(msg.contentSegments[0].order).toBe(0);
    expect(msg.contentSegments[1].order).toBe(1);
    expect(msg.contentSegments[2].order).toBe(2);
  });
  
  it('should preserve newlines and spaces in user messages', () => {
    const log = `digitarald: Test message with formatting

Error: Database query error: {}
    at createConsoleError (file.js:23)
    at handleError (file.js:45)`;
    
    const result = parseLog(log);
    const userMsg = result.messages[0];
    
    expect(userMsg.role).toBe('user');
    expect(userMsg.contentSegments).toHaveLength(1);
    expect(userMsg.contentSegments[0].type).toBe('text');
    
    if (userMsg.contentSegments[0].type === 'text') {
      const content = userMsg.contentSegments[0].content;
      // Should preserve double newline
      expect(content).toContain('\n\n');
      // Should preserve indentation (4 spaces)
      expect(content).toContain('    at createConsoleError');
      expect(content).toContain('    at handleError');
      // Should preserve all newlines (5 lines total)
      expect(content.split('\n').length).toBe(5);
    }
  });
});
