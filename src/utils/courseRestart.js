import { supabase } from './supabaseClient';
import { isUuid } from './profileShape';
import { getDisplayName } from './academySettings';
import {
  clearLocalCourseProgress,
  courseCertificateId,
  getCourseModules,
  getStudentStorageIds,
  lessonCertificateId
} from './progress';

let progressEpoch = 0;

export function currentProgressEpoch() {
  return progressEpoch;
}

function bumpProgressEpoch() {
  progressEpoch += 1;
}

function explainRestartError(error) {
  const message = error?.message || 'Request failed';
  if (
    error?.code === '42P01' ||
    error?.code === 'PGRST202' ||
    /course_restart_requests/i.test(message) ||
    /approve_course_restart/i.test(message) ||
    /schema cache/i.test(message)
  ) {
    return new Error(
      'Restart requests are not in the database yet. In the Supabase SQL editor, run supabase/migrations/20261021210000_course_restart_and_flashcards.sql, then try again.'
    );
  }
  return new Error(message);
}

function appliedKey(student) {
  return `applied_course_restarts_v2_${student?.id || student?.email || 'student'}`;
}

function personIds(student) {
  return [...new Set(
    getStudentStorageIds(student)
      .concat(student?.id, student?.email, student?.studentId)
      .filter(Boolean)
      .map((value) => String(value))
  )];
}

export async function wipeStoredCourseProgress(student, course) {
  bumpProgressEpoch();
  const moduleIds = getCourseModules(course).map((mod) => String(mod.id)).filter(Boolean);
  const courseId = String(course?.id || '');
  await Promise.all(
    personIds(student).flatMap((sid) => {
      const jobs = [];
      if (courseId) {
        jobs.push(supabase.from('submissions').delete().eq('student_id', sid).eq('course_id', courseId));
      }
      if (moduleIds.length) {
        jobs.push(
          supabase.from('module_progress').delete().eq('student_id', sid).in('module_id', moduleIds)
        );
      }
      return jobs;
    })
  );
  clearLocalCourseProgress(student, course);
  bumpProgressEpoch();
}

export async function listRestartRequests({ studentId, courseId, status } = {}) {
  let query = supabase
    .from('course_restart_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (studentId) query = query.eq('student_id', String(studentId));
  if (courseId) query = query.eq('course_id', String(courseId));
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw explainRestartError(error);
  return data || [];
}

export async function requestCourseRestart(student, course) {
  if (!student?.id || !course?.id) {
    throw new Error('Sign in as a student before requesting a restart.');
  }
  const existing = await listRestartRequests({
    studentId: student.id,
    courseId: course.id
  });
  const pending = existing.find((row) => row.status === 'pending');
  if (pending) return pending;

  const { data, error } = await supabase
    .from('course_restart_requests')
    .insert({
      student_id: String(student.id),
      student_email: student.email || '',
      student_name: getDisplayName(student),
      course_id: String(course.id),
      course_title: course.title || '',
      status: 'pending'
    })
    .select()
    .single();
  if (error) throw explainRestartError(error);
  return data;
}

export function certificateKeysForCourse(course) {
  const keys = (course?.lessons || []).map((lesson) => lessonCertificateId(course, lesson));
  keys.push(courseCertificateId(course));
  return keys;
}

export async function approveCourseRestart(request, course, student) {
  const moduleIds = getCourseModules(course)
    .map((mod) => String(mod.id))
    .filter(Boolean);
  const { error } = await supabase.rpc('approve_course_restart', {
    request_id: request.id,
    module_ids: moduleIds,
    certificate_keys: certificateKeysForCourse(course)
  });
  if (error && !/already/i.test(error.message || '')) throw explainRestartError(error);
  await wipeStoredCourseProgress(
    student || { id: request.student_id, email: request.student_email },
    course
  );
}

export async function denyCourseRestart(requestId) {
  const { error } = await supabase
    .from('course_restart_requests')
    .update({
      status: 'denied',
      reviewed_at: new Date().toISOString()
    })
    .eq('id', requestId);
  if (error) throw explainRestartError(error);
}

export async function sendRestartMessage(fromUser, toUser, body) {
  if (!isUuid(fromUser?.id) || !isUuid(toUser?.id) || !body) return;
  const { error } = await supabase.from('messages').insert({
    sender_id: fromUser.id,
    receiver_id: toUser.id,
    body
  });
  if (error) console.error('Restart message was not sent:', error.message);
}

export async function applyApprovedRestarts(student, courses) {
  if (!student?.id || !Array.isArray(courses) || courses.length === 0) return false;
  let rows = [];
  try {
    rows = await listRestartRequests({ studentId: student.id, status: 'approved' });
  } catch (err) {
    console.error(err);
    return false;
  }

  let applied = [];
  try {
    applied = JSON.parse(localStorage.getItem(appliedKey(student)) || '[]');
  } catch {
    applied = [];
  }
  const seen = new Set(applied);
  let changed = false;

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    const course = courses.find((item) => String(item.id) === String(row.course_id));
    if (course) await wipeStoredCourseProgress(student, course);
    seen.add(row.id);
    changed = true;
  }

  if (changed) localStorage.setItem(appliedKey(student), JSON.stringify([...seen]));
  return changed;
}
