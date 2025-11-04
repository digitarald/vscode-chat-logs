import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatMessage from '@/components/ChatMessage';
import { parseLog } from '@/lib/parser';

// JSON fixture with one parent tool call and one nested subagent tool call
const jsonFixture = {
  requesterUsername: 'digitarald',
  responderUsername: 'GitHub Copilot',
  requests: [
    {
      requestId: 'req-parent',
      message: { text: 'Start subagent work' },
      response: [
        {
          kind: 'toolInvocationSerialized',
          invocationMessage: 'Parser pattern research',
          pastTenseMessage: 'Parser pattern research',
          toolId: 'runSubagent',
          toolCallId: 'tc-parent',
          isComplete: true
        },
        {
          kind: 'toolInvocationSerialized',
          invocationMessage: 'Read [](file:///workspace/index.ts)',
          pastTenseMessage: 'Read [](file:///workspace/index.ts)',
          toolId: 'copilot_readFile',
          toolCallId: 'tc-child',
          isComplete: true,
          fromSubAgent: true
        }
      ]
    }
  ]
};

describe('Subagent icon & default expansion', () => {
  it('shows 🤖 icon for parent subagent root and nested subagent calls; parent expanded', () => {
    const parsed = parseLog(JSON.stringify(jsonFixture));
    const assistant = parsed.messages.find(m => m.role === 'assistant');
    expect(assistant).toBeTruthy();
    // Only one top-level tool call segment (child nested)
    const topLevelToolCalls = assistant!.contentSegments.filter(s => s.type === 'tool_call');
    expect(topLevelToolCalls.length).toBe(1);

    render(<ChatMessage message={assistant!} />);

    // Robot icon should appear twice: root subagent orchestrator and nested call indicator
    const robotIcons = screen.getAllByText('🤖');
    expect(robotIcons.length).toBe(2);
    // Root should have dedicated data-testid
    expect(screen.getByTestId('subagent-root-icon')).toBeTruthy();

    // Parent should be expanded (details container rendered with nested call)
    // Use aria-label since text is split across spans
    const nestedReadToggle = screen.getByLabelText('Toggle details for Read index.ts');
    expect(nestedReadToggle).toBeTruthy();

    // Indentation: nested tool call wrapper applies inline margin-left style (12px)
    // The clickable region is nested inside the wrapper, so parentElement should be the wrapper.
    const nestedWrapper = nestedReadToggle.parentElement;
    expect(nestedWrapper).toBeTruthy();
    if (nestedWrapper) {
      const styleAttr = nestedWrapper.getAttribute('style') || '';
      expect(styleAttr).toMatch(/margin-left:\s*12px/);
    }
  });
});
