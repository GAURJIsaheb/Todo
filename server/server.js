import crypto from 'crypto';
import path from 'path';

import { createServer } from './setup.js';
import { asyncHandler } from './TryCatch/async.js';


const { app, server, io, clientPath } = createServer();


const tasksByUser = new Map(); // userEmail → [tasks]
const users = new Map(); // userEmail → socket.id


// Socket connection
io.on('connection', (socket) => {
  socket.on('register', (userEmail) => {
    const tasks = tasksByUser.get(userEmail) || [];
    const unread = tasks.filter(t => t.receivedAt && !t.notified);

    if (unread.length > 0) {
      socket.emit('missedTasks', unread.length);
      unread.forEach(t => (t.notified = true));
    }

    socket.userEmail = userEmail;
    users.set(userEmail, socket.id);
    console.log('Registered:', userEmail);
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

//Get all tasks for a user (query: username)
app.get('/tasks', asyncHandler(async (req, res) => {
  const { userEmail } = req.query;
  if (!userEmail) {
    return res.status(400).json({ error: 'userEmail required' });
  }

  const userTasks = tasksByUser.get(userEmail) || [];
  res.json(userTasks);
}));





//Add a new task
 app.post('/tasks',  asyncHandler(async(req, res) => {
  const { id, username,userEmail, text, createdAt, originalOwner } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Task id required' });
  }

  if (!tasksByUser.has(userEmail)) {
    tasksByUser.set(userEmail, []);
  }

  //Usertaks abh taskbyuser ki array ko point kr rha,,so userTasks mai kuch push hoga to vo taskbyuser[name,[is list mai bhi jayega]] 
  const userTasks = tasksByUser.get(userEmail);


  const newTask = {
    id, //  SAME ID
    text,
    completed: false,
    archived: false,
    createdAt: createdAt || Date.now(),
    originalOwner: originalOwner || username,
    userEmail,//identity bridge
    sharedFromTaskId: null,
    receivedAt: null
  };


  const exists = userTasks.some(t => t.id === id);
  //some() ---> Kya is array me kam se kam ek element aisa hai jo meri condition satisfy karta hai?

  if (exists) {
    return res.json({ status: 'ok', task: userTasks.find(t => t.id === id) });
  }

  userTasks.push(newTask);

  res.json({ status: 'ok', task: newTask });
}));





// Update task (complete or edit)---> 2 baar (update,delete)+ checkbox tick 3 baar[normal se complete mai and restore se vaapis complete mai,,complete se archive mai]
app.put('/tasks/:id', asyncHandler(async(req, res) => {
  const { id } = req.params;
  const {
    username,
    userEmail,
    completed,
    text,
    archived,
    encrypted,
    selectedForArchive
  } = req.body;

  if (!userEmail) {
    return res.status(400).json({ error: 'Username required' });
  }

  const userTasks = tasksByUser.get(userEmail) || [];
  const taskIndex = userTasks.findIndex(t => t.id === id);

  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const task = userTasks[taskIndex];

  //  FULL STATE UPDATE 
  if (completed !== undefined) task.completed = completed;
  if (text !== undefined) task.text = text;
  if (archived !== undefined) task.archived = archived;
  if (encrypted !== undefined) task.encrypted = encrypted;
  if (selectedForArchive !== undefined)
    task.selectedForArchive = selectedForArchive;

  userTasks[taskIndex] = task;
  if (!task.userEmail && userEmail) {
    task.userEmail = userEmail;
  }


  res.json({ status: 'ok', task });

  // notification only when completed = true
  if (completed === true) {
    const completedSocketId = users.get(userEmail);
    if (completedSocketId) {
      io.except(completedSocketId).emit('taskCompletedNotification', {
        text: task.text,
        completedBy: userEmail
      });
    }
  }


  let totalCompleted = 0;
  for (const [user, tasks] of tasksByUser.entries()) {
    totalCompleted += tasks.filter(t => t.completed && !t.archived).length;
  }
  io.emit('globalCountUpdate', totalCompleted);
}));





// DELETE /tasks/:id - Delete task
app.delete('/tasks/:id',asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userEmail } = req.query;
  if (!userEmail) return res.status(400).json({ error: 'userEmail required' });

  const userTasks = tasksByUser.get(userEmail) || [];
  const taskIndex = userTasks.findIndex(t => t.id === id);
  if (taskIndex === -1) return res.status(404).json({ error: 'Task not found' });

  userTasks.splice(taskIndex, 1);
  res.json({ status: 'ok' });

}));



//Share task to another user (creates a copy in target's tasks)
// POST /share
app.post('/share',asyncHandler(async (req, res) => {
  console.log('📤 /share hit', req.body);
  const fromEmail = req.session.user.email;

  const { toEmail, taskId } = req.body;

  if (!fromEmail) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!toEmail || !taskId) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // ----> sender must be online
  if (!users.has(fromEmail)) {
    return res.status(403).json({
      error: 'Sender must be online to share task'
    });
  }

  const fromTasks = tasksByUser.get(fromEmail) || [];
  const sharedTask = fromTasks.find(t => t.id === taskId);

  if (!sharedTask) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // ensure receiver bucket
  if (!tasksByUser.has(toEmail)) {
    tasksByUser.set(toEmail, []);
  }

  const newTask = {
    id: crypto.randomUUID(),
    text: sharedTask.text,
    completed: false,
    archived: false,
    createdAt: sharedTask.createdAt,

    //  identity
    userEmail: toEmail,
    originalOwner: fromEmail,

    sharedFromTaskId: taskId,
    receivedAt: Date.now()
  };

  tasksByUser.get(toEmail).push(newTask);

  // SOCKET NOTIFICATION (ONLY NOTIFICATION)
  const targetSocketId = users.get(toEmail);
  if (targetSocketId) {
    io.to(targetSocketId).emit('taskShared', newTask);
  }

  res.json({ status: 'ok', task: newTask });
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


// Get global completed count
app.get('/global-completed', (req, res) => {
  let totalCompleted = 0;
  for (const [username, tasks] of tasksByUser.entries()) {
    totalCompleted += tasks.filter(t => t.completed && !t.archived).length;
  }
  res.json({ totalCompleted });
});

// ---- PROTECTED ROOT ROUTE 
app.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/pages/login.html');
  }
  res.sendFile(path.join(clientPath, 'index.html'));
});


app.use((err, req, res, next) => {
  console.error('🔥 Global Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

server.listen(3000, () => console.log('Server on 3000'));




