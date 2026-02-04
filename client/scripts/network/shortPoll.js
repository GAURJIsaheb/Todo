import { safeAsync } from '../TryCatch/safeAsync.js';
import { setChannelState } from './connectivity.js';
import { CONNECTION_STATES } from './connectionState.js';

export function initShortPoll({ API_BASE, shortPollLed }) {
  let lastSuccessAt = Date.now();
  let stopped = false;

  const RED_AFTER = 30000; // 30 sec silence,,if not single success response in 30 sec,,make it retire

  setChannelState(
    shortPollLed,
    CONNECTION_STATES.YELLOW,
    '🟡 Connecting…'
  );

  const poll = safeAsync(async () => {
    if (stopped) return;

    try {
      const res = await fetch(`${API_BASE}/short-poll`);
      if (!res.ok) throw new Error();

      await res.json();
      lastSuccessAt = Date.now();

      setChannelState(
        shortPollLed,
        CONNECTION_STATES.GREEN,
        '🟢 Short Poll'
      );

    } catch {
      const silentFor = Date.now() - lastSuccessAt;

      if (silentFor > RED_AFTER) {
        setChannelState(
          shortPollLed,
          CONNECTION_STATES.RED,
          '🔴 Short Poll (offline)'
        );
      } else {
        setChannelState(
          shortPollLed,
          CONNECTION_STATES.YELLOW,
          '🟡 Short Poll retrying…'
        );
      }
    }

    setTimeout(poll, 5000);
  }, { silent: true });

  poll();
}
