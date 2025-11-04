import { render, screen, fireEvent } from '@testing-library/react';
import ChatMessageComponent from '@/components/ChatMessage';
import type { ChatMessage, ToolCall } from '@/lib/parser/types';
import { describe, it, expect } from 'vitest';

function buildToolCall(): ToolCall {
  return {
    type: 'read',
    action: 'Read file',
    input: 'file:///Users/test/project/src/index.ts',
    output: 'console.log("hello")',
    status: 'completed',
    fileEdits: [
      { filePath: '/Users/test/project/src/index.ts', text: 'export const x = 1;' },
      { filePath: '/Users/test/project/src/utils.ts', text: 'export const y = 2;' }
    ]
  };
}

function buildMessage(): ChatMessage {
  const toolCall = buildToolCall();
  return {
    id: 'm1',
    role: 'assistant',
    contentSegments: [
      { type: 'tool_call', toolCall, order: 0 }
    ],
    codeBlocks: [],
  };
}

// Allowed non-selectable icon texts
const ICON_TEXTS = new Set(['▼','▶','✓','✏️','📄','🔎','🌐','🖱️','⌨️','📸','⚙️','▶️']);

describe('ChatMessage selection behavior', () => {
  it('makes action text and file chips selectable (no select-none class)', () => {
    const message = buildMessage();
    render(<ChatMessageComponent message={message} />);

    // Action text should be 'Read' (derived from type + filename)
    const actionSpan = screen.getByText('Read');
    expect(actionSpan).toBeDefined();
    expect(actionSpan.className).not.toMatch(/select-none/);

    // File edit chips
    const fileChipInstances = screen.getAllByText('index.ts');
    for (const chip of fileChipInstances) {
      expect(chip.className).not.toMatch(/select-none/);
    }
    const fileChip2 = screen.getByText('utils.ts');
    expect(fileChip2.className).not.toMatch(/select-none/);
  });

  it('keeps icons non-selectable', () => {
    const message = buildMessage();
    render(<ChatMessageComponent message={message} />);

    // All spans with select-none should be icons only
    const nonSelectableSpans = Array.from(document.querySelectorAll('span.select-none')) as HTMLSpanElement[];
    for (const span of nonSelectableSpans) {
      const text = span.textContent || '';
      // Allow arrow states and normalized variant selectors
      const normalized = text.replace(/\uFE0F/g,'');
      if (!ICON_TEXTS.has(text) && !ICON_TEXTS.has(normalized)) {
        expect.fail(`Found non-icon span with select-none: "${text}"`);
      }
    }
  });

  it('makes detail chrome labels selectable after expansion', () => {
    const message = buildMessage();
    render(<ChatMessageComponent message={message} />);

    // Expand details by clicking header (role button, label uses action)
    const header = screen.getByRole('button', { name: /Toggle details/i });
    fireEvent.click(header);

    const inputLabel = screen.getByText('Input:');
    expect(inputLabel.className).not.toMatch(/select-none/);

    const filesLabel = screen.getByText(/Files Modified/);
    expect(filesLabel.className).not.toMatch(/select-none/);
  });
});
