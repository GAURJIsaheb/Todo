

import { appState } from "../state/appState.js";
import { getAllTasks, addTask } from "../storage/initDb.js";
import { renderTasks } from "../RenderUi/render.js";
import {selectWorkspace} from '../dom/domElements.js';

const API_BASE="http://localhost:3000";

export function initWorkspaceToggle(){

  if(!selectWorkspace) return;

  selectWorkspace.value = appState.workspace;

  selectWorkspace.addEventListener("change", async ()=>{

    const val = selectWorkspace.value;
    appState.workspace = val;
    localStorage.setItem("workspace",val);

    console.log("Workspace switched →",val);

    /* SERVER SYNC */
    try{
      const res = await fetch(
        `${API_BASE}/tasks?userEmail=${appState.currentUser.email}&workspaceType=${val}`,
        {
          headers:{
            Authorization:"Bearer "+localStorage.getItem("token")
          }
        }
      );

      if(res.ok){
        const serverTasks = await res.json();

        for(const t of serverTasks){
          await addTask({
            id: t.taskId,
            text: t.text,
            image: t.image,
            completed: t.completed,
            archived: t.archived,
            deleted: t.deleted,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            userEmail: t.userEmail,
            workspaceType: t.workspaceType || "personal",
            syncStatus:"synced"
          });
        }
      }
    }catch(e){
      console.log("workspace server fetch failed");
    }

    const tasks = await getAllTasks(
      appState.currentUser.email,
      val
    );

    renderTasks(tasks);
  });

}
