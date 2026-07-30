import React, { useState } from 'react';
import { AuthContext } from './createAuthContext';

export function AuthProvider({ children }) {
  // Temporary mock user - will be replaced with Supabase Auth later
  const [currentUser, setCurrentUser] = useState({
    id: 'admin-1',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@pfta.edu',
    role: 'admin'
  });

  const login = (email, password) => {
    // Placeholder for login logic
    console.log(
      'Logging in with:',
      email,
      password ? '[PASSWORD_PROVIDED]' : ''
    );
  };

  const logout = () => {
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
