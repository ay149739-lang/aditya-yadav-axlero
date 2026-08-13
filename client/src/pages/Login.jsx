import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Layers, Lock, User, ArrowRight, ShieldCheck, Sparkles,
  Eye, EyeOff, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const strengthColors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];
const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

function getPasswordStrength(pw) {
  let s = 0;
  if (pw.length >= 6) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [strength, setStrength] = useState(0);

  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  // If already logged in, redirect
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from]);

  const handlePasswordChange = (v) => {
    setPassword(v);
    if (isRegister) setStrength(getPasswordStrength(v));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (isRegister && password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      let res;
      if (isRegister) {
        res = await register(username.trim(), password, displayName.trim() || username.trim());
      } else {
        res = await login(username.trim(), password);
      }

      if (res.success) {
        toast.success(isRegister ? '🎉 Account created! Welcome to SyncSpace!' : '👋 Welcome back!');
        navigate(from, { replace: true });
      } else {
        toast.error(res.message || 'Authentication failed');
      }
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (toRegister) => {
    setIsRegister(toRegister);
    setUsername('');
    setPassword('');
    setDisplayName('');
    setStrength(0);
  };

  return (
    <div className="min-h-screen flex bg-[#0A0A0A] overflow-hidden">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-[#0A0A0A] to-purple-950" />
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/20 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-600/20 blur-[100px]" />

        <div className="relative z-10 text-center max-w-md">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="bg-indigo-500/20 p-4 rounded-2xl border border-indigo-500/30 shadow-[0_0_40px_rgba(99,102,241,0.2)]">
              <Layers className="text-indigo-400 w-12 h-12" />
            </div>
          </div>
          <h2 className="text-4xl font-black text-white mb-4 leading-tight">
            Collaborate in<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
              Real-Time
            </span>
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-10">
            Draw, code, and build together — with a team or solo. SyncSpace keeps everyone in sync, live.
          </p>

          {/* Feature list */}
          <div className="space-y-3 text-left">
            {[
              'Real-time collaborative whiteboard',
              'Shared code editor with live cursors',
              'Private rooms with invite-only access',
              'Session replay & timeline history',
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-3 text-sm text-gray-300">
                <CheckCircle2 size={16} className="text-indigo-400 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] lg:hidden" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px] lg:hidden" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/30">
              <Layers className="text-indigo-400 w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold text-white">SyncSpace</h1>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
            <h2 className="text-2xl font-bold text-white mb-1">
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-gray-400 text-sm mb-7">
              {isRegister
                ? 'Sign up to start collaborating in real-time'
                : 'Sign in to access your workspaces'}
            </p>

            {/* Tab switcher */}
            <div className="flex bg-black/40 p-1 rounded-xl mb-7 border border-white/5">
              {[
                { label: 'Sign In', value: false },
                { label: 'Register', value: true },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => switchMode(value)}
                  className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    isRegister === value
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {isRegister && (
                  <motion.div
                    key="displayName"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Display Name <span className="text-gray-600">(shown to others)</span>
                    </label>
                    <div className="relative">
                      <Sparkles size={15} className="absolute left-3.5 top-3.5 text-gray-500" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Virat Kohli"
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-gray-600"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Username */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Username <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-3.5 text-gray-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="e.g. viratkohli"
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-gray-600"
                    required
                    autoComplete="username"
                  />
                </div>
                {isRegister && (
                  <p className="text-[11px] text-gray-600 mt-1">
                    Lowercase letters & numbers only. This is your unique ID.
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-3.5 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-gray-600"
                    required
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-gray-500 hover:text-gray-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {/* Password strength bar */}
                {isRegister && password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{ background: i <= strength ? strengthColors[strength] : '#374151' }}
                        />
                      ))}
                    </div>
                    <p className="text-[11px]" style={{ color: strengthColors[strength] }}>
                      {strengthLabels[strength]}
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-all mt-2 flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(99,102,241,0.3)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-center gap-2 text-[11px] text-gray-600">
              <ShieldCheck size={13} className="text-emerald-500" />
              <span>Secured with JWT &amp; Scrypt encryption</span>
            </div>
          </div>

          <p className="text-center text-xs text-gray-600 mt-5">
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            <button
              onClick={() => switchMode(!isRegister)}
              className="text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors"
            >
              {isRegister ? 'Sign In' : 'Register now'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
