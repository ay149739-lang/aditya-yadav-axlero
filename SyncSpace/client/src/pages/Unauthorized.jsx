import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Lock, KeyRound, Check, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function Unauthorized() {
  const navigate = useNavigate();
  const location = useLocation();
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestUsername, setGuestUsername] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);

  const message = location.state?.message || 'You do not have access permission to view this workspace.';
  const roomId = location.state?.roomId || '';

  // Check if the user is logged in
  const token = localStorage.getItem('syncspace_token');
  const savedUser = localStorage.getItem('syncspace_user') || sessionStorage.getItem('syncspace_user');
  const currentUser = savedUser ? JSON.parse(savedUser) : null;
  const isLoggedIn = Boolean(token && currentUser);

  const handleRequestAccess = async (usernameOverride) => {
    if (!roomId) {
      toast.error('No workspace room specified');
      return;
    }

    const username = usernameOverride || guestUsername.trim();
    const storedToken = localStorage.getItem('syncspace_token');

    // If not logged in and no guest username provided, show input
    if (!storedToken && !username) {
      setShowGuestInput(true);
      return;
    }

    setLoading(true);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const body = {};
      // Include username in body for guests (no JWT)
      if (!storedToken && username) {
        body.username = username;
      }

      const res = await fetch(`http://localhost:5001/api/rooms/${roomId}/request-access`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (data.success) {
        setRequested(true);
        toast.success('Access request sent to workspace owner!');
      } else {
        toast.error(data.message || 'Failed to send access request');
      }
    } catch (err) {
      console.error('Request access error:', err);
      toast.error('Could not connect to the server. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSubmit = (e) => {
    e.preventDefault();
    if (!guestUsername.trim()) {
      toast.error('Please enter your username');
      return;
    }
    handleRequestAccess(guestUsername.trim().toLowerCase());
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0A0A0A] select-none p-4">
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-red-600/10 blur-[140px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[140px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="glass-panel p-8 md:p-10 rounded-2xl w-full max-w-md relative z-10 text-center shadow-2xl border border-red-500/20"
      >
        <div className="mx-auto w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-2xl flex items-center justify-center mb-6">
          <ShieldAlert size={32} className="text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-sm text-gray-400 mb-6">
          {message}
        </p>

        {roomId && (
          <div className="bg-black/40 border border-white/10 rounded-xl p-3 mb-6 flex items-center justify-center gap-2 text-xs font-mono text-gray-300">
            <Lock size={14} className="text-amber-400" />
            <span>Private Room: {roomId}</span>
          </div>
        )}

        {/* Show logged-in user context */}
        {isLoggedIn && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 mb-4 text-xs text-indigo-300">
            Logged in as <span className="font-semibold font-mono">@{currentUser?.username}</span>
          </div>
        )}

        <div className="space-y-3">
          {/* If not logged in, show login + register options first */}
          {!isLoggedIn && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-2 text-xs text-amber-300">
              <p className="mb-2 font-medium">You need an account to request workspace access.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/login', { state: { from: { pathname: `/room/${roomId}` } } })}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold py-1.5 px-3 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <LogIn size={12} /> Sign In
                </button>
                <button
                  onClick={() => navigate('/login', { state: { from: { pathname: `/room/${roomId}` } } })}
                  className="flex-1 bg-white/10 hover:bg-white/15 text-gray-200 text-[11px] font-semibold py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
                >
                  Register
                </button>
              </div>
            </div>
          )}

          {/* Guest username input (when not logged in and they chose to request without login) */}
          {!isLoggedIn && showGuestInput && !requested && (
            <form onSubmit={handleGuestSubmit} className="text-left space-y-2">
              <label className="block text-xs font-medium text-gray-400">
                Enter your username to send a request:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={guestUsername}
                  onChange={(e) => setGuestUsername(e.target.value)}
                  placeholder="e.g. johndoe"
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-gray-600"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </form>
          )}

          {/* Request Access Button */}
          <button
            onClick={() => handleRequestAccess()}
            disabled={loading || requested}
            className={`w-full font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              requested
                ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.25)]'
            } disabled:opacity-70`}
          >
            {requested ? <Check size={16} /> : <KeyRound size={16} />}
            <span>
              {loading
                ? 'Sending Request...'
                : requested
                ? 'Access Request Sent!'
                : isLoggedIn
                ? 'Request Access from Owner'
                : 'Request Access as Guest'}
            </span>
          </button>

          <button
            onClick={() => navigate('/')}
            className="w-full bg-white/5 hover:bg-white/10 text-gray-300 font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all border border-white/10 cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Return to Workspaces</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
