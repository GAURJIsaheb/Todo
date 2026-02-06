import { getQueue, removeFromQueue, updateQueue ,getTaskById, addTask, initDB} from "../storage/initDb.js";

const API_BASE="http://localhost:3000";
let syncing = false;



function getBackoff(retry){
 const steps=[2000,5000,10000,30000];
 return steps[Math.min(retry,steps.length-1)];
}

export async function runSyncQueue(){

 if(syncing) return;
 syncing = true;

 try{

 if(!navigator.onLine){
   syncing=false;
   return;
 }

 const queue = await getQueue();
 if(!queue.length){
   syncing=false;
   return;
 }

 for(const job of queue){

   if(Date.now() < job.nextRetry) continue;

   try{

     if(job.action==="update"){
       const res = await fetch(`${API_BASE}/tasks/${job.taskId}`,{
         method:"PUT",
         headers:{
          "Content-Type":"application/json",
          Authorization:"Bearer "+localStorage.getItem("token")
         },
         body:JSON.stringify({
          userEmail:job.userEmail,
          ...job.payload
         })
       });

       if(!res.ok) throw new Error("update failed");
     }

     //------------create-------------
     if(job.action==="create"){
        const res = await fetch(`${API_BASE}/tasks`,{
          method:"POST",
          headers:{
            "Content-Type":"application/json",
            Authorization:"Bearer "+localStorage.getItem("token")
          },
          body:JSON.stringify({
            id:job.taskId,
            userEmail:job.userEmail,
            ...job.payload
          })
        });

        if(!res.ok && res.status!==409){
          throw new Error("create failed");
        }
        }


          /*------- DELETE ----------- */
     if(job.action==="delete"){
       const res = await fetch(`${API_BASE}/tasks/${job.taskId}?userEmail=${job.userEmail}`,{
         method:"DELETE",
         headers:{
          Authorization:"Bearer "+localStorage.getItem("token")
         }
       });

        if(!res.ok && res.status !== 404){
            throw new Error("delete failed");
        }
     }

     // remove queue job
     await removeFromQueue(job.id);

     
     /* ===== AFTER SUCCESS =====for delete in IDB */
     if(job.action==="delete"){
        // HARD DELETE from IDB after server confirms
        const db = await initDB();
        await db.delete("tasks", job.taskId);
        console.log("Hard deleted from IDB:",job.taskId);
     }else{
        // mark synced
        const task = await getTaskById(job.taskId);
        if(task){
          task.syncStatus="synced";
          await addTask(task);
        }
     }

     console.log("Synced:",job.action,job.taskId);

   }catch(err){

     job.retry++;
     job.nextRetry = Date.now()+getBackoff(job.retry);
     await updateQueue(job);

     console.log("Retry later",job.retry);
   }
 }

 }finally{
   syncing=false;
 }
}