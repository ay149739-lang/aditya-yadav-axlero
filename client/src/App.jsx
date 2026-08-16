import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import Workspace from './pages/Workspace';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Unauthorized from './pages/Unauthorized';
import { AuthProvider, useAuth } from './context/AuthContext';
import SocketProvider from './context/SocketProvider';
import { Layers } from 'lucide-react';

// Full-screen branded loading spinner
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center gap-4">
      <div className="bg-indigo-500/20 p-4 rounded-2xl border border-indigo-500/30 mb-2">
        <Layers className="text-indigo-400 w-8 h-8 animate-pulse" />
      </div>
      <div className="w-5 h-5 border-2 border-indigo-600/30 border-t-indigo-500 rounded-full animate-spin" />
      <p className="text-gray-600 text-xs font-mono tracking-wider">AUTHENTICATING...</p>
    </div>
  );
}

// Protects routes — redirects to /login if not authenticated
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// Redirects logged-in users away from /login back to /
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <div className="min-h-screen bg-[#080810] text-white">
            <Routes>
              {/* Public routes */}
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/forgot-password"
                element={
                  <PublicRoute>
                    <ForgotPassword />
                  </PublicRoute>
                }
              />

              {/* Unauthorized — accessible to all */}
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Protected routes — require login */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/room/:roomId"
                element={
                  <ProtectedRoute>
                    <Workspace />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all → home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>

          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#13131f',
                color: '#e2e8f0',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                fontSize: '13px',
                padding: '12px 16px',
              },
              success: {
                iconTheme: { primary: '#6366f1', secondary: '#fff' }
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#fff' }
              }
            }}
          />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
