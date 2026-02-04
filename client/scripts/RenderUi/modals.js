//info + edit modals
import {
  infoModal,
  closeInfoBtn,
  infoText,
  infoUser,
  infoCreated,
  infoImage,

  editModal,
  closeEditBtn,
  editTextInput,
  editImagePreview
} from '../domElements.js';

import { appState } from '../state/appState.js';
import { safeSync } from '../TryCatch/safeSync.js';


export function initModals() {

  //  ---Close-- info modal (X button)
  closeInfoBtn.addEventListener('click', safeSync(() => {
    infoModal.classList.add('hidden');
  }));


  //  Click outside info modal
  infoModal.addEventListener('click', safeSync((e) => {
    if (e.target === infoModal) {
      infoModal.classList.add('hidden');
    }
  }));

  // -- Close -- edit modal
  closeEditBtn.addEventListener('click',safeSync(() => {
    appState.editingTaskId = null;
    editModal.classList.add('hidden');
  }));

  // --- > Click outside edit modal
  editModal.addEventListener('click', safeSync((e) => {
    if (e.target === editModal) {
      appState.editingTaskId = null;
      editModal.classList.add('hidden');
    }
  }));

  // 📜 OPEN INFO MODAL (custom event)
  document.addEventListener('open-info-modal',safeSync((e) => {
    const task = e.detail;

    infoText.textContent = task.text;
    infoUser.textContent = appState.currentUser.email;
    infoCreated.textContent =
      new Date(task.createdAt).toLocaleString();

    infoImage.innerHTML = '';
    if (task.image instanceof Blob) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(task.image);//to make it visble on browser
      img.width = 150;
      infoImage.appendChild(img);
    }

    infoModal.classList.remove('hidden');//remove kr di hidden property,,makes moda visible
  })
);


  //edit modal   ---> open
  document.addEventListener('open-edit-modal', safeSync((e) => {
  const task = e.detail;

  appState.editingTaskId = task.id;
  editTextInput.value = task.text;
  editImagePreview.innerHTML = '';

  if (task.image instanceof Blob) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(task.image);
    img.width = 120;
    editImagePreview.appendChild(img);
  }

  editModal.classList.remove('hidden');
}))
;

}
