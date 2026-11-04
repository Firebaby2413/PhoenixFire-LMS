import { useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { getModuleSteps } from '../utils/moduleTypes';
import {
  writeLocalProgressFlag,
  clearLocalCourseProgress,
  readLocalProgressMap
} from '../utils/progress';

export function buildLessonSteps(modules) {
  const list = [];
  modules.forEach((mod, moduleIndex) => {
    getModuleSteps(mod).forEach((kind) => {
      list.push({ kind, mod, moduleIndex });
    });
  });
  return list;
}

function isStepDoneInMaps(step, readMap, watchMap, quizMap) {
  const modId = String(step.mod.id);
  if (step.kind === 'reading') {
    return !!(readMap[modId] || readMap[step.mod.id]);
  }
  if (step.kind === 'video') {
    return !!(watchMap[modId] || watchMap[step.mod.id]);
  }
  if (step.kind === 'quiz') {
    const entry = quizMap[modId] ?? quizMap[step.mod.id];
    if (entry === true) return true;
    return !!(entry && (entry.passed === true || Number(entry.percent) >= 90));
  }
  return false;
}

function getQuizAnswerKey(moduleId, question, index) {
  return `${moduleId}_${question.id || index}`;
}

function answersMatch(studentAnswer, correctAnswer) {
  return (
    String(studentAnswer || '').trim().toLowerCase() ===
    String(correctAnswer || '').trim().toLowerCase()
  );
}

const QUIZ_PASSING_PERCENT = 90;

function scoreQuiz(questions, answers, moduleId) {
  let correct = 0;
  questions.forEach((q, index) => {
    const key = getQuizAnswerKey(moduleId, q, index);
    if (answersMatch(answers[key], q.answer)) {
      correct += 1;
    }
  });
  const total = questions.length;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  return {
    correct,
    total,
    percent,
    passed: percent >= QUIZ_PASSING_PERCENT
  };
}

export function useLessonProgress({
  currentLesson,
  currentUser,
  course,
  courseId,
  studentId,
  resumeStepIndex,
  skipAutoResume,
  setCourses
}) {
  const [readModules, setReadModules] = useState({});
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResults, setQuizResults] = useState({});
  const [visibleStepIndex, setVisibleStepIndex] = useState(resumeStepIndex);
  const [watchedVideos, setWatchedVideos] = useState({});
  const [finishNotice, setFinishNotice] = useState('');
  const [finishScrollTick, setFinishScrollTick] = useState(0);
  const [courseResetAt, setCourseResetAt] = useState(0);
  const [progressReady, setProgressReady] = useState(0);
  const allowCertificateAwardRef = useRef(false);
  const finishPanelRef = useRef(null);
  const userMovedRef = useRef(false);
  const lastResumedLessonIdRef = useRef(null);

  const handleQuizAnswerChange = (questionKey, answer) => {
    setQuizAnswers((prev) => ({ ...prev, [questionKey]: answer }));
  };

  const handleCheckQuiz = (moduleId, questions) => {
    const unanswered = questions.some((q, index) => {
      const key = getQuizAnswerKey(moduleId, q, index);
      return !String(quizAnswers[key] || '').trim();
    });

    if (unanswered) {
      alert('Please answer every question before checking the quiz.');
      return;
    }

    const result = scoreQuiz(questions, quizAnswers, moduleId);
    setQuizResults((prev) => ({ ...prev, [String(moduleId)]: result }));
    writeLocalProgressFlag('quiz_results', currentUser, moduleId, result);
    if (studentId) {
      supabase.from('module_progress').upsert({
        student_id: String(studentId),
        module_id: String(moduleId),
        quiz_result: result,
        updated_at: new Date().toISOString()
      }, { onConflict: 'student_id,module_id' });
    }
  };

  useEffect(() => {
    let cancelled = false;
    allowCertificateAwardRef.current = false;
    const lessonIdKey = currentLesson?.id;

    if (lastResumedLessonIdRef.current !== lessonIdKey) {
      userMovedRef.current = false;
      lastResumedLessonIdRef.current = lessonIdKey;
    }

    function applyResume(readMap, watchMap, quizMap) {
      if (userMovedRef.current) return;
      const steps = buildLessonSteps(currentLesson?.modules || []);
      if (steps.length === 0) return;
      const firstIncomplete = steps.findIndex(
        (step) => !isStepDoneInMaps(step, readMap, watchMap, quizMap)
      );
      setVisibleStepIndex(firstIncomplete === -1 ? steps.length - 1 : firstIncomplete);
    }

    async function hydrateProgressAndResume() {
      if (skipAutoResume) {
        userMovedRef.current = true;
        setVisibleStepIndex(Number.isFinite(resumeStepIndex) ? resumeStepIndex : 0);
      }
      if (!currentUser) return;

      let localRead = {};
      let localWatch = {};
      let localQuiz = {};
      let supabaseRead = {};
      let didReadLocal = false;
      let approvedResetAt = 0;
      if (studentId) {
        try {
          const { data: resetRows } = await supabase
            .from('course_restart_requests')
            .select('reviewed_at, created_at')
            .eq('student_id', String(currentUser.id))
            .eq('course_id', String(course?.id || courseId || ''))
            .eq('status', 'approved')
            .order('reviewed_at', { ascending: false })
            .limit(1);
          const resetAt = new Date(resetRows?.[0]?.reviewed_at || resetRows?.[0]?.created_at || 0).getTime();
          if (resetRows?.length) approvedResetAt = resetAt;
          if (resetRows?.length && course) clearLocalCourseProgress(currentUser, course);

          localRead = readLocalProgressMap('read_modules', currentUser);
          localWatch = readLocalProgressMap('watched_videos', currentUser);
          localQuiz = readLocalProgressMap('quiz_results', currentUser);
          didReadLocal = true;

          if (!cancelled) {
            setReadModules(localRead);
            setWatchedVideos(localWatch);
            setQuizResults(localQuiz);
            applyResume(localRead, localWatch, localQuiz);
          }

          const { data, error } = await supabase
            .from('module_progress')
            .select('module_id, is_read, is_watched, is_submitted, quiz_result, updated_at')
            .eq('student_id', String(studentId));
          const kept = (data || []).filter((row) => {
            if (!resetRows?.length) return true;
            return new Date(row.updated_at || 0).getTime() > resetAt;
          });

          if (!error && kept) {
            const watched = {};
            const submitted = {};
            const quizzes = {};
            supabaseRead = kept.reduce((acc, item) => {
              const moduleKey = String(item.module_id);
              if (item.is_read) acc[moduleKey] = true;
              if (item.is_watched) watched[moduleKey] = true;
              if (item.is_submitted) submitted[moduleKey] = true;
              if (item.quiz_result) quizzes[moduleKey] = item.quiz_result;
              return acc;
            }, {});
            if (!cancelled) {
              setWatchedVideos({ ...localWatch, ...watched });
              setQuizResults({ ...localQuiz, ...quizzes });
              Object.entries(submitted).forEach(([moduleKey, value]) => {
                writeLocalProgressFlag('submitted_modules', currentUser, moduleKey, value);
              });
            }
          }
        } catch (err) {
          console.error('Failed to load module progress:', err);
          if (!didReadLocal) {
            localRead = readLocalProgressMap('read_modules', currentUser);
            localWatch = readLocalProgressMap('watched_videos', currentUser);
            localQuiz = readLocalProgressMap('quiz_results', currentUser);
          }
        }
      }

      if (cancelled) return;

      const nextRead = { ...localRead, ...supabaseRead };
      allowCertificateAwardRef.current = false;
      setCourseResetAt(approvedResetAt);
      setProgressReady((ready) => ready + 1);
      setReadModules(nextRead);
      applyResume(nextRead, localWatch, localQuiz);
    }

    hydrateProgressAndResume();
    return () => {
      cancelled = true;
    };
  // Rerun when the lesson or student id changes. The course object is read inside the load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLesson?.id, currentUser?.id, currentUser?.email, studentId, skipAutoResume, resumeStepIndex]);

  const toggleMarkRead = async (modId) => {
    const strModId = String(modId);
    const nextReadState = !readModules[strModId];

    setReadModules((prev) => ({ ...prev, [strModId]: nextReadState }));
    writeLocalProgressFlag('read_modules', currentUser, strModId, nextReadState);

    if (studentId) {
      await supabase.from('module_progress').upsert({
        student_id: String(studentId),
        module_id: strModId,
        is_read: nextReadState,
        updated_at: new Date().toISOString()
      }, { onConflict: 'student_id,module_id' });
    }

    if (typeof setCourses === 'function') {
      setCourses((prevCourses) => [...prevCourses]);
    }
  };

  const toggleMarkWatched = (modId) => {
    const strModId = String(modId);
    const nextWatched = !watchedVideos[strModId];

    setWatchedVideos((prev) => ({ ...prev, [strModId]: nextWatched }));
    writeLocalProgressFlag('watched_videos', currentUser, strModId, nextWatched);
    if (studentId) {
      supabase.from('module_progress').upsert({
        student_id: String(studentId),
        module_id: strModId,
        is_watched: nextWatched,
        updated_at: new Date().toISOString()
      }, { onConflict: 'student_id,module_id' });
    }
  };

  return {
    readModules,
    quizAnswers,
    quizResults,
    visibleStepIndex,
    setVisibleStepIndex,
    watchedVideos,
    finishNotice,
    setFinishNotice,
    finishScrollTick,
    setFinishScrollTick,
    courseResetAt,
    progressReady,
    allowCertificateAwardRef,
    finishPanelRef,
    userMovedRef,
    handleQuizAnswerChange,
    handleCheckQuiz,
    toggleMarkRead,
    toggleMarkWatched
  };
}
