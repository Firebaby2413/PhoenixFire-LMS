import { useCallback, useEffect, useMemo, useState } from 'react';
import { submitAssignment, fetchAllSubmissions, supabase } from '../utils/storage';
import { isReadingModule } from '../utils/moduleTypes';
import { isStatusPassing, getCourseModules, writeLocalProgressFlag } from '../utils/progress';
import { submissionSavedAt } from '../utils/courseRestart';

export function useLessonSubmissions({
  activeCourseId,
  activeLessonId,
  course,
  courseId,
  lessonId,
  courseResetAt,
  currentUser,
  currentLesson,
  modules,
  studentId
}) {
  const [submissionInputs, setSubmissionInputs] = useState({});
  const [dbSubmissions, setDbSubmissions] = useState([]);

  useEffect(() => {
    async function loadDbSubmissions() {
      try {
        const subs = await fetchAllSubmissions();
        setDbSubmissions(subs);
      } catch (err) {
        console.error('Failed to load database submissions:', err);
      }
    }
    loadDbSubmissions();
  }, [activeCourseId, activeLessonId]);

  const activeSubmissions = useMemo(() => {
    if (!courseResetAt) return dbSubmissions;
    const moduleIds = new Set(getCourseModules(course).map((mod) => String(mod.id)));
    const courseKey = String(course?.id || courseId || '');
    return dbSubmissions.filter((sub) => {
      const sameCourse = (courseKey && String(sub.course_id || '') === courseKey)
        || moduleIds.has(String(sub.module_id || ''));
      if (!sameCourse) return true;
      return submissionSavedAt(sub) > courseResetAt;
    });
  }, [dbSubmissions, courseResetAt, course, courseId]);

  const submissionLookup = useMemo(() => {
    const map = new Map();
    const email = currentUser?.email ? String(currentUser.email).toLowerCase() : '';
    const id = currentUser?.id ? String(currentUser.id).toLowerCase() : '';

    modules.forEach((mod) => {
      if (isReadingModule(mod)) return;

      const modKey = String(mod.id);

      const foundDbSub = activeSubmissions.find((sub) => {
        if (String(sub.module_id) !== modKey) return false;
        const subStudent = String(sub.student_id || sub.studentEmail || sub.student || '').toLowerCase();
        return (email && subStudent === email) || (id && subStudent === id);
      });

      if (foundDbSub) {
        map.set(modKey, foundDbSub);
        return;
      }

      if (!courseResetAt && Array.isArray(mod.submissions)) {
        const sub = mod.submissions.find((s) => {
          const subEmail = String(s.studentEmail || s.student_email || s.student || '').toLowerCase();
          const subId = String(s.studentId || s.student_id || '').toLowerCase();
          return (email && subEmail === email) || (id && subId === id);
        });
        if (sub) {
          map.set(modKey, sub);
        }
      }
    });

    return map;
  }, [modules, currentUser, activeSubmissions, courseResetAt]);

  const hasSubmittedAssignment = useCallback(
    (mod) => {
      const sub = submissionLookup.get(String(mod.id));
      const url = sub?.submission_url || sub?.submissionUrl || sub?.link || sub?.url;
      return Boolean(url);
    },
    [submissionLookup]
  );

  const hasPassedAssignment = useCallback(
    (mod) => {
      const sub = submissionLookup.get(String(mod.id));
      return isStatusPassing(sub?.status);
    },
    [submissionLookup]
  );

  const handleInputChange = (modId, value) => {
    setSubmissionInputs((prev) => ({
      ...prev,
      [String(modId)]: value
    }));
  };

  const handleSubmitAssignment = async (moduleId, linkValue) => {
    const trimmedLink = linkValue?.trim();
    if (!trimmedLink) {
      alert('Please enter a valid URL or response.');
      return;
    }

    const userId = studentId || 'student_id';
    const userEmail = currentUser?.email || 'student@test.com';

    try {
      const savedSub = await submitAssignment({
        studentId: userId,
        studentEmail: userEmail,
        courseId: courseId || course.id,
        lessonId: lessonId || currentLesson?.id,
        moduleId: moduleId,
        submissionUrl: trimmedLink
      });

      setDbSubmissions((prev) => [
        savedSub,
        ...prev.filter(
          (s) =>
            String(s.module_id) !== String(moduleId) ||
            String(s.student_id).toLowerCase() !== String(userId).toLowerCase()
        )
      ]);

      writeLocalProgressFlag('submitted_modules', currentUser, moduleId, true);
      await supabase.from('module_progress').upsert({
        student_id: String(userId),
        module_id: String(moduleId),
        is_submitted: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'student_id,module_id' });
      alert('Assignment submitted successfully!');
    } catch (err) {
      alert('Failed to submit assignment. Check console.');
      console.error(err);
    }
  };

  return {
    submissionInputs,
    activeSubmissions,
    submissionLookup,
    hasSubmittedAssignment,
    hasPassedAssignment,
    handleInputChange,
    handleSubmitAssignment
  };
}
