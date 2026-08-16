import { useState, useEffect } from 'react';
import { X, Inbox, Check, Ban, Clock, ArrowRight, Shield, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { fetchNotifications, acceptInvitation, rejectInvitation, fetchActiveRooms, checkRoomAccess } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function InvitationCenterModal({ isOpen, onClose, onInvitationsUpdated }) {
  const [invitations, setInvitations] = useState([]);
  const [activeRooms, setActiveRooms] = useState({});   // { roomId -> userCount }
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    const [notifs, active] = await Promise.all([
      fetchNotifications(),
      fetchActiveRooms()
    ]);
    setInvitations(notifs.pending || []);
    setActiveRooms(active || {});
    if (onInvitationsUpdated) onInvitationsUpdated(notifs.unreadCount || 0);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleAccept = async (inv) => {
    const invId = inv.id || inv._id;
    setActionId(invId);
    const res = await acceptInvitation(invId);
    if (res.ok && res.success) {
      const updated = invitations.filter(item => (item.id || item._id) !== invId);
      setInvitations(updated);
      if (onInvitationsUpdated) onInvitationsUpdated(updated.length);

      const accessRes = await checkRoomAccess(inv.roomId);
      if (accessRes.hasAccess) {
        toast.success(`Accepted! Joining "${inv.roomName || inv.roomId}"...`);
        onClose();
        navigate(`/room/${inv.roomId}`);
      } else {
        toast.error(accessRes.message || 'The room owner is currently offline. You can only join when the owner is inside the room.');
        onClose();
      }
    } else {
      toast.error(res.message || 'Failed to accept invitation');
    }
    setActionId(null);
  };

  const handleReject = async (inv) => {
    const invId = inv.id || inv._id;
    setActionId(invId);
    const res = await rejectInvitation(invId);
    if (res.ok && res.success) {
      toast('Invitation declined', { icon: '🚫' });
      const updated = invitations.filter(item => (item.id || item._id) !== invId);
      setInvitations(updated);
      if (onInvitationsUpdated) onInvitationsUpdated(updated.length);
    } else {
      toast.error(res.message || 'Failed to decline invitation');
    }
    setActionId(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[#12121e] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/20 p-2.5 rounded-xl border border-indigo-500/30">
                <Inbox className="text-indigo-400 w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Invitation Center</h3>
                <p className="text-xs text-gray-400">Review pending workspace invitations</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-xs text-gray-500 font-mono">Fetching notifications...</p>
            </div>
          ) : invitations.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
              <div className="bg-white/5 p-4 rounded-full border border-white/5">
                <Inbox size={32} className="text-gray-500" />
              </div>
              <p className="text-sm font-semibold text-gray-300">No pending invitations</p>
              <p className="text-xs text-gray-500 max-w-xs">
                When a workspace owner invites you to collaborate, invitations will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {invitations.map((inv) => {
                const invId = inv.id || inv._id;
                const isProcessing = actionId === invId;
                const isActive = Boolean(activeRooms[inv.roomId]);
                const activeCount = activeRooms[inv.roomId] || 0;
                const timeAgo = inv.createdAt
                  ? new Date(inv.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Recently';

                return (
                  <motion.div
                    key={invId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/[0.03] border border-white/10 hover:border-indigo-500/30 rounded-xl p-4 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-white truncate">
                            {inv.roomName || inv.roomId}
                          </h4>
                          {/* Live / Offline badge */}
                          {isActive ? (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                              Live · {activeCount} online
                            </span>
                          ) : (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium bg-white/5 text-gray-500 border border-white/10 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-600 inline-block" />
                              Offline
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-gray-400 flex items-center gap-1">
                            <Shield size={10} className="text-indigo-400" /> Owner: {inv.ownerName || inv.owner}
                          </span>
                          <span className="text-gray-600">•</span>
                          <span className="text-[10px] text-gray-500 flex items-center gap-1 font-mono">
                            <Clock size={10} /> {timeAgo}
                          </span>
                        </div>
                      </div>

                      <span className="shrink-0 ml-2 text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-400 mb-3 font-mono bg-black/30 px-2.5 py-1 rounded-lg inline-block">
                      ID: {inv.roomId}
                    </p>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                      <button
                        onClick={() => handleReject(inv)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-300 transition-colors border border-white/10 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Ban size={13} />
                        <span>Decline</span>
                      </button>

                      <button
                        onClick={() => handleAccept(inv)}
                        disabled={isProcessing}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isProcessing ? (
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Check size={13} />
                            <span>Accept & Join</span>
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
