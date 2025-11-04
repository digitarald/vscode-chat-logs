import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getHistory, addToHistory, clearHistory, removeFromHistory } from '@/lib/history';
import type { HistoryEntry } from '@/lib/history';

describe('History utility', () => {
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
      length: 0,
      key: vi.fn(() => null),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getHistory', () => {
    it('should return empty array when no history exists', () => {
      const history = getHistory();
      expect(history).toEqual([]);
    });

    it('should return parsed history from localStorage', () => {
      const mockHistory: HistoryEntry[] = [
        { id: 'abc123', type: 'gist', gistId: 'abc123', timestamp: Date.now() },
      ];
      localStorageMock['copilot-log-history'] = JSON.stringify(mockHistory);

      const history = getHistory();
      expect(history).toEqual(mockHistory);
    });

    it('should return empty array if localStorage contains invalid JSON', () => {
      localStorageMock['copilot-log-history'] = 'invalid json';

      const history = getHistory();
      expect(history).toEqual([]);
    });

    it('should return empty array if localStorage contains non-array', () => {
      localStorageMock['copilot-log-history'] = JSON.stringify({ not: 'an array' });

      const history = getHistory();
      expect(history).toEqual([]);
    });
  });

  describe('addToHistory', () => {
    it('should add a new gist entry to history', () => {
      const entry = { id: 'abc123', type: 'gist' as const, gistId: 'abc123' };
      addToHistory(entry);

      const history = getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('abc123');
      expect(history[0].type).toBe('gist');
      expect(history[0].gistId).toBe('abc123');
      expect(history[0].timestamp).toBeDefined();
    });

    it('should add a file entry to history', () => {
      const entry = { id: 'file-123', type: 'file' as const, title: 'My log' };
      addToHistory(entry);

      const history = getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('file-123');
      expect(history[0].type).toBe('file');
      expect(history[0].title).toBe('My log');
    });

    it('should add new entries at the beginning', () => {
      addToHistory({ id: 'first', type: 'gist', gistId: 'first' });
      addToHistory({ id: 'second', type: 'gist', gistId: 'second' });

      const history = getHistory();
      expect(history[0].id).toBe('second');
      expect(history[1].id).toBe('first');
    });

    it('should remove duplicate entries', () => {
      addToHistory({ id: 'abc123', type: 'gist', gistId: 'abc123' });
      addToHistory({ id: 'def456', type: 'gist', gistId: 'def456' });
      addToHistory({ id: 'abc123', type: 'gist', gistId: 'abc123' }); // Duplicate

      const history = getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('abc123'); // Most recent at top
      expect(history[1].id).toBe('def456');
    });

    it('should limit history to 5 entries', () => {
      // Add 10 entries
      for (let i = 0; i < 10; i++) {
        addToHistory({ id: `entry-${i}`, type: 'gist', gistId: `entry-${i}` });
      }

      const history = getHistory();
      expect(history).toHaveLength(5);
      // Most recent entry should be first
      expect(history[0].id).toBe('entry-9');
      // Oldest kept entry should be entry-5
      expect(history[4].id).toBe('entry-5');
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage.setItem to throw an error
      vi.spyOn(global.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('Quota exceeded');
      });

      // Should not throw
      expect(() => {
        addToHistory({ id: 'test', type: 'gist', gistId: 'test' });
      }).not.toThrow();
    });
  });

  describe('clearHistory', () => {
    it('should remove all history entries', () => {
      addToHistory({ id: 'abc123', type: 'gist', gistId: 'abc123' });
      addToHistory({ id: 'def456', type: 'gist', gistId: 'def456' });

      clearHistory();

      const history = getHistory();
      expect(history).toEqual([]);
    });
  });

  describe('removeFromHistory', () => {
    it('should remove a specific entry', () => {
      addToHistory({ id: 'abc123', type: 'gist', gistId: 'abc123' });
      addToHistory({ id: 'def456', type: 'gist', gistId: 'def456' });
      addToHistory({ id: 'ghi789', type: 'gist', gistId: 'ghi789' });

      removeFromHistory('def456');

      const history = getHistory();
      expect(history).toHaveLength(2);
      expect(history.find(e => e.id === 'def456')).toBeUndefined();
      expect(history.find(e => e.id === 'abc123')).toBeDefined();
      expect(history.find(e => e.id === 'ghi789')).toBeDefined();
    });

    it('should handle removing non-existent entry', () => {
      addToHistory({ id: 'abc123', type: 'gist', gistId: 'abc123' });

      removeFromHistory('nonexistent');

      const history = getHistory();
      expect(history).toHaveLength(1);
    });
  });
});
