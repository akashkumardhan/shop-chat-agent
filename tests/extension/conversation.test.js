import { describe, it, expect, vi } from 'vitest';
import { createConversation } from '../../extensions/chat-bubble/assets/modules/conversation.js';

describe('createConversation', () => {
  it('starts with an empty turn list', () => {
    const c = createConversation();
    expect(c.getTurns()).toEqual([]);
  });

  it('appends user turn with text block', () => {
    const c = createConversation();
    const t = c.appendUserMessage('hi');
    expect(t.role).toBe('user');
    expect(t.blocks).toHaveLength(1);
    expect(t.blocks[0]).toEqual({ type: 'text', content: 'hi' });
    expect(c.getTurns()).toHaveLength(1);
  });

  it('appends assistant turn and returns its id', () => {
    const c = createConversation();
    const t = c.appendAssistantTurn();
    expect(t.role).toBe('assistant');
    expect(t.blocks).toEqual([]);
    expect(typeof t.id).toBe('string');
  });

  it('appends text chunks to the last text block of a turn', () => {
    const c = createConversation();
    const t = c.appendAssistantTurn();
    c.appendTextChunk(t.id, 'Hello, ');
    c.appendTextChunk(t.id, 'world.');
    const turns = c.getTurns();
    expect(turns[0].blocks).toHaveLength(1);
    expect(turns[0].blocks[0]).toEqual({ type: 'text', content: 'Hello, world.' });
  });

  it('appendBlock starts a new block (does not merge with text)', () => {
    const c = createConversation();
    const t = c.appendAssistantTurn();
    c.appendTextChunk(t.id, 'searching:');
    c.appendBlock(t.id, { type: 'tool_use', label: 'Searching', params: 'size 7' });
    c.appendTextChunk(t.id, 'found it');
    const blocks = c.getTurns()[0].blocks;
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('text');
    expect(blocks[1].type).toBe('tool_use');
    expect(blocks[2].type).toBe('text');
  });

  it('notifies subscribers on mutation', () => {
    const c = createConversation();
    const fn = vi.fn();
    c.subscribe(fn);
    c.appendUserMessage('hi');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('supports unsubscribing', () => {
    const c = createConversation();
    const fn = vi.fn();
    const unsubscribe = c.subscribe(fn);
    unsubscribe();
    c.appendUserMessage('hi');
    expect(fn).not.toHaveBeenCalled();
  });

  it('reset clears all turns', () => {
    const c = createConversation();
    c.appendUserMessage('hi');
    c.reset();
    expect(c.getTurns()).toEqual([]);
  });
});
