import crypto from 'crypto';
import path from 'path';

import { createServer } from './setup.js';
import { asyncHandler } from './TryCatch/async.js';
import { requireAuth } from './middlewares/requireAuth.js';
import { connectDB, db } from './mongo/mongo.js';

const { app, server, io, clientPath } = createServer();
 

const users = new Map(); // userEmail → socket.id


// Socket connection
io.on('connection', (socket) => {
   socket.on('register', async (userEmail) => {

  socket.userEmail = userEmail;
  users.set(userEmail, socket.id);

  const col = db.collection("tasks");

  // unread tasks
  const unread = await col.find({
    userEmail,
    receivedAt: { $ne: null },
    notified: { $ne: true },
    deleted:false
  }).toArray();

  if (unread.length > 0) {
    socket.emit('missedTasks', unread.length);

    // mark notified
    await col.updateMany(
      {
        userEmail,
        receivedAt: { $ne: null },
        notified: { $ne: true }
      },
      { $set: { notified:true } }
    );
  }

  console.log("Socket registered:", userEmail);
});


  // Heartbeat (keep as is for "light on" - connection alive)
  const heartbeatInterval = setInterval(() => {
    const sentAt = Date.now();
    socket.emit('heartbeat', sentAt, (clientTime) => {
      console.log('Client alive | latency:', Date.now() - clientTime, 'ms');
    });
  }, 30000);


  socket.on('disconnect', () => {
    clearInterval(heartbeatInterval);
    if (socket.userEmail) {
    users.delete(socket.userEmail);
  }
    console.log('User disconnected');
  });
});






// CRUD 


//create
app.post('/tasks', requireAuth, asyncHandler(async (req, res) => {

  const { id, text, image, userEmail, workspaceType } = req.body;

  if (!id || !userEmail)
    return res.status(400).json({ error: 'missing fields' });

  const workspaceId =
    workspaceType === "professional"
      ? "pro_" + userEmail
      : "personal_" + userEmail;

  const col = db.collection("tasks");

  const exists = await col.findOne({ taskId:id });
  if (exists) return res.json({ status: 'ok' });

  const newTask = {
    taskId: id,
    workspaceId,
    text,
    image: image || null,
    completed:false,
    archived:false,
    deleted:false,
    createdBy:userEmail,
    createdAt:Date.now(),
    updatedAt:Date.now(),
    version:1
  };

  await col.insertOne(newTask);

  res.json({ status: 'ok', task:newTask });
}));



//Get all tasks ---> read
app.get('/tasks', requireAuth,asyncHandler(async (req, res) => {

  const { userEmail, workspaceType } = req.query;

  if(!userEmail){
    return res.status(400).json({error:"userEmail required"});
  }

  // workspace fetch
  const ws = await db.collection("workspaces").findOne({
    owner:userEmail,
    type:workspaceType
  });

  if(!ws) return res.json([]);

  const tasks = await db.collection("tasks")
    .find({ workspaceId:ws.workspaceId, deleted:false })
    .toArray();

  res.json(tasks);
}));





//update
app.put('/tasks/:id',  requireAuth,asyncHandler(async (req, res) => {

  const taskId = req.params.id;
  const { text, completed, archived, image } = req.body;

  const col = db.collection("tasks");

  const task = await col.findOne({ taskId });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const updated = {
    text: text ?? task.text,
    image: image ?? task.image,
    completed: completed ?? task.completed,
    archived: archived ?? task.archived,
    updatedAt: Date.now(),
    version: (task.version || 1) + 1
  };

  await col.updateOne({ taskId }, { $set: updated });

  res.json({ status: 'ok' });
}));



//delete
app.delete('/tasks/:id',  requireAuth,asyncHandler(async (req, res) => {

  const taskId = req.params.id;

  await db.collection("tasks").updateOne(//just mark delete=true-->soft delete
    { taskId },
    { $set:{ deleted:true, updatedAt:Date.now() } }
  );

  res.json({ status:'ok' });
}));





// Update task (complete or edit)---> 2 baar (update,delete)+ checkbox tick 3 baar[normal se complete mai and restore se vaapis complete mai,,complete se archive mai]
//share
app.post('/share', requireAuth, asyncHandler(async (req, res) => {
  const { toEmail, taskId, createdBy, workspaceType } = req.body;

  if (!toEmail || !taskId || !createdBy || !workspaceType)
    return res.status(400).json({ error: 'Missing fields' });

  const col = db.collection("tasks");

  const sharedTask = await col.findOne({
    taskId,
    createdBy,
    deleted:false
  });

  if (!sharedTask)
    return res.status(404).json({ error: 'Task not found' });

  const workspaceId =
    workspaceType === "professional"
      ? "pro_" + toEmail
      : "personal_" + toEmail;

  const newTask = {
    taskId: crypto.randomUUID(),
    workspaceId,                    // ⭐ MOST IMPORTANT

    text: sharedTask.text,
    image: sharedTask.image || null,

    completed:false,
    archived:false,
    deleted:false,

    createdBy: toEmail,             // receiver becomes owner
    originalOwner: createdBy,
    sharedFromTaskId: taskId,

    createdAt: Date.now(),
    updatedAt: Date.now(),
    receivedAt: Date.now(),

    version:1,
    notified:false
  };

  await col.insertOne(newTask);

  // realtime push
  const targetSocket = users.get(toEmail);
  if (targetSocket) {
    io.to(targetSocket).emit('taskShared', newTask);
  }

  res.json({ status: 'ok', task: newTask });

}));




// Get global completed count
app.get('/global-completed', requireAuth, asyncHandler(async (req, res) => {

  const { userEmail, workspaceType } = req.query;

  if(!userEmail){
    return res.status(400).json({error:"userEmail required"});
  }

  // direct workspaceId derive 
  const workspaceId =
    workspaceType === "professional"
      ? "pro_" + userEmail
      : "personal_" + userEmail;

  const total = await db.collection("tasks").countDocuments({
    workspaceId,
    completed:true,
    archived:false,
    deleted:false
  });

  res.json({ totalCompleted: total });

}));










//  SSE, long-poll, short-poll 
app.get('/sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendStats = () => {
    const now = new Date().toISOString();
    res.write(`data: Server alive at ${now}\n\n`);
  };
  
  sendStats();
  const interval = setInterval(sendStats, 10000);
  req.on('close', () => clearInterval(interval));
});




app.get('/long-poll', (req, res) => {
  let timeout = setTimeout(() => {
    res.status(204).end();
  }, 30000);
  if (Math.random() > 0.5) {
    clearTimeout(timeout);
    res.json({ alert: 'Priority alert from server!' });
  }
  req.on('close', () => {
    clearTimeout(timeout);
  });
});


app.get('/short-poll', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now()
  });
});




/* ROOT */
app.get('/', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});


/* ERROR */
app.use((err, req, res, next) => {
  console.error(' Global Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});


/* START SERVER */
async function start(){
  await connectDB();
  server.listen(3000, () => console.log(' Server on 3000 + Mongo'));
}

start();