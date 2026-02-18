import {
  addTask,
  upsertQueue
} from '../storage/initDb.js';

import { safeAsync } from '../TryCatch/safeAsync.js';
import { appState } from '../state/appState.js';

export function initArchiveWorker({
  currentUser,
  workerProgress,
  onRender
}) {

  const worker = new Worker(
    new URL('./archive.worker.js', import.meta.url),
    { type: 'module' }
  );

  let workerMode = null;
  let currentTasks = [];

  worker.onmessage = safeAsync(async (e) => {

    // progress bar
    if (e.data.progress !== undefined) {
      workerProgress.value = e.data.progress;
      return;
    }

    if (!e.data.done) return;

    const result = e.data.result; // encrypted/decrypted data

    /* ================= ARCHIVE ================= */
    if (workerMode === "archive") {

      for (let i = 0; i < result.length; i++) {

        const encrypted = result[i];
        const original = currentTasks[i];

        const updatedTask = {
          ...original,
          archived: true,
          encrypted: true,
          iv: encrypted.iv,
          payload: encrypted.payload,
          text: null,
          image: null,
          syncStatus: "pending",
          updatedAt: Date.now()
        };

        await addTask(updatedTask);

        await upsertQueue({
          id: crypto.randomUUID(),
          action: "update",
          taskId: updatedTask.id,
          userEmail: updatedTask.userEmail,
          workspaceType: updatedTask.workspaceType,
          payload: { completed:true,archived: true },
          retry: 0,
          nextRetry: Date.now()
        });
      }

      onRender();
    }

    /* ================= RESTORE ================= */
    if (workerMode === "restore") {

      for (let i = 0; i < result.length; i++) {

        const decrypted = result[i];
        const original = currentTasks[i];

        const updatedTask = {
          ...original,
          ...decrypted,
          archived: false,
          encrypted: false,
          iv: null,
          payload: null,
          syncStatus: "pending",
          updatedAt: Date.now()
        };

        await addTask(updatedTask);

        await upsertQueue({
          id: crypto.randomUUID(),
          action: "update",
          taskId: updatedTask.id,
          userEmail: updatedTask.userEmail,
          workspaceType: updatedTask.workspaceType,
          payload: { completed:true,archived: false },
          retry: 0,
          nextRetry: Date.now()
        });
      }

      onRender();
    }

    workerProgress.style.display = 'none';
    workerMode = null;
    currentTasks = [];
  });

  /* ================= PUBLIC API ================= */

  return {

    archive(tasks) {
      workerMode = 'archive';
      currentTasks = tasks;

      workerProgress.style.display = 'block';
      workerProgress.value = 0;

      worker.postMessage({
        type: 'encrypt',
        tasks: tasks.map(t => ({
          id: t.id,
          text: t.text,
          image: t.image ?? null,
          createdAt: t.createdAt,
          completed: t.completed,
          userEmail: t.userEmail
        }))
      });
    },

    restore(tasks) {
      workerMode = 'restore';
      currentTasks = tasks;

      workerProgress.style.display = 'block';
      workerProgress.value = 0;

      worker.postMessage({
        type: 'decrypt',
        tasks: tasks.map(t => ({
          iv: t.iv,
          payload: t.payload
        }))
      });
    }
  };
}
