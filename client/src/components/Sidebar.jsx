import React, { useState } from 'react';
import { Users, FileCode, Copy, Check, ChevronRight, ShieldAlert, Circle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Sidebar({ roomId, users = [], currentUser }) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'files'

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Room link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const files = [
    { name: 'main.js', language: 'javascript' },
    { name: 'index.html', language: 'html' },
    { name: 'styles.css', language: 'css' },
  ];

  return (
    <div className="w-64 h-full glass border-r border-white/10 flex flex-col bg-[#0F0F0F] text-white">
      {/* Tab Header */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'users'
              ? 'border-indigo-500 text-indigo-400 bg-white/5'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Users size={14} />
          Active Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'files'
              ? 'border-indigo-500 text-indigo-400 bg-white/5'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <FileCode size={14} />
          Files
        </button>
      </div>

      {/* Main Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeTab === 'users' ? (
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-gray-500 tracking-wider uppercase px-2 block">
              In Room Right Now
            </span>
            {users.map((u) => {
              const isSelf = u?.username === currentUser?.username || u?.id === currentUser?.id;
              return (
                <div
                  key={u?.id || u?.username}
                  className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0"
                      style={{ backgroundColor: u?.color || '#6366F1' }}
                    >
                      {(u?.name || u?.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-gray-200 block truncate">
                        {u?.name || u?.username || 'Guest'}
                        {isSelf && <span className="ml-1 text-[10px] text-indigo-400 font-mono">(You)</span>}
                      </span>
                      <span className="text-[10px] text-gray-600 font-mono truncate block">@{u?.username || '—'}</span>
                    </div>
                  </div>
                  <Circle size={8} className="text-emerald-400 fill-emerald-400 animate-pulse shrink-0" />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-gray-500 tracking-wider uppercase px-2 block mb-2">
              Workspace Files
            </span>
            {files.map((file) => (
              <div
                key={file.name}
                className="flex items-center gap-2 p-2 rounded-lg text-xs text-gray-300 hover:bg-white/5 cursor-pointer transition-colors"
              >
                <FileCode size={14} className="text-indigo-400" />
                <span>{file.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Room Share Card at Bottom */}
      <div className="p-3 border-t border-white/10 bg-black/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-gray-400 font-mono">ROOM: {roomId}</span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
            LIVE
          </span>
        </div>
        <button
          onClick={copyRoomLink}
          className="w-full bg-indigo-600/80 hover:bg-indigo-600 text-white py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied Link!' : 'Invite Collaborator'}
        </button>
      </div>
    </div>
  );
}
