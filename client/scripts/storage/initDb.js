
import { openDB } from 'https://unpkg.com/idb?module';
import { safeAsync } from '../TryCatch/safeAsync.js';

const DB_NAME = 'MyTodoApp';
const DB_VERSION = 4;
const STORE_TASKS = 'tasks';
const STORE_USER = 'user';
const STORE_SYNC = 'syncQueue';

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
      ////  NEW SYNC QUEUE STORE
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains(STORE_SYNC)) {
          const store = db.createObjectStore(STORE_SYNC, { keyPath: 'id' });
          store.createIndex('byRetry', 'retry');
        }
      }

    }
  });
});




export const addTask = safeAsync(async (task) => {
  if(!task?.id) return;
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
  if(!userEmail) return [];
  const db = await initDB();
  const allTasks = await db.getAll(STORE_TASKS);

  return allTasks.filter(t => t.userEmail === userEmail);
});





export const saveUser = safeAsync(async (userData) => {
  const db = await initDB();
  return db.put(STORE_USER, userData); 
});

export const getUser = safeAsync(async (email) => {
  if (!email) return null; //Never call IDB with undefined key.
  const db = await initDB();
  return db.get(STORE_USER, email);
});


//o(1)
export async function getTaskById(id) {
  if (!id) return null;  
  const db = await initDB();
  return db.get('tasks', id);
}


export const deleteTaskFromIDB = safeAsync(async (id) => {
  if (!id) return;  
  const db = await initDB();
  const tx = db.transaction(STORE_TASKS, 'readwrite');
  tx.store.delete(id);
  await tx.done;
  console.log('IDB DELETE COMMITTED:', id);
});




//queue helpet functions
export async function addToQueue(item){
 const db = await initDB();
 return db.put('syncQueue', item);
}

export async function getQueue(){
 const db = await initDB();
 return db.getAll('syncQueue');
}

export async function removeFromQueue(id){
 const db = await initDB();
 return db.delete('syncQueue', id);
}

export async function updateQueue(item){
 const db = await initDB();
 return db.put('syncQueue', item);
}




//to reduce server call--->if checkbox multiple times toggle ho on offline,,so sbh call server pr na jaayein
/*
agar user:

edit text
then complete toggle
then archive


payload change hota.

Old job replace ho raha but payload merge nahi.

Better:
always keep latest payload only.
 */
export async function upsertQueue(job){
 const db = await initDB();
 const all = await db.getAll("syncQueue");

 const existing = all.find(
  j => j.taskId === job.taskId && j.action==="update"
 );

 if(existing){
   job.id = existing.id;
   job.retry = existing.retry || 0;
 }

 job.nextRetry = Date.now();
 return db.put("syncQueue", job);
}



//Delete aaye to:---->old updates remove.
export async function removeTaskUpdatesFromQueue(taskId){
 const db = await initDB();
 const all = await db.getAll("syncQueue");

 for(const j of all){
   if(j.taskId===taskId && j.action==="update"){
     await db.delete("syncQueue", j.id);
   }
 }
}
