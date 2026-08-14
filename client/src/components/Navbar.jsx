import { useState, useEffect } from 'react';
import { Layers, PanelLeft, LogOut, UserPlus, Shield, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchPendingInvitations } from '../services/api';
import InvitationCenterModal from './InvitationCenterModal';

export default function Navbar({ 
  roomId = '', 
  socket = null,
  users = [], 
  currentUser = null, 
  onToggleSidebar,
  onOpenInvite,
  isOwner = false,
  ownerName = ''
}) {
  const displayRoomId = (roomId || '').toUpperCase();
  const activeUsers = Array.isArray(users) ? users : [];
  const navigate = useNavigate();

  const [isInvitationCenterOpen, setIsInvitationCenterOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = async () => {
    const invs = await fetchPendingInvitations();
    setUnreadCount(invs.length);
  };

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleLeave = () => {
    if (socket && roomId) {
      socket.emit('leave-room', { roomId });
    }
    sessionStorage.removeItem('syncspace_user');
    navigate('/');
  };

  return (
    <>
      <div className="h-14 glass border-b border-white/5 flex items-center justify-between px-4 z-50 shadow-sm relative">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            title="Toggle Sidebar"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <PanelLeft size={18} />
          </button>

          <div className="bg-indigo-500/20 p-1.5 rounded-lg border border-indigo-500/30">
            <Layers className="text-indigo-400 w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-wide text-white">SyncSpace</span>
              {isOwner && (
                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.2 rounded flex items-center gap-1 font-mono">
                  <Shield size={10} /> OWNER
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-500 font-mono">ROOM: {displayRoomId}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notifica tion Center Button */}
          <button
            onClick={() => setIsInvitationCenterOpen(true)}
            className="relative p-2 rounded-xl text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
            title="Invitation Center"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-indigo-600 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center border border-[#0A0A0A] shadow-sm animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Invite collaborators button — only visible to room owner */}
          {isOwner && (
            <button
              onClick={onOpenInvite}
              className="bg-indigo-600/80 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border border-indigo-500/30"
              title="Manage room access and invite users"
            >
              <UserPlus size={14} />
              <span>Invite</span>
            </button>
          )}

          {/* Active Users Avatar Group */}
          <div className="flex items-center -space-x-2 mr-1">
            {activeUsers.slice(0, 5).map((u, i) => (
              <div 
                key={u?.id || i} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 border-[#0A0A0A] shadow-md cursor-pointer transition-transform hover:scale-110"
                style={{ backgroundColor: u?.color || '#6366F1' }}
                title={u?.name || 'User'}
              >
                {u?.name ? u.name.charAt(0).toUpperCase() : 'U'}
              </div>
            ))}
            {activeUsers.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-semibold border-2 border-[#0A0A0A] z-10 text-gray-300">
                +{activeUsers.length - 5}
              </div>
            )}
          </div>
          
          <div className="h-5 w-px bg-white/10 mx-0.5" />
          
          <div 
            className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/40 border border-white/10"
            title={currentUser?.name ? `Signed in as ${currentUser.name}` : 'Your Profile'}
          >
            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: currentUser?.color || '#6366F1' }}></div>
            <span className="text-xs font-medium text-gray-300">{currentUser?.name || 'User'}</span>
          </div>

          <button
            onClick={handleLeave}
            title="Leave Room"
            className="p-2 rounded-lg text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <InvitationCenterModal
        isOpen={isInvitationCenterOpen}
        onClose={() => setIsInvitationCenterOpen(false)}
        onInvitationsUpdated={(count) => setUnreadCount(count)}
      />
    </>
  );
}
