import React from 'react';
import { Wifi, WifiOff, Users, MousePointer, ShieldCheck } from 'lucide-react';

export default function StatusBar({ socket, roomId, users = [], cursor = { x: 0, y: 0 } }) {
  const isConnected = Boolean(socket?.connected);

  return (
    <div className="h-7 bg-[#0E0E0E] border-t border-white/10 flex items-center justify-between px-4 text-[11px] text-gray-400 font-mono select-none z-50">
      {/* Left: Socket status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <>
              <Wifi size={12} className="text-emerald-400" />
              <span className="text-emerald-400 font-medium">Connected</span>
            </>
          ) : (
            <>
              <WifiOff size={12} className="text-amber-400" />
              <span className="text-amber-400 font-medium">Connecting...</span>
            </>
          )}
        </div>

        <div className="h-3 w-px bg-white/10" />

        <div className="flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-indigo-400" />
          <span>SyncSpace v2.0</span>
        </div>
      </div>

      {/* Right: Room stats & Mouse coordinates */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <MousePointer size={12} className="text-gray-500" />
          <span>X: {Math.round(cursor.x || 0)}, Y: {Math.round(cursor.y || 0)}</span>
        </div>

        <div className="h-3 w-px bg-white/10" /> 

        <div className="flex items-center gap-1.5">
          <Users size={12} className="text-indigo-400" />
          <span>{users.length} Active User{users.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="h-3 w-px bg-white/10" />

        <div className="text-gray-500">
          ROOM: <span className="text-gray-300 font-semibold">{roomId}</span>
        </div>
      </div>
    </div>
  );
}
