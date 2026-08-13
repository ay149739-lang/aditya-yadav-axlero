const API_BASE_URL = 'http://localhost:5001/api/rooms';

const getAuthHeaders = () => {
  const token = localStorage.getItem('syncspace_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const fetchRoomData = async (roomId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${roomId}`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, status: response.status, message: data.message || 'You are not invited to this room.' };
    }
    return { success: true, ...data };
  } catch (error) {
    console.error('Failed to fetch room data:', error);
    return { success: false, message: 'Could not connect to server' };
  }
};

export const saveRoomData = async (roomId, { boardData, codeData, language }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${roomId}/save`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ boardData, codeData, language })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to save room data:', error);
    return null;
  }
};

export const checkRoomAccess = async (roomId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${roomId}/access`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    return {
      status: response.status,
      ...data
    };
  } catch (error) {
    console.error('Check room access error:', error);
    return { success: false, hasAccess: false, message: 'Could not verify room access' };
  }
};

export const fetchPendingInvitations = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/invitations/pending`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.invitations || [];
  } catch (error) {
    console.error('Failed to fetch pending invitations:', error);
    return [];
  }
};

export const acceptInvitation = async (invitationId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/invitations/${invitationId}/accept`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    return { ok: response.ok, ...data };
  } catch (error) {
    console.error('Failed to accept invitation:', error);
    return { ok: false, message: 'Failed to accept invitation' };
  }
};

export const rejectInvitation = async (invitationId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/invitations/${invitationId}/reject`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    return { ok: response.ok, ...data };
  } catch (error) {
    console.error('Failed to reject invitation:', error);
    return { ok: false, message: 'Failed to reject invitation' };
  }
};

export const fetchActiveRooms = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/active-rooms`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) return {};
    const data = await response.json();
    return data.activeRooms || {};
  } catch (error) {
    console.error('Failed to fetch active rooms:', error);
    return {};
  }
};

export const fetchMyRooms = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/user/my-rooms`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) return { ownedRooms: [], joinedRooms: [] };
    const data = await response.json();
    return {
      ownedRooms: data.ownedRooms || [],
      joinedRooms: data.joinedRooms || []
    };
  } catch (error) {
    console.error('Failed to fetch my rooms:', error);
    return { ownedRooms: [], joinedRooms: [] };
  }
};

export const deleteRoom = async (roomId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${roomId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    return { ok: response.ok, ...data };
  } catch (error) {
    console.error('Failed to delete room:', error);
    return { ok: false, message: 'Failed to delete room' };
  }
};

export const leaveRoom = async (roomId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${roomId}/leave`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    return { ok: response.ok, ...data };
  } catch (error) {
    console.error('Failed to leave room:', error);
    return { ok: false, message: 'Failed to leave room' };
  }
};

export const fetchOwnedRooms = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/owned`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.ownedRooms || [];
  } catch (error) {
    console.error('Failed to fetch owned rooms:', error);
    return [];
  }
};

export const fetchJoinedRooms = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/joined`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.joinedRooms || [];
  } catch (error) {
    console.error('Failed to fetch joined rooms:', error);
    return [];
  }
};

export const fetchNotifications = async () => {
  try {
    const response = await fetch('http://localhost:5001/api/notifications', {
      headers: getAuthHeaders()
    });
    if (!response.ok) return { unreadCount: 0, pending: [], accepted: [], rejected: [] };
    const data = await response.json();
    return {
      unreadCount: data.unreadCount || 0,
      pending: data.pending || [],
      accepted: data.accepted || [],
      rejected: data.rejected || [],
      invitations: data.pending || []
    };
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return { unreadCount: 0, pending: [], accepted: [], rejected: [] };
  }
};

export const fetchOwnerStatus = async (roomId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${roomId}/owner-status`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) return { isOwnerOnline: false };
    const data = await response.json();
    return { isOwnerOnline: Boolean(data.isOwnerOnline) };
  } catch (error) {
    console.error('Failed to fetch owner status:', error);
    return { isOwnerOnline: false };
  }
};


