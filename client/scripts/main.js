import { initDB, getUser, saveUser, getAllTasks } from './storage/initDb.js';
import { appState } from './state/appState.js';

import { renderTasks } from './RenderUi/render.js';
import { initModals } from './RenderUi/modals.js';
import { initThemeEvents } from './events/themeEvents.js';
import { initTaskEvents } from './events/taskEvents.js';
import { initFormEvents } from './events/formEvents.js';
import { initFilterEvents } from './events/filterEvents.js';
import { initArchiveEvents } from './events/archiveEvents.js';

//stress test import
import { initStressTest } from './stress/stressTest.js';
import { taskList} from './domElements.js';

import { safeAsync } from './TryCatch/safeAsync.js';

import {
  todoContainer,
  logoutBtn
} from './domElements.js';

import { initConnectivity } from './network/connectivity.js';
import { updateGlobalCount } from './network/counts.js';


import { getMe ,logout } from './auth.js';


const LOGIN_PAGE = './pages/login.html';

const bootstrap = safeAsync(async () => {
  console.log('Bootstrap start');

  let user = null;

  try {
    /*
    await getMe()  // returns
    {
      user: {
        email: 'first123@gmail.com',
        name: 'edge1'
      }
    }
   */
    const res = await getMe();
    user = res.user;
  } catch {
    const cached = localStorage.getItem('user');
    if (cached) user = JSON.parse(cached);
  }

  // normalize
  if (user && !user.email && user.userEmail) {
    user.email = user.userEmail;
  }

  // hard guard
  if (!user || !user.email) {
    console.warn(' Invalid user, redirecting:', user);
    localStorage.removeItem('user');
    window.location.href = LOGIN_PAGE;
    return;
  }

  localStorage.setItem('user', JSON.stringify(user));
  appState.currentUser = user;

  initThemeEvents();
  await initDB();

  const localUser = await getUser(user.email);
  if (!localUser) {
    await saveUser({ email: user.email, name: user.name });
  }

  loadDashboard();
});



const loadDashboard = safeAsync(async () => {

  console.log('📦 dashboard loading');

  logoutBtn.addEventListener('click', async () => {
    const ok = confirm('Logout and clear session?');
    if (!ok) return;

    try {
      await logout(); // server + cookie cleanup
    } finally {
      //  realtime cleanup
      appState.socket?.disconnect();

      //  client cleanup
      localStorage.removeItem('user');
      appState.currentUser = null;

      //  full reset 
      window.location.href = LOGIN_PAGE;
    }
  });


  todoContainer.style.display = 'block';

  initConnectivity({
    currentUser: appState.currentUser,
    onRender: async () =>
      renderTasks(await getAllTasks(appState.currentUser.email))
  });

  //stress t est button
  initStressTest({
    stressBtn: document.getElementById('stress-btn'),
    taskList,
    count: 1000,
    holdMs: 10000
  });

  initModals();
  initTaskEvents();
  initFormEvents();
  initFilterEvents();
  initArchiveEvents();

  const tasks = await getAllTasks(appState.currentUser.email);
  renderTasks(tasks);

  await updateGlobalCount();
});

bootstrap();
