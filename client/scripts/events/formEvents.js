//------> add task + image upload + edit
import {
  taskText,
  taskImage,
  addTaskBtn,
  editTextInput,
  editImageInput,
  saveEditBtn,
  editModal,
  clipBtn
} from '../domElements.js';

import {fileToBase64} from '../utils/image.js'
import { safeAsync } from '../TryCatch/safeAsync.js';
import { safeSync } from '../TryCatch/safeSync.js';

import { addTask, getTaskById ,addToQueue ,upsertQueue} from '../storage/initDb.js';
import { appState } from '../state/appState.js';
import { updateTaskInDOM , renderSingleTask } from '../RenderUi/render.js';


const API_BASE = "http://localhost:3000";

//  JWT header helper
function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token
  };
}

export function initFormEvents() {

  // image select
  taskImage.addEventListener('change', safeSync((e) => {
    appState.selectedImageFile = e.target.files[0] || null;
  }));

  // clip button
  clipBtn.addEventListener('click', safeSync(() => taskImage.click()));



  // ---------------- ADD TASK ----------------
  addTaskBtn.addEventListener('click',safeAsync(async () => {

      const text = taskText.value.trim();
      if (!text) return;

      const imageBase64 = appState.selectedImageFile
        ? await fileToBase64(appState.selectedImageFile)
        : null;

      const isOnline = appState.socket?.connected;

      const task = {
        id: crypto.randomUUID(),
        text,
        completed: false,
        archived: false,
        image: imageBase64,
        createdAt: Date.now(),

        userEmail: appState.currentUser.email,
        userName: appState.currentUser.name,
        originalOwner: appState.currentUser.name,

        syncStatus: isOnline ? 'synced' : 'pending'
      };

      // save local first (offline-first rule)
      await addTask(task);
      renderSingleTask(task);

      //push in queue-->for already synced task updates
      await addToQueue({
        id: crypto.randomUUID(),
        action:"create",
        taskId:task.id,
        userEmail:task.userEmail,
        payload:{
          text:task.text,
          image:task.image,
          createdAt:task.createdAt,
          originalOwner:task.originalOwner
        },
        retry:0,
        nextRetry:Date.now()
        });


      // reset UI
      taskText.value = '';
      taskImage.value = '';
      appState.selectedImageFile = null;

      //  send to server if online
      if (isOnline) {
        try {
          //Add task
          await fetch(`${API_BASE}/tasks`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
              id: task.id,
              username: task.userName,
              userEmail: task.userEmail,
              text: task.text,
              image: task.image,         
              createdAt: task.createdAt,
              originalOwner: task.originalOwner
              
            })
          });
        } catch (err) {
          console.log("sync failed → pending", err);
          task.syncStatus = "pending";
          await addTask(task);
        }
      }
    })
  );

  // ---------------- EDIT TASK ----------------
  saveEditBtn.addEventListener('click',safeAsync(async () => {

      if (!appState.editingTaskId) return;

      const task = await getTaskById(appState.editingTaskId);
      if (!task) return;

      task.text = editTextInput.value.trim();

      if (editImageInput.files[0]) {
        task.image = await fileToBase64(editImageInput.files[0]);
      }

      const isOnline = appState.socket?.connected;

      await addTask({
        ...task,
        userEmail: appState.currentUser.email,
        syncStatus: isOnline ? 'synced' : 'pending'
      });

      //edit ke time bhi queue mai
      await upsertQueue({
        id:crypto.randomUUID(),
        action:"update",
        taskId:task.id,
        userEmail:appState.currentUser.email,
        payload:{
          text:task.text,
          image:task.image   // image edit support
        },
        retry:0,
        nextRetry:Date.now()
        });


      // send update if online
      if (isOnline) {
        try {//edit task
          await fetch(`${API_BASE}/tasks/${task.id}`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({
              userEmail: appState.currentUser.email,
              username: appState.currentUser.name,
              text: task.text,
              image: task.image 

            })
          });
        } catch (err) {
          console.log("edit sync failed → pending");
          task.syncStatus = "pending";
          await addTask(task);
        }
      }

      appState.editingTaskId = null;
      editModal.classList.add('hidden');
      updateTaskInDOM(task);
    })
  );
}
