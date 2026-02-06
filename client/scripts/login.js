const existingToken = localStorage.getItem("token");
if (existingToken) {
  window.location.href = "http://localhost:3000";
}

const form = document.getElementById('login-form');

const API_BASE ="http://localhost:3000";

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, email })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || 'Invalid login details');
    return;
  }

  //  JWT store
  localStorage.setItem('token', data.token);
  localStorage.setItem('userEmail', data.user.email);
  localStorage.setItem('userName', data.user.name);

  // redirect
  window.location.href = 'http://localhost:3000';
});
