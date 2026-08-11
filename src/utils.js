// Data normalization helper to ensure modules and lessons retain proper structure
// 2. APP HELPERS & CONSTANTS
export const STORAGE_KEYS = {
  THEME: 'pfta_theme_preference',
  BACKUP: 'pfta_lms_backup_data'
};

export const PFTA_CONSTANTS = {
  ROLES: {
    STUDENT: 'student',
    TA: 'ta',
    INSTRUCTOR: 'instructor',
    ADMIN: 'admin'
  },
  DEFAULT_VIEW: 'courses'
};

export const generateUniqueId = (prefix = 'id') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export const normalizeCourse = (course) => {
  if (!course) return null;
  return {
    id: course.id || generateUniqueId('course'),
    title: course.title || 'Untitled Course',
    description: course.description || '',
    category: course.category || 'General',
    instructor: course.instructor || 'PFTA Staff',
    modules: Array.isArray(course.modules)
      ? course.modules.map((mod, modIdx) => ({
          id: mod.id || generateUniqueId(`mod_${modIdx}`),
          title: mod.title || `Module ${modIdx + 1}`,
          lessons: Array.isArray(mod.lessons)
            ? mod.lessons.map((les, lesIdx) => ({
                id: les.id || generateUniqueId(`les_${modIdx}_${lesIdx}`),
                title: les.title || `Lesson ${lesIdx + 1}`,
                content: les.content || '',
                type: les.type || 'markdown',
                assignments: les.assignments || []
              }))
            : []
        }))
      : []
  };
};

export const getRoleName = (role) => {
  switch (role) {
    case PFTA_CONSTANTS.ROLES.ADMIN:
      return 'Administrator';
    case PFTA_CONSTANTS.ROLES.INSTRUCTOR:
      return 'Lead Instructor';
    case PFTA_CONSTANTS.ROLES.TA:
      return 'Teaching Assistant';
    default:
      return 'Student';
  }
};
