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

import { addTask, getTaskById  } from '../storage/initDb.js';
import { appState } from '../state/appState.js';
import { updateTaskInDOM , renderSingleTask } from '../RenderUi/render.js';

const API_BASE = 'http://localhost:3000';

export function initFormEvents() {

  //  image select 
  taskImage.addEventListener('change',safeSync((e) => {
    //
      appState.selectedImageFile = e.target.files[0] || null;
    })
  );

  //  clip button → open file picker
  clipBtn.addEventListener('click',safeSync(() => taskImage.click())
  );

  //  add task
  addTaskBtn.addEventListener(
    'click',
    safeAsync(async () => {
      const text = taskText.value.trim();
      if (!text) return;

      const imageBase64 = appState.selectedImageFile
        ? await fileToBase64(appState.selectedImageFile)
        : null;

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
        syncStatus: appState.socket?.connected ? 'synced' : 'pending'
      };

      await addTask(task);
      renderSingleTask(task);

      // reset form
      taskText.value = '';
      taskImage.value = '';
      appState.selectedImageFile = null;

      if (appState.socket?.connected) {
        await fetch(`${API_BASE}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: task.id,
            username: appState.currentUser.name,
            userEmail: appState.currentUser.email,
            text: task.text,
            createdAt: task.createdAt
          })
        });
      }
    })
  );

  
  //  edit task
  saveEditBtn.addEventListener(
    'click',
    safeAsync(async () => {
      if (!appState.editingTaskId) return;

      const task = await getTaskById(appState.editingTaskId);
      if (!task) return;

      task.text = editTextInput.value.trim();
      if (editImageInput.files[0]) {
        task.image = await fileToBase64(editImageInput.files[0]);
      }

      await addTask({
        ...task,
        userEmail: appState.currentUser.email,
        syncStatus: appState.socket?.connected ? task.syncStatus : 'pending'
      });

      if (
        appState.socket?.connected &&
        task.syncStatus === 'synced'
      ) {
        await fetch(`${API_BASE}/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail: appState.currentUser.email,
            username: appState.currentUser.name,
            text: task.text
          })
        });
      }

      appState.editingTaskId = null;
      editModal.classList.add('hidden');
      updateTaskInDOM(task);
    })
  );
}
