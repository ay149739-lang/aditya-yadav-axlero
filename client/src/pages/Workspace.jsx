import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketProvider';
import Navbar from '../components/Navbar';
import toast from 'react-hot-toast';

export default function Workspace() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const [users, setUsers] = useState([]);
  
  // User auth state
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = sessionStorage.getItem('syncspace_user');
    if (!savedUser) {
      toast.error('Please join with a name first');
      navigate('/');
      return;
    }
    setUser(JSON.parse(savedUser));
  }, [navigate]);

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

  if (!user) return null;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0A0A0A]">
      <Navbar roomId={roomId} users={users} currentUser={user} />
      
      <div className="flex flex-1 overflow-hidden relative p-4">
        {/* Main 70/30 split layout */}
        <div className="flex flex-1 h-full gap-4">
          {/* Left: Whiteboard Placeholder (70%) */}
          <div className="w-[70%] h-full relative border border-white/10 rounded-2xl bg-white/5 flex items-center justify-center">
            <span className="text-gray-500 font-medium">Whiteboard Placeholder</span>
          </div>
          
          {/* Right: Code Editor Placeholder (30%) */}
          <div className="w-[30%] h-full flex flex-col border border-white/10 rounded-2xl bg-white/5 items-center justify-center">
            <span className="text-gray-500 font-medium">Code Editor Placeholder</span>
          </div>
        </div>
      </div>
    </div>
  );
}
