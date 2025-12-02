import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addToHistory, getHistory, clearHistory } from '@/lib/history';
import { truncateFilename } from '@/lib/select-log-file';

describe('Uploaded file display in history', () => {
  // Mock localStorage
  let localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    localStorageMock = {};
    
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
      key: vi.fn((index: number) => Object.keys(localStorageMock)[index] || null),
      get length() {
        return Object.keys(localStorageMock).length;
      },
    };
    
    clearHistory();
  });

  it('should display chatreplay.json filename in history', () => {
    const filename = 'remove-tests.chatreplay.json';
    const truncated = truncateFilename(filename);
    
    addToHistory({
      id: 'file-123',
      type: 'file',
      title: truncated,
    });

    const history = getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].title).toBe(truncated);
    expect(history[0].title).not.toBe('Uploaded file');
  });

  it('should truncate long chatreplay.json filenames', () => {
    const longFilename = 'a-very-long-sample-filename-used-for-testing-truncation.chatreplay.json';
    const truncated = truncateFilename(longFilename);
    
    // Should be truncated since default maxLength is 40
    expect(truncated.length).toBeLessThanOrEqual(40);
    expect(truncated).toContain('…');
    
    addToHistory({
      id: 'file-456',
      type: 'file',
      title: truncated,
    });

    const history = getHistory();
    expect(history[0].title).toBe(truncated);
  });

  it('should preserve short filenames without truncation', () => {
    const shortFilename = 'log.json';
    const truncated = truncateFilename(shortFilename);
    
    expect(truncated).toBe(shortFilename);
    expect(truncated).not.toContain('…');
    
    addToHistory({
      id: 'file-789',
      type: 'file',
      title: truncated,
    });

    const history = getHistory();
    expect(history[0].title).toBe(shortFilename);
  });

  it('should use default "Uploaded file" for paste operations without filename', () => {
    addToHistory({
      id: 'file-paste-123',
      type: 'file',
      title: 'Uploaded file',
    });

    const history = getHistory();
    expect(history[0].title).toBe('Uploaded file');
  });

  it('should handle multiple uploaded files with different names', () => {
    const files = [
      'copilot_session_2025-12-01.chatreplay.json',
      'debug_log.json',
      'error_trace.txt',
    ];

    files.forEach((filename, index) => {
      addToHistory({
        id: `file-${index}`,
        type: 'file',
        title: truncateFilename(filename),
      });
    });

    const history = getHistory();
    expect(history).toHaveLength(3);
    
    // Each should have a unique, non-generic title
    const titles = history.map(h => h.title);
    expect(new Set(titles).size).toBe(3);
    expect(titles.every(t => t !== 'Uploaded file')).toBe(true);
  });

  it('should truncate filename with centered ellipsis preserving extension', () => {
    const filename = 'very_long_copilot_session_name_2025-12-02.chatreplay.json';
    const truncated = truncateFilename(filename, 40);
    
    expect(truncated.length).toBeLessThanOrEqual(40);
    expect(truncated).toContain('…');
    // Should preserve the extension at the end
    expect(truncated).toMatch(/\.json$/);
  });
});
