import { useState, useEffect } from 'react';
import { X, History, Crown, Users, Shield, Clock, LogIn, ArrowRight, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { fetchOwnedRooms, fetchJoinedRooms, fetchOwnerStatus } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function RoomHistoryModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [ownedRooms, setOwnedRooms] = useState([]);
  const [joinedRooms, setJoinedRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningRoomId, setJoiningRoomId] = useState(null);
  const navigate = useNavigate();

  const loadHistory = async () => {
    setLoading(true);
    const [owned, joined] = await Promise.all([
      fetchOwnedRooms(),
      fetchJoinedRooms()
    ]);
    setOwnedRooms(owned || []);
    setJoinedRooms(joined || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Recently';
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleJoinAgain = async (room, isOwner) => {
    const roomId = room.roomId;

    if (isOwner) {
      // CASE 1 — Created Room: Owner can always join directly
      toast.success(`Joining workspace "${room.roomName || roomId}"...`);
      onClose();
      navigate(`/room/${roomId}`);
      return;
    }

    // CASE 2 — Invited Room: Verify if room owner is currently online and connected
    setJoiningRoomId(roomId);
    try {
      const statusRes = await fetchOwnerStatus(roomId);
      if (statusRes.isOwnerOnline) {
        toast.success(`Owner is online! Joining "${room.roomName || roomId}"...`);
        onClose();
        navigate(`/room/${roomId}`);
      } else {
        toast.error('The room owner is currently offline. Please try again later.');
      }
    } catch (err) {
      console.error('Owner status verification failed:', err);
      toast.error('Failed to verify room owner status');
    } finally {
      setJoiningRoomId(null);
    }
  };

  if (!isOpen) return null;

  // Build combined history list: created rooms first, then invited rooms
  const historyItems = [
    ...ownedRooms.map(r => ({ ...r, isCreated: true, roleLabel: 'Owner' })),
    ...joinedRooms.map(r => ({ ...r, isCreated: false, roleLabel: 'Member' }))
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[#12121e] border border-white/10 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/20 p-2.5 rounded-xl border border-purple-500/30">
                <History className="text-purple-400 w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Room History</h3>
                <p className="text-xs text-gray-400">View and rejoin your created and invited rooms</p>
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
              <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              <p className="text-xs text-gray-500 font-mono">Loading room history...</p>
            </div>
          ) : historyItems.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
              <div className="bg-white/5 p-4 rounded-full border border-white/5">
                <History size={32} className="text-gray-500" />
              </div>
              <p className="text-sm font-semibold text-gray-300">No room history found</p>
              <p className="text-xs text-gray-500 max-w-xs">
                Rooms you create or join will automatically appear here in your history.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {historyItems.map((room) => {
                const isOwner = room.isCreated;
                const isProcessing = joiningRoomId === room.roomId;
                const displayTitle = `${room.roomName || room.roomId} ${isOwner ? '(Created)' : '(Invited)'}`;

                return (
                  <motion.div
                    key={room.roomId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/[0.03] border border-white/10 hover:border-purple-500/30 rounded-xl p-4 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-sm text-white truncate">
                            {displayTitle}
                          </h4>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400 font-mono mb-2">
                          <span className="bg-black/40 px-2 py-0.5 rounded text-gray-300">
                            ID: {room.roomId}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Shield size={11} className={isOwner ? "text-amber-400" : "text-purple-400"} />
                            Owner: {isOwner ? (user?.name || user?.username || room.ownerName || 'You') : room.ownerName}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock size={10} /> Last Joined: {formatDate(room.updatedAt || room.createdAt)}
                          </span>
                          <span>•</span>
                          <span>Role: <strong className="text-gray-400">{room.roleLabel}</strong></span>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isOwner
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                        }`}>
                          {isOwner ? 'Created' : 'Invited'}
                        </span>

                        <button
                          onClick={() => handleJoinAgain(room, isOwner)}
                          disabled={isProcessing}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                            isOwner
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                              : 'bg-purple-600 hover:bg-purple-500 text-white'
                          }`}
                        >
                          {isProcessing ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <LogIn size={13} />
                              <span>Join Again</span>
                            </>
                          )}
                        </button>
                      </div>
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
