/**
 * Utility functions for calculating student progress, completion,
 * and feedback history across courses, lessons, and modules.
 */

import { getModuleSteps, moduleHasPortions } from './moduleTypes';
import { supabase } from './supabaseClient';
import { isUuid } from './profileShape';

export function getStudentStorageIds(student) {
  if (!student) return [];
  const raw =
    typeof student === 'string'
      ? [student]
      : [student.id, student.studentId, student.email, student.username, student.user_id];
  const ids = [];
  raw.filter(Boolean).forEach((id) => {
    const value = String(id);
    ids.push(value);
    ids.push(value.toLowerCase());
  });
  return [...new Set(ids)];
}

export function readLocalProgressMap(prefix, student) {
  const merged = {};
  getStudentStorageIds(student).forEach((id) => {
    try {
      Object.assign(merged, JSON.parse(localStorage.getItem(`${prefix}_${id}`) || '{}'));
    } catch {
      // ignore bad JSON
    }
  });
  return merged;
}

export function writeLocalProgressFlag(prefix, student, modId, value) {
  const key = String(modId);
  getStudentStorageIds(student).forEach((id) => {
    try {
      const storageKey = `${prefix}_${id}`;
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      saved[key] = value;
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      // ignore quota / private mode
    }
  });
}

export function applyRemoteModuleProgress(rows) {
  if (!Array.isArray(rows)) return;
  rows.forEach((row) => {
    if (!row?.student_id || row.module_id == null) return;
    const student = { id: String(row.student_id) };
    const moduleId = row.module_id;
    if (row.is_read) writeLocalProgressFlag('read_modules', student, moduleId, true);
    if (row.is_watched) writeLocalProgressFlag('watched_videos', student, moduleId, true);
    if (row.is_submitted) writeLocalProgressFlag('submitted_modules', student, moduleId, true);
    const quiz = row.quiz_result;
    if (quiz && (quiz.passed === true || Number(quiz.percent) >= 90)) {
      writeLocalProgressFlag('quiz_results', student, moduleId, quiz);
    }
  });
}

function progressMapHas(map, modId) {
  const entry = map[modId] ?? map[String(modId)];
  if (entry === true || entry === 1) return true;
  if (entry && typeof entry === 'object') {
    if (entry.passed === true || entry.is_read === true) return true;
    if (Number(entry.percent) >= 90) return true;
  }
  return false;
}

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
  const savedReadState = readLocalProgressMap('read_modules', student);
  if (progressMapHas(savedReadState, mod.id)) {
    return true;
  }

  if (Array.isArray(mod.completions)) {
    return mod.completions.some((c) => {
      const cKeys = studentKeys(c);
      return keys.some((k) => cKeys.includes(k));
    });
  }

  return !!(mod.completed || mod.isCompleted);
};

/**
 * Progress is one point per lesson step (reading, video, quiz, assignment),
 * matching LessonView portions.
 */
export const calculateCourseProgressDetailed = (course, student, globalSubmissions = []) => {
  const modules = getCourseModules(course);
  const outline = getCourseOutline(course, student, globalSubmissions);
  const allSteps = outline.flatMap((entry) => entry.steps);

  if (allSteps.length === 0) {
    return { 
      completedCount: 0,
      totalCount: modules.length,
      completedSteps: 0,
      totalSteps: 0,
      completedLessons: 0,
      totalLessons: outline.length,
      percentage: 0
    };
  }

  const totalProgressPoints = allSteps.filter((step) => step.complete).length;
  const completedCount = outline.filter((entry) => entry.complete).length;
  const percentage = Math.min(100, Math.round((totalProgressPoints / allSteps.length) * 100));

  return {
    completedCount,
    totalCount: modules.length,
    completedSteps: totalProgressPoints,
    totalSteps: allSteps.length,
    completedLessons: outline.filter((entry) => entry.complete).length,
    totalLessons: outline.length,
    percentage
  };
};

/**
 * Shorthand wrapper to prevent missing export errors for components 
 * expecting `calculateCourseProgress`.
 */
export const calculateCourseProgress = (course, student, globalSubmissions = []) => {
  return calculateCourseProgressDetailed(course, student, globalSubmissions).percentage;
};

function isStepDoneFromMaps(kind, mod, maps, student, globalSubmissions = []) {
  if (kind === 'reading') {
    return progressMapHas(maps.readMap, mod.id) || isModuleCompletedByStudent(mod, student);
  }

  if (kind === 'video') {
    return progressMapHas(maps.watchedMap, mod.id);
  }

  if (kind === 'quiz') {
    return progressMapHas(maps.quizMap, mod.id); 
  }

  if (kind === 'assignment') {
    return (
      isModuleApprovedByStudent(mod, student, globalSubmissions)
    );
  }
  return false;
}

