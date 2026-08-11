import { supabase } from './supabaseClient';

/**
 * COURSES (Supabase API)
 * Fetch and save course data directly from your Supabase PostgreSQL database.
 */
export async function loadCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select('*');

  if (error) {
    console.error('Error fetching courses from Supabase:', error.message);
    return [];
  }
  return data || [];
}

export async function saveCourses(courses) {
  const { data, error } = await supabase
    .from('courses')
    .upsert(courses)
    .select();

  if (error) {
    console.error('Error saving courses to Supabase:', error.message);
    throw error;
  }
  return data;
}

/**
 * DEPRECATED USER STORAGE
 * Auth and user state are now handled dynamically via AuthProvider.jsx / Supabase Auth.
 */
export function loadCurrentUser() { return null; }
export function saveCurrentUser() {}
export function clearCurrentUser() {}
export function loadUsers() { return []; }
export function saveUsers() {}