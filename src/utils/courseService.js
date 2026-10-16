import { supabase } from './supabaseClient';
import { isUuid } from './profileShape';

export function courseFromRow(row) {
  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    slug: row.slug || '',
    status: row.status || (row.published ? 'published' : 'draft'),
    mentorKey: row.mentor_key || '',
    assignedStudentKeys: Array.isArray(row.assigned_student_keys) ? row.assigned_student_keys : [],
    lessons: Array.isArray(row.lessons) ? row.lessons : []
  };
}

export function rowFromCourse(course) {
  const row = {
    title: course.title || 'Untitled Course',
    description: course.description || '',
    slug: course.slug || '',
    status: course.status || 'draft',
    published: !course.status || course.status === 'published',
    mentor_key: course.mentorKey || '',
    assigned_student_keys: course.assignedStudentKeys || [],
    lessons: course.lessons || []
  };
  if (isUuid(course.id)) row.id = course.id;
  return row;
}

export async function saveCourse(course) {
  const { data, error } = await supabase.from('courses').upsert(rowFromCourse(course)).select().single();
  if (error) throw error;
  return courseFromRow(data);
}

export async function loadCourses() {
  const { data, error } = await supabase.from('courses').select('*').order('created_at');
  if (error) return { ok: false, message: error.message, rows: [] };
  return { ok: true, message: '', rows: (data || []).map(courseFromRow) };
}

export async function uploadCourses(courses) {
  const saved = [];
  for (const course of courses) {
    if (!course?.title) continue;
    saved.push(await saveCourse(course));
  }
  return saved;
}
