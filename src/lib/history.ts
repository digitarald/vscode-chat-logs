export interface HistoryEntry {
  id: string; // Unique identifier (gistId or generated ID for files)
  type: 'gist' | 'file';
  gistId?: string; // Only for gist entries
  timestamp: number;
  title?: string; // Optional title/description
}

const HISTORY_KEY = 'copilot-log-history';
const MAX_HISTORY_ENTRIES = 5;

/**
 * Get all history entries from localStorage
 */
export function getHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) {
      return [];
    }
    
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // If parsing fails, return empty array
    return [];
  }
}

/**
 * Add a new entry to history
 * Removes duplicates and maintains max entries limit
 */
export function addToHistory(entry: Omit<HistoryEntry, 'timestamp'>): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    const history = getHistory();
    
    // Create new entry with timestamp
    const newEntry: HistoryEntry = {
      ...entry,
      timestamp: Date.now(),
    };
    
    // Remove any existing entry with the same ID
    const filtered = history.filter(e => e.id !== entry.id);
    
    // Add new entry at the beginning
    const updated = [newEntry, ...filtered];
    
    // Keep only the most recent MAX_HISTORY_ENTRIES
    const trimmed = updated.slice(0, MAX_HISTORY_ENTRIES);
    
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch (error) {
    // Silently fail if localStorage is not available or quota is exceeded
    console.error('Failed to save to history:', error);
  }
}

/**
 * Clear all history entries
 */
export function clearHistory(): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // Silently fail
  }
}

/**
 * Remove a specific entry from history
 */
export function removeFromHistory(id: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    const history = getHistory();
    const filtered = history.filter(e => e.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  } catch {
    // Silently fail
  }
}
