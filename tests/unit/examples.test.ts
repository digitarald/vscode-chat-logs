import { describe, it, expect } from 'vitest';
import { EXAMPLE_GISTS, formatGistId, getExampleLabel } from '@/lib/examples';

describe('EXAMPLE_GISTS config', () => {
  it('has unique gist IDs', () => {
    const ids = EXAMPLE_GISTS.map(g => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses labels when provided', () => {
    const labeled = EXAMPLE_GISTS.filter(g => g.label);
    expect(labeled.length).toBeGreaterThan(0);
    for (const g of labeled) {
      expect(getExampleLabel(g)).toBe(g.label);
    }
  });

  it('falls back to truncated ID when no label', () => {
    const unlabeled = EXAMPLE_GISTS.filter(g => !g.label);
    for (const g of unlabeled) {
      expect(getExampleLabel(g)).toBe(formatGistId(g.id));
    }
  });

  it('truncates long IDs correctly', () => {
    const id = '123456abcdef7890fedcba654321ffff';
    const truncated = formatGistId(id);
    expect(truncated).toMatch(/^123456…ffff$/);
  });
});
