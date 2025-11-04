import { describe, it, expect } from 'vitest';
import { selectLogFile, deriveDisplayTitle, truncateFilename } from '@/lib/select-log-file';
import type { GistData, GistFile } from '@/lib/gist-fetcher';

function makeGist(files: Record<string, GistFile>, description = ''): GistData {
  return {
    id: '1234567890abcdef',
    files,
    description,
    created_at: 'now',
    updated_at: 'now',
  };
}

describe('selectLogFile', () => {
  it('picks .log over other extensions', () => {
    const files = {
      'a.txt': { filename: 'a.txt', content: 'short' },
      'b.log': { filename: 'b.log', content: 'log content' },
      'c.json': { filename: 'c.json', content: '{"x":1}' },
    };
    const selected = selectLogFile(files);
    expect(selected?.filename).toBe('b.log');
  });

  it('picks largest among same extension group', () => {
    const files = {
      'a.log': { filename: 'a.log', content: '123' },
      'b.log': { filename: 'b.log', content: '123456' },
      'c.txt': { filename: 'c.txt', content: 'xx' },
    };
    const selected = selectLogFile(files);
    expect(selected?.filename).toBe('b.log');
  });

  it('falls back to first file when no prioritized extensions exist', () => {
    const files = {
      'README.md': { filename: 'README.md', content: 'docs' },
      'other.md': { filename: 'other.md', content: 'more' },
    };
    const selected = selectLogFile(files);
    expect(selected?.filename).toBe('README.md');
  });
});

describe('deriveDisplayTitle', () => {
  it('returns truncated filename when file selected', () => {
    const files = {
      'very-very-long-filename-to-test-truncation.log': { filename: 'very-very-long-filename-to-test-truncation.log', content: 'content' },
    };
    const gist = makeGist(files);
    const selected = selectLogFile(files)!;
    const title = deriveDisplayTitle(gist, selected);
    expect(title.startsWith('very-very-long')).toBe(true);
    expect(title.includes('…')).toBe(true);
  });

  it('falls back to description when no selected file', () => {
    const gist = makeGist({}, 'My gist description');
    const title = deriveDisplayTitle(gist, null);
    expect(title).toBe('My gist description');
  });

  it('falls back to truncated gist id when no file or description', () => {
    const gist = makeGist({});
    const title = deriveDisplayTitle(gist, null);
    expect(title.startsWith('Gist 12345678')).toBe(true);
  });
});

describe('truncateFilename', () => {
  it('does not truncate short filenames', () => {
    expect(truncateFilename('short.log', 20)).toBe('short.log');
  });
  it('truncates long filenames with centered ellipsis', () => {
    const result = truncateFilename('abcdefghijklmnopqrstuvwxyz.log', 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.includes('…')).toBe(true);
  });
});
