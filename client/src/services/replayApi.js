const API_BASE_URL = 'http://localhost:5001/api/rooms';

const getAuthHeaders = () => {
  const token = localStorage.getItem('syncspace_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const fetchSnapshots = async (roomId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${roomId}/snapshots`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.snapshots || [];
  } catch (error) {
    console.error('Failed to fetch snapshots:', error);
    return [];
  }
};

export const createSnapshot = async (roomId, { boardData, codeData, language }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${roomId}/snapshots`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ boardData, codeData, language })
    });
    const data = await response.json();
    return data.snapshot;
  } catch (error) {
    console.error('Failed to create snapshot:', error);
    return null;
  }
};
