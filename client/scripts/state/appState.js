//represents the global application state
export const appState = {
  currentUser: null,
  socket: null,

  selectedImageFile: null,
  editingTaskId: null,
  workspace: localStorage.getItem("workspace") || "personal",

  

  sortOrder: localStorage.getItem('task-sort') || 'desc',
  searchQuery: ''
};
//hr cheez kyu nhi daali isme ???