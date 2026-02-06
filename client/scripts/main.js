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

//sync queue
import {runSyncQueue} from './syncEngine/syncEngine.js'


const LOGIN_PAGE = './pages/login.html';

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = LOGIN_PAGE;
}


const bootstrap = safeAsync(async () => {
  console.log('Bootstrap start');
  
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  let user = null;

  try {

    const res = await getMe();//verify token with backend
    user = res.user;
  } catch {
    alert("Token invalid");
  }

  if (!user) {
    const email = localStorage.getItem("userEmail");
    const name = localStorage.getItem("userName");
    if (email) user = { email, name };
  }

  // hard guard
  if (!user || !user.email) {
    console.warn(' Invalid user, redirecting:', user);
    localStorage.removeItem('user');
    window.location.href = LOGIN_PAGE;
    return;
  }

  //save normalise user
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
    await logout();
  } finally {

    appState.socket?.disconnect();

    // FULL cleanup
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');

    appState.currentUser = null;

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


  //sync engine
  setInterval(runSyncQueue, 20000);

  // run once immediately
  runSyncQueue();

  // when internet returns
  window.addEventListener("online", runSyncQueue);
});

bootstrap();
