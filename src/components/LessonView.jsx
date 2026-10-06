import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { submitAssignment, fetchAllSubmissions, supabase } from '../utils/storage';

export default function LessonView({
  course,
  lesson: initialLesson,
  courseId,
  lessonId,
  setCourses,
  currentUser,
  onBack,
  onSelectLesson
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

  const handleQuizAnswerChange = (questionIndex, answer) => {
    setQuizAnswers((prev) => ({ ...prev, [questionIndex]: answer }));
  };

  const userRole = String(currentUser?.role || currentUser?.type || '').toLowerCase();
  const isAdminOrMentor = userRole === 'admin' || userRole === 'mentor' || currentUser?.isAdmin || currentUser?.email?.includes('admin');

  const studentId = currentUser?.id || currentUser?.email || '';

  useEffect(() => {
    if (!studentId || isAdminOrMentor) return;

    async function fetchReadState() {
      const { data, error } = await supabase
        .from('module_progress')
        .select('module_id, is_read')
        .eq('student_id', String(studentId));

      if (!error && data) {
        const readMap = data.reduce((acc, item) => {
          if (item.is_read) {
            acc[String(item.module_id)] = true;
          }
          return acc;
        }, {});
        setReadModules(readMap);
      }
    }

    fetchReadState();
  }, [studentId, isAdminOrMentor, courseId, currentLesson?.id]);

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

  const handleProceedToNextLesson = () => {
    if (!nextLesson) return;
    setCurrentLesson(nextLesson);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof onSelectLesson === 'function') {
      onSelectLesson(nextLesson);
    }
  };

  /**
   * BULLETPROOF CHECK:
   * 1. If explicitly marked as reading/text/lesson -> Reading module.
   * 2. If explicitly marked as assignment/quiz/lab -> NOT reading.
   * 3. If it has actual quiz questions or a starter repository -> NOT reading.
   * 4. Otherwise -> Default to Reading module.
   */
  const isReadingModule = (mod) => {
    if (!mod) return true;

    const explicitType = String(mod.type || mod.kind || '').toLowerCase();

    // Explicit non-reading types
    if (['assignment', 'lab', 'quiz', 'exercise', 'project', 'assessment', 'challenge', 'submission', 'homework', 'task'].includes(explicitType)) {
      return false;
    }

    // Explicit reading types
    if (['reading', 'text', 'lesson', 'content', 'article'].includes(explicitType)) {
      return true;
    }

    // Check for real interactive questions
    const hasQuestions = Boolean(
      (Array.isArray(mod.questions) && mod.questions.length > 0) ||
      (Array.isArray(mod.quiz) && mod.quiz.length > 0) ||
      (Array.isArray(mod.quizQuestions) && mod.quizQuestions.length > 0)
    );

    // STRICT CHECK: Only consider it a repo assignment if a non-empty URL string actually exists
    const rawRepo = mod.repo_url || mod.repoUrl || mod.repository || mod.assignment?.repoUrl || '';
    const hasRepo = typeof rawRepo === 'string' && rawRepo.trim().length > 0;

    if (hasQuestions || hasRepo) {
      return false;
    }

    // Default to reading material
    return true;
  };

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

  const isModulePassed = useCallback(
    (mod) => {
      if (isAdminOrMentor) return true;
      const modIdStr = String(mod.id);
      
      if (isReadingModule(mod)) {
        return !!readModules[modIdStr];
      }

      const sub = submissionLookup.get(modIdStr);
      const subStatus = String(sub?.status || '').toLowerCase();
      const modStatus = String(mod?.status || '').toLowerCase();

      return subStatus === 'pass' || subStatus === 'passed' || modStatus === 'pass' || modStatus === 'passed';
    },
    [submissionLookup, readModules, isAdminOrMentor]
  );

  const isLessonComplete = useMemo(() => {
    if (modules.length === 0) return false;
    return modules.every((mod) => isModulePassed(mod));
  }, [modules, isModulePassed]);

  const toggleMarkRead = async (modId) => {
    if (isAdminOrMentor) return;
    const strModId = String(modId);
    const nextReadState = !readModules[strModId];
    
    setReadModules((prev) => ({ ...prev, [strModId]: nextReadState }));

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
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {modules.map((mod, index) => {
          const modIdStr = String(mod.id);
          const prevModule = index > 0 ? modules[index - 1] : null;
          const isUnlocked = isAdminOrMentor || index === 0 || (prevModule && isModulePassed(prevModule));

          const isReading = isReadingModule(mod);
          const isPassed = isModulePassed(mod);
          const isRead = isAdminOrMentor || !!readModules[modIdStr];

          const rawContentText = mod.content || mod.body || mod.markdown || mod.details || mod.text || '';
          const moduleContentText = cleanMarkdownText(rawContentText);
          const videoUrl = mod.video_url || mod.videoUrl || mod.video || '';

          const userSub = isReading ? null : submissionLookup.get(modIdStr);
          const submittedUrl = isReading ? null : (userSub?.submission_url || userSub?.submissionUrl || userSub?.link || userSub?.url);
          const hasExistingSubmission = isReading ? false : Boolean(submittedUrl);
          const currentInputValue = submissionInputs[modIdStr] !== undefined ? submissionInputs[modIdStr] : submittedUrl || '';
          const assignmentPrompt = mod.assignment_prompt || mod.instructions || mod.prompt || '';
          const repoUrl = mod.repo_url || mod.repoUrl || mod.repository || '';

          return (
            <div key={modIdStr || index} style={{ background: '#111827', border: `1px solid ${isUnlocked ? '#374151' : '#1f2937'}`, borderRadius: '12px', padding: '24px', opacity: isUnlocked ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                  {cleanMarkdownText(mod.title) || `Module ${index + 1}`} {!isUnlocked && '🔒'}
                </h4>
                <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', background: isUnlocked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(107, 114, 128, 0.2)', color: isUnlocked ? '#10b981' : '#9ca3af' }}>
                  {isReading ? (isRead ? 'Completed' : 'In Progress') : (isPassed ? 'Passed' : 'Pending')}
                </span>
              </div>

              {isUnlocked ? (
                <>
                  {moduleContentText && (
                    <div style={{ background: '#030712', border: '1px solid #1f2937', padding: '20px', borderRadius: '8px', marginBottom: '16px', color: '#e5e7eb', whiteSpace: 'pre-wrap' }}>
                      {moduleContentText}
                    </div>
                  )}

                  {videoUrl && (
                    <div style={{ marginBottom: '16px' }}>
                      <a href={videoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: '#3b82f6', color: '#fff', padding: '10px 16px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold' }}>
                        ▶ Watch Lesson Video
                      </a>
                    </div>
                  )}

                  {/* Starter Repository (Assignments only) */}
                  {!isReading && repoUrl && (
                    <div style={{ background: '#1e293b', border: '1px solid #475569', padding: '14px 18px', borderRadius: '8px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Starter Repository:</span>
                      <a href={repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', wordBreak: 'break-all', fontWeight: '500' }}>
                        {repoUrl}
                      </a>
                    </div>
                  )}

                  {/* Instructions & Prompt (Assignments only) */}
                  {!isReading && assignmentPrompt && (
                    <div style={{ background: '#1e293b', border: '1px solid #334155', padding: '16px', borderRadius: '8px', marginBottom: '16px', color: '#f3f4f6' }}>
                      <h5 style={{ color: '#f97316', margin: '0 0 8px 0', fontSize: '15px' }}>Instructions & Prompt</h5>
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{assignmentPrompt}</div>
                    </div>
                  )}

                  {/* Quiz Questions (Quizzes only) */}
                  {!isReading && mod.questions && Array.isArray(mod.questions) && (
                    <div style={{ background: '#1e293b', padding: '18px', borderRadius: '8px', marginBottom: '16px' }}>
                      <h5 style={{ color: '#f97316', margin: '0 0 12px 0' }}>Quiz Questions</h5>
                      {mod.questions.map((q, qIdx) => (
                        <div key={qIdx} style={{ marginBottom: '12px' }}>
                          <p style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '6px' }}>{q.question || q.text}</p>
                          <input 
                            type="text"
                            placeholder="Type your answer..."
                            value={quizAnswers[qIdx] || ''}
                            onChange={(e) => handleQuizAnswerChange(qIdx, e.target.value)}
                            style={{ width: '100%', background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#fff', padding: '8px 12px'}}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Mark as Read Button (Reading materials ONLY) */}
                  {isReading && !isAdminOrMentor && (
                    <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button 
                        onClick={() => toggleMarkRead(mod.id)} 
                        style={{ background: isRead ? '#10b981' : '#374151', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        {isRead ? '✓ Material Read (Completed)' : 'Mark Material as Read'}
                      </button>
                      {isRead && (
                        <span style={{ fontSize: '14px', color: '#34d399', fontWeight: '500' }}>
                          Module completed!
                        </span>
                      )}
                    </div>
                  )}

                  {/* Assignment Submission Box (Assignments ONLY) */}
                  {!isReading && !isAdminOrMentor && (
                    <div style={{ background: '#1e293b', padding: '18px', borderRadius: '8px', border: '1px solid #334155', marginTop: '16px' }}>
                      <h5 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#f97316', fontWeight: 'bold' }}>Assignment Submission</h5>
                      <input
                        type="text"
                        placeholder="Paste your link or response here..."
                        value={currentInputValue}
                        onChange={(e) => handleInputChange(mod.id, e.target.value)}
                        style={{ width: '100%', background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#fff', padding: '10px 14px', marginBottom: '10px' }}
                      />
                      <button onClick={() => handleSubmitAssignment(mod.id, currentInputValue)} style={{ background: 'linear-gradient(to right, #f97316, #ec4899)', border: 'none', color: '#fff', fontWeight: 'bold', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>
                        {hasExistingSubmission ? 'Resubmit' : 'Submit Assignment'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p style={{ color: '#6b7280', fontSize: '14px', fontStyle: 'italic', margin: 0 }}>
                  🔒 Complete the previous module above to unlock this content.
                </p>
              )}
            </div>
          );
        })}

        {isLessonComplete && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: '#34d399', fontSize: '18px' }}>🎉 Lesson Completed Successfully!</h4>
              <p style={{ margin: 0, color: '#9ca3af', fontSize: '14px' }}>
                {nextLesson ? `Next up: ${nextLesson.title}` : 'You have finished all lessons in this course!'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {nextLesson && (
                <button 
                  onClick={handleProceedToNextLesson} 
                  style={{ background: '#f97316', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Next Lesson →
                </button>
              )}
              <button onClick={onBack} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Back to Course Menu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}