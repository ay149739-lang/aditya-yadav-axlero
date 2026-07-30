import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Rect, Text } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import Toolbar from './Toolbar';

export default function Whiteboard({ roomId, socket, users = [], onCursorMove }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [activeTool, setActiveTool] = useState('pencil');
  const [color, setColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [shapes, setShapes] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShapeId, setCurrentShapeId] = useState(null);
  const [cursors, setCursors] = useState({});
  const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, text: '' });

  const currentShapeRef = useRef(null);

  const CURSOR_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
  const getColorForUser = (userId) => {
    if (!userId || !Array.isArray(users)) return CURSOR_COLORS[0];
    const index = users.findIndex(u => u?.id === userId);
    if (index === -1) return CURSOR_COLORS[0];
    return CURSOR_COLORS[index % CURSOR_COLORS.length];
  };

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
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
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleDrawStart = (newShape) => {
      setShapes((prev) => {
        if (prev.some(s => s.id === newShape.id)) return prev;
        return [...prev, newShape];
      });
    };

    const handleDrawing = (updatedShape) => {
      setShapes((prev) => {
        const index = prev.findIndex(s => s.id === updatedShape.id);
        if (index !== -1) {
          const newShapes = [...prev];
          newShapes[index] = updatedShape;
          return newShapes;
        } else {
          return [...prev, updatedShape];
        }
      });
    };

    const handleDrawEnd = (finalShape) => {
      setShapes((prev) => {
        const index = prev.findIndex(s => s.id === finalShape.id);
        if (index !== -1) {
          const newShapes = [...prev];
          newShapes[index] = finalShape;
          return newShapes;
        } else {
          return [...prev, finalShape];
        }
      });
    };

    const handleClearCanvas = () => {
      setShapes([]);
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

    const handleInitialShapes = (initialShapes) => {
      if (Array.isArray(initialShapes)) {
        setShapes(initialShapes);
      }
    };

    socket.on('initial-shapes', handleInitialShapes);
    socket.on('draw-start', handleDrawStart);
    socket.on('drawing', handleDrawing);
    socket.on('draw-end', handleDrawEnd);
    socket.on('clear-canvas', handleClearCanvas);
    socket.on('cursor-move', handleCursorMove);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('initial-shapes', handleInitialShapes);
      socket.off('draw-start', handleDrawStart);
      socket.off('drawing', handleDrawing);
      socket.off('draw-end', handleDrawEnd);
      socket.off('clear-canvas', handleClearCanvas);
      socket.off('cursor-move', handleCursorMove);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket]);

  const handleClear = () => {
    setShapes([]);
    socket?.emit('clear-canvas', { roomId });
  };

  const handleMouseDown = (e) => {
    if (textInput.visible) return;

    const pos = e.target.getStage().getPointerPosition();
    if (!pos) return;

    if (activeTool === 'text') {
      setTextInput({ visible: true, x: pos.x, y: pos.y, text: '' });
      return;
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
    
    // Broadcast cursor position
    socket?.emit('cursor-move', { roomId, x: point.x, y: point.y });

    if (!isDrawing || activeTool === 'text' || !currentShapeRef.current) return;

    const currentShape = currentShapeRef.current;

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      const pts = currentShape.points;
      const lastX = pts[pts.length - 2];
      const lastY = pts[pts.length - 1];

      // Smoothness filter: only add point if distance is >= 2px
      const dist = Math.hypot(point.x - lastX, point.y - lastY);
      if (dist < 2) return;

      currentShape.points = [...pts, point.x, point.y];
    } else if (activeTool === 'rect') {
      currentShape.x = Math.min(currentShape.startX, point.x);
      currentShape.y = Math.min(currentShape.startY, point.y);
      currentShape.width = Math.abs(point.x - currentShape.startX);
      currentShape.height = Math.abs(point.y - currentShape.startY);
    }

    // Update local state for immediate re-render
    setShapes((prev) => {
      const index = prev.findIndex(s => s.id === currentShape.id);
      if (index === -1) return [...prev, { ...currentShape }];
      const newShapes = [...prev];
      newShapes[index] = { ...currentShape };
      return newShapes;
    });

    // Broadcast live drawing shape to other clients
    socket?.emit('drawing', { roomId, ...currentShape });
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentShapeRef.current) {
      const finalShape = { ...currentShapeRef.current };
      socket?.emit('draw-end', { roomId, ...finalShape });
      currentShapeRef.current = null;
    }
    setCurrentShapeId(null);
  };

  const handleTextSubmit = () => {
    if (textInput.text.trim()) {
      const newShape = {
        type: 'text',
        id: uuidv4(),
        x: textInput.x,
        y: textInput.y,
        text: textInput.text,
        fontSize: 20 + strokeWidth * 2,
        fill: color,
      };
      setShapes((prev) => [...prev, newShape]);
      socket?.emit('draw-start', { roomId, ...newShape });
      socket?.emit('draw-end', { roomId, ...newShape });
    }
    setTextInput({ visible: false, x: 0, y: 0, text: '' });
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
      <Toolbar 
        activeTool={activeTool} 
        setActiveTool={setActiveTool} 
        color={color}
        setColor={setColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        onClear={handleClear}
      />
      <Stage 
        width={size.width} 
        height={size.height}
        style={{ cursor: activeTool === 'text' ? 'text' : activeTool === 'eraser' ? 'cell' : 'crosshair' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        <Layer>
          {shapes.map((shape) => {
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
          
          {Object.entries(cursors).map(([userId, pos]) => {
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

      {textInput.visible && (
        <input
          autoFocus
          value={textInput.text}
          onChange={(e) => setTextInput(prev => ({ ...prev, text: e.target.value }))}
          onBlur={handleTextSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTextSubmit();
            if (e.key === 'Escape') setTextInput({ visible: false, x: 0, y: 0, text: '' });
          }}
          style={{
            position: 'absolute',
            top: textInput.y,
            left: textInput.x,
            color: color,
            fontSize: `${20 + strokeWidth * 2}px`,
            fontFamily: 'sans-serif',
            background: 'transparent',
            border: `1px dashed ${color}`,
            outline: 'none',
            padding: '0 4px',
            margin: 0,
            minWidth: '60px',
            zIndex: 30
          }}
        />
      )}
    </div>
  );
}
