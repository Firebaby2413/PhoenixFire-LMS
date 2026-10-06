// src/context/AuthProvider.jsx
import React, { useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { supabase } from '../utils/supabaseClient';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (authUser) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('Profile fetch note:', error.message);
      }

      setCurrentUser({
        id: authUser.id,
        email: authUser.email,
        firstName:
          profile?.first_name || authUser.user_metadata?.first_name || '',
        lastName: profile?.last_name || authUser.user_metadata?.last_name || '',
        role: profile?.role || authUser.user_metadata?.role || 'student',
        rawUser: authUser
      });
    } catch (err) {
      console.error('Error attaching user profile:', err.message);
      setCurrentUser({
        id: authUser.id,
        email: authUser.email,
        firstName: authUser.user_metadata?.first_name || '',
        lastName: authUser.user_metadata?.last_name || '',
        role: authUser.user_metadata?.role || 'student',
        rawUser: authUser
      });
    }
  };

  useEffect(() => {
    // onAuthStateChange fires on initial mount and whenever auth state changes
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await fetchUserProfile(session.user);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  };

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error signing out:', error.message);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ currentUser, loading, login, signUp, logout }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}