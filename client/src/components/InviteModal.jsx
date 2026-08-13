import { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Shield, Check, Copy, UserCheck, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const API_BASE = 'http://localhost:5001';

const getAuthHeaders = () => {
  const token = localStorage.getItem('syncspace_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

export default function InviteModal({ isOpen, onClose, roomId, isOwner, ownerName, currentUsername }) {
  const [searchQuery, setSearchQuery] = useState('');  // username or email
  const [invitedUsers, setInvitedUsers] = useState([]); // array of User IDs
  const [invitedUserDetails, setInvitedUserDetails] = useState({}); // userId -> {username, displayName}
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && roomId) {
      fetchAccessDetails();
    }
  }, [isOpen, roomId]);

  const fetchAccessDetails = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/rooms/${roomId}/access`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.invitedUsers) setInvitedUsers(data.invitedUsers);
    } catch (err) {
      console.error('Failed to fetch room access details:', err);
      toast.error('Could not load room access details');
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const token = localStorage.getItem('syncspace_token');
    if (!token) {
      toast.error('You must be logged in to invite users');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/rooms/${roomId}/invite`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ username: searchQuery.trim() })
      });
      const data = await res.json();

      if (data.success) {
        const invitedName =
          data.invitation?.invitedDisplayName ||
          data.invitation?.invitedUsername ||
          searchQuery.trim();
        toast.success(`${invitedName} invited to workspace!`);
        setInvitedUsers(data.invitedUsers || []);
        // Store display info for newly invited user
        if (data.invitation?.invitedUserId || data.invitation?.invitedUser) {
          const uid = (data.invitation.invitedUserId || data.invitation.invitedUser).toString();
          setInvitedUserDetails(prev => ({
            ...prev,
            [uid]: {
              username: data.invitation.invitedUsername || searchQuery.trim(),
              displayName: data.invitation.invitedDisplayName || searchQuery.trim()
            }
          }));
        }
        setSearchQuery('');
      } else {
        toast.error(data.message || 'Failed to invite user');
      }
    } catch (err) {
      console.error('Invite error:', err);
      toast.error('Network error — make sure the server is running');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (targetUserId) => {
    const token = localStorage.getItem('syncspace_token');
    if (!token) {
      toast.error('You must be logged in to revoke access');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/rooms/${roomId}/invite/${targetUserId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Access revoked');
        setInvitedUsers(data.invitedUsers || []);
      } else {
        toast.error(data.message || 'Failed to remove user');
      }
    } catch (err) {
      console.error('Remove error:', err);
      toast.error('Network error while revoking access');
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Workspace link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Resolve display label for a user ID
  const getUserLabel = (userId) => {
    const details = invitedUserDetails[userId];
    if (details) return details.displayName || details.username || userId;
    return userId.length > 16 ? `${userId.substring(0, 12)}...` : userId;
  };

  if (!isOpen) return null;

  const hasToken = Boolean(localStorage.getItem('syncspace_token'));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden"
        >
          {/* Top Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/20 p-2.5 rounded-xl border border-indigo-500/30">
                <UserPlus className="text-indigo-400 w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-white">Invite Collaborators</h3>
                <p className="text-xs text-gray-400 font-mono">ROOM: {roomId}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Owner info */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 mb-4 text-xs">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-amber-400" />
              <span className="text-gray-300">Room Owner:</span>
            </div>
            <span className="font-semibold text-indigo-400">{ownerName || 'Owner'}</span>
          </div>

          {/* Auth warning if no token */}
          {!hasToken && isOwner && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 text-xs text-amber-300">
              ⚠️ You need to be logged in to manage invitations.
            </div>
          )}

          {/* Invite form — only for authenticated owners */}
          {isOwner && hasToken ? (
            <form onSubmit={handleInvite} className="mb-4">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Invite by Username or Email
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="username or email@example.com"
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-gray-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <UserPlus size={14} />
                  <span>{loading ? 'Inviting...' : 'Invite'}</span>
                </button>
              </div>
            </form>
          ) : !isOwner ? (
            <p className="text-xs text-gray-400 mb-4 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
              Only the room owner (<span className="font-mono text-amber-300">{ownerName}</span>) can invite new collaborators.
            </p>
          ) : null}

          {/* Invited Users List */}
          <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
              Authorized Collaborators ({invitedUsers.length})
            </span>

            {invitedUsers.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-1">No individual invites sent yet.</p>
            ) : (
              invitedUsers.map((userId) => {
                const label = getUserLabel(userId);
                return (
                  <div
                    key={userId}
                    className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <UserCheck size={14} className="text-emerald-400" />
                      <span className="text-gray-200">{label}</span>
                    </div>
                    {isOwner && hasToken && (
                      <button
                        onClick={() => handleRemove(userId)}
                        title="Revoke access"
                        className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Copy Link Button */}
          <button
            onClick={copyInviteLink}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? 'Copied Room Link!' : 'Copy Room Link'}</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
