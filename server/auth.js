import express from 'express';

const router = express.Router();

// in-memory users (email → user)
const users = new Map();

/* LOGIN */
router.post('/login', (req, res) => {
  const { name, email } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: 'Name and email required' });
  }

  const existingUser = users.get(email);

  // same email, different name = reject
  if (existingUser && existingUser.name !== name) {
    return res.status(401).json({
      error: 'Invalid details'
    });
  }

  // first-time user
  if (!existingUser) {
    users.set(email, { email, name });
  }

  req.session.user = { email, name };

  res.json({ ok: true });
});

/* LOGOUT */
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('todo.sid');
    res.json({ ok: true });
  });
});

/* ME */
router.get('/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

export default router;

