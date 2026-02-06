import { io } from 'https://cdn.socket.io/4.8.1/socket.io.esm.min.js';
import { appState } from '../state/appState.js';
import { CONNECTION_STATES } from './connectionState.js'
import {
  wsLed,
  sseLed,
  longPollLed,
  shortPollLed
} from '../domElements.js';

import {
  addTask,
  getAllTasks
} from '../storage/initDb.js';

import { initSSE } from './sse.js';
import { initLongPoll } from './longPoll.js';
import { initShortPoll } from './shortPoll.js';

//global try-catch for async + sync eventlistners functions
import { safeAsync } from '../TryCatch/safeAsync.js';

const API_BASE = "http://localhost:3000";



let reconnectTimer = null;

let heartbeatTimeout = null



function wsGreen() {
  wsLed.dataset.state = CONNECTION_STATES.GREEN;
  wsLed.textContent = '🟢 Real-time';
}
function wsYellow(msg = 'Reconnecting…') {
  wsLed.dataset.state = CONNECTION_STATES.YELLOW;
  wsLed.textContent = `🟡 ${msg}`;
}
function wsRed() {
  wsLed.dataset.state = CONNECTION_STATES.RED;
  wsLed.textContent = '🔴 Offline';
}

function getToken() {
  return localStorage.getItem('token');
}


export function setChannelState(el, state, label) {
  el.dataset.state = state;
  el.textContent = label;
}







export function initConnectivity({ currentUser, onRender }) {

   window.addEventListener('offline', () => {
      console.warn('🌐 Browser offline');

      wsRed();
      setChannelState(sseLed, CONNECTION_STATES.RED, '🔴 Offline');
      setChannelState(longPollLed, CONNECTION_STATES.RED, '🔴 Offline');
      setChannelState(shortPollLed, CONNECTION_STATES.RED, '🔴 Offline');


      appState.socket?.disconnect();
    });


    window.addEventListener('online', () => {
        console.warn('🌐 Browser online');

        wsYellow('Connecting…');
        setChannelState(sseLed, CONNECTION_STATES.YELLOW, '🟡 Connecting…');
        setChannelState(longPollLed, CONNECTION_STATES.YELLOW, '🟡 Connecting…');
        setChannelState(shortPollLed, CONNECTION_STATES.YELLOW, '🟡 Connecting…');


        //  hard restart everything
        appState.socket?.connect();
        initLongPoll({ API_BASE, longPollLed });
        initShortPoll({ API_BASE, shortPollLed });
      })



     const socket = io(API_BASE, {
        auth: {
          token: getToken()
        },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
      });



  // expose socket to appState 
  appState.socket = socket;



  socket.on('connect', safeAsync(async () => {
    console.log(' WebSocket CONNECTED --->'+ socket.id);
    wsGreen();

     if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    socket.emit('register', appState.currentUser.email);

    // 1.) RESTART FALLBACK CHANNELS
    initSSE({ API_BASE, sseLed });
    initLongPoll({ API_BASE, longPollLed });
    initShortPoll({ API_BASE, shortPollLed });

    


    // 2.) SERVER Truth/Data upholding
    const res = await fetch(
      `${API_BASE}/tasks?userEmail=${appState.currentUser.email}`,{
      headers: {
       Authorization: 'Bearer ' + getToken()
    }}
    );
    const serverTasks = await res.json();

    if (!Array.isArray(serverTasks)) {//array cheeck
    console.warn('⚠️ Server tasks invalid:', serverTasks);
    return;
  }


    //  SERVER → INDEXEDDB...if conflict happens than put the data of server
    for (const task of serverTasks) {
      await addTask({
        ...task,
        userEmail: appState.currentUser.email,
        user: appState.currentUser.name,
        syncStatus: 'synced'//local work mai bhi sync maaro
      });
    }


    //3.)Now Locally-->offline task hua agr kuch vo sync
  //(local → server)--->sync-->Pending tasks
    const localTasks = await getAllTasks(appState.currentUser.email);//from index db

    //  ONLY OFFLINE / UNSYNCED TASKS
    const pendingTasks = localTasks.filter(
      t => t.syncStatus === 'pending' && !t.archived
    );

    for (const task of pendingTasks) {
      //  ensure task exists on server
//handle race condtion by sending POST req-->as post guranty ki task hai index db mai
      await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + getToken()
        },

        body: JSON.stringify({
          id: task.id,//not random new id
          userEmail: appState.currentUser.email,
          username: appState.currentUser.name,
          text: task.text,
          createdAt: task.createdAt,
          originalOwner: task.originalOwner
        })
      });


      //  update state on server 
      await fetch(`${API_BASE}/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + getToken()
        },

        body: JSON.stringify({
          userEmail: appState.currentUser.email,
          completed: task.completed ?? false
        })
      });

      //  mark local as synced
      task.syncStatus = 'synced';
      await addTask(task);
      }

  //4.) ui render
  onRender();
}));




  

  socket.on('reconnect_attempt', (n) => {
    wsLed.dataset.state = CONNECTION_STATES.YELLOW;
    wsLed.textContent = `🟡 Reconnecting (${n}/1)`;
  });

  


   socket.on('disconnect', (reason) => {
      wsYellow('Reconnecting…');
      console.warn('🔌 socket disconnected:', reason);

      if (reconnectTimer) clearTimeout(reconnectTimer);

      reconnectTimer = setTimeout(() => {
        wsRed(); //  FINAL, FORCE
      }, 5000);
    });




  socket.on('heartbeat', (sentAt, ack) => {
    const latency = Date.now() - sentAt;
    console.log(` WebSocket HEARTBEAT received | latency: ${latency}ms`);

    if (heartbeatTimeout) clearTimeout(heartbeatTimeout);//if any heartbeattimer is running cleaar it first
    wsGreen(); //heartbeat recovery
    heartbeatTimeout = setTimeout(() => wsYellow('Unstable'),60000);
    if (ack) {
      console.log('↩ WebSocket HEARTBEAT ack sent');
      ack(sentAt);}
  });

  socket.on('globalCountUpdate', (count) => {//event driven
    const el = document.getElementById('global-count');
    if (el) el.textContent = `Global Completed: ${count}`;
  });


  socket.on('taskCompletedNotification', ({ text, completedBy }) => {
    if (completedBy === appState.currentUser.email) return;//No self notify
    alert(`🔔 ${completedBy} completed: "${text}"`);
  });






  //share
  socket.on('taskShared',  safeAsync(async (payload) => {
  const newTask = {
    id: payload.id,
    text: payload.text,
    completed: false,
    archived: false,
    image: null,
    createdAt: payload.createdAt,
    receivedAt: Date.now(),
    user: appState.currentUser.name,
    originalOwner: payload.originalOwner,
    sharedFromTaskId: payload.sharedFromTaskId,
    syncStatus: 'synced'
  };

  await addTask(newTask);
  onRender(); // renderTasks call

  alert(`📥 Task received from ${payload.originalOwner}`);
}));

  

  socket.on('missedTasks', (count) => {
    alert(`📥 You received ${count} task(s) while offline`);
  });



  // Polls + sse
  initSSE({ API_BASE, sseLed });
  initLongPoll({ API_BASE, longPollLed });
  initShortPoll({ API_BASE, shortPollLed });
}
