//render 
import {
  taskList,
  completedTaskList
} from '../domElements.js';

import { appState } from '../state/appState.js';
import { updateLocalCount } from '../network/counts.js';
/*Nothing in try-catch bcz if UI crashes than it should be visible for the user */



function revokeImages(container) {
  container.querySelectorAll('img').forEach(img => {
    if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  });
}



export async function renderTasks(tasks) {



  taskList.innerHTML = '';
  completedTaskList.innerHTML = '';

  //  filtering --> searching + sorting
  let activeTasks = tasks.filter(
    t => !t.completed && !t.archived && !t.encrypted
  );

  // SEARCH FILTER
  if (appState.searchQuery) {
    activeTasks = activeTasks.filter(t =>
      t.text.toLowerCase().includes(appState.searchQuery)
    );
  }

  //  SORT
  activeTasks.sort((a, b) =>
    appState.sortOrder === 'asc'
      ? a.createdAt - b.createdAt
      : b.createdAt - a.createdAt
  );
  

  const completedTasks = tasks.filter(
  t => t.completed === true &&
       t.archived === false
  );



  //  render
  activeTasks.forEach(task => renderTaskItem(task, taskList));
  completedTasks.forEach(task => renderTaskItem(task, completedTaskList));
  //  counts
  await updateLocalCount();

}




function renderTaskItem(task, container) {
  const li = document.createElement('li');
  li.dataset.id = task.id;
  const isCompletedView = container === completedTaskList;
  const restoreBtnHTML = isCompletedView ? `<button class="restore">↩ Restore</button>` : '';
  const checkboxChecked = isCompletedView ? task.selectedForArchive : task.completed;
  let imageHTML = '';

  if (task.image && typeof task.image === 'string') {
  imageHTML = `<img src="${task.image}" width="50" />`;
}



  li.innerHTML = `
    <input type="checkbox" ${checkboxChecked ? 'checked' : ''}>
    <div class="task-body">
      <span class="task-text">${task.text}</span>
    </div>
    ${isCompletedView
      ? `<div class="task-actions">${restoreBtnHTML}</div>`
      : `
        <div class="task-actions">
          <span class="sync-status ${task.syncStatus === 'synced' ? 'synced' : 'not-synced'}">
          ${task.syncStatus === 'synced' ? 'Synced' : 'Not-Synced'}
        </span>

          <button class="edit">Edit</button>
          <button class="delete">Delete</button>
          <button class="info">📜</button>
        </div>
        ${imageHTML ? `<span class="task-image">${imageHTML}</span>` : ''}
        <button type="button" class="share">Send</button>
      `}
  `;
  container.appendChild(li);
}




export function renderSingleTask(task) {
  const container = task.completed
    ? completedTaskList
    : taskList;

  renderTaskItem(task, container);
}

export function updateTaskInDOM(task) {
  const li = document.querySelector(`[data-id="${task.id}"]`);
  if (!li) return;

  li.querySelector('.task-text').textContent = task.text;

  const sync = li.querySelector('.sync-status');
  if (sync) {
    sync.textContent = task.syncStatus === 'synced'
      ? 'Synced'
      : 'Not-Synced';
    sync.className = `sync-status ${
      task.syncStatus === 'synced' ? 'synced' : 'not-synced'
    }`;
  }
}

export function removeTaskFromDOM(taskId) {
  const li = document.querySelector(`[data-id="${taskId}"]`);
  if (!li) return;

  li.querySelectorAll('img').forEach(img => {
    if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  });

  li.remove();
}

export function moveTaskBetweenLists(task) {
  removeTaskFromDOM(task.id);//remove from a section
  renderSingleTask(task);//add in other section
}

