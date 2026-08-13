const API_BASE_URL = 'http://localhost:5001/api/auth';

export const loginUser = async (username, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Server connection failed' };
  }
};

export const registerUser = async (username, password, displayName) => {
  try {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, displayName })
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Register error:', error);
    return { success: false, message: 'Server connection failed' };
  }
};

export const getMe = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Get me error:', error);
    return { success: false, message: 'Server connection failed' };
  }
};
