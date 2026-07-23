import { Layers } from 'lucide-react';

export default function Navbar({ roomId, users, currentUser }) {
  return (
    <div className="h-14 glass border-b border-white/5 flex items-center justify-between px-4 z-50 shadow-sm relative">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-500/20 p-1.5 rounded-lg border border-indigo-500/30">
          <Layers className="text-indigo-400 w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm tracking-wide">SyncSpace</span>
          <span className="text-[10px] text-gray-500 font-mono">ROOM: {roomId.toUpperCase()}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Active Users Avatar Group */}
        <div className="flex items-center -space-x-2 mr-2">
          {users.slice(0, 5).map((u, i) => (
            <div 
              key={u.id} 
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 border-[#0A0A0A] shadow-sm cursor-pointer"
              style={{ backgroundColor: u.color }}
              title={u.name}
            >
              {u.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {users.length > 5 && (
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs border-2 border-[#0A0A0A] z-10">
              +{users.length - 5}
            </div>
          )}
        </div>
        
        <div className="h-5 w-px bg-white/10 mx-1"></div>
        
        <div 
          className="flex items-center gap-2 px-2 py-1 rounded-md bg-black/20 border border-white/5"
          title="Your Profile"
        >
          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: currentUser?.color }}></div>
          <span className="text-sm text-gray-300">{currentUser?.name}</span>
        </div>
      </div>
    </div>
  );
}
