
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './auth.js';
import { requireAuth } from './middlewares/requireAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// client path
const clientPath = path.join(__dirname, '..', 'client');

export function createServer() {
  const app = express();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:3000',
      credentials: true
    }
  });

  // ---------------- middleware ---------------- 

  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
  }));

  app.use(express.json());//for http json parsin

  app.use(
    session({
      name: 'todo.sid',
      secret: 'super-secret-key', // can be dio if later env
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 // 1 day
      }
    })
  );

  // ---------------- routes ---------------- 

  app.use('/auth', authRoutes);

  app.use('/pages', express.static(path.join(clientPath, 'pages')));
  app.use(express.static(clientPath));

  // protected APIs
  app.use('/tasks', requireAuth);
  app.use('/share', requireAuth);

  return { app, server, io, clientPath };
}
