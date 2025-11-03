'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { gistFetcher } from '@/lib/gist-fetcher';
import { parseLog } from '@/lib/parser';
import type { ParsedSession } from '@/lib/parser/types';
import ChatMessageComponent from '@/components/ChatMessage';

function ViewerContent() {
  const searchParams = useSearchParams();
  const gistId = searchParams.get('gistId');
  
  const [session, setSession] = useState<ParsedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    async function loadContent() {
      // Prevent double-loading in React StrictMode
      if (hasLoadedRef.current) {
        return;
      }
      hasLoadedRef.current = true;
      
      try {
        setLoading(true);
        
        // Check URL parameter for source
        const source = searchParams.get('source');
        
        if (source === 'idb') {
          // Load from IndexedDB
          const content = await loadFromIndexedDB();
          if (content) {
            const parsed = parseLog(content);
            setSession(parsed);
            setLoading(false);
            return;
          } else {
            setError('Failed to load content from storage');
            setLoading(false);
            return;
          }
        }
        
        // Check if we have content in sessionStorage (from file upload)
        const storedContent = sessionStorage.getItem('copilot-log-content');
        
        if (storedContent) {
          // Clear it after reading
          sessionStorage.removeItem('copilot-log-content');
          const parsed = parseLog(storedContent);
          setSession(parsed);
          setLoading(false);
          return;
        }
        
        // Otherwise, load from Gist
        if (!gistId) {
          setError('No Gist ID or content provided');
          setLoading(false);
          return;
        }
        
        const gist = await gistFetcher.fetchGist(gistId);
        
        // Find the log file (first .log, .txt, or .json file, or first file)
        const logFile = Object.values(gist.files).find(
          f => f.filename.endsWith('.log') || 
               f.filename.endsWith('.txt') || 
               f.filename.endsWith('.json')
        ) || Object.values(gist.files)[0];

        if (!logFile) {
          throw new Error('No log file found in Gist');
        }

        const parsed = parseLog(logFile.content);
        setSession(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    }

    loadContent();
  }, [gistId, searchParams]);

  const loadFromIndexedDB = (): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CopilotLogDB', 1);
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['logs'], 'readonly');
        const store = transaction.objectStore('logs');
        const getRequest = store.get('current');
        
        getRequest.onsuccess = () => {
          db.close();
          resolve(getRequest.result || null);
        };
        
        getRequest.onerror = () => {
          db.close();
          reject(new Error('Failed to load from IndexedDB'));
        };
      };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1e1e1e' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#007acc' }}></div>
          <p style={{ color: '#969696' }}>Loading chat log...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#1e1e1e' }}>
        <div className="max-w-md w-full rounded-lg p-6" style={{ backgroundColor: '#252526', border: '1px solid #f48771' }}>
          <div className="text-4xl mb-4" style={{ color: '#f48771' }}>⚠️</div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: '#cccccc' }}>Error Loading Content</h2>
          <p className="mb-4" style={{ color: '#969696' }}>{error}</p>
          <Link 
            href="/"
            className="inline-block text-white font-semibold py-2 px-4 rounded transition-colors"
            style={{ backgroundColor: '#007acc' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a8dd8'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#007acc'}
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1e1e1e', color: '#cccccc' }}>
      <div>
        {/* Header */}
        <div className="px-4 py-3 sticky top-0 z-10 backdrop-blur-sm" style={{ backgroundColor: 'rgba(37, 37, 38, 0.95)', borderBottom: '1px solid #3e3e42' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link 
                href="/"
                className="transition-colors"
                style={{ color: '#969696' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#cccccc'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#969696'}
              >
                ←
              </Link>
              <h1 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#cccccc' }}>
                <span>💬</span>
                GitHub Copilot Chat Log
              </h1>
            </div>
            
            {session?.metadata && (
              <div className="flex gap-4 text-sm" style={{ color: '#969696' }}>
                <span>{session.metadata.totalMessages} messages</span>
                <span>{session.metadata.toolCallCount} tool calls</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Chat Messages */}
        <div style={{ borderTop: '1px solid #3e3e42' }}>
          {session?.messages.map((message, index) => (
            <div key={message.id} style={{ borderBottom: index < session.messages.length - 1 ? '1px solid #3e3e42' : 'none' }}>
              <ChatMessageComponent message={message} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center py-8 text-sm" style={{ borderTop: '1px solid #3e3e42', color: '#969696' }}>
          <p>End of conversation</p>
        </div>
      </div>
    </div>
  );
}

export default function ViewerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1e1e1e' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#007acc' }}></div>
          <p style={{ color: '#969696' }}>Loading...</p>
        </div>
      </div>
    }>
      <ViewerContent />
    </Suspense>
  );
}