export function getCourseOutline(course, student, globalSubmissions = []) {
  const maps = {
    readMap: readLocalProgressMap('read_modules', student),
    watchedMap: readLocalProgressMap('watched_videos', student),
    quizMap: readLocalProgressMap('quiz_results', student),
    submittedMap: readLocalProgressMap('submitted_modules', student)
  };

  const lessons = course?.lessons || [];
  const outline = lessons.map((lesson) => {
    const steps = [];
    (lesson.modules || []).forEach((mod) => {
      if (!moduleHasPortions(mod)) return;
      getModuleSteps(mod).forEach((kind) => {
        steps.push({ kind, mod });
      });
    });

    const stepItems = steps.map((step, stepIndex) => ({
      kind: step.kind,
      mod: step.mod,
      stepIndex,
      complete: isStepDoneFromMaps(step.kind, step.mod, maps, student, globalSubmissions),
      unlocked: false
    }));

    const indexesByModule = {};
    stepItems.forEach((item, idx) => {
      const id = String(item.mod.id);
      if (!indexesByModule[id]) indexesByModule[id] = [];
      indexesByModule[id].push(idx);
    });
    Object.keys(indexesByModule).forEach((id) => {
      const idxs = indexesByModule[id];
      let laterDone = false;
      for (let i = idxs.length - 1; i >= 0; i -= 1) {
        if (laterDone) stepItems[idxs[i]].complete = true;
        if (stepItems[idxs[i]].complete) laterDone = true;
      }
    });

    return { lesson, steps: stepItems };
  });

  let allPreviousDone = true;
  outline.forEach((entry) => {
    entry.steps.forEach((item) => {
      item.unlocked = allPreviousDone;
      allPreviousDone = allPreviousDone && item.complete;
    });
    entry.complete = entry.steps.length > 0 && entry.steps.every((item) => item.complete);
    entry.unlocked =
      entry.steps.length === 0 ? allPreviousDone : entry.steps.some((item) => item.unlocked);
  });

  return outline;
}

export function lessonCertificateId(course, lesson) {
  const courseId = course?.id || course?.title || 'course';
  const lessonId = lesson?.id || lesson?._id || lesson?.title || 'lesson';
  return `lesson:${courseId}:${lessonId}`;
}

export function courseCertificateId(course) {
  return `course:${course?.id || course?.title || 'course'}`;
}

export function stampCertificateDate(student, certificateId) {
  const id = String(certificateId);
  const existing = readLocalProgressMap('certificate_dates', student);
  if (existing[id]) return existing[id];
  const iso = new Date().toISOString();
  writeLocalProgressFlag('certificate_dates', student, id, iso);
  if (isUuid(student?.id)) {
    supabase
      .from('certificates')
      .upsert(
        { student_id: student.id, certificate_key: id, awarded_at: iso },
        { onConflict: 'student_id,certificate_key' }
      )
      .then(({ error }) => {
        if (error) console.error('Certificate was not saved to Supabase:', error.message);
      });
  }
  return iso;
}

export function getEarnedCertificates(course, student, globalSubmissions = []) {
  if (!course || !student) return { lessons: [], course: null };

  const outline = getCourseOutline(course, student, globalSubmissions);
  const dates = readLocalProgressMap('certificate_dates', student);
  const lessons = outline
    .filter((entry) => entry.complete && entry.lesson)
    .map((entry) => {
      const id = lessonCertificateId(course, entry.lesson);
      return {
        id,
        kind: 'lesson',
        title: entry.lesson.title || 'Lesson',
        courseTitle: course.title || 'Course',
        earnedOn: dates[id] || null
      };
    });

  const steps = outline.flatMap((entry) => entry.steps);
  const courseDone = steps.length > 0 && steps.every((step) => step.complete);
  const id = courseCertificateId(course);

  return {
    lessons,
    course: courseDone
      ? {
        id,
        kind: 'course',
        title: course.title || 'Course',
        courseTitle: course.title || 'Course',
        earnedOn: dates[id] || null
      }
    : null
  };
}

export function stampEarnedCertificates(student, earned) {
  const lessons = (earned?.lessons || []).map((cert) => ({
    ...cert,
    earnedOn: cert.earnedOn || stampCertificateDate(student, cert.id)
  }));
  const courseCert = earned?.course
    ? {
        ...earned.course,
        earnedOn: earned.course.earnedOn || stampCertificateDate(student, earned.course.id) 
      }
    : null;
  return { lessons, course: courseCert }
}

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