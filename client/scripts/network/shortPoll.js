import { safeAsync } from '../TryCatch/safeAsync.js';
import { setChannelState } from './connectivity.js';
import { CONNECTION_STATES } from './connectionState.js';

function authHeader(){
  const token = localStorage.getItem("token");
  return token ? { Authorization: "Bearer " + token } : {};
}

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
      const res = await fetch(`${API_BASE}/short-poll`,{
        headers: authHeader()
      });
      if (!res.ok){
        if(res.status === 401){
          console.warn("JWT expired → redirect login");
          localStorage.removeItem("token");
          setTimeout(()=>location.href="/pages/login.html",1000);
          return;
        }
        throw new Error();
      }

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
