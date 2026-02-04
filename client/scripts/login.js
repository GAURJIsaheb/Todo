const form = document.getElementById('login-form');
const API_BASE = 'http://localhost:3000';

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, email })
  });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Invalid login details');
      return;
    }


  window.location.href = 'http://localhost:3000';
});
