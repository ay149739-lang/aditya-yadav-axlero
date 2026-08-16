import React, { useState, useRef } from 'react';
import {
  Users, FileCode, Copy, Check, Circle, Plus, Upload, Download,
  Edit2, Trash2, FolderArchive, X, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Sidebar({
  roomId,
  users = [],
  currentUser,
  files = [],
  activeFileId,
  onSelectFile,
  onCreateFile,
  onUploadFile,
  onRenameFile,
  onDeleteFile,
  onDownloadFile,
  onDownloadProject
}) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'files'

  // New File Modal state
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // Rename File state
  const [editingFileId, setEditingFileId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const fileInputRef = useRef(null);

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Room link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newFileName.trim()) {
      toast.error('Please enter a valid filename');
      return;
    }
    if (onCreateFile) {
      onCreateFile(newFileName.trim());
    }
    setNewFileName('');
    setIsNewFileModalOpen(false);
  };

  const handleFileUpload = (e) => {
    const uploadedFiles = Array.from(e.target.files || []);
    if (uploadedFiles.length === 0) return;

    uploadedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result || '';
        if (onUploadFile) {
          onUploadFile(file.name, content);
        }
      };
      reader.readAsText(file);
    });

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRenaming = (file, e) => {
    e.stopPropagation();
    setEditingFileId(file.id);
    setRenameValue(file.name);
  };

  const handleRenameSubmit = (fileId, e) => {
    e.preventDefault();
    if (!renameValue.trim()) {
      toast.error('Filename cannot be empty');
      return;
    }
    if (onRenameFile) {
      onRenameFile(fileId, renameValue.trim());
    }
    setEditingFileId(null);
    setRenameValue('');
  };

  return (
    <div className="w-64 h-full glass border-r border-white/10 flex flex-col bg-[#0F0F0F] text-white select-none">
      {/* Hidden File Input for Upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.js,.jsx,.ts,.tsx,.html,.css,.py,.java,.cpp,.json,.md"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Tab Header */}
      <div className="flex border-b border-white/10 shrink-0">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'users'
              ? 'border-indigo-500 text-indigo-400 bg-white/5'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Users size={14} />
          Active ({users.length})
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
          Files ({files.length})
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
                  <div className="flex items-center gap-2.5 min-w-0">
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
          <div className="space-y-3">
            {/* Header Action Toolbar for Files */}
            <div className="space-y-1.5 pb-2 border-b border-white/10">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setIsNewFileModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer shadow-md"
                >
                  <Plus size={13} />
                  <span>New File</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white/5 hover:bg-white/10 text-gray-200 text-[11px] font-semibold py-1.5 px-2 rounded-lg transition-all border border-white/10 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Upload size={13} className="text-purple-400" />
                  <span>Upload</span>
                </button>
              </div>

              <button
                onClick={onDownloadProject}
                className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FolderArchive size={13} />
                <span>Download Project ZIP</span>
              </button>
            </div>

            {/* File List */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-gray-500 tracking-wider uppercase px-1 block mb-1">
                Workspace Files ({files.length})
              </span>

              {files.length === 0 ? (
                <p className="text-xs text-gray-500 italic px-2 py-2">No files in workspace</p>
              ) : (
                files.map((file) => {
                  const isActive = file.id === activeFileId;
                  const isEditing = editingFileId === file.id;

                  return (
                    <div
                      key={file.id || file.name}
                      onClick={() => onSelectFile && onSelectFile(file.id)}
                      className={`group flex items-center justify-between p-2 rounded-xl text-xs transition-all cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600/20 border border-indigo-500/40 text-white shadow-sm font-semibold'
                          : 'bg-white/[0.02] border border-transparent hover:bg-white/5 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileCode
                          size={15}
                          className={isActive ? 'text-indigo-400 shrink-0' : 'text-gray-500 shrink-0'}
                        />

                        {isEditing ? (
                          <form onSubmit={(e) => handleRenameSubmit(file.id, e)} className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={(e) => handleRenameSubmit(file.id, e)}
                              autoFocus
                              className="w-full bg-black border border-indigo-500 rounded px-1 py-0.5 text-xs text-white outline-none"
                            />
                          </form>
                        ) : (
                          <div className="min-w-0 flex-1">
                            <span className="truncate block leading-tight">{file.name}</span>
                            <span className="text-[9px] text-gray-500 font-mono block truncate">
                              ({file.creatorName || file.creator || 'Owner'})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* File Hover Action Icons */}
                      {!isEditing && (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onDownloadFile) onDownloadFile(file);
                            }}
                            title="Download File"
                            className="p-1 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors"
                          >
                            <Download size={12} />
                          </button>

                          <button
                            onClick={(e) => startRenaming(file, e)}
                            title="Rename File"
                            className="p-1 hover:bg-white/10 text-gray-400 hover:text-indigo-300 rounded transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete "${file.name}"?`)) {
                                if (onDeleteFile) onDeleteFile(file.id);
                              }
                            }}
                            title="Delete File"
                            className="p-1 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* New File Modal */}
      {isNewFileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#141414] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="text-indigo-400" size={18} />
                <h4 className="font-semibold text-sm text-white">Create New File</h4>
              </div>
              <button
                onClick={() => setIsNewFileModalOpen(false)}
                className="p-1 text-gray-400 hover:text-white rounded"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">
                  Filename with Extension
                </label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="e.g. App.jsx, styles.css, script.py"
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div className="flex flex-wrap gap-1 text-[10px] font-mono text-gray-500">
                <span>Supported:</span>
                <span className="text-indigo-400">.html .css .js .jsx .ts .tsx .py .java .cpp .json .md .txt</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsNewFileModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFileName.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Share Card at Bottom */}
      <div className="p-3 border-t border-white/10 bg-black/40 shrink-0">
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

