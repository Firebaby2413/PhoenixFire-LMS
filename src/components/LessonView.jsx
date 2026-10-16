import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import MarkdownPreview from './MarkdownPreview';
import { submitAssignment, fetchAllSubmissions, supabase } from '../utils/storage';
import { isReadingModule, getModuleRepoUrl, getModuleQuizItems, getModuleSteps } from '../utils/moduleTypes';
import { 
  writeLocalProgressFlag,
  readLocalProgressMap,
  isStatusPassing,
  isStatusFailing,
  getEarnedCertificates,
  stampEarnedCertificates,
  stampCertificateDate,
  lessonCertificateId
} from '../utils/progress';
import { getAcademySettings, getDisplayName } from '../utils/academySettings';
import CertificateCard from './CertificateCard';


function getQuizAnswerKey(moduleId, question, index) {
  return `${moduleId}_${question.id || index}`;
}

const QUIZ_PASSING_PERCENT = 90;

function getVideoEmbedUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '');
      return `https://www.youtube.com/embed/${id}`;
    }
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch (e) {
    // not a valid URL
  }
  return url;
}

function buildLessonSteps(modules) {
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
  if(step.kind === 'video') {
    return !!(watchMap[modId] || watchMap[step.mod.id]);
  }
  if (step.kind === 'quiz') {
    const entry = quizMap[modId] ?? quizMap[step.mod.id];
    if (entry === true) return true;
    return !!(entry && (entry.passed === true || Number(entry.percent) >= 90));
  }
  return false;
}

function answersMatch(studentAnswer, correctAnswer) {
  return (
    String(studentAnswer || '').trim().toLowerCase() ===
    String(correctAnswer || '').trim().toLowerCase()
  );
}

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

