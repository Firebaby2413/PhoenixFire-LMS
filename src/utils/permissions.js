// src/utils/permissions.js
export function canMentorSeeCourse(user, course) {
  if (user?.role === 'admin') return true;
  if (user?.role === 'mentor') {
    return user.assignedCourses?.includes(course?.id) ?? false;
  }
  return false;
}
