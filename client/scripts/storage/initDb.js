
import { openDB } from 'https://unpkg.com/idb?module';
import { safeAsync } from '../TryCatch/safeAsync.js';

const DB_NAME = 'MyTodoApp';
const DB_VERSION = 3;
const STORE_TASKS = 'tasks';
const STORE_USER = 'user';

export const initDB = safeAsync(async () => {//Only 1 time DB is opened in the whole app
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      console.log(`[IDB] Upgrade ${oldVersion} → ${newVersion}`);

      // ---- Version 1 (fresh install) ----
      if (oldVersion < 1) {

        if (!db.objectStoreNames.contains(STORE_TASKS)) {
          db.createObjectStore(STORE_TASKS, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORE_USER)) {
          db.createObjectStore(STORE_USER, { keyPath: 'email' });
        }
      }

      // ---- Version 3 (multi-user identity fix) ----
      if (oldVersion >= 1 && oldVersion < 3) {

        if (db.objectStoreNames.contains(STORE_USER)) {
          const userStore = transaction.objectStore(STORE_USER);

          userStore.openCursor().then(function migrate(cursor) {
            if (!cursor) return;

            const user = cursor.value;

            // migrate old id-based user
            if (user.id === 1 && user.email) {
              userStore.put({
                email: user.email,
                name: user.name
              });
              userStore.delete(1);
            }

            return cursor.continue().then(migrate);
          });
        }
      }
    }
  });
});




export const addTask = safeAsync(async (task) => {
  const db = await initDB();//it is just a js level handler,,not Disk level
  const existing = await db.get(STORE_TASKS, task.id);

  const mergedTask = {
    ...existing,
    ...task,

    //  Preserve client-only fields
    image:
      task.image !== undefined
        ? task.image
        : existing?.image
  };

  return db.put(STORE_TASKS, mergedTask);
});



export const getAllTasks = safeAsync(async (userEmail) => {
  const db = await initDB();
  const allTasks = await db.getAll(STORE_TASKS);

  return allTasks.filter(t => t.userEmail === userEmail);
});





export const saveUser = safeAsync(async (userData) => {
  const db = await initDB();
  return db.put(STORE_USER, userData); 
});

export const getUser = safeAsync(async (email) => {
  const db = await initDB();
  return db.get(STORE_USER, email);
});


//o(1)
export async function getTaskById(id) {
  const db = await initDB();
  return db.get('tasks', id);
}


export const deleteTaskFromIDB = safeAsync(async (id) => {
  const db = await initDB();
  const tx = db.transaction(STORE_TASKS, 'readwrite');
  tx.store.delete(id);
  await tx.done;
  console.log('IDB DELETE COMMITTED:', id);
});




