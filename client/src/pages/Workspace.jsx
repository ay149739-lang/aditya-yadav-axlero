import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketProvider';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Whiteboard from '../components/Whiteboard';
import CodeEditor from '../components/CodeEditor';
import StatusBar from '../components/StatusBar';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { Layers } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Workspace() {
  const { roomId } = useParams();
  const socket = useSocket();
  const [users, setUsers] = useState([]);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Initialize user synchronously from sessionStorage
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem('syncspace_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [inputName, setInputName] = useState('');

  const handleJoinDirectly = (e) => {
    e.preventDefault();
    if (!inputName.trim()) return;

    const newUser = {
      id: uuidv4(),
      name: inputName.trim(),
      color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
    };

    sessionStorage.setItem('syncspace_user', JSON.stringify(newUser));
    setUser(newUser);
  };

  useEffect(() => {
    if (user?.name) {
      document.title = `${user.name} - SyncSpace`;
    } else {
      document.title = `SyncSpace - Room ${roomId || ''}`;
    }
  }, [user, roomId]);

  useEffect(() => {
    if (!socket || !user) return;

    socket.emit('join-room', { roomId, user });

    socket.on('user-joined', (newUser) => {
      toast.success(`${newUser.name} joined the room`);
    });

    socket.on('user-left', (userId) => {
      setUsers(prev => {
        const leftUser = prev.find(u => u.id === userId);
        if (leftUser) toast(`${leftUser.name} left the room`, { icon: '👋' });
        return prev;
      });
    });

    socket.on('users-updated', (updatedUsers) => {
      setUsers(updatedUsers);
    });

    return () => {
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('users-updated');
    };
  }, [socket, roomId, user]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0A0A0A]">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/20 blur-[120px]" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-panel p-8 rounded-2xl w-full max-w-md relative z-10 text-center shadow-2xl border border-white/10"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/30">
              <Layers className="text-indigo-400 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Join Room: <span className="text-indigo-400 font-mono">{roomId}</span>
            </h1>
          </div>
          
          <p className="text-gray-400 mb-6 text-sm">
            Enter your name to join this workspace session.
          </p>

          <form onSubmit={handleJoinDirectly} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Your Name</label>
              <input 
                type="text" 
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600"
                autoFocus
                required
              />
            </div>
            
            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition-colors mt-2 shadow-[0_0_20px_rgba(99,102,241,0.3)] cursor-pointer"
            >
              Join Workspace
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0A0A0A] select-none">
      <Navbar 
        roomId={roomId} 
        users={users} 
        currentUser={user} 
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
      />
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* Collapsible Sidebar */}
        {showSidebar && (
          <Sidebar roomId={roomId} users={users} currentUser={user} />
        )}

        {/* Main 70/30 split layout */}
        <div className="flex flex-1 h-full gap-3 p-3 overflow-hidden">
          {/* Left: Whiteboard (70%) */}
          <div className="w-[68%] h-full relative border border-white/10 rounded-2xl bg-[#0A0A0A] flex items-center justify-center overflow-hidden shadow-2xl">
            <Whiteboard 
              roomId={roomId} 
              socket={socket} 
              users={users} 
              onCursorMove={(pos) => setCursor(pos)}
            />
          </div>
          
          {/* Right: Code Editor (32%) */}
          <div className="w-[32%] h-full flex flex-col overflow-hidden">
            <CodeEditor roomId={roomId} socket={socket} />
          </div>
        </div>
      </div>

      {/* Footer Status Bar */}
      <StatusBar socket={socket} roomId={roomId} users={users} cursor={cursor} />
    </div>
  );
}
