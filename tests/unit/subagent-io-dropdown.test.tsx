import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { parseLog } from '@/lib/parser';
import ChatMessage from '@/components/ChatMessage';
import planJson from '../../samples/plan.json';

describe('Subagent I/O Dropdown', () => {
  it('displays input and output for subagent orchestrator calls', () => {
    const parsed = parseLog(JSON.stringify(planJson));
    
    // Find the assistant message with the subagent call
    const assistantMessage = parsed.messages.find(m => m.role === 'assistant');
    expect(assistantMessage).toBeDefined();
    
    // Find the subagent tool call
    const subagentSegment = assistantMessage?.contentSegments.find(
      seg => seg.type === 'tool_call' && seg.toolCall.type === 'subagent'
    );
    
    expect(subagentSegment).toBeDefined();
    if (subagentSegment?.type === 'tool_call') {
      const toolCall = subagentSegment.toolCall;
      
      // Verify it has input (the prompt) and output (the result)
      expect(toolCall.isSubagentRoot).toBe(true);
      expect(toolCall.input).toBeDefined();
      expect(toolCall.input).toContain('You are a research subagent');
      expect(toolCall.output).toBeDefined();
      expect(toolCall.output).toContain('Existing patterns summary');
      expect(toolCall.output).toContain('ToolCallType values');
    }
    
    // Render the component
    if (assistantMessage) {
      render(<ChatMessage message={assistantMessage} />);
      
      // Should show the action text
      expect(screen.getByText('Parser pattern research')).toBeInTheDocument();
      
      // Should show "Subagent call" button (it's inside an auto-expanded section)
      const subagentCallToggle = screen.getByText('Subagent call');
      expect(subagentCallToggle).toBeInTheDocument();
      
      // Click to expand subagent I/O section
      fireEvent.click(subagentCallToggle);
      
      // Should show "Prompt:" and "Result:" labels
      expect(screen.getByText('Prompt:')).toBeInTheDocument();
      expect(screen.getByText('Result:')).toBeInTheDocument();
    }
  });
  
  it('shows nested subagent tool calls under the parent', () => {
    const parsed = parseLog(JSON.stringify(planJson));
    
    const assistantMessage = parsed.messages.find(m => m.role === 'assistant');
    expect(assistantMessage).toBeDefined();
    
    const subagentSegment = assistantMessage?.contentSegments.find(
      seg => seg.type === 'tool_call' && seg.toolCall.type === 'subagent'
    );
    
    if (subagentSegment?.type === 'tool_call') {
      const toolCall = subagentSegment.toolCall;
      
      // Should have nested sub-calls
      expect(toolCall.subAgentCalls).toBeDefined();
      expect(toolCall.subAgentCalls!.length).toBeGreaterThan(0);
      
      // Nested calls should have fromSubAgent flag
      const nestedCall = toolCall.subAgentCalls![0];
      expect(nestedCall.fromSubAgent).toBe(true);
    }
  });
});
