export const LIVE_CLASSES_KEY = 'app_live_classes';

const HOST_ROLES = ['mentor', 'instructor', 'admin'];

export function readLiveClasses() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LIVE_CLASSES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function userKeys(user) {
  return [user?.studentId, user?.email, user?.username, user?.id]
    .filter(Boolean)
    .map((value) => String(value));
}

export function canHostLiveClass(user) {
  return HOST_ROLES.includes(String(user?.role || '').toLowerCase());
}

export function courseVisibleToStudent(course, user) {
  if (!course) return false;
  const isPublished = !course.status || course.status === 'published';
  if (!isPublished) return false;
  const assigned = course.assignedStudentKeys;
  if (!Array.isArray(assigned) || assigned.length === 0) return true;
  return userKeys(user).some((id) => assigned.includes(id));
}

export function mentorOwnsCourse(user, course) {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'admin') return true;
  if (role !== 'mentor' && role !== 'instructor') return false;
  const keys = userKeys(user).map((key) => key.toLowerCase());
  const mentorKey = String(course?.mentorKey || '').trim().toLowerCase();
  if (!mentorKey) return true;
  if (keys.includes(mentorKey)) return true;
  return Array.isArray(user?.assignedCourses) && user.assignedCourses.includes(course?.id);
}

function hostMatches(user, session) {
  const keys = userKeys(user).map((key) => key.toLowerCase());
  return keys.includes(String(session?.hostEmail || '').toLowerCase());
}

export function canManageSession(user, session, course) {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'admin') return true;
  if (!canHostLiveClass(user)) return false;
  if (hostMatches(user, session)) return true;
  return Boolean(course) && mentorOwnsCourse(user, course);
}

export function sessionsForUser(sessions, courses, user) {
  const role = String(user?.role || 'student').toLowerCase();
  const list = Array.isArray(sessions) ? sessions : [];
  const courseById = new Map((courses || []).map((course) => [course.id, course]));

  if (role === 'admin' || role === 'ta') return list;

  if (role === 'mentor' || role === 'instructor') {
    return list.filter((session) => {
      const course = courseById.get(session.courseId);
      return course ? mentorOwnsCourse(user, course) : hostMatches(user, session);
    });
  }

  return list.filter((session) => {
    if (session.status === 'cancelled') return false;
    return courseVisibleToStudent(courseById.get(session.courseId), user);
  });
}

export function coursesHostCanSchedule(courses, user) {
  const role = String(user?.role || '').toLowerCase();
  const list = Array.isArray(courses) ? courses : [];
  if (role === 'admin') return list;
  if (role === 'mentor' || role === 'instructor') {
    return list.filter((course) => mentorOwnsCourse(user, course));
  }
  return [];
}

export function getClassTiming(session, now = Date.now()) {
  if (session?.status === 'cancelled') return 'cancelled';
  const start = new Date(session?.startsAt).getTime();
  if (Number.isNaN(start)) return 'upcoming';
  const minutes = Number(session?.durationMinutes) || 60;
  const end = start + minutes * 60 * 1000;
  if (now < start) return 'upcoming';
  if (now <= end) return 'live';
  return 'ended';
}

export function formatClassWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Time not set';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const match = String(url).match(
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/
  );
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  return null;
}

export function studentsForCourse(course, users) {
  return (users || []).filter((user) => {
    if (String(user?.role || '').toLowerCase() !== 'student') return false;
    return courseVisibleToStudent(course, user);
  });
}
