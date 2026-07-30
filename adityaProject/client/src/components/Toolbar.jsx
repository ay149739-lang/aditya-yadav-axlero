import React from 'react';
import { Pencil, Square, Type, Eraser, Trash2 } from 'lucide-react';

export default function Toolbar({ 
  activeTool, 
  setActiveTool, 
  color, 
  setColor, 
  strokeWidth, 
  setStrokeWidth,
  onClear 
}) {
  const tools = [
    { id: 'pencil', icon: Pencil, label: 'Pencil (P)' },
    { id: 'rect', icon: Square, label: 'Rectangle (R)' },
    { id: 'text', icon: Type, label: 'Text (T)' },
    { id: 'eraser', icon: Eraser, label: 'Eraser (E)' },
  ];

  const colors = ['#ffffff', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  const strokeWidths = [2, 4, 8];

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#141414]/90 backdrop-blur-md border border-white/10 rounded-2xl p-2 flex items-center gap-3 shadow-2xl z-20">
      {/* Drawing Tools */}
      <div className="flex items-center gap-1">
        {tools.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTool(id)}
            title={label}
            className={`p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
              activeTool === id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>

      <div className="h-6 w-px bg-white/10" />

      {/* Color Palette */}
      <div className="flex items-center gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
              color === c ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2 ring-offset-black' : 'hover:scale-105 opacity-80 hover:opacity-100'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="h-6 w-px bg-white/10" />

      {/* Stroke Width Selection */}
      <div className="flex items-center gap-1">
        {strokeWidths.map((w) => (
          <button
            key={w}
            onClick={() => setStrokeWidth(w)}
            className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
              strokeWidth === w ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {w}px
          </button>
        ))}
      </div>

      <div className="h-6 w-px bg-white/10" />

      {/* Clear Canvas */}
      <button
        onClick={onClear}
        title="Clear Whiteboard"
        className="p-2.5 rounded-xl text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors flex items-center justify-center cursor-pointer"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}
