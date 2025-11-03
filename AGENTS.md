# AI Agent Contribution Guide for Copilot Log Viewer

**Last Updated:** November 3, 2025  
**Status:** Publication-ready with critical issues resolved  
**Target Audience:** AI coding assistants (GitHub Copilot, Claude, Cursor, etc.)

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Design Principles](#architecture--design-principles)
3. [Code Standards](#code-standards)
4. [Testing Requirements](#testing-requirements)
5. [Common Tasks](#common-tasks)
6. [File Structure](#file-structure)
7. [Development Workflow](#development-workflow)
8. [AI Agent Guidelines](#ai-agent-guidelines)
9. [Examples](#examples)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Project Overview

### **Purpose**
A static Next.js web application that renders GitHub Copilot VS Code chat logs in a beautiful, VS Code-like interface. Users paste a GitHub Gist URL, and the app fetches and displays the log.

### **Tech Stack**
- **Framework:** Next.js 14 (App Router, Static Export)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Markdown:** react-markdown + remark-gfm (GitHub-flavored markdown)
- **Testing:** Vitest (unit tests only)
- **Deployment:** GitHub Pages via GitHub Actions

### **Key Constraints**
- ✅ Must work as static site (no server-side code)
- ✅ Must support GitHub Gist API rate limits (60 requests/hour unauthenticated)
- ✅ Must implement robust error handling with retries and timeouts
- ✅ Must maintain library-first architecture
- ✅ All code must pass type-check, lint, and tests (zero `any` types)
- ✅ Must maintain accessibility standards (ARIA labels, semantic HTML)
- ✅ Must maintain VS Code aesthetic consistency

---

## 🏗️ Architecture & Design Principles

### **1. Library-First Architecture**

**CRITICAL:** The parser logic is completely decoupled from UI.

```
src/lib/parser/     ← Pure TypeScript, zero UI dependencies
    ↓
src/lib/            ← API/utility layer
    ↓
src/components/     ← React UI components
    ↓
src/app/            ← Next.js pages
```

**Rules:**
- ❌ Parser must NEVER import React, Next.js, or UI components
- ✅ Parser should be testable without any UI
- ✅ All parser functions should be pure (no side effects)
- ✅ Parser types should be exported from `types.ts`

### **2. Testing Philosophy**

**Unit Tests (Focus on comprehensive coverage):**
- Test parser logic exhaustively
- Test edge cases and error handling
- Fast, isolated, no external dependencies
- Test markdown rendering and content segment interleaving
- Aim for >80% code coverage

**Note:** E2E tests were removed in favor of comprehensive unit tests. The parser's interleaved content segments architecture makes unit testing sufficient for verifying correct behavior.

**Anti-pattern:**
```typescript
// ❌ Don't test implementation details
expect(component.state.isOpen).toBe(true);

// ✅ Test data structure and parsing logic
expect(result.messages[0].contentSegments[0].type).toBe('text');
```

### **3. Static Export Constraints**

This app uses `output: 'export'` which means:
- ❌ No API routes (use client-side fetch)
- ❌ No server components with dynamic data
- ❌ No getServerSideProps
- ✅ All data fetching happens client-side
- ✅ Use `'use client'` for interactive components

### **4. Design System**

**Colors (VS Code Dark Theme):**
```typescript
// Background layers
bg-gray-900   // Main background
bg-gray-850   // User messages
bg-gray-800   // Cards/panels
bg-gray-700   // Borders

// Accent colors
purple-600    // Primary actions
blue-700      // Code/file references
green-500     // Success/completed
yellow-400    // In-progress
red-700       // Errors
```

**Typography:**
- Base: `text-sm` (14px)
- Headers: `text-lg` (18px)
- Code: `font-mono`

**Spacing:**
- Cards: `p-4` (16px)
- Gaps: `gap-3` (12px)
- Sections: `py-4` (16px vertical)

---

## 📏 Code Standards

### **TypeScript**

**Always use strict typing:**
```typescript
// ✅ Good
interface Props {
  message: ChatMessage;
  onExpand: (id: string) => void;
}

// ❌ Bad
interface Props {
  message: any;
  onExpand: Function;
}
```

**Prefer type inference where clear:**
```typescript
// ✅ Good - type is obvious
const messages = parseLog(logText);

// ❌ Bad - unnecessary annotation
const messages: ParsedSession = parseLog(logText);
```

**Use discriminated unions:**
```typescript
// ✅ Good
type ToolCallType = 'read' | 'search' | 'navigate' | 'click';
type ContentSegmentType = 'text' | 'tool_call';

interface ToolCall {
  type: ToolCallType;
  action: string;
}

// ❌ Bad
interface ToolCall {
  type: string;
  action: string;
}
```

**NEVER use `any` type - prefer specific types:**
```typescript
// ✅ Good - use union types
interface Variable {
  value?: string | number | boolean | Record<string, unknown> | null;
}

// ✅ Good - use unknown with type guards
function parseData(data: unknown): void {
  if (typeof data === 'string') {
    // data is now string
  }
}

// ✅ Good - use Record for flexible objects
function handle(item: Record<string, unknown>): void {
  const value = item.key as string; // explicit cast with validation
}

// ❌ Bad - `any` defeats type safety
interface Variable {
  value?: any; // NO!
}

// ❌ Bad - overly broad
function handle(item: any): void {}
```

### **React & Next.js**

**Always use 'use client' for interactive components:**
```typescript
// ✅ Good
'use client';

import { useState } from 'react';

export default function InteractiveComponent() {
  const [isOpen, setIsOpen] = useState(false);
  // ...
}
```

**Prefer function components:**
```typescript
// ✅ Good
export default function ChatMessage({ message }: Props) {
  return <div>{message.content}</div>;
}

// ❌ Bad - avoid class components
export default class ChatMessage extends React.Component {
  render() {
    return <div>{this.props.message.content}</div>;
  }
}
```

**Use semantic HTML:**
```typescript
// ✅ Good
<button onClick={handleClick}>Click me</button>

// ❌ Bad
<div onClick={handleClick} className="cursor-pointer">Click me</div>
```

### **Tailwind CSS**

**Use utility classes, avoid custom CSS:**
```typescript
// ✅ Good
<div className="bg-gray-800 rounded-md border border-gray-700 p-4">

// ❌ Bad
<div className="custom-card">
// With custom CSS in globals.css
```

**Maintain responsive design:**
```typescript
// ✅ Good - mobile-first
<div className="text-sm md:text-base lg:text-lg">

// ❌ Bad - desktop-only
<div className="text-lg">
```

### **Naming Conventions**

```typescript
// Files
ChatMessage.tsx           // Components: PascalCase
gist-fetcher.ts          // Utils: kebab-case
parser.test.ts           // Tests: *.test.ts
types.ts                 // Types: types.ts

// Variables
const messageId = '123'; // camelCase
const USER_ROLE = 'user'; // UPPER_CASE for constants

// Functions
function parseMessage() {} // camelCase
function ChatMessage() {}  // PascalCase for components

// Types
interface ChatMessage {}   // PascalCase
type ToolCallType = ...   // PascalCase
```

---

## 🧪 Testing Requirements

### **Unit Test Requirements**

**Every parser function must have tests:**
```typescript
// src/lib/parser/index.ts
export function parseLog(logText: string): ParsedSession {
  // implementation
}

// tests/unit/parser.test.ts
describe('parseLog', () => {
  it('should parse user messages', () => {
    const log = 'digitarald: Hello';
    const result = parseLog(log);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].contentSegments).toHaveLength(1);
    expect(result.messages[0].contentSegments[0].type).toBe('text');
  });

  it('should handle empty input', () => {
    const result = parseLog('');
    expect(result.messages).toHaveLength(0);
  });

  it('should interleave text and tool calls correctly', () => {
    const log = 'GitHub Copilot: Text\n\nRan Click\n\nMore text';
    const result = parseLog(log);
    expect(result.messages[0].contentSegments[0].type).toBe('text');
    expect(result.messages[0].contentSegments[1].type).toBe('tool_call');
    expect(result.messages[0].contentSegments[2].type).toBe('text');
  });
});
```

**Test edge cases:**
```typescript
describe('edge cases', () => {
  it('should handle code blocks without language', () => {
    const log = 'GitHub Copilot: Code:\n```\nconst x = 1;\n```';
    const result = parseLog(log);
    expect(result.messages[0].codeBlocks[0].language).toBe('plaintext');
  });

  it('should preserve markdown in text segments', () => {
    const log = 'GitHub Copilot: **bold** and `code`';
    const result = parseLog(log);
    const textSeg = result.messages[0].contentSegments[0];
    if (textSeg.type === 'text') {
      expect(textSeg.content).toContain('**bold**');
      expect(textSeg.content).toContain('`code`');
    }
  });

  it('should handle consecutive tool calls', () => {
    const log = 'GitHub Copilot: Start\n\nRan Click\nRan Navigate';
    const result = parseLog(log);
    const toolSegments = result.messages[0].contentSegments.filter(s => s.type === 'tool_call');
    expect(toolSegments).toHaveLength(2);
  });
});
```

### **Running Tests**

```bash
# Before committing
npm test                    # Run all unit tests

# During development
npm run test:unit:watch     # Auto-run unit tests with watch mode

# Check coverage
npm run test:unit:coverage  # Should be >80%
```

---

## 📁 File Structure

### **Adding New Files**

**Parser functionality:**
```
src/lib/parser/
├── index.ts           # Main export
├── types.ts           # All interfaces
├── message-parser.ts  # Extract into modules as needed
└── tool-parser.ts     # Keep functions focused
```

**UI components:**
```
src/components/
├── ChatMessage.tsx    # One component per file
├── ToolCall.tsx       # Named exports for subcomponents OK
├── CodeBlock.tsx      # Keep components small (<200 lines)
└── FileReference.tsx  # Extract when logic gets complex
```

**Tests:**
```
tests/
└── unit/
    ├── parser.test.ts          # Parser logic tests
    ├── markdown-test.test.ts   # Markdown & interleaving tests
    └── gist-fetcher.test.ts    # API fetching tests
```

### **Import Conventions**

```typescript
// ✅ Good - use path alias
import { parseLog } from '@/lib/parser';
import ChatMessage from '@/components/ChatMessage';

// ❌ Bad - relative paths from app/
import { parseLog } from '../../../lib/parser';

// ✅ Good - group imports
// 1. External dependencies
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 2. Internal lib
import { parseLog } from '@/lib/parser';

// 3. Components
import ChatMessage from '@/components/ChatMessage';

// 4. Types
import type { ChatMessage as ChatMessageType } from '@/lib/parser/types';
```

---

## 🛠️ Common Tasks

### **Task 1: Add New Tool Call Type**

**Files to modify:**
1. `src/lib/parser/types.ts` - Add to `ToolCallType` union
2. `src/lib/parser/index.ts` - Update `parseToolCall()` method
3. `src/components/ChatMessage.tsx` - Add icon in `getIcon()`
4. `tests/unit/parser.test.ts` - Add test case

**Example:**
```typescript
// 1. types.ts
export type ToolCallType = 
  | 'read'
  | 'search'
  | 'evaluate' // ← Add new type
  | 'other';

// 2. index.ts
private parseToolCall(line: string): ToolCall | null {
  // ... existing patterns ...
  
  const evalMatch = line.match(/^Ran Evaluate JavaScript/);
  if (evalMatch) {
    return {
      type: 'evaluate',
      action: 'Evaluate JavaScript',
      status: 'completed',
    };
  }
  
  return null;
}

// 3. ChatMessage.tsx
const getIcon = () => {
  switch (toolCall.type) {
    case 'evaluate': return '⚡';
    // ... other cases ...
  }
};

// 4. parser.test.ts
it('should parse evaluate tool calls', () => {
  const log = 'GitHub Copilot: Testing\n\nRan Evaluate JavaScript';
  const result = parseLog(log);
  const toolSegments = result.messages[0].contentSegments.filter(s => s.type === 'tool_call');
  if (toolSegments[0].type === 'tool_call') {
    expect(toolSegments[0].toolCall.type).toBe('evaluate');
  }
});
```

### **Task 2: Add New UI Component**

**Checklist:**
- [ ] Create `src/components/NewComponent.tsx`
- [ ] Add TypeScript interface for props
- [ ] Use Tailwind utilities (no custom CSS)
- [ ] Make it accessible (ARIA labels, keyboard navigation)
- [ ] Add data-testid for testing/debugging
- [ ] Export from component file

**Template:**
```typescript
// src/components/NewComponent.tsx
'use client';

import { useState } from 'react';

interface NewComponentProps {
  data: string;
  onAction: (id: string) => void;
}

export default function NewComponent({ data, onAction }: NewComponentProps) {
  const [isActive, setIsActive] = useState(false);

  return (
    <div 
      className="bg-gray-800 rounded-md p-4"
      data-testid="new-component"
    >
      <button
        onClick={() => onAction(data)}
        className="text-purple-400 hover:text-purple-300"
        aria-label="Perform action"
      >
        {data}
      </button>
    </div>
  );
}
```

### **Task 4: Improve Error Handling & Resilience**

**When to improve:**
- API calls need timeout protection
- Operations should retry on transient failures
- Rate limiting needs user-friendly messages
- Network errors should show helpful context

**Example - Adding timeout and retry logic:**
```typescript
export class GistFetcher {
  private readonly timeout = 10000; // 10 seconds
  private readonly maxRetries = 3;

  async fetchGist(gistId: string): Promise<GistData> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const response = await fetch(`${this.baseUrl}/${gistId}`, {
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Check rate limiting
          const remaining = response.headers.get('x-ratelimit-remaining');
          if (remaining === '0') {
            const resetTime = response.headers.get('x-ratelimit-reset');
            throw new Error(`Rate limit exceeded. Try again at ${resetTime}`);
          }

          if (!response.ok) {
            if (response.status === 404) {
              throw new Error('Gist not found. Check the URL.');
            }
            throw new Error(`Failed: ${response.status} ${response.statusText}`);
          }

          return await response.json();
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on client errors
        if (lastError.message.includes('not found')) {
          throw lastError;
        }

        // Retry with exponential backoff
        if (attempt < this.maxRetries) {
          await new Promise(resolve =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
          );
        }
      }
    }

    throw lastError;
  }
}
```

**Key principles:**
- Timeout prevents hanging requests (10s default)
- Retry logic handles transient network issues (exponential backoff)
- Rate limit detection reads GitHub API headers
- Specific error messages help users understand what went wrong
- Don't retry on client errors (404, 403, etc.)

### **Task 5: Update GitHub Actions**

**Files:**
- `.github/workflows/deploy.yml`

**Common updates:**
```yaml
# Add new test step
- name: Run security audit
  run: npm audit --audit-level=high

# Update Node version
- name: Setup Node
  uses: actions/setup-node@v4
  with:
    node-version: '20' # ← Update here

# Add caching
- name: Cache dependencies
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

---

## 🔄 Development Workflow

### **Before Starting Work**

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install dependencies (if package.json changed)
npm install

# 3. Verify setup
npm run type-check
npm run lint
npm test

# 4. Start dev server
npm run dev

# 5. Start test watch mode (in another terminal)
npm run test:unit:watch
```

### **During Development**

**TDD Workflow (Recommended):**
1. ✅ Write failing test
2. ✅ Write minimal code to pass
3. ✅ Refactor
4. ✅ Repeat

**Example session:**
```bash
# Terminal 1: Dev server
npm run dev

# Terminal 2: Test watcher
npm run test:unit:watch

# Terminal 3: Your commands
git status
git add .
git commit -m "feat: add evaluate tool call type"
```

### **Before Committing**

```bash
# 1. Type check
npm run type-check

# 2. Lint
npm run lint

# 3. Format
npx prettier --write .

# 4. Run all tests
npm test

# 5. Build test
npm run build

# 6. Commit
git add .
git commit -m "type: description"

# Commit message format:
# feat: new feature
# fix: bug fix
# docs: documentation
# test: adding tests
# refactor: code refactoring
# style: formatting
# chore: maintenance
```

### **Code Review Checklist**

Before marking work as complete:

- [ ] All tests pass (`npm test`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] Code is formatted (`npx prettier --write .`)
- [ ] New features have unit tests
- [ ] No console.log statements left in code
- [ ] Comments explain "why", not "what"
- [ ] Accessibility attributes added (aria-label, aria-expanded, aria-label, etc.)
- [ ] Mobile responsive
- [ ] Follows existing patterns in codebase
- [ ] No `any` types in TypeScript code
- [ ] Error handling implemented for external APIs (timeouts, retries, rate limits)

---

## 🤖 AI Agent Guidelines

### **When Contributing As An AI**

**DO:**
- ✅ Follow existing patterns in the codebase
- ✅ Ask clarifying questions if requirements are unclear
- ✅ Write tests before implementation (TDD)
- ✅ Keep changes focused and atomic
- ✅ Add comments explaining complex logic
- ✅ Check if similar functionality exists before adding
- ✅ Validate your changes by running tests
- ✅ Consider edge cases and error handling

**DON'T:**
- ❌ Make sweeping changes without discussion
- ❌ Mix multiple concerns in one change
- ❌ Ignore TypeScript errors
- ❌ Skip writing tests
- ❌ Add external dependencies without justification
- ❌ Use `any` type
- ❌ Ignore existing code style
- ❌ Leave TODO comments without creating issues

### **Communication Style**

When working with humans:

```typescript
// ✅ Good - explain your reasoning
// I'm adding a timeout to prevent infinite parsing loops
// that could occur with malformed nested code blocks
const MAX_ITERATIONS = 10000;

// ❌ Bad - unclear purpose
// TODO: fix this
const MAX = 10000;
```

When proposing changes:

```markdown
## Proposed Change: Add Support for Image References

**Problem:** Parser doesn't handle image references in logs

**Solution:** 
1. Add ImageReference type to types.ts
2. Update parseToolCall to detect image patterns
3. Add ImageRef component for rendering

**Test Plan:**
- Unit test for image URL parsing
- Unit test for ImageReference type integration
- Unit test for proper segment ordering with images

**Impact:** 
- ~50 lines added
- 0 breaking changes
- Improves feature completeness
```

### **Debugging Assistance**

When helping debug:

```typescript
// ✅ Good - systematic debugging
// Check 1: Is the regex matching?
console.log('Regex test:', /pattern/.test(line));

// Check 2: What's the actual input?
console.log('Input line:', JSON.stringify(line));

// Check 3: What's being returned?
console.log('Parse result:', result);

// ❌ Bad - vague debugging
// hmm, it's broken
console.log(stuff);
```

### **Suggesting Improvements**

Structure suggestions:

```markdown
**Current Behavior:**
Parser doesn't handle nested code blocks

**Suggested Improvement:**
Add a stack-based approach for tracking code block depth

**Benefits:**
- Handles arbitrary nesting
- More robust parsing
- Clearer code

**Trade-offs:**
- Slightly more complex
- ~20% slower (acceptable for client-side)

**Implementation Effort:** ~2 hours
**Priority:** Medium
```

---

## 📚 Examples

### **Example 1: Adding a New Feature**

**Feature:** Add support for collapsible message groups

```typescript
// 1. Add type
// src/lib/parser/types.ts
export interface MessageGroup {
  id: string;
  title: string;
  messages: ChatMessage[];
}

// 2. Add parser logic
// src/lib/parser/index.ts
private parseMessageGroups(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentGroup: ChatMessage[] = [];
  
  messages.forEach(msg => {
    if (msg.content.startsWith('## ')) {
      if (currentGroup.length > 0) {
        groups.push({
          id: generateId(),
          title: extractTitle(currentGroup[0]),
          messages: currentGroup,
        });
      }
      currentGroup = [msg];
    } else {
      currentGroup.push(msg);
    }
  });
  
  return groups;
}

// 3. Add UI component
// src/components/MessageGroup.tsx
'use client';

import { useState } from 'react';
import ChatMessage from './ChatMessage';
import type { MessageGroup } from '@/lib/parser/types';

export default function MessageGroupComponent({ group }: { group: MessageGroup }) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  return (
    <div className="border-l-2 border-purple-600 pl-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-lg font-semibold mb-2"
      >
        <span>{isExpanded ? '▼' : '▶'}</span>
        <span>{group.title}</span>
      </button>
      {isExpanded && (
        <div>
          {group.messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </div>
      )}
    </div>
  );
}

// 4. Add tests
// tests/unit/parser.test.ts
describe('parseMessageGroups', () => {
  it('should group messages by headers', () => {
    const messages = [
      { content: '## Group 1', ... },
      { content: 'Message 1', ... },
      { content: '## Group 2', ... },
      { content: 'Message 2', ... },
    ];
    
    const groups = parseMessageGroups(messages);
    expect(groups).toHaveLength(2);
    expect(groups[0].title).toBe('Group 1');
  });
});

// 5. Update page to use groups
// src/app/view/[gistId]/page.tsx
const groups = session?.messageGroups || [];
return (
  <div>
    {groups.map(group => (
      <MessageGroupComponent key={group.id} group={group} />
    ))}
  </div>
);
```

### **Example 2: Fixing a Bug**

**Bug:** Parser fails on code blocks with triple backticks inside

```typescript
// 1. Reproduce with test
it('should handle nested triple backticks', () => {
  const log = `
GitHub Copilot: Here's an example:

\`\`\`markdown
# Example
\`\`\`code
nested
\`\`\`
\`\`\`
`;
  
  const result = parseLog(log);
  expect(result.messages[0].codeBlocks).toHaveLength(1);
  expect(result.messages[0].codeBlocks[0].code).toContain('nested');
});

// Test fails ❌

// 2. Debug
// The regex is too greedy and matches all backticks
// Need to track nesting depth

// 3. Fix
private parseCodeBlocks(lines: string[]): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  let depth = 0;
  let currentBlock: string[] = [];
  let language = 'plaintext';
  
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (depth === 0) {
        language = line.trim().slice(3) || 'plaintext';
        depth++;
      } else {
        depth--;
        if (depth === 0) {
          blocks.push({ language, code: currentBlock.join('\n') });
          currentBlock = [];
        } else {
          currentBlock.push(line);
        }
      }
    } else if (depth > 0) {
      currentBlock.push(line);
    }
  }
  
  return blocks;
}

// Test passes ✅

// 4. Add more edge cases
it('should handle multiple nested levels', () => { ... });
it('should handle unclosed code blocks', () => { ... });
```

### **Example 3: Refactoring**

**Goal:** Extract tool call parsing into separate module

```typescript
// Before: All in index.ts (500+ lines)
// After: Split into focused modules

// src/lib/parser/tool-parser.ts
export class ToolCallParser {
  parse(line: string): ToolCall | null {
    return (
      this.parseRanAction(line) ||
      this.parseReadFile(line) ||
      this.parseSearch(line) ||
      null
    );
  }
  
  private parseRanAction(line: string): ToolCall | null {
    const match = line.match(/^Ran\s+(.+?)$/);
    if (!match) return null;
    
    return {
      type: 'run',
      action: match[1].trim(),
      status: 'completed',
    };
  }
  
  private parseReadFile(line: string): ToolCall | null {
    const match = line.match(/^Read\s+\[\]\(file:\/\/(.+?)\)/);
    if (!match) return null;
    
    return {
      type: 'read',
      action: `Read ${match[1].split('/').pop()}`,
      input: match[1],
      status: 'completed',
    };
  }
  
  private parseSearch(line: string): ToolCall | null {
    const match = line.match(/^Searched\s+(.+?),\s*(\d+)\s*results?/);
    if (!match) return null;
    
    return {
      type: 'search',
      action: match[1],
      output: `${match[2]} results`,
      status: 'completed',
    };
  }
}

// src/lib/parser/index.ts
import { ToolCallParser } from './tool-parser';

export class CopilotLogParser {
  private toolParser = new ToolCallParser();
  
  // ... now much cleaner ...
  
  private parseToolCall(line: string): ToolCall | null {
    return this.toolParser.parse(line);
  }
}

// tests/unit/tool-parser.test.ts
describe('ToolCallParser', () => {
  const parser = new ToolCallParser();
  
  describe('parseRanAction', () => {
    it('should parse run actions', () => {
      const result = parser.parse('Ran Navigate to a URL');
      expect(result?.type).toBe('run');
    });
  });
  
  // ... separate test suite ...
});
```

---

## 🔧 Troubleshooting

### **Common Issues**

**Issue: React StrictMode causing double-render bugs**
```typescript
// Problem: useEffect runs twice in development, consuming sessionStorage/state
// Symptom: Content loads on first render but disappears on second render

// Solution: Use a ref to prevent double-execution
const hasLoadedRef = useRef(false);

useEffect(() => {
  async function loadContent() {
    // Prevent double-loading in React StrictMode
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;
    
    // ... rest of loading logic
  }
  loadContent();
}, [dependencies]);
```

**Issue: Types not working**
```bash
# Solution 1: Regenerate Next.js types
npm run dev  # Start and stop server

# Solution 2: Clean and reinstall
rm -rf .next node_modules package-lock.json
npm install
```

**Issue: Tests failing in CI but passing locally**
```bash
# Possible causes:
# 1. Missing environment variables
# 2. Different Node versions
# 3. Cached data

# Solution: Check GitHub Actions logs
# Look for differences in Node version, environment, etc.
```

**Issue: Playwright browser not found**
```bash
# Solution: Reinstall browsers
npx playwright install chromium
```

**Issue: Tailwind classes not working**
```bash
# Check: Is the file in tailwind.config.ts content array?
# Check: Did you restart dev server after adding?
# Check: Is it a custom class that doesn't exist?

# Solution: Restart dev server
npm run dev
```

**Issue: Build fails but dev works**
```bash
# Common cause: Dynamic imports or client-side only code

# Solution: Add 'use client' directive
'use client';

// Or use dynamic import
const Component = dynamic(() => import('./Component'), { ssr: false });
```

### **Debugging Tips**

**Parser debugging:**
```typescript
// Add verbose logging
export function parseLog(logText: string): ParsedSession {
  const DEBUG = true; // Toggle this
  
  if (DEBUG) {
    console.log('Input lines:', logText.split('\n').length);
  }
  
  // ... parsing logic ...
  
  if (DEBUG) {
    console.log('Parsed messages:', messages.length);
    console.log('Tool calls:', messages.flatMap(m => m.toolCalls).length);
  }
  
  return { messages, metadata };
}
```

**React debugging:**
```typescript
// Use React DevTools
// Add display names
Component.displayName = 'ChatMessage';

// Add debug logging
useEffect(() => {
  console.log('ChatMessage mounted:', message.id);
  return () => console.log('ChatMessage unmounted:', message.id);
}, [message.id]);
```

**Test debugging:**
```typescript
// For unit tests
it.only('should debug this test', () => { ... });
```

---

## 📖 Additional Resources

### **Key Files to Understand**

1. **src/lib/parser/index.ts** - Core parsing logic with interleaved content segments
2. **src/lib/parser/types.ts** - Type definitions including ContentSegment discriminated union
3. **src/components/ChatMessage.tsx** - Main UI component with markdown rendering
4. **tests/unit/parser.test.ts** - Parser test examples
5. **tests/unit/markdown-test.test.ts** - Markdown and interleaving tests
6. **next.config.js** - Build configuration

### **External Documentation**

- [Next.js App Router](https://nextjs.org/docs/app)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Vitest API](https://vitest.dev/api/)
- [Playwright API](https://playwright.dev/docs/api/class-test)
- [GitHub Gist API](https://docs.github.com/en/rest/gists)

### **Design Decisions**

**Q: Why static export instead of server components?**
A: To enable GitHub Pages hosting without a server. Keeps deployment simple and costs zero.

**Q: Why library-first architecture?**
A: Parser logic is complex and changes frequently. Keeping it separate:
- Makes testing easier
- Enables reuse in other projects
- Clarifies responsibilities

**Q: Why Vitest over Jest?**
A: Vitest is faster, has better TypeScript support, and works seamlessly with Vite/Next.js.

**Q: Why not use a markdown parser library?**
A: Copilot logs have custom syntax that markdown parsers don't understand. Custom parser gives full control.

**Q: Why use contentSegments instead of separate content and toolCalls arrays?**
A: The interleaved architecture solves the critical bug where all text appeared before all tool calls. ContentSegments maintain the exact order from the log, allowing text and tool calls to flow naturally. This matches how Copilot actually presents information.

**Q: Why use useRef to prevent double-loading?**
A: React StrictMode in development intentionally runs effects twice to catch bugs. For operations that consume resources (like removing from sessionStorage), we use a ref to track completion and prevent the second execution from causing errors. The ref persists across renders but doesn't trigger re-renders, making it ideal for tracking initialization state.

---

## ✅ Final Checklist

Before marking your contribution complete:

- [ ] Code follows TypeScript strict mode
- [ ] All tests pass (`npm test`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code is formatted (`npx prettier --write .`)
- [ ] New features have comprehensive unit tests
- [ ] Test coverage remains >80%
- [ ] No console.log statements in production code
- [ ] No `any` types in TypeScript code
- [ ] Accessibility attributes added where needed (aria-label, aria-expanded, aria-controls)
- [ ] Mobile responsive
- [ ] Follows existing code patterns
- [ ] Comments explain complex logic
- [ ] Error handling implemented for async operations (timeouts, retries, rate limits)
- [ ] Git commit message follows convention
- [ ] AGENTS.md updated if workflow changed