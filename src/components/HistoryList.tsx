'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getHistory } from '@/lib/history';
import type { HistoryEntry } from '@/lib/history';

export default function HistoryList() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Load history on mount
    const entries = getHistory();
    setHistory(entries);
    setIsVisible(entries.length > 0);
  }, []);

  const getEntryUrl = (entry: HistoryEntry) => {
    if (entry.type === 'gist' && entry.gistId) {
      return `/view?gistId=${entry.gistId}`;
    }
    // File entries can't be reopened (we don't store the content)
    return null;
  };

  const getEntryTitle = (entry: HistoryEntry) => {
    if (entry.title) {
      return entry.title;
    }
    if (entry.type === 'gist' && entry.gistId) {
      return `Gist ${entry.gistId.substring(0, 8)}...`;
    }
    return 'Uploaded file';
  };

  // Don't render anything if no history
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="rounded-lg p-4 mb-6"
      style={{ backgroundColor: '#252526', border: '1px solid #3e3e42' }}
      aria-labelledby="history-heading"
    >
      <h2
        id="history-heading"
        className="text-sm font-medium mb-3"
        style={{ color: '#969696' }}
      >
        Recently opened
      </h2>
      <ul className="space-y-2">
        {history.map((entry) => {
          const url = getEntryUrl(entry);
          const title = getEntryTitle(entry);
          const canReopen = url !== null;

          return (
            <li key={entry.id}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base" aria-hidden="true">
                  {entry.type === 'gist' ? '🔗' : '📄'}
                </span>
                <div className="flex-1 min-w-0">
                  {canReopen ? (
                    <Link
                      href={url}
                      className="text-sm truncate block"
                      style={{ color: '#007acc' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#1a8dd8')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#007acc')}
                    >
                      {title}
                    </Link>
                  ) : (
                    <span
                      className="text-sm truncate block"
                      style={{ color: '#969696' }}
                    >
                      {title}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
