import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketProvider';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Whiteboard from '../components/Whiteboard';
import CodeEditor from '../components/CodeEditor';
import StatusBar from '../components/StatusBar';
import ReplayPanel from '../components/ReplayPanel';
import InviteModal from '../components/InviteModal';
import toast from 'react-hot-toast';
import { Layers, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchRoomData, saveRoomData } from '../services/api';
import { fetchSnapshots } from '../services/replayApi';

// Helper to deduplicate active user list by user ID / username
const dedupeUsers = (userList) => {
  if (!Array.isArray(userList)) return [];
  const seenKeys = new Set();
  const result = [];
  for (const u of userList) {
    if (!u) continue;
    const key = (u.userId || u.id || u.username || '').toString();
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key);
      result.push(u);
    }
  }
  return result;
};

export default function Workspace() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const { user: authUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [showSidebar, setShowSidebar] = useState(true);

  // Access validation state
  const [accessState, setAccessState] = useState({ checking: true, granted: false });

  // Room access & ownership
  const [isOwner, setIsOwner] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Layout Panel Mode State ('split' | 'whiteboard-max' | 'code-max')
  const [panelMode, setPanelMode] = useState('split');

  const handleToggleMaximize = useCallback((target) => {
    setPanelMode((prev) => {
      if (target === 'whiteboard') {
        return prev === 'whiteboard-max' ? 'split' : 'whiteboard-max';
      }
      if (target === 'code') {
        return prev === 'code-max' ? 'split' : 'code-max';
      }
      return 'split';
    });
  }, []);

  // Refs to avoid stale closures in socket listeners without adding to effect deps
  const ownerNameRef = useRef('');
  const hasJoinedRef = useRef(false);

  // Replay State
  const [snapshots, setSnapshots] = useState([]);
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replayShapes, setReplayShapes] = useState(null);
  const [replayCode, setReplayCode] = useState(null);
  const [replayLanguage, setReplayLanguage] = useState(null);

  // Autosave and Room Recovery State
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [initialShapes, setInitialShapes] = useState([]);
  const [initialCode, setInitialCode] = useState(null);
  const [initialLanguage, setInitialLanguage] = useState('javascript');

  const shapesRef = useRef([]);
  const codeRef = useRef('');
  const languageRef = useRef('javascript');
  const isDirtyRef = useRef(false);

  // Build user object from auth context — memoized to prevent re-creating inline object on every render
  const user = useMemo(() => {
    if (!authUser) return null;
    return {
      id: authUser.id,
      name: authUser.name || authUser.username,
      username: authUser.username,
      color: authUser.color || '#6366F1'
    };
  }, [authUser?.id, authUser?.name, authUser?.username, authUser?.color]);

  // Ensure current logged-in user is ALWAYS included in active users list if joined
  const displayUsers = useMemo(() => {
    const list = Array.isArray(users) ? [...users] : [];
    if (user && hasJoinedRef.current) {
      const myKey = (user.id || user.userId || user.username || '').toString().toLowerCase();
      const hasSelf = list.some(u => {
        const k = (u.userId || u.id || u.socketId || u.username || '').toString().toLowerCase();
        return k === myKey || (user.username && u.username && u.username.toLowerCase() === user.username.toLowerCase());
      });
      if (!hasSelf) {
        list.unshift({
          ...user,
          userId: user.id,
          socketId: socket?.id || user.id,
          isOwner
        });
      }
    }
    return dedupeUsers(list);
  }, [users, user, isOwner, socket?.id]);

  useEffect(() => {
    if (user?.name || user?.username) {
      document.title = `${user.name || user.username} - SyncSpace`;
    } else {
      document.title = `SyncSpace - Room ${roomId || ''}`;
    }
  }, [user?.name, user?.username, roomId]);

  // Load room persistence & validate room access on initial mount
  useEffect(() => {
    if (!roomId || !authUser) return; // Wait until auth user is resolved
    let isMounted = true;

    const loadRoomState = async () => {
      setAccessState({ checking: true, granted: false });
      const data = await fetchRoomData(roomId);

      if (!isMounted) return;

      if (!data || !data.success) {
        console.warn('[Workspace] Access denied for room:', roomId, data?.message);
        toast.error(data?.message || 'You are not invited to this room.');
        setAccessState({ checking: false, granted: false });
        navigate('/', { replace: true });
        return;
      }

      setAccessState({ checking: false, granted: true });

      if (Array.isArray(data.boardData)) {
        setInitialShapes(data.boardData);
        shapesRef.current = data.boardData;
      }
      if (data.codeData !== undefined) {
        setInitialCode(data.codeData);
        codeRef.current = data.codeData;
      }
      if (data.language) {
        setInitialLanguage(data.language);
        languageRef.current = data.language;
      }
      if (data.owner) {
        // data.owner = owner User ID; data.ownerName = display name
        const displayName = data.ownerName || data.owner;
        ownerNameRef.current = displayName;
        setOwnerName(displayName);
        // Compare by User ID and username — set strictly to true or false
        const currentUserId = (authUser?.id || authUser?._id)?.toString();
        const currentUsername = (authUser?.username || authUser?.name || '').toLowerCase();
        const roomOwner = data.owner ? data.owner.toString() : '';
        const isMatched = Boolean(
          (currentUserId && roomOwner === currentUserId) || 
          (currentUsername && roomOwner.toLowerCase() === currentUsername)
        );
        setIsOwner(isMatched);
      }
    };

    const loadSnapshots = async () => {
      const list = await fetchSnapshots(roomId);
      if (isMounted && Array.isArray(list) && list.length > 0) {
        setSnapshots((prev) => {
          // Merge server list with any real-time ones already in state
          const existingIds = new Set(prev.map(s => s.snapshotId));
          const incoming = list.filter(s => !existingIds.has(s.snapshotId));
          if (incoming.length === 0 && list.length === prev.length) return prev;
          const merged = [...prev, ...incoming];
          return merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        });
      }
    };

    loadRoomState();
    loadSnapshots();

    // Poll snapshots every 10s to keep timeline fresh
    const snapshotInterval = setInterval(loadSnapshots, 10000);

    return () => {
      isMounted = false;
      clearInterval(snapshotInterval);
    };
  }, [roomId, navigate, authUser?.id]);

  const debounceTimerRef = useRef(null);

  // Handle save API trigger
  const triggerSave = useCallback(async () => {
    if (!roomId || !isDirtyRef.current || isReplayMode || !accessState.granted) return;
    setSaveStatus('Saving...');

    try {
      const res = await saveRoomData(roomId, {
        boardData: shapesRef.current,
        codeData: codeRef.current,
        language: languageRef.current
      });

      if (res && res.success) {
        setSaveStatus('Saved');
        isDirtyRef.current = false;
      } else {
        setSaveStatus('Error Saving');
      }
    } catch (err) {
      console.error('Autosave error:', err);
      setSaveStatus('Error Saving');
    }
  }, [roomId, isReplayMode, accessState.granted]);

  const scheduleDebouncedSave = useCallback(() => {
    if (isReplayMode || !accessState.granted) return;
    isDirtyRef.current = true;
    setSaveStatus('Unsaved changes');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      triggerSave();
    }, 2000);
  }, [triggerSave, isReplayMode, accessState.granted]);

  // Autosave interval every 15 seconds
  useEffect(() => {
    if (!accessState.granted) return;
    const interval = setInterval(() => {
      triggerSave();
    }, 15000);

    return () => clearInterval(interval);
  }, [triggerSave, accessState.granted]);

  // Save before refresh or tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirtyRef.current && roomId && !isReplayMode && accessState.granted) {
        saveRoomData(roomId, {
          boardData: shapesRef.current,
          codeData: codeRef.current,
          language: languageRef.current
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [roomId, isReplayMode, accessState.granted]);

  const handleShapesChange = useCallback((newShapes) => {
    if (isReplayMode) return;
    shapesRef.current = newShapes;
    scheduleDebouncedSave();
  }, [scheduleDebouncedSave, isReplayMode]);

  const handleCodeChange = useCallback((newCode) => {
    if (isReplayMode) return;
    codeRef.current = newCode;
    scheduleDebouncedSave();
  }, [scheduleDebouncedSave, isReplayMode]);

  // Emit join-room ONLY when access is granted and socket + user are ready
  useEffect(() => {
    if (!socket || !user || !accessState.granted || hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    socket.emit('join-room', { roomId, user });
  }, [socket, authUser?.id, roomId, accessState.granted, user]);

  // Emit leave-room ONLY when component unmounts or roomId changes
  useEffect(() => {
    return () => {
      if (socket && hasJoinedRef.current) {
        socket.emit('leave-room', { roomId });
        hasJoinedRef.current = false;
      }
    };
  }, [roomId]);

  // Reset join flag if the socket reconnects (e.g. page refresh without unmount)
  useEffect(() => {
    if (!socket) return;
    const onConnect = () => { hasJoinedRef.current = false; };
    socket.on('connect', onConnect);
    return () => socket.off('connect', onConnect);
  }, [socket]);


  const usersRef = useRef([]);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // Handle socket permission & presence events
  useEffect(() => {
    if (!socket || !authUser) return;

    const handleAccessDenied = (err) => {
      toast.error(err.message || 'You are not invited to this room.', { id: 'access-denied', duration: 3000 });
      navigate('/', { replace: true });
    };

    const handleRoomData = (data) => {
      if (data.users) setUsers(dedupeUsers(data.users));
      if (data.owner) {
        const myUserId = authUser?.id;
        if (data.owner === myUserId) setIsOwner(true);
      }
    };

    const handleUserJoined = (newUser) => {
      if (!newUser) return;
      const joinKey = (newUser.id || newUser.socketId || newUser.userId || newUser.username || '').toString();
      toast.success(`${newUser.name || newUser.username} joined the room`, {
        id: `user-joined-${joinKey}`,
        duration: 3000
      });
    };

    const handleUserLeft = (leftId) => {
      const leftIdStr = leftId ? leftId.toString() : '';
      if (!leftIdStr) return;

      // Look up user from usersRef BEFORE updating state to show toast ONCE
      const currentUsers = usersRef.current || [];
      const leftUser = currentUsers.find(
        u => u.id === leftIdStr || u.socketId === leftIdStr || u.userId === leftIdStr
      );

      if (leftUser) {
        toast(`${leftUser.name || leftUser.username} left the room`, {
          icon: '👋',
          id: `user-left-${leftUser.userId || leftUser.id || leftIdStr}`,
          duration: 3000
        });
      }

      setUsers(prev => prev.filter(u => u.id !== leftIdStr && u.socketId !== leftIdStr && u.userId !== leftIdStr));
    };

    const handleUsersUpdated = (updatedUsers) => {
      setUsers(dedupeUsers(updatedUsers));
    };

    const handleNewSnapshot = (snapshot) => {
      if (!snapshot) return;
      setSnapshots((prev) => {
        if (prev.some(s => s.snapshotId === snapshot.snapshotId)) return prev;
        const updated = [...prev, snapshot];
        return updated.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      });
    };

    // Remove any previous duplicate listeners before adding fresh ones
    socket.off('access-denied', handleAccessDenied);
    socket.off('room-data', handleRoomData);
    socket.off('user-joined', handleUserJoined);
    socket.off('user-left', handleUserLeft);
    socket.off('users-updated', handleUsersUpdated);
    socket.off('new-snapshot', handleNewSnapshot);

    socket.on('access-denied', handleAccessDenied);
    socket.on('room-data', handleRoomData);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('users-updated', handleUsersUpdated);
    socket.on('new-snapshot', handleNewSnapshot);

    return () => {
      socket.off('access-denied', handleAccessDenied);
      socket.off('room-data', handleRoomData);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('users-updated', handleUsersUpdated);
      socket.off('new-snapshot', handleNewSnapshot);
    };
  }, [socket, roomId, authUser?.id, navigate]);

  // Handle selecting snapshot in Replay Panel
  const handleSelectSnapshot = useCallback((snapshot) => {
    if (!snapshot) return;
    setIsReplayMode(true);
    setReplayShapes(Array.isArray(snapshot.boardData) ? snapshot.boardData : []);
    setReplayCode(snapshot.codeData !== undefined && snapshot.codeData !== null ? snapshot.codeData : '');
    setReplayLanguage(snapshot.language || 'javascript');
  }, []);

  const handleExitReplay = useCallback(() => {
    setIsReplayMode(false);
    // Clear replay state so Whiteboard and CodeEditor revert to live data
    setReplayShapes(null);
    setReplayCode(null);
    setReplayLanguage(null);
  }, []);

  // Show loading state while auth or room access is being verified
  if (!user || accessState.checking) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="flex items-center gap-3 text-gray-400"
        >
          <Layers className="text-indigo-400 w-5 h-5 animate-pulse" />
          <span className="font-mono text-sm">Verifying room access...</span>
        </motion.div>
      </div>
    );
  }

  // Render Access Denied UI if room access is not granted
  if (!accessState.granted) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-4 text-white p-4">
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl flex flex-col items-center gap-3 max-w-md text-center shadow-xl">
          <ShieldAlert className="text-red-400 w-10 h-10" />
          <h2 className="text-lg font-bold">Access Denied</h2>
          <p className="text-xs text-gray-400">
            You do not have permission to join this workspace or the room does not exist.
          </p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0A0A0A] select-none">
      <Navbar
        roomId={roomId}
        socket={socket}
        users={displayUsers}
        currentUser={user}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        onOpenInvite={() => setIsInviteOpen(true)}
        isOwner={isOwner}
        ownerName={ownerName}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Collapsible Sidebar */}
        {showSidebar && (
          <Sidebar roomId={roomId} users={displayUsers} currentUser={user} />
        )}

        {/* Main split / maximized layout */}
        <div className="flex flex-1 h-full gap-3 p-3 overflow-hidden">
          {/* Left: Whiteboard */}
          <div className={
            panelMode === 'whiteboard-max'
              ? 'w-full h-full relative border border-white/10 rounded-2xl bg-[#0A0A0A] flex items-center justify-center overflow-hidden shadow-2xl transition-all duration-300'
              : panelMode === 'code-max'
              ? 'hidden'
              : 'w-[68%] h-full relative border border-white/10 rounded-2xl bg-[#0A0A0A] flex items-center justify-center overflow-hidden shadow-2xl transition-all duration-300'
          }>
            <Whiteboard
              roomId={roomId}
              socket={socket}
              users={displayUsers}
              onCursorMove={(pos) => setCursor(pos)}
              initialShapes={initialShapes}
              onShapesChange={handleShapesChange}
              replayShapes={replayShapes}
              isReplayMode={isReplayMode}
              panelMode={panelMode}
              onToggleMaximize={() => handleToggleMaximize('whiteboard')}
            />
          </div>

          {/* Right: Code Editor */}
          <div className={
            panelMode === 'code-max'
              ? 'w-full h-full flex flex-col overflow-hidden transition-all duration-300'
              : panelMode === 'whiteboard-max'
              ? 'hidden'
              : 'w-[32%] h-full flex flex-col overflow-hidden transition-all duration-300'
          }>
            <CodeEditor
              roomId={roomId}
              socket={socket}
              currentUser={user}
              initialCode={initialCode}
              initialLanguage={initialLanguage}
              onCodeChange={handleCodeChange}
              replayCode={replayCode}
              replayLanguage={replayLanguage}
              isReplayMode={isReplayMode}
              panelMode={panelMode}
              onToggleMaximize={() => handleToggleMaximize('code')}
            />
          </div>
        </div>
      </div>

      {/* Replay Controls Panel */}
      <ReplayPanel
        snapshots={snapshots}
        onSelectSnapshot={handleSelectSnapshot}
        isReplayMode={isReplayMode}
        setIsReplayMode={setIsReplayMode}
        onExitReplay={handleExitReplay}
      />

      {/* Footer Status Bar */}
      <StatusBar
        socket={socket}
        roomId={roomId}
        users={users}
        cursor={cursor}
        saveStatus={isReplayMode ? 'Read-Only (Replay)' : saveStatus}
      />

      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        roomId={roomId}
        isOwner={isOwner}
        ownerName={ownerName}
        currentUsername={user?.username}
      />
    </div>
  );
}
