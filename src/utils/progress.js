/**
 * Utility functions for calculating student progress, completion,
 * and feedback history across courses, lessons, and modules.
 */

// Helper to extract all possible student identifiers into a uniform array
export const studentKeys = (input) => {
  if (!input) return [];
  if (typeof input === "string") return [input.trim().toLowerCase()];
  const candidates = [
    input.id,
    input.studentId,
    input.custom_id,
    input.user_id,
    input.student_id,
    input.email,
    input.studentEmail,
    input.student,
    input.username,
  ];
  return candidates.filter(Boolean).map((val) => String(val).trim().toLowerCase());
};

/**
 * Normalizes submission status comparisons ('pass' vs 'passed' vs 'approved').
 */
export const normalizeStatus = (status) => String(status || "").trim().toLowerCase();

export const isStatusPassing = (status) => {
  const norm = normalizeStatus(status);
  return norm === "pass" || norm === "passed" || norm === "approved";
};

export const isStatusFailing = (status) => {
  const norm = normalizeStatus(status);
  return norm === "fail" || norm === "failed" || norm === "needs_revision" || norm === "rejected";
};

/**
 * Extracts a flattened list of all modules across all lessons in a course.
 */
export const getCourseModules = (course) => {
  if (!course) return [];
  if (Array.isArray(course.modules)) return course.modules;
  if (Array.isArray(course.lessons)) {
    return course.lessons.flatMap((lesson) => lesson.modules || []);
  }
  return [];
};

/**
 * Matches a submission from a flat submission array to a student and module.
 */
export const findSubmission = (submissions, student, moduleId) => {
  if (!Array.isArray(submissions) || !student || !moduleId) return null;
  const targetStudentKeys = studentKeys(student);
  const targetModuleId = String(moduleId).trim();

  return submissions.find((sub) => {
    const subStudentKeys = studentKeys(sub);
    const matchesUser = targetStudentKeys.some((k) => subStudentKeys.includes(k));
    const subModuleId = String(sub.module_id ?? sub.moduleId ?? "").trim();
    return matchesUser && subModuleId === targetModuleId;
  });
};

/**
 * Checks if a module is passed/approved for a student using global submissions.
 */
export const isModuleApprovedByStudent = (mod, student, globalSubmissions = []) => {
  if (!mod || !student) return false;

  // 1. Search global submissions passed from Supabase
  const globalSub = findSubmission(globalSubmissions, student, mod.id);
  if (globalSub) {
    return isStatusPassing(globalSub.status) || globalSub.passed === true;
  }

  // 2. Fallback check for embedded module submissions
  const embeddedSubs = mod?.assignment?.submissions || mod?.submissions || [];
  if (Array.isArray(embeddedSubs)) {
    const targetKeys = studentKeys(student);
    return embeddedSubs.some((s) => {
      const matchesStudent = targetKeys.some((k) => studentKeys(s).includes(k));
      return matchesStudent && (isStatusPassing(s.status) || s.passed === true);
    });
  }

  return false;
};

/**
 * Checks if a non-assignment module is marked as read/completed.
 */
export const isModuleCompletedByStudent = (mod, student) => {
  if (!mod || !student) return false;
  const keys = studentKeys(student);
  const studentId = student.id || student.email;

  // Check localStorage read state used in dashboard
  if (studentId) {
    try {
      const savedReadState = JSON.parse(
        localStorage.getItem(`read_modules_${studentId}`) || "{}"
      );
      if (savedReadState[mod.id]) return true;
    } catch {
      // Fall through to object checks if localStorage access is restricted
    }
  }

  // Fallback check on module completion arrays or properties
  if (Array.isArray(mod.completions)) {
    return mod.completions.some((c) => {
      const cKeys = studentKeys(c);
      return keys.some((k) => cKeys.includes(k));
    });
  }

  return !!(mod.completed || mod.isCompleted);
};

/**
 * Calculates total and completed modules using the unified 2-point scale:
 * Point 1: Read status
 * Point 2: Passed assignment submission
 */
