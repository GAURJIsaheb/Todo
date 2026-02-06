//auth call -->API wrapper

//login
export async function login(name, email) {
  const token = localStorage.getItem('token');
  const res = await fetch(`/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email })
  });

  if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }

  const data = await res.json();
   //  store JWT + user
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));

  return data.user;

}


//logout
export async function logout() {
  try {
    await fetch('/auth/logout', {
      method: 'POST',
    });
  } catch (e) {
    console.warn('Logout request failed, clearing local session');
  }

  // client-side cleanup
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}



// GET CURRENT USER (token verify)
export async function getMe() {

  const token = localStorage.getItem('token');
  if (!token) return null;

  const res = await fetch(`/auth/me`, {
    headers: {
      Authorization: 'Bearer ' + token
    }
  });

  const data = await res.json();
  return data.user || null;
}


//  helper for protected API calls
export function authHeaders() {
  const token = localStorage.getItem('token');

  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token
  };
}
