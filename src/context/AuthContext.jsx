import { createContext, useContext } from 'react';

// 1. Create Context
export const AuthContext = createContext({
  currentUser: null,
  loading: true,
  login: async () => {},
  signUp: async () => {},
  logout: async () => {}
});

// 2. Custom Hook for consuming context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
