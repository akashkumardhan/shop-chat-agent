/**
 * conversation — in-memory store of chat turns with subscribers.
 */
export function createConversation() {
  let turns = [];
  const subscribers = new Set();
  let nextId = 0;

  function notify() {
    for (const fn of subscribers) fn(turns);
  }

  function id() {
    nextId += 1;
    return `t${nextId}`;
  }

  return {
    getTurns: () => turns,

    appendUserMessage(text) {
      const turn = { id: id(), role: 'user', blocks: [{ type: 'text', content: text }] };
      turns.push(turn);
      notify();
      return turn;
    },

    appendAssistantTurn() {
      const turn = { id: id(), role: 'assistant', blocks: [] };
      turns.push(turn);
      notify();
      return turn;
    },

    appendBlock(turnId, block) {
      const turn = turns.find(t => t.id === turnId);
      if (!turn) return;
      turn.blocks.push(block);
      notify();
    },

    // Update existing block of matching type in the turn, or append if none exists
    upsertBlock(turnId, block) {
      const turn = turns.find(t => t.id === turnId);
      if (!turn) return;
      const idx = turn.blocks.findIndex(b => b.type === block.type);
      if (idx >= 0) {
        turn.blocks[idx] = block;
      } else {
        turn.blocks.push(block);
      }
      notify();
    },

    // Remove all blocks of a given type from every turn
    removeBlockType(type) {
      let changed = false;
      for (const turn of turns) {
        const before = turn.blocks.length;
        turn.blocks = turn.blocks.filter(b => b.type !== type);
        if (turn.blocks.length !== before) changed = true;
      }
      if (changed) notify();
    },

    appendTextChunk(turnId, chunk) {
      const turn = turns.find(t => t.id === turnId);
      if (!turn) return;
      const last = turn.blocks[turn.blocks.length - 1];
      if (last && last.type === 'text') {
        last.content += chunk;
      } else {
        turn.blocks.push({ type: 'text', content: chunk });
      }
      notify();
    },

    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },

    reset() {
      turns = [];
      notify();
    },
  };
}
