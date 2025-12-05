import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GistFetcher } from '../../src/lib/gist-fetcher';

global.fetch = vi.fn();

describe('GistFetcher', () => {
  let fetcher: GistFetcher;

  beforeEach(() => {
    fetcher = new GistFetcher();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch a basic gist', async () => {
    const mockResponse = {
      id: 'abc123',
      description: 'Test gist',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      files: {
        'test.json': {
          content: '{"test": true}',
          language: 'JSON',
        },
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: new Map([['x-ratelimit-remaining', '60']]),
      json: async () => mockResponse,
    });

    const result = await fetcher.fetchGist('abc123');

    expect(result.id).toBe('abc123');
    expect(result.files['test.json'].content).toBe('{"test": true}');
  });

  it('should fetch truncated content from raw_url', async () => {
    const mockGistResponse = {
      id: 'large123',
      description: 'Large file',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      files: {
        'large.json': {
          content: '{"truncated": true}...',
          truncated: true,
          raw_url:
            'https://gist.githubusercontent.com/user/large123/raw/abc/large.json',
          language: 'JSON',
        },
      },
    };

    const fullContent = '{"full": "This is the complete file content"}';

    // Mock the gist API call
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: new Map([['x-ratelimit-remaining', '60']]),
      json: async () => mockGistResponse,
    });

    // Mock the raw_url fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: async () => fullContent,
    });

    const result = await fetcher.fetchGist('large123');

    expect(result.files['large.json'].content).toBe(fullContent);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as any).mock.calls[1][0]).toContain('raw');
  });

  it('should handle truncated file with failed raw fetch', async () => {
    const mockGistResponse = {
      id: 'fail123',
      description: 'Failed raw fetch',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      files: {
        'file.json': {
          content: '{"truncated": true}',
          truncated: true,
          raw_url: 'https://example.com/raw/fail',
          language: 'JSON',
        },
      },
    };

    // Mock the gist API call
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: new Map([['x-ratelimit-remaining', '60']]),
      json: async () => mockGistResponse,
    });

    // Mock failed raw_url fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await fetcher.fetchGist('fail123');

    // Should fall back to truncated content
    expect(result.files['file.json'].content).toBe('{"truncated": true}');
  });

  it('should extract gist ID from URL', () => {
    expect(
      fetcher.extractGistId('https://gist.github.com/user/abc123')
    ).toBe('abc123');
    expect(fetcher.extractGistId('https://gist.github.com/abc123')).toBe(
      'abc123'
    );
    expect(fetcher.extractGistId('invalid-url')).toBeNull();
  });
});
