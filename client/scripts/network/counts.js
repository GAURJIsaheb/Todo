//local + global counts
import { getAllTasks } from '../storage/initDb.js';
import { appState } from '../state/appState.js';

import { safeAsync } from '../TryCatch/safeAsync.js';

const API_BASE = 'http://localhost:3000';

function authHeader(){
  const token = localStorage.getItem("token");
  return {
    Authorization: "Bearer " + token
  };
}

//  LOCAL COUNT 
export const updateLocalCount = safeAsync(async () => {
  if (!appState.currentUser) return;

  const tasks = await getAllTasks(appState.currentUser.email);
  const completedCount = tasks.filter(
    t => t.completed && !t.archived
  ).length;

  const el = document.getElementById('local-count');
  if (el) {
    el.textContent = `My Completed: ${completedCount}`;
  }
});



export const updateGlobalCount = safeAsync(async () => {
  const res = await fetch(`${API_BASE}/global-completed`,{
    headers: authHeader()
  });//page load --> not event driven
    if(res.status === 401){
  localStorage.removeItem("token");
  location.href="/pages/login.html";
  }


  if (!res.ok) {
    throw new Error(`Global count failed: ${res.status}`);
  }

  const data = await res.json();

  const el = document.getElementById('global-count');
  if (el) {
    el.textContent = `Global Completed: ${data.totalCompleted}`;
  }
});
