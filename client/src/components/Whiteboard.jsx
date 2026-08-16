import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Rect, Text } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import { Maximize2, Minimize2 } from 'lucide-react';
import Toolbar from './Toolbar';

export default function Whiteboard({ 
  roomId, 
  socket, 
  users = [], 
  onCursorMove,
  initialShapes = [],
  onShapesChange,
  replayShapes = null,
  isReplayMode = false,
  panelMode = 'split',
  onToggleMaximize
}) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [activeTool, setActiveTool] = useState('pencil');
  const [color, setColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [shapes, setShapes] = useState(initialShapes);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShapeId, setCurrentShapeId] = useState(null);
  const [cursors, setCursors] = useState({});
  const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, text: '', createdAt: 0 });

  // Per-user Undo / Redo history stacks
  const myUndoStackRef = useRef([]);
  const myRedoStackRef = useRef([]);
  const [, setStackTick] = useState(0);

  const currentShapeRef = useRef(null);
  const textInputRef = useRef(null);
  const stageRef = useRef(null);

  // Auto-focus floating text input when created
  useEffect(() => {
    if (textInput.visible && textInputRef.current) {
      const timer = setTimeout(() => {
        textInputRef.current?.focus();
        textInputRef.current?.select();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [textInput.visible]);

  const activeShapes = isReplayMode && replayShapes !== null ? replayShapes : shapes;

  const CURSOR_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
  const getColorForUser = (userId) => {
    if (!userId || !Array.isArray(users)) return CURSOR_COLORS[0];
    const index = users.findIndex(u => u?.id === userId);
    if (index === -1) return CURSOR_COLORS[0];
    return CURSOR_COLORS[index % CURSOR_COLORS.length];
  };

  // Sync initial shapes when loaded from recovery/persistence
  useEffect(() => {
    if (Array.isArray(initialShapes) && initialShapes.length > 0 && shapes.length === 0) {
      setShapes(initialShapes);
    }
  }, [initialShapes]);

  // Notify parent of shape updates for autosave
  const updateShapes = (newShapes) => {
    setShapes(newShapes);
    if (onShapesChange) onShapesChange(newShapes);
  };

  const pushUndoAction = (action) => {
    myUndoStackRef.current.push(action);
    myRedoStackRef.current = [];
    setStackTick(t => t + 1);
  };

  const handleUndo = useCallback(() => {
    if (isReplayMode || myUndoStackRef.current.length === 0) return;
    const action = myUndoStackRef.current.pop();
    myRedoStackRef.current.push(action);
    setStackTick(t => t + 1);

    if (action.type === 'ADD') {
      setShapes((prev) => {
        const updated = prev.filter(s => s.id !== action.shape.id);
        if (onShapesChange) onShapesChange(updated);
        return updated;
      });
      socket?.emit('delete-shape', { roomId, shapeId: action.shape.id });
    }
  }, [roomId, socket, onShapesChange, isReplayMode]);

  const handleRedo = useCallback(() => {
    if (isReplayMode || myRedoStackRef.current.length === 0) return;
    const action = myRedoStackRef.current.pop();
    myUndoStackRef.current.push(action);
    setStackTick(t => t + 1);

    if (action.type === 'ADD') {
      setShapes((prev) => {
        const updated = prev.some(s => s.id === action.shape.id) ? prev : [...prev, action.shape];
        if (onShapesChange) onShapesChange(updated);
        return updated;
      });
      socket?.emit('draw-end', { roomId, ...action.shape });
    }
  }, [roomId, socket, onShapesChange, isReplayMode]);

  useEffect(() => {
    const checkSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth || containerRef.current.clientWidth || 800;
        const h = containerRef.current.offsetHeight || containerRef.current.clientHeight || 600;
        setSize({ width: w, height: h });
      }
    };

    checkSize();
    window.addEventListener('resize', checkSize);
    
    const observer = new ResizeObserver(checkSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', checkSize);
      observer.disconnect();
    };
  }, []);

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isReplayMode) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (isCtrlOrCmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      
      switch(e.key.toLowerCase()) {
        case 'p':
        case '1':
          setActiveTool('pencil');
          break;
        case 'r':
        case '2':
          setActiveTool('rect');
          break;
        case 't':
        case '3':
          setActiveTool('text');
          break;
        case 'e':
        case '4':
          setActiveTool('eraser');
          break;
        default:
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, isReplayMode]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleDrawStart = (newShape) => {
      setShapes((prev) => {
        if (prev.some(s => s.id === newShape.id)) return prev;
        const updated = [...prev, newShape];
        if (onShapesChange) onShapesChange(updated);
        return updated;
      });
    };

    const handleDrawing = (updatedShape) => {
      setShapes((prev) => {
        const index = prev.findIndex(s => s.id === updatedShape.id);
        let newShapes;
        if (index !== -1) {
          newShapes = [...prev];
          newShapes[index] = updatedShape;
        } else {
          newShapes = [...prev, updatedShape];
        }
        return newShapes;
      });
    };

    const handleDrawEnd = (finalShape) => {
      setShapes((prev) => {
        const index = prev.findIndex(s => s.id === finalShape.id);
        let newShapes;
        if (index !== -1) {
          newShapes = [...prev];
          newShapes[index] = finalShape;
        } else {
          newShapes = [...prev, finalShape];
        }
        if (onShapesChange) onShapesChange(newShapes);
        return newShapes;
      });
    };

    const handleDeleteShape = ({ shapeId }) => {
      setShapes((prev) => {
        const updated = prev.filter(s => s.id !== shapeId);
        if (onShapesChange) onShapesChange(updated);
        return updated;
      });
    };

    const handleClearCanvas = () => {
      updateShapes([]);
    };

    const handleSyncShapes = (data) => {
      if (data && Array.isArray(data.shapes)) {
        setShapes(data.shapes);
        if (onShapesChange) onShapesChange(data.shapes);
      }
    };

    const handleCursorMove = (data) => {
      setCursors(prev => ({
        ...prev,
        [data.userId]: { x: data.x, y: data.y, userName: data.userName }
      }));
    };

    const handleUserLeft = (userId) => {
      setCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
    };

    const handleInitialShapes = (initialShapesData) => {
      if (Array.isArray(initialShapesData)) {
        setShapes(initialShapesData);
        if (onShapesChange) onShapesChange(initialShapesData);
      }
    };

    socket.off('initial-shapes', handleInitialShapes);
    socket.off('draw-start', handleDrawStart);
    socket.off('drawing', handleDrawing);
    socket.off('draw-end', handleDrawEnd);
    socket.off('delete-shape', handleDeleteShape);
    socket.off('clear-canvas', handleClearCanvas);
    socket.off('sync-shapes', handleSyncShapes);
    socket.off('cursor-move', handleCursorMove);
    socket.off('user-left', handleUserLeft);

    socket.on('initial-shapes', handleInitialShapes);
    socket.on('draw-start', handleDrawStart);
    socket.on('drawing', handleDrawing);
    socket.on('draw-end', handleDrawEnd);
    socket.on('delete-shape', handleDeleteShape);
    socket.on('clear-canvas', handleClearCanvas);
    socket.on('sync-shapes', handleSyncShapes);
    socket.on('cursor-move', handleCursorMove);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('initial-shapes', handleInitialShapes);
      socket.off('draw-start', handleDrawStart);
      socket.off('drawing', handleDrawing);
      socket.off('draw-end', handleDrawEnd);
      socket.off('delete-shape', handleDeleteShape);
      socket.off('clear-canvas', handleClearCanvas);
      socket.off('sync-shapes', handleSyncShapes);
      socket.off('cursor-move', handleCursorMove);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket, onShapesChange]);

  const handleClear = () => {
    if (isReplayMode) return;
    updateShapes([]);
    socket?.emit('clear-canvas', { roomId });
  };

  const handleMouseDown = (e) => {
    if (isReplayMode) return;

    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    if (activeTool === 'text') {
      if (textInput.visible) {
        if (Date.now() - (textInput.createdAt || 0) < 250) return;
        if (textInput.text.trim()) {
          handleTextSubmit();
        }
      }
      setTextInput({ visible: true, x: pos.x, y: pos.y, text: '', createdAt: Date.now() });
      return;
    }

    if (textInput.visible) {
      if (textInput.text.trim()) {
        handleTextSubmit();
      } else {
        setTextInput({ visible: false, x: 0, y: 0, text: '', createdAt: 0 });
      }
    }

    setIsDrawing(true);
    const newId = uuidv4();
    setCurrentShapeId(newId);

    const activeColor = activeTool === 'eraser' ? '#0A0A0A' : color;
    const activeWidth = activeTool === 'eraser' ? strokeWidth * 4 : strokeWidth;

    let newShape = null;

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      newShape = {
        type: 'line',
        id: newId,
        points: [pos.x, pos.y],
        stroke: activeColor,
        strokeWidth: activeWidth,
      };
    } else if (activeTool === 'rect') {
      newShape = {
        type: 'rect',
        id: newId,
        startX: pos.x,
        startY: pos.y,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        stroke: activeColor,
        strokeWidth: activeWidth,
      };
    }

    if (newShape) {
      currentShapeRef.current = newShape;
      setShapes((prev) => [...prev, newShape]);
      socket?.emit('draw-start', { roomId, ...newShape });
    }
  };

  const handleMouseMove = (e) => {
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    if (!point) return;

    if (onCursorMove) onCursorMove(point);
    
    if (isReplayMode) return;

    socket?.emit('cursor-move', { roomId, x: point.x, y: point.y });

    if (!isDrawing || activeTool === 'text' || !currentShapeRef.current) return;

    const currentShape = currentShapeRef.current;

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      const pts = currentShape.points;
      const lastX = pts[pts.length - 2];
      const lastY = pts[pts.length - 1];

      const dist = Math.hypot(point.x - lastX, point.y - lastY);
      if (dist < 2) return;

      currentShape.points = [...pts, point.x, point.y];
    } else if (activeTool === 'rect') {
      currentShape.x = Math.min(currentShape.startX, point.x);
      currentShape.y = Math.min(currentShape.startY, point.y);
      currentShape.width = Math.abs(point.x - currentShape.startX);
      currentShape.height = Math.abs(point.y - currentShape.startY);
    }

    setShapes((prev) => {
      const index = prev.findIndex(s => s.id === currentShape.id);
      if (index === -1) return [...prev, { ...currentShape }];
      const newShapes = [...prev];
      newShapes[index] = { ...currentShape };
      return newShapes;
    });

    socket?.emit('drawing', { roomId, ...currentShape });
  };

  const handleMouseUp = () => {
    if (isReplayMode || !isDrawing) return;
    setIsDrawing(false);

    if (currentShapeRef.current) {
      const finalShape = { ...currentShapeRef.current };
      socket?.emit('draw-end', { roomId, ...finalShape });
      
      setShapes((prev) => {
        const newShapes = prev.map(s => s.id === finalShape.id ? finalShape : s);
        if (!newShapes.some(s => s.id === finalShape.id)) newShapes.push(finalShape);
        if (onShapesChange) onShapesChange(newShapes);
        return newShapes;
      });

      pushUndoAction({ type: 'ADD', shape: finalShape });
      currentShapeRef.current = null;
    }
    setCurrentShapeId(null);
  };

  const handleTextSubmit = () => {
    if (isReplayMode) return;
    setTextInput(prev => {
      if (!prev.visible) return prev;
      if (prev.text && prev.text.trim()) {
        const newShape = {
          type: 'text',
          id: uuidv4(),
          x: prev.x,
          y: prev.y,
          text: prev.text.trim(),
          fontSize: 20 + strokeWidth * 2,
          fill: color,
        };
        setShapes(prevShapes => {
          const updated = [...prevShapes, newShape];
          if (onShapesChange) onShapesChange(updated);
          return updated;
        });
        pushUndoAction({ type: 'ADD', shape: newShape });
        socket?.emit('draw-start', { roomId, ...newShape });
        socket?.emit('draw-end', { roomId, ...newShape });
      }
      return { visible: false, x: 0, y: 0, text: '', createdAt: 0 };
    });
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full absolute inset-0 overflow-hidden rounded-2xl bg-[#0A0A0A]"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.12) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Maximize / Restore Button */}
      {onToggleMaximize && (
        <button
          onClick={onToggleMaximize}
          title={panelMode === 'whiteboard-max' ? 'Restore Split View' : 'Maximize Whiteboard'}
          className="absolute top-3 right-3 z-30 bg-[#1A1A1A]/90 hover:bg-[#2A2A2A] border border-white/10 text-gray-300 hover:text-white p-2 rounded-xl transition-all cursor-pointer shadow-lg flex items-center gap-1.5 text-xs font-semibold select-none"
        >
          {panelMode === 'whiteboard-max' ? (
            <>
              <Minimize2 size={15} className="text-indigo-400" />
              <span className="hidden sm:inline">Restore</span>
            </>
          ) : (
            <>
              <Maximize2 size={15} className="text-indigo-400" />
              <span className="hidden sm:inline">Maximize</span>
            </>
          )}
        </button>
      )}

      {!isReplayMode && (
        <Toolbar 
          activeTool={activeTool} 
          setActiveTool={(toolId) => {
            if (textInput.visible) {
              handleTextSubmit();
            }
            setActiveTool(toolId);
          }} 
          color={color}
          setColor={setColor}
          strokeWidth={strokeWidth}
          setStrokeWidth={setStrokeWidth}
          onClear={handleClear}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={myUndoStackRef.current.length > 0}
          canRedo={myRedoStackRef.current.length > 0}
        />
      )}

      {/* Floating Input for Text Tool */}
      {textInput.visible && (
        <input
          ref={textInputRef}
          type="text"
          value={textInput.text}
          onChange={(e) => setTextInput(prev => ({ ...prev, text: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleTextSubmit();
            } else if (e.key === 'Escape') {
              setTextInput({ visible: false, x: 0, y: 0, text: '', createdAt: 0 });
            }
          }}
          onBlur={() => {
            if (Date.now() - (textInput.createdAt || 0) < 250) return;
            handleTextSubmit();
          }}
          autoFocus
          placeholder="Type text..."
          style={{
            position: 'absolute',
            left: `${textInput.x}px`,
            top: `${textInput.y}px`,
            color: color,
            fontSize: `${20 + strokeWidth * 2}px`,
            background: 'rgba(10, 10, 10, 0.85)',
            border: '1.5px dashed #6366F1',
            borderRadius: '6px',
            outline: 'none',
            zIndex: 40,
            padding: '2px 8px',
            fontFamily: 'sans-serif'
          }}
        />
      )}

      {/* Stage */}
      <div style={{ pointerEvents: isReplayMode ? 'none' : 'auto', position: 'absolute', inset: 0 }}>
        <Stage 
          ref={stageRef}
          width={size.width} 
          height={size.height}
          style={{ cursor: isReplayMode ? 'default' : activeTool === 'text' ? 'text' : activeTool === 'eraser' ? 'cell' : 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        >
          <Layer>
            {activeShapes.map((shape) => {
              if (shape.type === 'line') {
                return (
                  <Line
                    key={shape.id}
                    points={shape.points}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    tension={0.35}
                    lineCap="round"
                    lineJoin="round"
                    perfectDrawEnabled={false}
                    shadowForStrokeEnabled={false}
                  />
                );
              }
              if (shape.type === 'rect') {
                return (
                  <Rect
                    key={shape.id}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    cornerRadius={4}
                  />
                );
              }
              if (shape.type === 'text') {
                return (
                  <Text
                    key={shape.id}
                    x={shape.x}
                    y={shape.y}
                    text={shape.text}
                    fontSize={shape.fontSize}
                    fill={shape.fill}
                    fontFamily="sans-serif"
                  />
                );
              }
              return null;
            })}
            
            {!isReplayMode && Object.entries(cursors).map(([userId, pos]) => {
              const userObj = (users || []).find(u => u?.id === userId || u?.socketId === userId);
              const userName = pos?.userName || userObj?.name || 'User';
              const userColor = getColorForUser(userId);
              return (
                <React.Fragment key={userId}>
                  <Line
                    points={[pos.x, pos.y, pos.x + 12, pos.y + 16, pos.x + 8, pos.y + 16, pos.x + 4, pos.y + 22]}
                    closed={true}
                    fill={userColor}
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                  <Rect
                    x={pos.x + 12}
                    y={pos.y + 20}
                    width={userName.length * 8 + 12}
                    height={22}
                    fill={userColor}
                    cornerRadius={4}
                  />
                  <Text
                    x={pos.x + 16}
                    y={pos.y + 24}
                    text={userName}
                    fontSize={12}
                    fill="#ffffff"
                    fontStyle="bold"
                  />
                </React.Fragment>
              );
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
