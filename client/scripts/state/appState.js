//represents the global application state
export const appState = {
  currentUser: null,
  socket: null,

  selectedImageFile: null,
  editingTaskId: null,

  sortOrder: localStorage.getItem('task-sort') || 'desc',
  searchQuery: ''
};
