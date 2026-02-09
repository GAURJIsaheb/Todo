//Restore and handle task-related events(add,delete,share,upadte)
import {
  taskList,
  completedTaskList,
} from '../dom/domElements.js';

//global try-catch for async eventlistners functions
import { safeAsync } from '../TryCatch/safeAsync.js';

import { updateGlobalCount , updateLocalCount} from '../network/counts.js';

import {
  addTask,
  addToQueue,
  removeTaskUpdatesFromQueue,
  upsertQueue,
  getTaskById
} from '../storage/initDb.js';

import {authHeaders} from "../auth.js";////  JWT header helper 


import { appState } from '../state/appState.js';
import {moveTaskBetweenLists,updateTaskInDOM,removeTaskFromDOM } from '../RenderUi/render.js';




const API_BASE = "http://localhost:3000";





export function initTaskEvents() {

  // ✔ checkbox → DB update → server sync → UI redraw
  document.addEventListener('change',safeAsync(async (e) => {

    if (e.target.type !== 'checkbox') return;

    const li = e.target.closest('li');//checkbox ke jariye  task pkda
    if (!li) return;

    const taskId = li.dataset.id;
    const task = await getTaskById(taskId);
    if (!task) return;

    const isCompletedView = li.parentElement === completedTaskList;
    if (!isCompletedView) {
      task.completed = e.target.checked;

      //on dit mark it pending
      task.syncStatus = 'pending';
      task.updatedAt = Date.now();
      await addTask(task);

      await upsertQueue({//only queue update no server call
          id:crypto.randomUUID(),
          action:"update",
          taskId:task.id,
          userEmail:appState.currentUser.email,
          workspaceType: appState.workspace, 
          payload:{ completed:task.completed },
          retry:0,
          nextRetry:Date.now()
          });


      moveTaskBetweenLists(task);
      await updateLocalCount();
      await updateGlobalCount();

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
      console.log("check", toEmail, task.id, appState);
      const res = await fetch(`${API_BASE}/share`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          toEmail: toEmail.trim(),
          taskId: task.id,
          createdBy: appState.currentUser.email,
          workspaceType: appState.workspace || "personal", 
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
        : `📤 Sent to ${toEmail} `//when offline
    );


      return;
    }


    //Delete button
    if (btn.classList.contains('delete')) {

      // mark deleted locally always
      task.deleted = true;
      task.syncStatus = 'pending';
      task.updatedAt = Date.now();
      await addTask(task);

      removeTaskFromDOM(taskId);

      //if delete --> thn remove old updates
      await removeTaskUpdatesFromQueue(task.id);

      await addToQueue({//2nd time only queue push no server call
          id: crypto.randomUUID(),
          action:"delete",
          taskId:task.id,
          userEmail:appState.currentUser.email,
          workspaceType: appState.workspace, 
          payload:null,
          retry:0,
          nextRetry:Date.now()
        });

      await updateLocalCount();
      await updateGlobalCount();


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
      task.syncStatus = 'pending';
      task.updatedAt = Date.now();
      await addTask(task);

      await upsertQueue({//again 3rd time
        id:crypto.randomUUID(),
        action:"update",
        taskId:task.id,
        userEmail:appState.currentUser.email,
        payload:{ completed:false },
        workspaceType: appState.workspace, 
        retry:0,
        nextRetry:Date.now()
        });


      moveTaskBetweenLists(task);
      await updateLocalCount();
      await updateGlobalCount();

}));



}
