export interface GistFile {
  filename: string;
  content: string;
  language?: string;
}

export interface GistData {
  id: string;
  files: Record<string, GistFile>;
  description: string;
  created_at: string;
  updated_at: string;
}

export class GistFetcher {
  private baseUrl = 'https://api.github.com/gists';
  private readonly timeout = 10000; // 10 seconds
  private readonly maxRetries = 3;

  async fetchGist(gistId: string): Promise<GistData> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const response = await fetch(`${this.baseUrl}/${gistId}`, {
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Check rate limiting
          const remaining = response.headers.get('x-ratelimit-remaining');
          if (remaining === '0') {
            const resetTime = response.headers.get('x-ratelimit-reset');
            const resetDate = resetTime
              ? new Date(parseInt(resetTime) * 1000).toLocaleTimeString()
              : 'soon';
            throw new Error(
              `GitHub API rate limit exceeded. Please try again at ${resetDate}.`
            );
          }

          if (!response.ok) {
            if (response.status === 404) {
              throw new Error(
                'Gist not found. Please check the URL and try again.'
              );
            } else if (response.status === 403) {
              throw new Error(
                'Access denied. This gist may be private or rate limited.'
              );
            }
            throw new Error(
              `Failed to fetch gist: ${response.status} ${response.statusText}`
            );
          }

          const data = await response.json();

          // Transform the response to include content
          const files: Record<string, GistFile> = {};
          interface RawGistFile {
            content: string;
            language?: string;
          }
          for (const [filename, file] of Object.entries(
            data.files as Record<string, RawGistFile>
          )) {
            files[filename] = {
              filename,
              content: file.content as string,
              language: file.language as string | undefined,
            };
          }

          return {
            id: data.id,
            files,
            description: data.description,
            created_at: data.created_at,
            updated_at: data.updated_at,
          };
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error('Unknown error occurred');

        // Don't retry on client errors (404, 403, etc.)
        if (
          lastError.message.includes('not found') ||
          lastError.message.includes('Access denied')
        ) {
          throw lastError;
        }

        // Retry on network errors
        if (attempt < this.maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
          ); // Exponential backoff
        }
      }
    }

    throw (
      lastError ||
      new Error(
        `Failed to fetch gist after ${this.maxRetries} attempts. Please check your connection and try again.`
      )
    );
  }

  extractGistId(url: string): string | null {
    // Extract from URLs like:
    // https://gist.github.com/username/abc123
    // https://gist.github.com/abc123
    const match = url.match(/gist\.github\.com\/(?:[\w-]+\/)?([\w]+)/);
    return match ? match[1] : null;
  }
}

export const gistFetcher = new GistFetcher();
