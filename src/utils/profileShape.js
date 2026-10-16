const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return UUID_PATTERN.test(String(value || ''));
}

export function profileFromRow(row) {
  if (!row) return null;
  const firstName = row.first_name || row.firstName || '';
  const lastName = row.last_name || row.lastName || '';
  const email = row.email || '';
  return {
    id: row.id,
    email,
    role: row.role || 'student',
    firstName,
    lastName,
    studentId: row.student_id || row.studentId || '',
    name: `${firstName} ${lastName}`.trim() || email || 'User',
    securityQuestion: row.security_question || row.securityQuestion || '',
    securityAnswer: row.security_answer || row.securityAnswer || ''
  };
}

export function profileToRow(user) {
  return {
    id: user.id,
    email: user.email || '',
    role: user.role || 'student',
    first_name: user.firstName || '',
    last_name: user.lastName || '',
    student_id: user.studentId || '',
    security_question: user.securityQuestion || '',
    security_answer: user.securityAnswer || ''
  };
}
