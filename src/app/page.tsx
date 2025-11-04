'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { gistFetcher } from '@/lib/gist-fetcher';
import { parseLog } from '@/lib/parser';
import { addToHistory } from '@/lib/history';
import HistoryList from '@/components/HistoryList';
import { EXAMPLE_GISTS, getExampleLabel, formatGistId } from '@/lib/examples';

export default function HomePage() {
  const router = useRouter();
  const [gistUrl, setGistUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const gistId = gistFetcher.extractGistId(gistUrl);
      
      if (!gistId) {
        setError('Invalid Gist URL. Please use a valid GitHub Gist URL.');
        setLoading(false);
        return;
      }

      // Navigate to the viewer page
      router.push(`/view?gistId=${gistId}`);
    } catch {
      setError('Failed to process Gist URL');
      setLoading(false);
    }
  };

  const handleFileLoad = async (content: string) => {
    try {
      // Validate that the content can be parsed
      parseLog(content);
      
      // Generate a unique ID for file uploads
      const fileId = `file-${Date.now()}`;
      
      // Add to history
      addToHistory({
        id: fileId,
        type: 'file',
        title: 'Uploaded file',
      });
      
      // For large files, store in IndexedDB instead of sessionStorage
      try {
        // Try sessionStorage first (faster)
        sessionStorage.setItem('copilot-log-content', content);
        // Small delay to ensure storage is committed
        await new Promise(resolve => setTimeout(resolve, 50));
        router.push('/view');
      } catch {
        // If sessionStorage fails (quota exceeded), use IndexedDB
        // Wait for IndexedDB write to complete before navigating
        await storeInIndexedDB(content);
        // Small delay to ensure IndexedDB transaction completes
        await new Promise(resolve => setTimeout(resolve, 100));
        router.push('/view?source=idb');
      }
    } catch (err) {
      setError(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const storeInIndexedDB = (content: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CopilotLogDB', 1);
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('logs')) {
          db.createObjectStore('logs');
        }
      };
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['logs'], 'readwrite');
        const store = transaction.objectStore('logs');
        
        store.put(content, 'current');
        
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        
        transaction.onerror = () => reject(new Error('Failed to store in IndexedDB'));
      };
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      await handleFileLoad(content);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError('');

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json') && !file.name.endsWith('.txt')) {
      setError('Please drop a .json or .txt file');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      await handleFileLoad(content);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(to bottom right, #1e1e1e, #252526, #1e1e1e)' }}
    >
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
            style={{ backgroundColor: '#007acc' }}
          >
            <span className="text-4xl">💬</span>
          </div>
          <h1 className="text-4xl font-bold mb-4" style={{ color: '#cccccc' }}>
            VS Code Chat Log Viewer
          </h1>
          <p className="text-lg" style={{ color: '#969696' }}>
            Paste a GitHub Gist URL or drop a JSON/text file to view your Copilot chat log
          </p>
        </div>

        {/* History List */}
        <HistoryList />

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            borderWidth: '2px',
            borderStyle: 'dashed',
            borderRadius: '0.5rem',
            padding: '2rem',
            textAlign: 'center',
            marginBottom: '1.5rem',
            borderColor: isDragging ? '#007acc' : '#3e3e42',
            backgroundColor: isDragging ? 'rgba(0, 122, 204, 0.1)' : 'rgba(37, 37, 38, 0.5)',
            transition: 'all 0.15s',
          }}
          className=""
        >
          <div className="text-4xl mb-3">📁</div>
          <p className="mb-2 font-medium" style={{ color: '#cccccc' }}>
            Drop your chat log file here
          </p>
          <p className="text-sm mb-4" style={{ color: '#969696' }}>
            Supports .json (exported chat) and .txt (copied chat) files
          </p>
          <label className="inline-block" htmlFor="file-input">
            <input
              id="file-input"
              type="file"
              accept=".json,.txt"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Upload chat log file (JSON or text format)"
            />
            <span className="cursor-pointer text-sm underline" style={{ color: '#007acc' }}>
              or click to browse files
            </span>
          </label>
        </div>

        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t w-full" style={{ borderColor: '#3e3e42' }}></div>
          <span
            className="absolute px-4 text-sm"
            style={{ backgroundColor: '#1e1e1e', color: '#969696' }}
          >
            OR
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="gist-url" className="block text-sm mb-2" style={{ color: '#969696' }}>
              GitHub Gist URL
            </label>
            <input
              id="gist-url"
              type="text"
              value={gistUrl}
              onChange={(e) => setGistUrl(e.target.value)}
              placeholder="https://gist.github.com/username/abc123..."
              className="w-full px-4 py-4 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
              aria-label="GitHub Gist URL"
              aria-describedby={error ? 'error-message' : undefined}
              style={{
                backgroundColor: '#252526',
                border: '1px solid #3e3e42',
                color: '#cccccc',
              }}
              disabled={loading}
            />
          </div>

          {error && (
            <div
              id="error-message"
              className="rounded-lg p-4"
              style={{
                backgroundColor: 'rgba(244, 135, 113, 0.3)',
                border: '1px solid #f48771',
                color: '#f48771',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!gistUrl || loading}
            className="w-full text-white font-semibold py-4 px-6 rounded-lg transition-colors"
            style={{
              backgroundColor: !gistUrl || loading ? '#3e3e42' : '#007acc',
              cursor: !gistUrl || loading ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!(!gistUrl || loading)) {
                e.currentTarget.style.backgroundColor = '#1a8dd8';
              }
            }}
            onMouseLeave={(e) => {
              if (!(!gistUrl || loading)) {
                e.currentTarget.style.backgroundColor = '#007acc';
              }
            }}
          >
            {loading ? 'Loading...' : 'View Chat Log from Gist'}
          </button>
        </form>

        {/* Example Gists (now data-driven & label-aware) */}
        <div
          className="mt-12 rounded-lg p-6"
          style={{ backgroundColor: '#252526', border: '1px solid #3e3e42' }}
          aria-labelledby="example-gists-heading"
        >
          <h2
            id="example-gists-heading"
            className="font-semibold mb-3 flex items-center gap-2"
            style={{ color: '#cccccc' }}
          >
            <span>🔗</span>
            Example Gists
          </h2>
          <p className="text-sm mb-4" style={{ color: '#969696' }}>
            Quick samples – open one to see the viewer:
          </p>
          <div className="flex flex-wrap gap-2" aria-label="Example Copilot chat logs">
            {EXAMPLE_GISTS.map((gist) => {
              const display = getExampleLabel(gist);
              const truncated = formatGistId(gist.id);
              return (
                <Link
                  key={gist.id}
                  href={`/view?gistId=${gist.id}`}
                  className="px-3 py-1 rounded-full text-xs font-medium focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: '#2d2d2d',
                    border: '1px solid #3e3e42',
                    color: '#cccccc',
                  }}
                  aria-label={`Open example chat log ${display} (${truncated})`}
                >
                  {display}
                </Link>
              );
            })}
          </div>
        </div>

        <div
          className="mt-12 rounded-lg p-6"
          style={{ backgroundColor: '#252526', border: '1px solid #3e3e42' }}
        >
          <h2 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#cccccc' }}>
            <span>📝</span>
            How to use:
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2" style={{ color: '#cccccc' }}>
                Option 1: Drop a file
              </h3>
              <ol className="space-y-1 text-sm ml-4" style={{ color: '#969696' }}>
                <li>• Export your chat from VS Code (as JSON)</li>
                <li>• Drag and drop the file above</li>
              </ol>
            </div>
            <div>
              <h3 className="font-medium mb-2" style={{ color: '#cccccc' }}>
                Option 2: Use a Gist URL
              </h3>
              <ol className="space-y-1 text-sm ml-4" style={{ color: '#969696' }}>
                <li>• Copy your chat log from VS Code</li>
                <li>• Create a GitHub Gist and paste the log</li>
                <li>• Paste the Gist URL above</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
