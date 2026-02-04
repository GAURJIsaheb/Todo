import { addTask, getAllTasks, deleteTaskFromIDB } from '../storage/initDb.js';
import { safeAsync } from '../TryCatch/safeAsync.js';

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
  const imageCache = new Map();

worker.onmessage = safeAsync(async (e) => {
    // progress update
    if (e.data.progress !== undefined) {
      workerProgress.value = e.data.progress;
      return;
    }

    if (!e.data.done) return;

    const allTasks = await getAllTasks(currentUser.email);

    // ARCHIVE FLOW
    if (workerMode === 'archive') {
      const completed = allTasks.filter(
        t => t.completed && t.selectedForArchive && !t.archived
      );

      for (let i = 0; i < completed.length; i++) {
        completed[i].selectedForArchive = false;

        if (completed[i].image) {
          imageCache.set(completed[i].id, completed[i].image);
        }


        await deleteTaskFromIDB(completed[i].id);

        await addTask({
          id: completed[i].id,             
          archived: true,
          encrypted: true,                 
          encryptedPayload: e.data.result[i],
          completed: true,
          userEmail: currentUser.email,
          userName: currentUser.name
        });
      }
    }

    // RESTORE FLOW
    if (workerMode === 'restore') {
      const archived = allTasks.filter(t => t.archived && t.encrypted);

      for (let i = 0; i < archived.length; i++) {
        await deleteTaskFromIDB(archived[i].id);

        const plain = e.data.result[i];//get decrpt data as worker has used key for encrption
        const restoredImage = imageCache.get(plain.id) ?? null;

        await addTask({
            ...plain,
            archived: false,
            encrypted: false,
            encryptedPayload: null,
            completed: true,
            userEmail: currentUser.email,
            userName: currentUser.name,
            syncStatus: 'pending',
          image: restoredImage
        });

        imageCache.delete(plain.id);
      }
    }

    workerProgress.style.display = 'none';
    workerMode = null;
    onRender();//from main.js 
  });

  //  PUBLIC API (for main.js)
  return {
    archive(tasks) {
      workerMode = 'archive';
      workerProgress.style.display = 'block';
      workerProgress.value = 0;

      worker.postMessage({
        type: 'encrypt',
        tasks: tasks.map(t => ({
          id: t.id,
          text: t.text,
          createdAt: t.createdAt,
          user: t.user,
          syncStatus: t.syncStatus ?? 'pending'
        }))
      });
    },

    restore(tasks) {
      workerMode = 'restore';
      workerProgress.style.display = 'block';
      workerProgress.value = 0;

      worker.postMessage({
        type: 'decrypt',
        tasks: tasks.map(t => t.encryptedPayload)
      });
    }
  };
}
