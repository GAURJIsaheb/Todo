//search + sort event listeners
import {
  sortSelect,
  searchInput
} from '../domElements.js';

//global try-catch for async eventlistners functions
import { safeAsync } from '../TryCatch/safeAsync.js';

import { appState } from '../state/appState.js';
import { getAllTasks } from '../storage/initDb.js';
import { renderTasks } from '../RenderUi/render.js';

export function initFilterEvents() {
  //  SEARCH
  searchInput.addEventListener('input',safeAsync(async (e) => {
     // console.log('search '+e.target);// [object HTMLInputElement]
      appState.searchQuery = e.target.value.trim().toLowerCase();
      renderTasks(await getAllTasks(appState.currentUser.email));
    })
  );

  //  SORT
  sortSelect.value = appState.sortOrder;

  sortSelect.addEventListener('change',safeAsync(async (e) => {
      //console.log('sort '+e.target);//[object HTMLSelectElement]
      appState.sortOrder = e.target.value;
      localStorage.setItem('task-sort', appState.sortOrder);
      renderTasks(await getAllTasks(appState.currentUser.email));
    })
  );
}
