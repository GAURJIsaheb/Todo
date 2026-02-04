//archive + restore
import {
  archiveBtn,
  restoreBtn,
  workerProgress
} from '../domElements.js';

//global try-catch for async eventlistners functions
import { safeAsync } from '../TryCatch/safeAsync.js';
import { renderTasks } from '../RenderUi/render.js';
import { getAllTasks } from '../storage/initDb.js';
import { initArchiveWorker } from '../workers/archiveController.js';
import { appState } from '../state/appState.js';

let archiveWorker;

export function initArchiveEvents() {

  archiveWorker = initArchiveWorker({
    currentUser: appState.currentUser,
    workerProgress,
    onRender: async () => {
      const tasks = await getAllTasks(appState.currentUser.email);
      await renderTasks(tasks);
    }

  });


  archiveBtn.addEventListener('click', safeAsync(async () => {
    const tasks = await getAllTasks(appState.currentUser.email);
    const completed = tasks.filter(
      t => t.completed && t.selectedForArchive && !t.archived
    );

    if (!completed.length) return alert('No completed tasks');
    archiveWorker.archive(completed);//archive
  })
);

  restoreBtn.addEventListener('click', safeAsync(async () => {
    const tasks = await getAllTasks(appState.currentUser.email);
    const archived = tasks.filter(t => t.archived && t.encrypted);

    if (!archived.length) return alert('Nothing to restore');
    archiveWorker.restore(archived);//restore
  })
);

}
