const STORAGE_KEY = 'lms_academy_settings';
const DEFAULT_OWNER_KEY = 'FireKey-Creation-2026';
const DEFAULT_ENROLLMENT_KEY = 'FireKey-Enroll-2026';
const DEFAULT_ACADEMY_NAME = 'Phoenix Fire Technical Academy';

export function getAcademySettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      academyName: parsed.academyName || DEFAULT_ACADEMY_NAME,
      ownerKey: parsed.ownerKey || DEFAULT_OWNER_KEY,
      enrollmentKey: parsed.enrollmentKey || DEFAULT_ENROLLMENT_KEY
    };
  } catch {
    return {
      academyName: DEFAULT_ACADEMY_NAME,
      ownerKey: DEFAULT_OWNER_KEY,
      enrollmentKey: DEFAULT_ENROLLMENT_KEY
    };
  }
}

export function saveAcademySettings(patch) {
  const next = { ...getAcademySettings(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getOwnerKey() {
  return getAcademySettings().ownerKey;
}

export function getEnrollmentKey() {
  return getAcademySettings().enrollmentKey;
}

export function validateAccountKey(role, submittedKey) {
  const key = String(submittedKey || '').trim();
  if((role || 'student') === 'admin') {
    if (key !== getOwnerKey()) {
      throw new Error('Invalid Owner Key');
    }
    return;
  }
  if (key !== getEnrollmentKey()) {
    throw new Error('Invalid Enrollment Key');
  }
}

export function prefsStorageKey(user) {
  const id = user?.id || user?.email || 'guest';
  return `lms_user_prefs_${id}`;
}

export function getUserPrefs(user) {
  try {
    const parsed = JSON.parse(localStorage.getItem(prefsStorageKey(user)) || '{}');
    return {
      preferredName: parsed.preferredName || '',
      notifyPassed: parsed.notifyPassed !== false,
      notifyRevision: parsed.notifyRevision !== false,
      notifyMessage: parsed.notifyMessage !== false,
      feedbackSnippets: parsed.feedbackSnippets || '' 
    };
  } catch {
    return {
      preferredName: '',
      notifyPassed: true,
      notifyRevision: true,
      notifyMessage: true,
      feedbackSnippets: ''
    };
  }
}

export function saveUserPrefs(user, prefs) {
  localStorage.setItem(prefsStorageKey(user), JSON.stringify(prefs));
  return prefs;
}

export function getDisplayName(user) {
  if (!user) return 'User';
  const preferred = (getUserPrefs(user).preferredName || user.preferredName || '').trim();
  if (preferred) return preferred;
  const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  if (full) return full;
  return user.name || user.email || 'User';
}

export function findStoredUser(users, raw) {
  if (!Array.isArray(users) || !raw) return null;
  const keys = [
    raw.id,
    raw.studentId,
    raw.student_id,
    raw.email,
    raw.studentEmail,
    raw.student
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase().trim());
  return (
    users.find((u) =>
    [u.id, u.studentId, u.email]
      .filter(Boolean)
      .some((v) => keys.includes(String(v).toLowerCase().trim()))
    ) || null
  );
}

function notificationKey(user) {
  return `lms_notifications_${user?.id || user?.email || 'guest'}`;
}

export function readUserNotifications(user) {
  try {
    const parsed = JSON.parse(localStorage.getItem(notificationKey(user)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushUserNotification(user, type, message) {
  if (!user || !message) return;
  const prefs = getUserPrefs(user);
  if (type === 'passed' && prefs.notifyPassed === false) return;
  if (type === 'revision' && prefs.notifyRevision === false) return;
  if (type === 'message' && prefs.notifyMessage === false) return;
  const next = [
    { id: Date.now(), type, message, read: false, at: new Date().toISOString() },
    ...readUserNotifications(user)
  ].slice(0, 40);
  localStorage.setItem(notificationKey(user), JSON.stringify(next));
}

export function markNotificationsRead(user) {
  const next = readUserNotifications(user).map((n) => ({ ...n, read: true }));
  localStorage.setItem(notificationKey(user), JSON.stringify(next));
  return next;
}