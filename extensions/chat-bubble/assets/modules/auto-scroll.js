const THRESHOLD = 100;

export function createAutoScroll(streamEl) {
  let userSuspended = false;
  const listeners = new Set();

  function isNearBottom() {
    return streamEl.scrollHeight - (streamEl.scrollTop + streamEl.clientHeight) < THRESHOLD;
  }

  function onScroll() {
    if (isNearBottom()) {
      if (userSuspended) {
        userSuspended = false;
        listeners.forEach(fn => fn(false));
      }
    } else if (!userSuspended) {
      userSuspended = true;
      listeners.forEach(fn => fn(true));
    }
  }
  streamEl.addEventListener('scroll', onScroll, { passive: true });

  return {
    scrollToBottom() {
      if (userSuspended) return false;
      streamEl.scrollTop = streamEl.scrollHeight;
      return true;
    },
    forceScrollToBottom() {
      userSuspended = false;
      listeners.forEach(fn => fn(false));
      streamEl.scrollTop = streamEl.scrollHeight;
    },
    isPaused() { return userSuspended; },
    onSuspended(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
