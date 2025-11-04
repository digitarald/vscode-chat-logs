import { describe, it, expect } from 'vitest';
import { parseLog } from '../../src/lib/parser';

describe('CopilotLogParser', () => {
  it('should parse user messages', () => {
    const log = 'digitarald: Test Sign up for Drop with OTP flow';
    const result = parseLog(log);
    
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].contentSegments).toHaveLength(1);
    expect(result.messages[0].contentSegments[0].type).toBe('text');
    if (result.messages[0].contentSegments[0].type === 'text') {
      expect(result.messages[0].contentSegments[0].content).toContain('Test Sign up');
    }
  });

  it('should parse assistant messages', () => {
    const log = "GitHub Copilot: I'll help you test the OTP flow";
    const result = parseLog(log);
    
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('assistant');
    expect(result.messages[0].contentSegments).toHaveLength(1);
  });

  it('should parse tool calls', () => {
    const log = `GitHub Copilot: Testing now

Ran Navigate to a URL
Completed with input: {
  "url": "http://localhost:3000"
}

Read [](file:///path/to/file.tsx)`;
    
    const result = parseLog(log);
    const message = result.messages[0];
    
    expect(message.contentSegments).toBeDefined();
    const toolSegments = message.contentSegments.filter(s => s.type === 'tool_call');
    expect(toolSegments.length).toBeGreaterThan(0);
    
    if (toolSegments[0].type === 'tool_call') {
      expect(toolSegments[0].toolCall.type).toBe('navigate');
      expect(toolSegments[0].toolCall.action).toContain('Navigate');
    }
  });

  it('should parse Simple Browser open line as navigate tool call', () => {
    const log = 'GitHub Copilot: Browser\nOpened Simple Browser at http://localhost:3000/test-otp';
    const result = parseLog(log);
    const message = result.messages[0];
    const toolSegments = message.contentSegments.filter(s => s.type === 'tool_call');
    expect(toolSegments).toHaveLength(1);
    if (toolSegments[0].type === 'tool_call') {
      expect(toolSegments[0].toolCall.type).toBe('navigate');
      expect(toolSegments[0].toolCall.action).toBe('Opened Simple Browser');
      expect(toolSegments[0].toolCall.input).toBe('http://localhost:3000/test-otp');
      expect(toolSegments[0].toolCall.status).toBe('completed');
    }
  });

  it('should parse file references', () => {
    const log = `GitHub Copilot: Checking files

Read [](file:///Users/digitarald/src/cart-context.tsx#200-240)`;
    
    const result = parseLog(log);
    const message = result.messages[0];
    
    expect(message.fileReferences).toBeDefined();
    expect(message.fileReferences![0].path).toContain('cart-context.tsx');
    expect(message.fileReferences![0].lines).toBe('200-240');
  });

  it('should parse code blocks inline as code_block segments', () => {
    const log = `GitHub Copilot: Here's the fix

\`\`\`typescript
const x = 10;
\`\`\``;

    const result = parseLog(log);
    const message = result.messages[0];

    const codeBlockSegments = message.contentSegments.filter((s) => s.type === 'code_block');
    expect(codeBlockSegments.length).toBe(1);
    const seg = codeBlockSegments[0];
    if (seg.type === 'code_block') {
      expect(seg.language).toBe('typescript');
      expect(seg.code).toContain('const x = 10');
    }
  });

  it('should parse task statuses', () => {
    const log = `GitHub Copilot: Working on it

Created 5 todos

Starting: *Fix the bug* (1/5)

Completed: *Fix the bug* (1/5)`;
    
    const result = parseLog(log);
    const message = result.messages[0];
    
    expect(message.tasks).toBeDefined();
    expect(message.tasks!.length).toBe(2);
    expect(message.tasks![0].status).toBe('completed');
    expect(message.tasks![1].status).toBe('completed');
    
    // "Starting" patterns are now tool calls
    const toolCalls = message.contentSegments.filter(s => s.type === 'tool_call');
    expect(toolCalls.length).toBe(1);
    expect(toolCalls[0].type).toBe('tool_call');
    if (toolCalls[0].type === 'tool_call') {
      expect(toolCalls[0].toolCall.type).toBe('todo');
      expect(toolCalls[0].toolCall.action).toContain('Fix the bug');
    }
  });

  it('should generate metadata', () => {
    const log = `digitarald: Test

GitHub Copilot: Response

Ran Click
Read [](file:///test.tsx)`;
    
    const result = parseLog(log);
    
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.totalMessages).toBe(2);
    expect(result.metadata!.toolCallCount).toBeGreaterThan(0);
  });

  it('should parse multi-line tool call inputs', () => {
    const log = `GitHub Copilot: Testing navigation

Ran Navigate to a URL 
Completed with input: {
  "url": "http://localhost:3000"
}

Ran Type text 
Completed with input: {
  "element": "Phone number input field",
  "ref": "e149",
  "text": "+15551234567"
}`;
    
    const result = parseLog(log);
    const message = result.messages[0];
    
    expect(message.contentSegments).toBeDefined();
    const toolSegments = message.contentSegments.filter(s => s.type === 'tool_call');
    expect(toolSegments.length).toBe(2);
    
    // First tool call - Navigate
    if (toolSegments[0].type === 'tool_call') {
      expect(toolSegments[0].toolCall.type).toBe('navigate');
      expect(toolSegments[0].toolCall.action).toBe('Navigate to a URL');
      expect(toolSegments[0].toolCall.input).toBeDefined();
      expect(toolSegments[0].toolCall.input).toContain('"url"');
      expect(toolSegments[0].toolCall.input).toContain('localhost:3000');
    }
    
    // Second tool call - Type
    if (toolSegments[1].type === 'tool_call') {
      expect(toolSegments[1].toolCall.type).toBe('type');
      expect(toolSegments[1].toolCall.action).toBe('Type text');
      expect(toolSegments[1].toolCall.input).toBeDefined();
      expect(toolSegments[1].toolCall.input).toContain('Phone number');
    }
  });

  it('should extract correct tool types from actions', () => {
    const log = `GitHub Copilot: Testing

Ran Navigate to a URL
Ran Click
Ran Type text
Ran Take a screenshot
Ran Page snapshot
Ran Some other action`;
    
    const result = parseLog(log);
    const message = result.messages[0];
    const toolSegments = message.contentSegments.filter(s => s.type === 'tool_call');
    
    expect(toolSegments[0].type).toBe('tool_call');
    if (toolSegments[0].type === 'tool_call') {
      expect(toolSegments[0].toolCall.type).toBe('navigate');
      expect(toolSegments[1].toolCall.type).toBe('click');
      expect(toolSegments[2].toolCall.type).toBe('type');
      expect(toolSegments[3].toolCall.type).toBe('screenshot');
      expect(toolSegments[4].toolCall.type).toBe('screenshot');
      expect(toolSegments[5].toolCall.type).toBe('run');
    }
  });

  it('should handle tool calls without input', () => {
    const log = `GitHub Copilot: Testing

Ran Navigate to a URL
Ran Click`;
    
    const result = parseLog(log);
    const message = result.messages[0];
    const toolSegments = message.contentSegments.filter(s => s.type === 'tool_call');
    
    expect(toolSegments).toBeDefined();
    expect(toolSegments.length).toBe(2);
    if (toolSegments[0].type === 'tool_call') {
      expect(toolSegments[0].toolCall.input).toBeUndefined();
      expect(toolSegments[1].toolCall.input).toBeUndefined();
    }
  });

  it('should handle inline input on same line', () => {
    const log = `GitHub Copilot: Testing

Ran Navigate to a URL
Completed with input: {"url": "http://localhost:3000"}`;
    
    const result = parseLog(log);
    const message = result.messages[0];
    const toolSegments = message.contentSegments.filter(s => s.type === 'tool_call');
    
    if (toolSegments[0].type === 'tool_call') {
      expect(toolSegments[0].toolCall.input).toBeDefined();
      expect(toolSegments[0].toolCall.input).toContain('localhost:3000');
    }
  });

  it('should parse "Got output for task" pattern', () => {
    const log = `GitHub Copilot: Starting tasks

Got output for \`Start Next.js Dev Server\` task

Got output for \`Build Project\` task`;
    
    const result = parseLog(log);
    const message = result.messages[0];
    const toolSegments = message.contentSegments.filter(s => s.type === 'tool_call');
    
    expect(toolSegments).toBeDefined();
    expect(toolSegments.length).toBe(2);
    if (toolSegments[0].type === 'tool_call') {
      expect(toolSegments[0].toolCall.action).toBe('Start Next.js Dev Server');
      expect(toolSegments[0].toolCall.type).toBe('run');
      expect(toolSegments[1].toolCall.action).toBe('Build Project');
    }
  });

  it('should handle multi-line JSON with standalone closing braces', () => {
    const log = `GitHub Copilot: Testing

Ran Navigate to a URL
Completed with input: {
  "url": "http://localhost:3000"
}

Got output for \`Next Task\` task`;
    
    const result = parseLog(log);
    const message = result.messages[0];
    const toolSegments = message.contentSegments.filter(s => s.type === 'tool_call');
    
    expect(toolSegments.length).toBe(2);
    if (toolSegments[0].type === 'tool_call' && toolSegments[1].type === 'tool_call') {
      expect(toolSegments[0].toolCall.input).toContain('localhost:3000');
      expect(toolSegments[1].toolCall.action).toBe('Next Task');
    }
  });

  // NEW TESTS FOR INTERLEAVED CONTENT
  it('should interleave text and tool calls in correct order', () => {
    const log = `GitHub Copilot: Starting test

First text segment

Ran Navigate to a URL

Second text segment

Ran Click

Final text segment`;
    
    const result = parseLog(log);
    const message = result.messages[0];
    
    expect(message.contentSegments).toHaveLength(5);
    expect(message.contentSegments[0].type).toBe('text');
    expect(message.contentSegments[1].type).toBe('tool_call');
    expect(message.contentSegments[2].type).toBe('text');
    expect(message.contentSegments[3].type).toBe('tool_call');
    expect(message.contentSegments[4].type).toBe('text');
    
    if (message.contentSegments[0].type === 'text') {
      expect(message.contentSegments[0].content).toContain('Starting test');
      expect(message.contentSegments[0].content).toContain('First text segment');
    }
    if (message.contentSegments[2].type === 'text') {
      expect(message.contentSegments[2].content).toContain('Second text segment');
    }
    if (message.contentSegments[4].type === 'text') {
      expect(message.contentSegments[4].content).toContain('Final text segment');
    }
  });

  it('should preserve markdown in text segments', () => {
    const log = `GitHub Copilot: Here's a **bold** statement

- Item 1
- Item 2

Ran Navigate to a URL

Here's some \`inline code\` and a [link](https://example.com)`;
    
    const result = parseLog(log);
    const message = result.messages[0];
    
    expect(message.contentSegments[0].type).toBe('text');
    if (message.contentSegments[0].type === 'text') {
      expect(message.contentSegments[0].content).toContain('**bold**');
      expect(message.contentSegments[0].content).toContain('- Item 1');
      expect(message.contentSegments[0].content).toContain('- Item 2');
    }
    
    if (message.contentSegments[2].type === 'text') {
      expect(message.contentSegments[2].content).toContain('`inline code`');
      expect(message.contentSegments[2].content).toContain('[link](https://example.com)');
    }
  });

  it('should handle consecutive tool calls without text between them', () => {
    const log = `GitHub Copilot: Testing

Ran Navigate to a URL
Ran Click
Ran Type text

Done!`;
    
    const result = parseLog(log);
    const message = result.messages[0];
    
    const toolSegments = message.contentSegments.filter(s => s.type === 'tool_call');
    expect(toolSegments.length).toBe(3);
    
    // Should have text before and after tool calls
    expect(message.contentSegments[0].type).toBe('text');
    expect(message.contentSegments[message.contentSegments.length - 1].type).toBe('text');
  });

  it('should handle empty text segments gracefully', () => {
    const log = `GitHub Copilot: 

Ran Navigate to a URL

Ran Click`;
    
    const result = parseLog(log);
    const message = result.messages[0];
    
    // Should filter out empty text segments if they exist
    const textSegments = message.contentSegments.filter(s => s.type === 'text');
    textSegments.forEach(seg => {
      if (seg.type === 'text') {
        expect(seg.content.trim()).not.toBe('');
      }
    });
  });

  it('should parse read file references and extract filename', () => {
    const log = `GitHub Copilot: Let me check the file

Read [](file:///Users/test/project/src/components/Button.tsx)

The file contains...`;
    
    const result = parseLog(log);
    const message = result.messages[0];
    
    expect(message.fileReferences).toHaveLength(1);
    expect(message.fileReferences![0].path).toBe('/Users/test/project/src/components/Button.tsx');
    
    const toolSegments = message.contentSegments.filter(s => s.type === 'tool_call');
    expect(toolSegments).toHaveLength(1);
    
    if (toolSegments[0].type === 'tool_call') {
      expect(toolSegments[0].toolCall.type).toBe('read');
      expect(toolSegments[0].toolCall.action).toBe('Read Button.tsx');
      expect(toolSegments[0].toolCall.input).toBe('/Users/test/project/src/components/Button.tsx');
    }
  });

  it('should handle multiple read file references', () => {
    const log = `GitHub Copilot: Checking files

Read [](file:///path/to/layout.tsx)
Read [](file:///path/to/page.tsx)

All files look good`;
    
    const result = parseLog(log);
    const message = result.messages[0];
    
    expect(message.fileReferences).toHaveLength(2);
    
    const toolSegments = message.contentSegments.filter(s => s.type === 'tool_call');
    expect(toolSegments).toHaveLength(2);
    
    if (toolSegments[0].type === 'tool_call' && toolSegments[1].type === 'tool_call') {
      expect(toolSegments[0].toolCall.action).toBe('Read layout.tsx');
      expect(toolSegments[1].toolCall.action).toBe('Read page.tsx');
    }
  });
});