function StudentQuizQuestion({ question, answer, onChange, groupName }) {
  const prompt = question.question || question.text || '';
  const type = String(question.type || '').toLowerCase();
  const options = Array.isArray(question.options)
    ? question.options.filter((opt) => String(opt).trim() !== '')
    : [];
  const showChoices =
    type === 'multiple_choice' || type === 'true_false' || options.length > 0;
  return (
    <div style={{ marginBottom: '12px' }}>
      <p style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>{prompt}</p>

      {showChoices ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {options.map((opt, optIdx) => {
            const checked = answer === opt;
            return (
              <label
                key={`${groupName}_${optIdx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: checked ? 'rgba(249, 115, 22, 0.15)' : '#0f172a',
                  border: `1px solid ${checked ? '#f97316' : '#475569'}`,
                  borderRadius: '6px',
                  padding: '8px 12px',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name={groupName}
                  value={opt}
                  checked={checked}
                  onChange={() => onChange(opt)}
                />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <input
          type="text"
          placeholder="Type your answer..."
          value={answer || ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%', background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#fff', padding: '8px 12px' }}
        />
      )}
    </div>
  );
}
export default function LessonView({
  course,
  lesson: initialLesson,
  courseId,
  lessonId,
  setCourses,
  currentUser,
  onBack,
  onSelectLesson,
  resumeStepIndex = 0,
  skipAutoResume = false
}) {
  const [currentLesson, setCurrentLesson] = useState(initialLesson);

  const [prevInitialLesson, setPrevInitialLesson] = useState(initialLesson);
  if (initialLesson !== prevInitialLesson) {
    setPrevInitialLesson(initialLesson);
    setCurrentLesson(initialLesson);
  }

  const [submissionInputs, setSubmissionInputs] = useState({});
  const [readModules, setReadModules] = useState({});
  const [dbSubmissions, setDbSubmissions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResults, setQuizResults] = useState({});
  const [visibleStepIndex, setVisibleStepIndex] = useState(resumeStepIndex);
  const [watchedVideos, setWatchedVideos] = useState({});
  const [finishNotice, setFinishNotice] = useState('');
  const [finishScrollTick, setFinishScrollTick] = useState(0);
  const finishPanelRef = useRef(null);
  const userMovedRef = useRef(false);
  const lastResumedLessonIdRef = useRef(null);
  const handleQuizAnswerChange = (questionKey, answer) => {
    setQuizAnswers((prev) => ({ ...prev, [questionKey]: answer }));
  };

  const handleCheckQuiz = (moduleId, questions) => {
    if (isAdminOrMentor) return;

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
  };

  const userRole = String(currentUser?.role || currentUser?.type || '').toLowerCase();
  const isAdminOrMentor = userRole === 'admin' || userRole === 'mentor' || currentUser?.isAdmin || currentUser?.email?.includes('admin');

  const studentId = currentUser?.id || currentUser?.email || '';

  useEffect(() => {
    let cancelled = false;
    const lessonIdKey = currentLesson?.id;

    if (lastResumedLessonIdRef.current !== lessonIdKey) {
      userMovedRef.current = false;
      lastResumedLessonIdRef.current = lessonIdKey;
    }

    function applyResume(readMap, watchMap, quizMap) {
      if (isAdminOrMentor || userMovedRef.current) return;
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
      if (isAdminOrMentor && !skipAutoResume) {
        setVisibleStepIndex(0);
        return;
      }
      if (!currentUser) return;

      const localRead = readLocalProgressMap('read_modules', currentUser);
      const localWatch = readLocalProgressMap('watched_videos', currentUser);
      const localQuiz = readLocalProgressMap('quiz_results', currentUser);

      setReadModules((prev) => ({ ...localRead, ...prev }));
      setWatchedVideos((prev) => ({ ...localWatch, ...prev }));
      setQuizResults((prev) => ({ ...localQuiz, ...prev}));
      applyResume(localRead, localWatch, localQuiz);

      let supabaseRead = {};
      if (studentId) {
        try {
          const { data, error} = await supabase
            .from('module_progress')
            .select('module_id, is_read')
            .eq('student_id', String(studentId));

            if (!error && data) {
              supabaseRead = data.reduce((acc, item) => {
                if (item.is_read) {
                  acc[String(item.module_id)] = true;
                }
                return acc;
              }, {});
            }
        } catch (err) {
          console.error('Failed to load module progress:', err);
        }
      }

      if (cancelled) return;

      const nextRead = { ...localRead, ...supabaseRead };
      setReadModules((prev) => ({ ...nextRead, ...prev }));
      applyResume(nextRead, localWatch, localQuiz);
    }

    hydrateProgressAndResume();
    return () => {
      cancelled = true;
    };
  }, [currentLesson?.id, currentUser?.id, currentUser?.email, studentId, isAdminOrMentor, skipAutoResume, resumeStepIndex]);

  const activeCourseId = courseId || course?.id;
  const activeLessonId = lessonId || currentLesson?.id;

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

  const modules = useMemo(() => currentLesson?.modules || [], [currentLesson]);
  const lessonSteps = useMemo(() => buildLessonSteps(modules), [modules]);

  const nextLesson = useMemo(() => {
    if (!course?.lessons || !Array.isArray(course.lessons)) return null;
    const currentIndex = course.lessons.findIndex(
      (l) => String(l.id || l._id) === String(currentLesson?.id || currentLesson?._id) || l.title === currentLesson?.title
    );
    if (currentIndex !== -1 && currentIndex < course.lessons.length - 1) {
      return course.lessons[currentIndex + 1];
    }
    return null;
  }, [course, currentLesson]);

  const cleanMarkdownText = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  };

  const submissionLookup = useMemo(() => {
    const map = new Map();
    const email = currentUser?.email ? String(currentUser.email).toLowerCase() : '';
    const id = currentUser?.id ? String(currentUser.id).toLowerCase() : '';

    modules.forEach((mod) => {
      if (isReadingModule(mod)) return;

      const modKey = String(mod.id);

      if (isAdminOrMentor) {
        if (dbSubmissions.length > 0) {
          const match = dbSubmissions.find(sub => String(sub.module_id) === modKey);
          if (match) map.set(modKey, match);
        }
        return;
      }

      const foundDbSub = dbSubmissions.find((sub) => {
        if (String(sub.module_id) !== modKey) return false;
        const subStudent = String(sub.student_id || sub.studentEmail || sub.student || '').toLowerCase();
        return (email && subStudent === email) || (id && subStudent === id);
      });

      if (foundDbSub) {
        map.set(modKey, foundDbSub);
        return;
      }

      if (Array.isArray(mod.submissions)) {
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
  }, [modules, currentUser, dbSubmissions, isAdminOrMentor]);

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

  // Student can continue when this portion is done (read, quiz, or submitted).
  // Mentor "pass" is separate and still shows as Pending until graded.
  const isModulePassed = useCallback(
    (mod) => {
      if (isAdminOrMentor) return true;
      const modIdStr = String(mod.id);
      const quizItems = getModuleQuizItems(mod);
      const quizResult = quizResults[modIdStr];

      if (quizItems.length > 0 && !quizResult?.passed) {
        return false;
      }

      if (isReadingModule(mod)) {
        return !!readModules[modIdStr];
      }

      return hasPassedAssignment(mod);
    },
    [isAdminOrMentor, readModules, quizResults, hasPassedAssignment]
  );

  const isStepComplete = useCallback(
    (step) => {
      if (isAdminOrMentor) return true;
      const modId = String(step.mod.id);

      if (step.kind === 'reading') {
        return !!readModules[modId];
      }

      if (step.kind === 'video') {
        return !!watchedVideos[modId];
      }

      if (step.kind === 'quiz') {
        return !!quizResults[modId]?.passed;
      }

      if (step.kind === 'assignment') {
        return hasPassedAssignment(step.mod);
      }
      return false;
    }, 
    [isAdminOrMentor, readModules, watchedVideos, quizResults, hasPassedAssignment]
  );

  const isLessonComplete = useMemo(() => {
    if (lessonSteps.length === 0) return false;
    return lessonSteps.every((step) => isStepComplete(step));
  }, [lessonSteps, isStepComplete]);

  const earnedCertificates = useMemo(() => {
    return stampEarnedCertificates(
      currentUser,
      getEarnedCertificates(course, currentUser, dbSubmissions)
    );
  }, [course, currentUser, dbSubmissions, readModules, watchedVideos, quizResults]);

  const lessonCert = useMemo(() => {
    if (!isLessonComplete || !currentLesson) return null;
    const certId = lessonCertificateId(course, currentLesson);
    const stored = earnedCertificates.lessons.find((cert) => cert.id === certId);
    if (stored) return stored;
    return {
      id: certId,
      kind: 'lesson',
      title: currentLesson.title || 'Lesson',
      courseTitle: course?.title || 'Course',
      earnedOn: stampCertificateDate(currentUser, certId)
    };
  }, [course, currentLesson, currentUser, earnedCertificates.lessons, isLessonComplete]);

  useEffect(() => {
    if (isLessonComplete) setFinishNotice('');
  }, [isLessonComplete]);

  useEffect(() => {
    if (!finishScrollTick) return;
    finishPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [finishScrollTick]);

  const handleProceedToNextLesson = () => {
    if (!nextLesson || !isLessonComplete) return;
    setCurrentLesson(nextLesson);
    setVisibleStepIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof onSelectLesson === 'function') {
      onSelectLesson(nextLesson);
    }
  };

  const toggleMarkRead = async (modId) => {
    if (isAdminOrMentor) return;
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
    if (isAdminOrMentor) return;
    const strModId = String(modId);
    const nextWatched = !watchedVideos[strModId];

    setWatchedVideos((prev) => ({ ...prev, [strModId]: nextWatched }));
    writeLocalProgressFlag('watched_videos', currentUser, strModId, nextWatched);
  };

  const handleInputChange = (modId, value) => {
    setSubmissionInputs((prev) => ({
      ...prev,
      [String(modId)]: value
    }));
  };

  const handleSubmitAssignment = async (moduleId, linkValue) => {
    if (isAdminOrMentor) return;
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
        lessonId: lessonId || currentLesson.id,
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
      alert('Assignment submitted successfully!');
    } catch (err) {
      alert('Failed to submit assignment. Check console.');
      console.error(err);
    }
  };

  if (!course || !currentLesson) {
    return (
      <div style={{ color: '#fff', padding: '20px' }}>
        <button onClick={onBack} style={{ background: '#1f2937', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginBottom: '15px' }}>
          ← Back
        </button>
        <p>No lesson or course selected.</p>
      </div>
    );
  }

  return (
    <div style={{ color: '#fff', padding: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={onBack} style={{ background: '#1f2937', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
          ← Back to Courses
        </button>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{course.title}</h2>
        <h3 style={{ fontSize: '20px', color: '#f97316', margin: 0 }}>{currentLesson.title}</h3>
        {lessonSteps.length > 0 && (
          <p style={{ margin: '8px 0 0 0', color: '#9ca3af', fontSize: '14px' }}>
            Portion {Math.min(visibleStepIndex + 1, lessonSteps.length)} of {lessonSteps.length}
            {' · '}
            {lessonSteps.filter((step) => isStepComplete(step)).length} completed
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {lessonSteps[visibleStepIndex] && (() => {
          const step = lessonSteps[visibleStepIndex];
          const mod = step.mod;
          const modIdStr = String(mod.id);
          const isRead = isAdminOrMentor || !!readModules[modIdStr];
          const stepDone = isStepComplete(step);

          const moduleMarkdown =
            mod.content || mod.body || mod.markdown || mod.details || mod.text || '';
          const videoUrl = 
          mod.assignment?.instructionsVideoUrl ||
          mod.video_url ||
          mod.videoUrl ||
          '';
          const embedUrl = getVideoEmbedUrl(videoUrl);

          const userSub = submissionLookup.get(modIdStr);
          const submittedUrl = userSub?.submission_url || userSub?.submissionUrl || userSub?.link || userSub?.url;
          const hasExistingSubmission = Boolean(submittedUrl);
          const currentInputValue = submissionInputs[modIdStr] !== undefined ? submissionInputs[modIdStr] : submittedUrl || '';
          const assignmentPrompt = mod.assignment_prompt || mod.instructions || mod.prompt || mod.assignment?.instructionsText || '';
          const repoUrl = getModuleRepoUrl(mod);
          const quizItems = getModuleQuizItems(mod);
          const quizResult = quizResults[modIdStr];

          const handleContinue = () => {
            userMovedRef.current = true;
            if (visibleStepIndex < lessonSteps.length - 1) {
              setFinishNotice('');
              setVisibleStepIndex(visibleStepIndex + 1);
              window.scrollTo({ top: 0, behavior: 'smooth' });
              return;
            }

            if (!isLessonComplete) {
              const stillOpen = lessonSteps.filter((step) => !isStepComplete(step));
              const labels = stillOpen.map(
                (step) => `${cleanMarkdownText(step.mod.title) || 'Portion'} (${step.kind})`
              );
              setFinishNotice(
                labels.length
                  ? `Finish is waiting on: ${labels.join(', ')}`
                  : `This lesson still has unfinished portions.`
              );
              setFinishScrollTick((tick) => tick + 1);
              return;
            }

            setFinishNotice('');
            setFinishScrollTick((tick) => tick + 1);
          };

          const handleBackStep = () => {
            userMovedRef.current = true;
            if (visibleStepIndex <= 0) return;
            const currentModId = String(lessonSteps[visibleStepIndex].mod.id);
            const prevStep = lessonSteps[visibleStepIndex - 1];
            if (String(prevStep.mod.id) !== currentModId) return;
            setVisibleStepIndex(visibleStepIndex - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          };

          const canBackSameModule =
            visibleStepIndex > 0 &&
            String(lessonSteps[visibleStepIndex - 1].mod.id) ===
              String(lessonSteps[visibleStepIndex].mod.id);
          return (
            <div
              key={`${modIdStr}-${step.kind}`}
              style={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', padding: '24px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                  {cleanMarkdownText(mod.title) || 'Module'} - {step.kind}
                </h4>
                <span style={{
                  fontSize: '12px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: stepDone ? 'rgba(16, 185, 129, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                  color: stepDone ? '#10b981' : '#fb923c'
                }}
                >
                  {stepDone ? 'Completed' : 'In Progress'}
                </span>
              </div>

              {step.kind === 'reading' && (
                <>
                  <div
                    className='module-markdown'
                    style={{ background: '#030712', border: '1px solid #1f2937', padding: '20px', borderRadius: '8px', marginBottom: '16px', color: '#e5e7eb' }}
                  >
                    <MarkdownPreview markdown={moduleMarkdown} showHeader={false} />
                  </div>
                  {!isAdminOrMentor && (
                    <button
                      onClick={() => toggleMarkRead(mod.id)}
                      style={{
                        background: isRead ? '#10b981' : '#374151',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      {isRead ? '✓ Material Read (Completed)' : 'Mark Material as Read'}
                    </button>
                  )}
                </>
              )}

              {step.kind === 'video' && (
                <>
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px', marginBottom: '16px' }}>
                    <iframe
                      src={embedUrl}
                      title='Lesson video'
                      allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                      allowFullScreen
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                      />
                  </div>
                  {!isAdminOrMentor && (
                    <button
                      onClick={() => toggleMarkWatched(mod.id)}
                      style={{
                        background: watchedVideos[modIdStr] ? '#10b981' : '#374151',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      {watchedVideos[modIdStr] ? '✓ Video Watched (Completed)' : 'Mark Video as Watched'}
                    </button>
                  )}
                </>
              )}

              {step.kind === 'assignment' && (
                <>
                  {embedUrl && (
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px', marginBottom: '16px' }}>
                      <iframe
                      src={embedUrl}
                      title='Assignment instruction video'
                      allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                      allowFullScreen
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                      />
                    </div>
                  )}
                  {repoUrl && (
                    <div style={{ background: '#1e293b', border: '1px solid #475569', padding: '14px 18px', borderRadius: '8px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                        Starter Repository (clone this):
                      </span>
                      <a href={repoUrl} target='_blank' rel='noopener noreferrer' style={{ color: '#38bdf8', wordBreak: 'break-all' }}>
                        {repoUrl}
                      </a>
                    </div>
                  )}
                  {assignmentPrompt && (
                    <div style={{ background: '#1e293b', border: '1px solid #334155', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                      <h5 style={{ color: '#f97316', margin: '0 0 8px 0' }}>Instructions & Prompt</h5>
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{assignmentPrompt}</div>
                    </div>
                  )}
                  {!isAdminOrMentor && (
                    <div style={{ background: '#1e293b', padding: '18px', borderRadius: '8px', border: '1px solid #334155'}}>
                      <h5 style={{ margin: '0 0 10px 0', color: '#f97316' }}>Assignment Submission</h5>
                      <input
                        type="text"
                        placeholder="Paste your Github repo link here..."
                        value={currentInputValue}
                        onChange={(e) => handleInputChange(mod.id, e.target.value)}
                        style={{
                          width: '100%',
                          background: '#0f172a',
                          border: '1px solid #475569',
                          borderRadius: '6px',
                          color: '#fff',
                          padding: '10px 14px',
                          marginBottom: '10px'
                        }}
                      />
                      <button
                        onClick={() => handleSubmitAssignment(mod.id, currentInputValue)}
                        style={{
                          background: 'linear-gradient(to right, #f97316, #ec4899)',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 'bold',
                          padding: '10px 20px',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        {hasExistingSubmission ? 'Resubmit' : 'Submit Assignment'}
                      </button>
                      {hasExistingSubmission && (
                        <p style={{
                          margin: '12px 0 0 0',
                          fontSize: '13px',
                          color: hasPassedAssignment(mod)
                            ? '#34d399'
                            : isStatusFailing(submissionLookup.get(modIdStr)?.status)
                              ? '#f87171'
                              : '#fbbf24'
                        }}>
                          {hasPassedAssignment(mod)
                            ? 'Passed - you can finish this lesson.'
                            : isStatusFailing(submissionLookup.get(modIdStr)?.status)
                              ? 'Needs revision. Update your repo and submit.'
                              : 'Submitted. Waiting for mentor/admin feedback before you can finish.'}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {step.kind === 'quiz' && (
                <div style={{ background: '#1e293b', padding: '18px', borderRadius: '18px' }}>
                  <h5 style={{ color: '#f97316', margin: '0 0 12px 0' }}>Quiz Questions</h5>
                  {quizItems.map((q, qIdx) => {
                    const questionKey = getQuizAnswerKey(modIdStr, q, qIdx);
                    return (
                      <StudentQuizQuestion
                        key={questionKey}
                        question={q}
                        answer={quizAnswers[questionKey] || ''}
                        groupName={questionKey}
                        onChange={(value) => handleQuizAnswerChange(questionKey, value)}
                      />
                    );
                  })}
                  {!isAdminOrMentor && (
                    <div style={{ marginTop: '12px' }}>
                      <button
                        type='button'
                        onClick={() => handleCheckQuiz(modIdStr, quizItems)}
                        style={{
                          background: '#f97316',
                          color: '#fff',
                          border: 'none',
                          padding: '10px 20px', 
                          borderRadius: '6px', 
                          cursor: 'pointer', 
                          fontWeight: 'bold'
                        }}
                      >
                        {quizResult ? 'Retake / Check Again' : 'Check Quiz'}
                      </button>
                      {quizResult && (
                        <p style={{ marginTop: '10px', color: quizResult.passed ? '#34d399' : '#f87171' }}>
                          Score: {quizResult.correct}/{quizResult.total} ({quizResult.percent}%).
                          {quizResult.passed ? 'Passed!' : `Need ${QUIZ_PASSING_PERCENT}% to pass.`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!isAdminOrMentor && (
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {canBackSameModule ? (
                    <button
                      type='button'
                      onClick={handleBackStep}
                      style={{
                        background: '#1f2937', 
                        color: '#fff',
                        border: '1px solid #374151',
                        padding: '10px 20px', 
                        borderRadius: '6px',
                        fontWeight: 'bold', 
                        cursor: 'pointer'
                      }}
                    >
                      ← Back
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type='button'
                    disabled={!stepDone}
                    onClick={handleContinue}
                    style={{
                      background: stepDone ? '#f97316' : '#374151',
                      color: '#fff', 
                      border: 'none',
                      padding: '10px 20px', 
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      cursor: stepDone ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {visibleStepIndex < lessonSteps.length - 1
                      ? 'Continue →'
                      : isLessonComplete
                        ? 'View certificate' 
                        : 'Finish'}
                  </button>
                </div>
              )}
            </div>
        );
        })()}
        
        {(finishNotice || lessonCert) && (
          <div ref={finishPanelRef} style={{ display: 'grid', gap: '14px', marginTop: '10px', justifyItems: 'center' }}>
            {finishNotice && <p className='finish-notice'>{finishNotice}</p>}
            {lessonCert && (
              <>
                <CertificateCard
                  kind='lesson'
                  title={cleanMarkdownText(lessonCert.title)}
                  courseTitle={lessonCert.courseTitle}
                  studentName={getDisplayName(currentUser)}
                  academyName={getAcademySettings().academyName}
                  earnedOn={lessonCert.earnedOn}
                />
                {earnedCertificates.course && (
                  <CertificateCard
                    kind='course'
                    title={earnedCertificates.course.title}
                    studentName={getDisplayName(currentUser)}
                    academyName={getAcademySettings().academyName}
                    earnedOn={earnedCertificates.course.earnedOn}
                  />
                )}
                <p style={{ margin: 0, width: '100%', color: '#9ca3af', fontSize: '14px' }}>
                  {earnedCertificates.course
                    ? 'You finished this course. Both certificates are saved on your Progress tab.'
                    : nextLesson
                      ? `Next up: ${nextLesson.title}. This certificate is saved on your Progress tab.`
                      : 'This certificate is saved on your Progress tab.' }
                </p>
                <div className='certificate-actions'>
                  {nextLesson && (
                    <button
                      type='button'
                      onClick={handleProceedToNextLesson}
                      style={{ background: '#f97316', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Next Lesson →
                    </button>
                  )}
                  <button
                    type='button'
                    onClick={onBack}
                    style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Back to Course Menu
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}