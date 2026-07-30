import { Layers, PanelLeft, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ roomId = '', users = [], currentUser = null, onToggleSidebar }) {
  const displayRoomId = (roomId || '').toUpperCase();
  const activeUsers = Array.isArray(users) ? users : [];
  const navigate = useNavigate();

  const handleLeave = () => {
    sessionStorage.removeItem('syncspace_user');
    navigate('/');
  };

  return (
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
          <span className="font-semibold text-sm tracking-wide text-white">SyncSpace</span>
          <span className="text-[10px] text-gray-500 font-mono">ROOM: {displayRoomId}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Active Users Avatar Group */}
        <div className="flex items-center -space-x-2 mr-2">
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
        
        <div className="h-5 w-px bg-white/10 mx-1" />
        
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
  );
}
