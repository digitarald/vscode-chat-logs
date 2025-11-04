'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getHistory, removeFromHistory } from '@/lib/history';
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

  const handleRemove = (id: string) => {
    removeFromHistory(id);
    const updated = getHistory();
    setHistory(updated);
    setIsVisible(updated.length > 0);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    // Less than 1 hour
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return minutes <= 1 ? 'Just now' : `${minutes} minutes ago`;
    }

    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    // Less than 7 days
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    // Otherwise show the date
    return date.toLocaleDateString();
  };

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
      className="rounded-lg p-6 mb-6"
      style={{ backgroundColor: '#252526', border: '1px solid #3e3e42' }}
      aria-labelledby="history-heading"
    >
      <h2
        id="history-heading"
        className="font-semibold mb-3 flex items-center gap-2"
        style={{ color: '#cccccc' }}
      >
        <span>🕐</span>
        Recent Logs
      </h2>
      <p className="text-sm mb-4" style={{ color: '#969696' }}>
        Quick access to your recently viewed chat logs
      </p>
      <ul className="space-y-2">
        {history.map((entry) => {
          const url = getEntryUrl(entry);
          const title = getEntryTitle(entry);
          const canReopen = url !== null;

          return (
            <li
              key={entry.id}
              className="flex items-center justify-between p-3 rounded group"
              style={{
                backgroundColor: '#1e1e1e',
                border: '1px solid #3e3e42',
              }}
            >
              <div className="flex-1 flex items-center gap-3 min-w-0">
                <span className="text-lg" aria-hidden="true">
                  {entry.type === 'gist' ? '🔗' : '📄'}
                </span>
                <div className="flex-1 min-w-0">
                  {canReopen ? (
                    <Link
                      href={url}
                      className="text-sm font-medium truncate block"
                      style={{ color: '#007acc' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#1a8dd8')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#007acc')}
                    >
                      {title}
                    </Link>
                  ) : (
                    <span
                      className="text-sm font-medium truncate block"
                      style={{ color: '#969696' }}
                    >
                      {title}
                    </span>
                  )}
                  <span className="text-xs" style={{ color: '#5a5a5a' }}>
                    {formatTimestamp(entry.timestamp)}
                    {!canReopen && ' • Cannot reopen uploaded files'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleRemove(entry.id)}
                className="p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: '#969696' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#f48771')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#969696')}
                aria-label={`Remove ${title} from history`}
              >
                <span className="text-lg">×</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
