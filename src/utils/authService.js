import { supabase } from '../supabaseClient';
import { validateAccountKey } from './academySettings';

/**
 * Sign in existing user via Supabase
 */
export async function signInUser(email, password) {
  if (!email || !password) {
    throw new Error('Please enter both email and password');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw new Error(error.message || 'Invalid email or password');
  }

  return data.user;
}

/**
 * Create a new user account via Supabase Auth
 */
export async function createUser({
  email,
  password,
  role,
  ownerKey,
  firstName,
  lastName,
  studentId
}) {
  // 1. Business Logic Validations
  if (!email || !password || !role) {
    throw new Error('Missing required account fields');
  }

  if (!email.includes('@')) {
    throw new Error('Email must be a valid email address');
  }

  if (!firstName || !lastName) {
    throw new Error('First and last name are required');
  }

  if (role === 'student' && !studentId) {
    throw new Error('Student ID is required for students');
  }

  validateAccountKey(role, ownerKey);

  // 2. Build Role-Specific Identifiers
  let computedId = null;
  if (role === 'student') computedId = studentId || `STU-${Date.now()}`;
  if (role === 'mentor') computedId = `MEN-${Date.now()}`;
  if (role === 'admin') computedId = `ADM-${Date.now()}`;

  // 3. Register with Supabase
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        role: role,
        custom_id: computedId
      }
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  // 4. (Optional) Upsert to 'profiles' table if you are using RLS/DB tables
  if (data?.user) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      first_name: firstName,
      last_name: lastName,
      role: role,
      custom_id: computedId,
      email: email
    });

    if (profileError) {
      console.warn(
        'User created in Auth, but profile write failed:',
        profileError.message
      );
    }
  }

  return data.user;
}
