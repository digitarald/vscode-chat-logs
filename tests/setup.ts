import { expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Extend Vitest matchers with Testing Library matchers
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Mock IntersectionObserver
beforeAll(() => {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    takeRecords() {
      return [];
    }
    unobserve() {}
  } as unknown as typeof IntersectionObserver;
});

// Mock ResizeObserver
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
});

// Mock fetch for Gist API
beforeAll(() => {
  global.fetch = vi.fn();
});

afterAll(() => {
  vi.restoreAllMocks();
});

// Helper function to create mock Gist response
export function createMockGistResponse(content: string, filename = 'copilot.log') {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: 'mock-gist-id',
      description: 'Mock Gist',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      files: {
        [filename]: {
          filename,
          content,
          language: 'text',
          size: content.length,
          raw_url: `https://gist.githubusercontent.com/mock/${filename}`,
        },
      },
    }),
  };
}

// Helper function to create mock fetch response
export function mockFetchResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
    redirected: false,
    statusText: ok ? 'OK' : 'Error',
    type: 'basic' as ResponseType,
    url: 'https://api.github.com/gists/mock-id',
    clone: function () {
      return this;
    },
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
  } as Response;
}

// Helper function to wait for async operations
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper to create mock ChatMessage
export function createMockChatMessage(overrides = {}) {
  return {
    id: 'msg_1',
    role: 'user' as const,
    content: 'Test message',
    toolCalls: [],
    codeBlocks: [],
    fileReferences: [],
    tasks: [],
    ...overrides,
  };
}

// Helper to create mock ToolCall
export function createMockToolCall(overrides = {}) {
  return {
    type: 'run' as const,
    action: 'Test action',
    status: 'completed' as const,
    ...overrides,
  };
}

// Helper to create mock ParsedSession
export function createMockSession(overrides = {}) {
  return {
    messages: [createMockChatMessage()],
    metadata: {
      totalMessages: 1,
      toolCallCount: 0,
      fileCount: 0,
    },
    ...overrides,
  };
}

// Console error/warning suppression for expected errors in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Suppress specific expected errors
    const message = args[0]?.toString() || '';
    if (
      message.includes('Not implemented: HTMLFormElement.prototype.submit') ||
      message.includes('Not implemented: navigation') ||
      message.includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: unknown[]) => {
    // Suppress specific expected warnings
    const message = args[0]?.toString() || '';
    if (
      message.includes('componentWillReceiveProps') ||
      message.includes('componentWillMount')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Custom matchers
expect.extend({
  toBeValidGistUrl(received: string) {
    const gistUrlPattern = /^https:\/\/gist\.github\.com\/[\w-]+\/[\w]+$/;
    const pass = gistUrlPattern.test(received);

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid Gist URL`
          : `expected ${received} to be a valid Gist URL`,
    };
  },

  toHaveValidMessageStructure(received: unknown) {
    const message = received as { id?: unknown; role?: string; content?: unknown };
    const hasRequiredFields =
      typeof message.id === 'string' &&
      (message.role === 'user' || message.role === 'assistant') &&
      typeof message.content === 'string';

    return {
      pass: hasRequiredFields,
      message: () =>
        hasRequiredFields
          ? `expected message not to have valid structure`
          : `expected message to have valid structure (id, role, content)`,
    };
  },
});

// Type augmentation for custom matchers
declare module 'vitest' {
  interface Assertion {
    toBeValidGistUrl(): void;
    toHaveValidMessageStructure(): void;
  }
}

// Export cleanup function for manual cleanup in tests if needed
export { cleanup };
