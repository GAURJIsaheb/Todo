//Restore and handle task-related events(add,delete,share,upadte)
import {
  taskList,
  completedTaskList,
} from '../domElements.js';

//global try-catch for async eventlistners functions
import { safeAsync } from '../TryCatch/safeAsync.js';

import {
  addTask,
  deleteTaskFromIDB,
  getTaskById
} from '../storage/initDb.js';

import { updateLocalCount } from '../network/counts.js';

import { appState } from '../state/appState.js';
import {moveTaskBetweenLists,
  updateTaskInDOM,
  removeTaskFromDOM } from '../RenderUi/render.js';

import { API_BASE } from '../domElements.js';



export function initTaskEvents() {

  // ✔ checkbox → DB update → server sync → UI redraw
  document.addEventListener('change',safeAsync(async (e) => {
    //console.log("checkbox "+e.target);---- > [object HTMLInputElement]
    if (e.target.type !== 'checkbox') return;

    const li = e.target.closest('li');//checkbox ke jariye  task pkda
    if (!li) return;

    const taskId = li.dataset.id;
    const task = await getTaskById(taskId);
    if (!task) return;

    const isCompletedView = li.parentElement === completedTaskList;
    if (!isCompletedView) {
      task.completed = e.target.checked;
      task.syncStatus = appState.socket?.connected ? 'synced' : 'pending';

      await addTask(task);

      if (appState.socket?.connected) {
        await fetch(`${API_BASE}/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail: appState.currentUser.email,
            completed: task.completed
          })
        });
      }

      moveTaskBetweenLists(task);
      await updateLocalCount();
    } else {
      task.selectedForArchive = e.target.checked;
      await addTask(task);
      updateTaskInDOM(task);
    }


  })
);



  // ✔ buttons  --- > info + edit + delete + share
  taskList.addEventListener('click',safeAsync(async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const li = btn.closest('li');
    const taskId = li.dataset.id;

    const task = await getTaskById(taskId);

    if (!task) return;

    if (btn.classList.contains('info')) {//info button
      document.dispatchEvent(
        //in modal.js
        new CustomEvent('open-info-modal', { detail: task })//trigger event
      );
      return;
    }

    if (btn.classList.contains('edit')) {
      document.dispatchEvent(
        //in modal.js
        new CustomEvent('open-edit-modal', { detail: task })
      );
      return;
    }


    //sender side
    if (btn.classList.contains('share')) {
      const toEmail = prompt('Send task to which email?');
      if (!toEmail) return;

      const res = await fetch(`${API_BASE}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          toEmail: toEmail.trim(),
          taskId: task.id
        })
      });

      if (!res.ok) {
        alert('❌ Failed to send task');
        return;
      }

      btn.textContent = 'Sent!';
      setTimeout(() => (btn.textContent = 'Send'), 2000);

      // IMPORTANT UX MESSAGE
      alert(
      appState.socket?.connected
        ? `📤 Sent to ${toEmail}`
        : `📤 Sent to ${toEmail} (will appear when they come online)`
    );


      return;
    }


    //Delete button
    if (btn.classList.contains('delete')) {
        //  if task was never synced, dont hit the server
            if (task.syncStatus !== 'synced') {
              await deleteTaskFromIDB(taskId);
              removeTaskFromDOM(taskId);
              return;
            }



            if (appState.socket?.connected) {
              await fetch(
                `${API_BASE}/tasks/${taskId}?userEmail=${appState.currentUser.email}`,
                { method: 'DELETE' ,credentials: 'include' }
              );
            }

            await deleteTaskFromIDB(taskId);
            removeTaskFromDOM(taskId);
          }

  })
);




  //Restore Completed button
  completedTaskList.addEventListener('click', safeAsync(async (e) => {
      const btn = e.target.closest('button.restore');
      if (!btn) return;

      const li = btn.closest('li');
      const taskId = li.dataset.id;

      const task = await getTaskById(taskId);
      if (!task) return;

      // local restore
      task.completed = false;
      task.selectedForArchive = false;
      task.syncStatus = appState.socket?.connected ? 'synced' : 'pending';

      await addTask(task);

      //  SERVER UPDATE 
      if (appState.socket?.connected) {
        await fetch(`${API_BASE}/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userEmail: appState.currentUser.email,
            completed: false,
            selectedForArchive: false
          })
        });

        task.syncStatus = 'synced';
        await addTask(task);
      }

      moveTaskBetweenLists(task);
      await updateLocalCount();

}));



}
