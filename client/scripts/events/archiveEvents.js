//archive + restore
import {
  archiveBtn,
  restoreBtn,
  workerProgress
} from '../dom/domElements.js';

//global try-catch for async eventlistners functions
import { safeAsync } from '../TryCatch/safeAsync.js';
import { renderTasks } from '../RenderUi/render.js';
import { getAllTasks } from '../storage/initDb.js';
import { initArchiveWorker } from '../workers/archiveController.js';
import { appState } from '../state/appState.js';
import { addTask, upsertQueue } from '../storage/initDb.js';


let archiveWorker;

export function initArchiveEvents() {

  archiveWorker = initArchiveWorker({
    currentUser: appState.currentUser,
    workerProgress,
    onRender: async () => {
      const tasks = await getAllTasks(appState.currentUser.email,appState.workspace);
      await renderTasks(tasks);
    }

  });


  archiveBtn.addEventListener('click', safeAsync(async () => {
    const tasks = await getAllTasks(appState.currentUser.email, appState.workspace);

    const completed = tasks.filter(
      t => t.completed && t.selectedForArchive && !t.archived
    );

    if (!completed.length) return alert('No completed tasks');
    archiveWorker.archive(completed);

    for (const task of completed) {

      // local archive
      task.archived = true;
      task.syncStatus = "pending";
      task.updatedAt = Date.now();
      await addTask(task);

      // queue push
      await upsertQueue({
        id: crypto.randomUUID(),
        action: "update",
        taskId: task.id,
        userEmail: task.userEmail,
        payload: {
          completed:true,
          archived: true
        },
        retry: 0,
        nextRetry: Date.now()
      });
    }

    archiveWorker.archive(completed);
}));


  


  restoreBtn.addEventListener('click', safeAsync(async () => {

      const tasks = await getAllTasks(appState.currentUser.email, appState.workspace);

      const archived = tasks.filter(t => t.archived);
      if (!archived.length) return alert('Nothing to restore');
      archiveWorker.restore(archived);

      for (const task of archived) {

      task.archived = false;
      task.selectedForArchive = false;   
      task.syncStatus = "pending";
      task.updatedAt = Date.now();

      await addTask(task);

      await upsertQueue({
        id: crypto.randomUUID(),
        action: "update",
        taskId: task.id,
        userEmail: task.userEmail,
        payload: {

          archived: false
        },
        retry: 0,
        nextRetry: Date.now()
      });
    }


      archiveWorker.restore(archived);  
}));




}