export const calculateCourseProgressDetailed = (course, student, globalSubmissions = []) => {
  const modules = getCourseModules(course);
  if (modules.length === 0) {
    return { completedCount: 0, totalCount: 0, percentage: 0 };
  }

  const totalCount = modules.length;
  let totalProgressPoints = 0;
  

  let totalPossiblePoints = 0;

  modules.forEach((mod) => {
    const hasAssignment = !!(mod.assignment || mod.assignment_prompt || mod.questions || mod.quiz || mod.type === 'assignment');
    const pointsPossibleForModule = hasAssignment ? 2 : 1;
    totalPossiblePoints += pointsPossibleForModule;

    const isRead = isModuleCompletedByStudent(mod, student);
    if (isRead) {
      totalProgressPoints += 1;
    }

    if (hasAssignment) {
      if (isModuleApprovedByStudent(mod, student, globalSubmissions)) {
        totalProgressPoints += 1;
      }
    } else {
      if (isRead) {
        totalProgressPoints += 1;
      }
    }
  });

  const percentage =
    totalPossiblePoints > 0
      ? Math.min(100, Math.round((totalProgressPoints / totalPossiblePoints) * 100))
      : 0;

      const completedCount = modules.filter((mod) => {
        const hasAssignment = !!(mod.assignment || mod.assignment_prompt || mod.questions || mod.quiz || mod.type === 'assignment');
        const isRead = isModuleCompletedByStudent(mod, student);
        if (hasAssignment) {
          return isRead && isModuleApprovedByStudent(mod, student, globalSubmissions);
        }
        return isRead;
      }).length;

  return {
    completedCount,
    totalCount,
    percentage,
  };
};

/**
 * Shorthand wrapper to prevent missing export errors for components 
 * expecting `calculateCourseProgress`.
 */
export const calculateCourseProgress = (course, student, globalSubmissions = []) => {
  return calculateCourseProgressDetailed(course, student, globalSubmissions).percentage;
};

/**
 * Returns list of modules needing revision across courses for a student.
 */
export const getModulesNeedingRevision = (courses, student, globalSubmissions = []) => {
  if (!Array.isArray(courses) || !student) return [];
  const result = [];

  courses.forEach((course) => {
    const modules = getCourseModules(course);
    modules.forEach((mod) => {
      const sub = findSubmission(globalSubmissions, student, mod.id);
      if (sub && isStatusFailing(sub.status)) {
        result.push({
          courseId: course.id,
          courseTitle: course.title,
          moduleId: mod.id,
          moduleTitle: mod.title,
          feedback: sub.feedback_text || sub.feedback || sub.comments || "",
          submittedAt: sub.created_at || sub.submittedAt,
        });
      }
    });
  });

  return result;
};

/**
 * Retrieves all submission feedback history for a student across all courses.
 */
export const getStudentFeedbackHistory = (courses, student, globalSubmissions = []) => {
  if (!Array.isArray(courses) || !student) return [];
  const feedbackList = [];

  courses.forEach((course) => {
    const modules = getCourseModules(course);
    modules.forEach((mod) => {
      const sub = findSubmission(globalSubmissions, student, mod.id);
      const feedbackText = sub?.feedback_text || sub?.feedback || sub?.comments;

      if (sub && (feedbackText || sub.feedback_video_url)) {
        feedbackList.push({
          id: sub.id || `${course.id}-${mod.id}`,
          courseTitle: course.title,
          moduleTitle: mod.title,
          status: sub.status,
          feedback: feedbackText,
          videoUrl: sub.feedback_video_url,
          gradedAt: sub.updated_at || sub.gradedAt || sub.created_at,
          read: !!sub.feedback_read || !!sub.feedbackRead,
        });
      }
    });
  });

  return feedbackList.sort(
    (a, b) => new Date(b.gradedAt || 0) - new Date(a.gradedAt || 0)
  );
};