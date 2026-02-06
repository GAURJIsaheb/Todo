/*
Hr long poll req 30 second tk alive rhagea if rwesponse else 30 sec baad 204..

2 try krega in case of no connection 3rd rety k baad ---> red---> 90 seconds*/

import { safeAsync } from '../TryCatch/safeAsync.js';


//lonPolled will be the DOM element ,,for ui update
export function initLongPoll({ API_BASE, longPollLed }) {
  let retries = 0;
  const MAX_RETRIES = 2;
  let stopped = false;
  let hasEverConnected = false;
  
   const getAuthHeader = () => ({
    Authorization: "Bearer " + localStorage.getItem("token")
  });

  longPollLed.textContent = '🟡 Connecting…'; // 👈 initial

  const poll = safeAsync(async () => {
    if (stopped) return;

    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${API_BASE}/long-poll`, {
        signal: controller.signal,
        headers: getAuthHeader()
      });
      
      //  token expired case
      if (res.status === 401) {
        longPollLed.textContent = '🔴 Auth expired';
        localStorage.removeItem("token");
        setTimeout(()=>location.href="/pages/login.html",1000);
        return;
      }

      if (!res.ok && res.status !== 204) {
        throw new Error();
      }

      //  FIRST REAL SUCCESS
      hasEverConnected = true;
      retries = 0;

      longPollLed.textContent = '🟢 Long Poll';

      if (res.status !== 204) {
        
        await res.json();
        console.log(' LongPoll response :'+res);
      }

    } catch {
      //  ignore failures BEFORE first success
      if (!hasEverConnected) {
        longPollLed.textContent = '🟡 Connecting…';
      } else {
        retries++;
        if (retries <= MAX_RETRIES) {
          longPollLed.textContent = `🟡 Long Poll (retry ${retries}/2)`;
        } else {
          longPollLed.textContent = '🔴 Long Poll (offline)';
          stopped = true;
          return;
        }
      }
    }

    poll(); // reopen immediately
  }, { silent: true });

  poll();
}
