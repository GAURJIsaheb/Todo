//20 second tk try
import { setChannelState } from './connectivity.js';
import { CONNECTION_STATES } from './connectionState.js';

let retryTimer = null;

function startRetryWindow(sse, sseLed) {
  if (retryTimer) clearTimeout(retryTimer);

  retryTimer = setTimeout(() => {
    setChannelState(
      sseLed,
      CONNECTION_STATES.RED,
      '🔴 SSE (stopped)'
    );

    sse.close();
    console.warn('⛔ SSE stopped after 20s retry');
  }, 20000);
}

export function initSSE({ API_BASE, sseLed }) {
  const sse = new EventSource(`${API_BASE}/sse`);

  // start window immediately
  startRetryWindow(sse, sseLed);

  sse.onopen = () => {
    setChannelState(
      sseLed,
      CONNECTION_STATES.GREEN,
      '🟢 SSE'
    );

    // refresh window (connection alive)
    startRetryWindow(sse, sseLed);
  };

  sse.onmessage = () => {
    // message received = proof of life
    startRetryWindow(sse, sseLed);
  };

  sse.onerror = () => {
    setChannelState(
      sseLed,
      CONNECTION_STATES.YELLOW,
      '🟡 SSE reconnecting…'
    );

    // keep retry window alive
    startRetryWindow(sse, sseLed);
  };

  window.addEventListener('beforeunload', () => {
    if (retryTimer) clearTimeout(retryTimer);
    sse.close();
  });
}
