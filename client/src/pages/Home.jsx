import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Layers, Plus, Hash, LogOut, Crown, Users,
  ArrowRight, Sparkles, Shield, Copy, Check, Bell, Trash2,
  Calendar, Clock, UserPlus, LogIn, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  fetchPendingInvitations,
  fetchMyRooms,
  fetchOwnedRooms,
  fetchJoinedRooms,
  deleteRoom as apiDeleteRoom,
  leaveRoom as apiLeaveRoom
} from '../services/api';
import InvitationCenterModal from '../components/InvitationCenterModal';
import InviteModal from '../components/InviteModal';
import RoomHistoryModal from '../components/RoomHistoryModal';

const API_BASE = 'http://localhost:5001/api/rooms';

const getAuthHeaders = () => {
  const token = localStorage.getItem('syncspace_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'join'
  const [roomName, setRoomName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // My Rooms from DB
  const [ownedRooms, setOwnedRooms] = useState([]);
  const [joinedRooms, setJoinedRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);

  // Invite Modal from Dashboard
  const [inviteModalRoomId, setInviteModalRoomId] = useState(null);

  // Invitation Center & History
  const [isInvitationCenterOpen, setIsInvitationCenterOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = async () => {
    const invs = await fetchPendingInvitations();
    setUnreadCount(invs.length);
  };

  const loadUserRooms = async () => {
    setRoomsLoading(true);
    const [owned, joined] = await Promise.all([
      fetchOwnedRooms(),
      fetchJoinedRooms()
    ]);
    setOwnedRooms(owned || []);
    setJoinedRooms(joined || []);
    setRoomsLoading(false);
  };

  useEffect(() => {
    loadUnreadCount();
    loadUserRooms();
    const interval = setInterval(loadUnreadCount, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) { toast.error('Please enter a room name'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/create`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ roomName: roomName.trim() })
      });
      const data = await res.json();

      if (data.success) {
        // Show exactly ONE success toast
        toast.success(`Room "${data.roomName}" created!`);
        // Navigate immediately — do NOT block on loadUserRooms
        // Rooms list will refresh when the user comes back to this page
        navigate(`/room/${data.roomId}`);
      } else {
        toast.error(data.message || 'Failed to create room');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    const id = joinRoomId.trim();
    if (!id) { toast.error('Please enter a room ID'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${id}/access`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.hasAccess) {
        navigate(`/room/${id}`);
      } else {
        toast.error(data.message || 'The room owner is currently offline. You can only join when the owner is inside the room.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not verify room access');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinJoinedRoom = async (roomId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${roomId}/access`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.hasAccess) {
        navigate(`/room/${roomId}`);
      } else {
        toast.error(data.message || 'The room owner is currently offline. You can only join when the owner is inside the room.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not verify room access');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm(`Are you sure you want to delete room "${roomId}"?`)) return;
    const res = await apiDeleteRoom(roomId);
    if (res.ok && res.success) {
      toast.success('Room deleted successfully');
      loadUserRooms();
    } else {
      toast.error(res.message || 'Failed to delete room');
    }
  };

  const handleLeaveRoom = async (roomId) => {
    if (!window.confirm(`Are you sure you want to leave room "${roomId}"?`)) return;
    const res = await apiLeaveRoom(roomId);
    if (res.ok && res.success) {
      toast.success('Left room successfully');
      loadUserRooms();
    } else {
      toast.error(res.message || 'Failed to leave room');
    }
  };

  const copyRoomId = (roomId) => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
    setCopiedId(roomId);
    toast.success('Room link copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Recently';
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const avatarColor = user?.color || '#6366F1';
  const initials = (user?.name || user?.username || '?').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#080810] text-white overflow-x-hidden select-none">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-5%] w-[40%] h-[40%] rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-5%] w-[40%] h-[40%] rounded-full bg-purple-600/15 blur-[120px]" />
        <div className="absolute top-[40%] left-[50%] w-[30%] h-[30%] rounded-full bg-violet-600/8 blur-[100px]" />
      </div>

      {/* Top Navbar */}
      <nav className="relative z-10 border-b border-white/[0.06] bg-black/20 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2 rounded-xl border border-indigo-500/20">
              <Layers className="text-indigo-400 w-5 h-5" />
            </div>
            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              SyncSpace
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell Button */}
            <button
              onClick={() => setIsInvitationCenterOpen(true)}
              className="relative p-2.5 rounded-xl text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
              title="Invitation Center"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-indigo-600 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center border border-[#080810] shadow-sm animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* History Button */}
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="p-2.5 px-3.5 rounded-xl text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Room History"
            >
              <History size={16} className="text-purple-400" />
              <span>History</span>
            </button>

            {/* Profile pill */}
            <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-md"
                style={{ background: avatarColor }}
              >
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-white leading-tight">{user?.name || user?.username}</p>
                <p className="text-[10px] text-gray-500 font-mono">@{user?.username}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-2.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer border border-transparent hover:border-red-500/20"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Hero greeting */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
            <Sparkles size={12} />
            Real-time collaboration platform
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-3 leading-tight">
            Welcome back,{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400">
              {user?.name || user?.username}
            </span>
          </h1>
          <p className="text-gray-400 text-base max-w-md mx-auto">
            Create a private workspace or join an existing room to collaborate in real-time.
          </p>
        </motion.div>

        {/* Main Card Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-16 max-w-3xl mx-auto">
          {/* Create Room Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={`rounded-2xl border p-6 cursor-pointer transition-all duration-300 ${
              activeTab === 'create'
                ? 'bg-indigo-600/10 border-indigo-500/40 shadow-[0_0_40px_rgba(99,102,241,0.1)]'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20'
            }`}
            onClick={() => setActiveTab('create')}
          >
            <div className="flex items-start justify-between mb-5">
              <div className={`p-3 rounded-xl border ${
                activeTab === 'create'
                  ? 'bg-indigo-500/20 border-indigo-500/30'
                  : 'bg-white/5 border-white/10'
              }`}>
                <Plus className={activeTab === 'create' ? 'text-indigo-400' : 'text-gray-400'} size={22} />
              </div>
              <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                <Crown size={11} className="text-amber-400" />
                <span className="text-[11px] text-amber-300 font-semibold">You're Admin</span>
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-1.5">Create New Room</h3>
            <p className="text-gray-400 text-xs leading-relaxed mb-5">
              Start a private workspace. You'll be the admin — nobody can join unless you invite them.
            </p>

            <AnimatePresence>
              {activeTab === 'create' && (
                <motion.form
                  key="createForm"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleCreateRoom}
                  className="space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 mb-1.5">
                      Room Name
                    </label>
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="e.g. Design Sprint, Code Review"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition-all placeholder:text-gray-600"
                      autoFocus
                      maxLength={50}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-gray-500 bg-white/3 border border-white/5 rounded-xl p-2.5">
                    <Shield size={12} className="text-emerald-400 shrink-0" />
                    <span>Private room — only invited users can join</span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !roomName.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Create Room</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Join Room Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={`rounded-2xl border p-6 cursor-pointer transition-all duration-300 ${
              activeTab === 'join'
                ? 'bg-purple-600/10 border-purple-500/40 shadow-[0_0_40px_rgba(168,85,247,0.1)]'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20'
            }`}
            onClick={() => setActiveTab('join')}
          >
            <div className="flex items-start justify-between mb-5">
              <div className={`p-3 rounded-xl border ${
                activeTab === 'join'
                  ? 'bg-purple-500/20 border-purple-500/30'
                  : 'bg-white/5 border-white/10'
              }`}>
                <Hash className={activeTab === 'join' ? 'text-purple-400' : 'text-gray-400'} size={22} />
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1 rounded-lg">
                <Users size={11} className="text-gray-400" />
                <span className="text-[11px] text-gray-400 font-semibold">Collaborator</span>
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-1.5">Join Existing Room</h3>
            <p className="text-gray-400 text-xs leading-relaxed mb-5">
              Enter a Room ID shared by the workspace owner to join their session.
            </p>

            <AnimatePresence>
              {activeTab === 'join' && (
                <motion.form
                  key="joinForm"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleJoinRoom}
                  className="space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 mb-1.5">
                      Room ID
                    </label>
                    <input
                      type="text"
                      value={joinRoomId}
                      onChange={(e) => setJoinRoomId(e.target.value.trim())}
                      placeholder="e.g. design-sprint-a1b2c3d4"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition-all placeholder:text-gray-600 font-mono"
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-gray-500 bg-white/3 border border-white/5 rounded-xl p-2.5">
                    <Shield size={12} className="text-amber-400 shrink-0" />
                    <span>Access is controlled by the room owner</span>
                  </div>

                  <button
                    type="submit"
                    disabled={!joinRoomId.trim() || loading}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <span>Join Room</span>
                    <ArrowRight size={15} />
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* MY ROOMS SECTION (BUG 4) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="max-w-4xl mx-auto space-y-10"
        >
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <Layers className="text-indigo-400 w-5 h-5" />
            <h2 className="text-xl font-bold text-white">My Rooms</h2>
          </div>

          {/* SECTION 1: OWNED ROOMS */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Crown className="text-amber-400 w-4 h-4" />
              <h3 className="text-base font-bold text-gray-200">Owned Rooms</h3>
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full font-mono">
                {ownedRooms.length}
              </span>
            </div>

            {roomsLoading ? (
              <div className="py-8 text-center text-xs text-gray-500 font-mono">Loading rooms...</div>
            ) : ownedRooms.length === 0 ? (
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 text-center text-xs text-gray-500">
                You haven't created any rooms yet. Click "Create New Room" above to get started.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownedRooms.map((room) => (
                  <motion.div
                    key={room.roomId}
                    whileHover={{ y: -2 }}
                    className="bg-white/[0.03] border border-white/10 hover:border-indigo-500/40 rounded-2xl p-5 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="bg-indigo-500/20 p-2 rounded-xl border border-indigo-500/30">
                          <Crown size={16} className="text-amber-400" />
                        </div>
                        <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          Owner
                        </span>
                      </div>

                      <h4 className="font-bold text-base text-white mb-1 truncate">
                        {room.roomName || room.roomId}
                      </h4>
                      <p className="text-xs font-mono text-gray-400 mb-3 bg-black/40 px-2.5 py-1 rounded-lg inline-block truncate max-w-full">
                        ID: {room.roomId}
                      </p>

                      <div className="space-y-1 text-[11px] text-gray-400 mb-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <Shield size={11} className="text-indigo-400" />
                          <span>Owner: {user?.name || user?.username}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={11} className="text-gray-500" />
                          <span>Created: {formatDate(room.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={11} className="text-gray-500" />
                          <span>Last Active: {formatDate(room.updatedAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons for Owner */}
                    <div className="space-y-2 pt-3 border-t border-white/5">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => navigate(`/room/${room.roomId}`)}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <LogIn size={13} />
                          <span>Resume</span>
                        </button>
                        <button
                          onClick={() => setInviteModalRoomId(room.roomId)}
                          className="w-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-semibold py-2 rounded-lg transition-all border border-white/10 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <UserPlus size={13} />
                          <span>Invite</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteRoom(room.roomId)}
                        className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold py-1.5 rounded-lg transition-all border border-red-500/20 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={13} />
                        <span>Delete Room</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: JOINED ROOMS */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Users className="text-purple-400 w-4 h-4" />
              <h3 className="text-base font-bold text-gray-200">Joined Rooms</h3>
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full font-mono">
                {joinedRooms.length}
              </span>
            </div>

            {roomsLoading ? (
              <div className="py-8 text-center text-xs text-gray-500 font-mono">Loading rooms...</div>
            ) : joinedRooms.length === 0 ? (
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 text-center text-xs text-gray-500">
                You haven't joined any rooms yet. When an owner invites you, accepted rooms will appear here.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {joinedRooms.map((room) => (
                  <motion.div
                    key={room.roomId}
                    whileHover={{ y: -2 }}
                    className="bg-white/[0.03] border border-white/10 hover:border-purple-500/40 rounded-2xl p-5 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="bg-purple-500/20 p-2 rounded-xl border border-purple-500/30">
                          <Users size={16} className="text-purple-400" />
                        </div>
                        <span className="text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-full">
                          Member
                        </span>
                      </div>

                      <h4 className="font-bold text-base text-white mb-1 truncate">
                        {room.roomName || room.roomId}
                      </h4>
                      <p className="text-xs font-mono text-gray-400 mb-3 bg-black/40 px-2.5 py-1 rounded-lg inline-block truncate max-w-full">
                        ID: {room.roomId}
                      </p>

                      <div className="space-y-1 text-[11px] text-gray-400 mb-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <Shield size={11} className="text-purple-400" />
                          <span>Owner: {room.ownerName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={11} className="text-gray-500" />
                          <span>Created: {formatDate(room.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={11} className="text-gray-500" />
                          <span>Last Active: {formatDate(room.updatedAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons for Member */}
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
                      <button
                        onClick={() => handleJoinJoinedRoom(room.roomId)}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold py-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <LogIn size={13} />
                        <span>Join Room</span>
                      </button>
                      <button
                        onClick={() => handleLeaveRoom(room.roomId)}
                        className="w-full bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-300 text-xs font-semibold py-2 rounded-lg transition-all border border-white/10 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <LogOut size={13} />
                        <span>Leave Room</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </main>

      {/* Invitation Center Modal */}
      <InvitationCenterModal
        isOpen={isInvitationCenterOpen}
        onClose={() => {
          setIsInvitationCenterOpen(false);
          loadUserRooms();
        }}
        onInvitationsUpdated={(count) => setUnreadCount(count)}
      />

      {/* Room History Modal */}
      <RoomHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => {
          setIsHistoryOpen(false);
          loadUserRooms();
        }}
      />

      {/* Invite Modal for Dashboard Owned Rooms */}
      {inviteModalRoomId && (
        <InviteModal
          isOpen={Boolean(inviteModalRoomId)}
          onClose={() => setInviteModalRoomId(null)}
          roomId={inviteModalRoomId}
          isOwner={true}
          ownerName={user?.name || user?.username}
          currentUsername={user?.username}
        />
      )}
    </div>
  );
}
