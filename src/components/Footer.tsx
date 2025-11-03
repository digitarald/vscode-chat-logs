'use client';

export default function Footer() {
  return (
    <footer className="py-6 px-4 text-center text-sm" style={{ borderTop: '1px solid #3e3e42', color: '#969696' }}>
      <div className="max-w-5xl mx-auto">
        <p>
          Built with ❤️ by{' '}
          <a
            href="https://x.com/digitarald"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors"
            style={{ color: '#007acc' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#1a8dd8'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#007acc'}
          >
            @digitarald
          </a>
          {' '}(
          <a
            href="https://github.com/digitarald/vscode-chat-logs"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors"
            style={{ color: '#007acc' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#1a8dd8'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#007acc'}
          >GitHub</a>
          )
        </p>
      </div>
    </footer>
  );
}
