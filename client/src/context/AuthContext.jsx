import { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser, getMe } from '../services/authApi';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('syncspace_token') || null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('syncspace_user') || sessionStorage.getItem('syncspace_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (token) {
          const res = await getMe(token);
          if (res.success && res.user) {
            setUser(res.user);
            localStorage.setItem('syncspace_user', JSON.stringify(res.user));
            sessionStorage.setItem('syncspace_user', JSON.stringify(res.user));
          } else {
            // Token invalid or expired
            logout();
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [token]);

  const completeAuth = (userToken, userData) => {
    if (userToken && userData) {
      setToken(userToken);
      setUser(userData);
      localStorage.setItem('syncspace_token', userToken);
      localStorage.setItem('syncspace_user', JSON.stringify(userData));
      sessionStorage.setItem('syncspace_user', JSON.stringify(userData));
    }
  };

  const login = async (username, password) => {
    const res = await loginUser(username, password);
    if (res.success && res.token && res.user) {
      completeAuth(res.token, res.user);
    }
    return res;
  };

  const register = async (username, password, displayName) => {
    const res = await registerUser(username, password, displayName);
    if (res.success && res.token && res.user && !res.recoveryCode) {
      completeAuth(res.token, res.user);
    }
    return res;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('syncspace_token');
    localStorage.removeItem('syncspace_user');
    sessionStorage.removeItem('syncspace_user');
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    completeAuth,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
