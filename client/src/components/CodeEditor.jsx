import React, { useState, useEffect } from 'react';
import { Play, Code2, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CodeEditor({ roomId, socket }) {
  const [code, setCode] = useState(`// Collaborative Workspace Editor
function syncSpace() {
  console.log("Realtime collaboration ready!");
}

syncSpace();`);
  const [language, setLanguage] = useState('javascript');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleCodeChange = (newCode) => {
      setCode(newCode);
    };

    socket.on('code-change',  handleCodeChange);
    return () => socket.off('code-change', handleCodeChange);
  }, [socket]);

  const handleChange = (e) => {
    const val = e.target.value;
    setCode(val);
    socket?.emit('code-change', { roomId, code: val });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#121212] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Editor Header */}
      <div className="h-11 bg-[#1A1A1A] border-b border-white/10 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Code2 size={16} className="text-indigo-400" />
          <span className="text-xs font-semibold text-gray-300">Code Editor</span>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="html">HTML</option>
          </select>

          <button
            onClick={handleCopy}
            title="Copy Code"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Editor Main Content */}
      <div className="flex-1 relative font-mono text-xs">
        <textarea
          value={code}
          onChange={handleChange}
          spellCheck="false"
          className="w-full h-full p-4 bg-[#0D0D0D] text-emerald-400 font-mono resize-none focus:outline-none leading-relaxed selection:bg-indigo-500/30"
          placeholder="// Type your code here..."
        />
      </div>
    </div>
  );
}
