/**
 * api — single source of truth for backend calls.
 */

const CHAT_URL = '/chat';
const WELCOME_URL = '/welcome';

/**
 * streamChat — opens an SSE connection to /chat.
 *
 * @param {object} payload   { message, conversation_id?, prompt_type?, page_context? }
 * @param {object} handlers  { onEvent(eventObj), onError(err), onClose() }
 * @returns {{ cancel(): void }}
 */
export function streamChat(payload, handlers) {
  const controller = new AbortController();
  const onEvent = handlers.onEvent || (() => {});
  const onError = handlers.onError || (() => {});
  const onClose = handlers.onClose || (() => {});

  (async () => {
    try {
      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        onError(new Error(`Chat request failed: ${res.status}`));
        onClose();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = raw.split('\n').find(l => l.startsWith('data:'));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;
          try {
            onEvent(JSON.parse(json));
          } catch (e) {
            console.warn('[swa] malformed SSE chunk:', json);
          }
        }
      }
      onClose();
    } catch (err) {
      if (err.name !== 'AbortError') onError(err);
      onClose();
    }
  })();

  return { cancel: () => controller.abort() };
}

/**
 * fetchWelcome — requests the welcome bundle.
 */
export async function fetchWelcome({ pageType, pageContext, hasPriorConvo } = {}) {
  const params = new URLSearchParams({
    page_type: pageType || 'unknown',
    has_prior_convo: hasPriorConvo ? '1' : '0',
  });
  if (pageContext) params.set('page_context', JSON.stringify(pageContext));

  const res = await fetch(`${WELCOME_URL}?${params}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Welcome request failed: ${res.status}`);
  return res.json();
}
