//auth call -->API wrapper

//login
export async function login(name, email) {
  const res = await fetch(`/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, email })
  });

  if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }

  const user = await res.json(); // server should return user
  localStorage.setItem('user', JSON.stringify(user));
  return user;

}


//logout
export async function logout() {
  try {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (e) {
    console.warn('Logout request failed, clearing local session');
  }

  // client-side cleanup
  localStorage.removeItem('user');
}



export async function getMe() {
  const res = await fetch(`/auth/me`, {
    credentials: 'include'
  });
  if (!res.ok) {
    throw new Error('Not authenticated');
  }
  return res.json();
}
