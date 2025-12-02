import { render, screen, fireEvent } from '@testing-library/react';
import ChatMessageComponent from '@/components/ChatMessage';
import type { ChatMessage, ThinkingSegment } from '@/lib/parser/types';
import { describe, it, expect } from 'vitest';

function buildThinkingMessage(): ChatMessage {
  const thinkingSegment: ThinkingSegment = {
    type: 'thinking',
    content: 'The user wants to test thinking segments. I need to verify the rendering.',
    order: 0,
  };

  return {
    id: 'm1',
    role: 'assistant',
    contentSegments: [
      thinkingSegment,
      { type: 'text', content: 'Here is my response.', order: 1 },
    ],
  };
}

describe('Thinking segment rendering', () => {
  it('renders thinking segments with brain icon and collapsed by default', () => {
    const message = buildThinkingMessage();
    render(<ChatMessageComponent message={message} />);

    // Should show the brain emoji
    const brainIcon = screen.getByText('🧠');
    expect(brainIcon).toBeDefined();

    // Should show "Thinking" label
    const thinkingLabel = screen.getByText('Thinking');
    expect(thinkingLabel).toBeDefined();

    // Should show collapse arrow (▶) since collapsed by default
    const collapseArrow = screen.getByText('▶');
    expect(collapseArrow).toBeDefined();

    // Content should NOT be visible when collapsed
    expect(screen.queryByText(/test thinking segments/)).toBeNull();
  });

  it('expands thinking content when clicked', () => {
    const message = buildThinkingMessage();
    render(<ChatMessageComponent message={message} />);

    // Click the toggle button
    const toggleButton = screen.getByRole('button', { name: /Toggle AI reasoning/i });
    fireEvent.click(toggleButton);

    // Arrow should change to ▼
    const expandArrow = screen.getByText('▼');
    expect(expandArrow).toBeDefined();

    // Content should now be visible
    expect(screen.getByText(/test thinking segments/)).toBeDefined();
  });

  it('renders text segment alongside thinking segment', () => {
    const message = buildThinkingMessage();
    render(<ChatMessageComponent message={message} />);

    // Text content should be visible (not in thinking box)
    expect(screen.getByText('Here is my response.')).toBeDefined();
  });

  it('has proper aria attributes on thinking toggle', () => {
    const message = buildThinkingMessage();
    render(<ChatMessageComponent message={message} />);

    const toggleButton = screen.getByRole('button', { name: /Toggle AI reasoning/i });

    // Should have aria-expanded="false" when collapsed
    expect(toggleButton.getAttribute('aria-expanded')).toBe('false');

    // Click to expand
    fireEvent.click(toggleButton);

    // Should have aria-expanded="true" when expanded
    expect(toggleButton.getAttribute('aria-expanded')).toBe('true');
  });
});
