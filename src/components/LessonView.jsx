import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { isStatusFailing, getEarnedCertificates, isFreshCertificate, stampCertificateDate, lessonCertificateId } from '../utils/progress';
import { getModuleRepoUrl, getModuleQuizItems } from '../utils/moduleTypes';
import { getAcademySettings, getDisplayName } from '../utils/academySettings';
import { buildLessonSteps, useLessonProgress } from '../hooks/useLessonProgress';
import { useLessonSubmissions } from '../hooks/useLessonSubmissions';
import LessonHeader from './LessonHeader';
import LessonStepFrame from './LessonStepFrame';
import LessonFinishPanel from './LessonFinishPanel';
import ReadingStep from './ReadingStep';
import VideoStep from './VideoStep';
import AssignmentStep from './AssignmentStep';
import QuizStep from './QuizStep';

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
  } catch {
    // not a valid URL
  }
  return url;
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
  const [certificateStamp, setCertificateStamp] = useState(0);
  const studentId = currentUser?.id || currentUser?.email || '';
  const activeCourseId = courseId || course?.id;
  const activeLessonId = lessonId || currentLesson?.id;

  const {
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
  } = useLessonProgress({
    currentLesson,
    currentUser,
    course,
    courseId,
    studentId,
    resumeStepIndex,
    skipAutoResume,
    setCourses
  });

  const modules = useMemo(() => currentLesson?.modules || [], [currentLesson]);
  const lessonSteps = useMemo(() => buildLessonSteps(modules), [modules]);

  const {
    submissionInputs,
    activeSubmissions,
    submissionLookup,
    hasPassedAssignment,
    handleInputChange,
    handleSubmitAssignment
  } = useLessonSubmissions({
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
  });

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

  const isStepComplete = useCallback(
    (step) => {
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
    [readModules, watchedVideos, quizResults, hasPassedAssignment]
  );

  const isLessonComplete = useMemo(() => {
    if (lessonSteps.length === 0) return false;
    return lessonSteps.every((step) => isStepComplete(step));
  }, [lessonSteps, isStepComplete]);

  const earnedCertificates = useMemo(() => {
    void readModules;
    void watchedVideos;
    void quizResults;
    void certificateStamp;
    return getEarnedCertificates(course, currentUser, activeSubmissions);
  }, [course, currentUser, activeSubmissions, readModules, watchedVideos, quizResults, certificateStamp]);

  const lessonCert = useMemo(() => {
    if (!isLessonComplete || !currentLesson) return null;
    const certId = lessonCertificateId(course, currentLesson);
    const stored = earnedCertificates.lessons.find((cert) => cert.id === certId);
    if (!stored || !isFreshCertificate(stored.earnedOn, courseResetAt)) return null;
    return stored;
  }, [course, currentLesson, earnedCertificates.lessons, isLessonComplete, courseResetAt]);

  const courseCert = earnedCertificates.course && isFreshCertificate(earnedCertificates.course.earnedOn, courseResetAt)
    ? earnedCertificates.course
    : null;

  useEffect(() => {
    if (!progressReady) return;
    if (!isLessonComplete) allowCertificateAwardRef.current = true;
  }, [progressReady, isLessonComplete, allowCertificateAwardRef]);

  useEffect(() => {
    if (!progressReady || !allowCertificateAwardRef.current || !isLessonComplete || !currentLesson || !currentUser) return;
    stampCertificateDate(currentUser, lessonCertificateId(course, currentLesson));
    const earned = getEarnedCertificates(course, currentUser, activeSubmissions);
    if (earned.course) stampCertificateDate(currentUser, earned.course.id);
    // The date is stored outside React. This updates the screen so the certificate can render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCertificateStamp(Date.now());
  }, [progressReady, isLessonComplete, currentLesson, currentUser, course, activeSubmissions, allowCertificateAwardRef]);

  useEffect(() => {
    if (isLessonComplete) setFinishNotice('');
  }, [isLessonComplete, setFinishNotice]);

  useEffect(() => {
    if (!finishScrollTick) return;
    finishPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [finishScrollTick, finishPanelRef]);

  const handleProceedToNextLesson = () => {
    if (!nextLesson || !isLessonComplete) return;
    setCurrentLesson(nextLesson);
    setVisibleStepIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof onSelectLesson === 'function') {
      onSelectLesson(nextLesson);
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
      <LessonHeader
        courseTitle={course.title}
        lessonTitle={currentLesson.title}
        stepNumber={Math.min(visibleStepIndex + 1, lessonSteps.length)}
        stepCount={lessonSteps.length}
        completedCount={lessonSteps.filter((step) => isStepComplete(step)).length}
        onBack={onBack}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {lessonSteps[visibleStepIndex] && (() => {
          const step = lessonSteps[visibleStepIndex];
          const mod = step.mod;
          const modIdStr = String(mod.id);
          const isRead = !!readModules[modIdStr];
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
              const stillOpen = lessonSteps.filter((item) => !isStepComplete(item));
              const labels = stillOpen.map(
                (item) => `${cleanMarkdownText(item.mod.title) || 'Portion'} (${item.kind})`
              );
              setFinishNotice(
                labels.length
                  ? `Finish is waiting on: ${labels.join(', ')}`
                  : 'This lesson still has unfinished portions.'
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
            <LessonStepFrame
              key={`${modIdStr}-${step.kind}`}
              title={cleanMarkdownText(mod.title) || 'Module'}
              kind={step.kind}
              done={stepDone}
              canGoBack={canBackSameModule}
              isLast={visibleStepIndex >= lessonSteps.length - 1}
              lessonComplete={isLessonComplete}
              onBack={handleBackStep}
              onContinue={handleContinue}
            >
              {step.kind === 'reading' && (
                <ReadingStep
                  markdown={moduleMarkdown}
                  isRead={isRead}
                  onToggleRead={() => toggleMarkRead(mod.id)}
                />
              )}
              {step.kind === 'video' && (
                <VideoStep
                  embedUrl={embedUrl}
                  isWatched={!!watchedVideos[modIdStr]}
                  onToggleWatched={() => toggleMarkWatched(mod.id)}
                />
              )}
              {step.kind === 'assignment' && (
                <AssignmentStep
                  embedUrl={embedUrl}
                  repoUrl={repoUrl}
                  prompt={assignmentPrompt}
                  linkValue={currentInputValue}
                  hasSubmission={hasExistingSubmission}
                  passed={hasPassedAssignment(mod)}
                  needsRevision={isStatusFailing(submissionLookup.get(modIdStr)?.status)}
                  onLinkChange={(value) => handleInputChange(mod.id, value)}
                  onSubmit={() => handleSubmitAssignment(mod.id, currentInputValue)}
                />
              )}
              {step.kind === 'quiz' && (
                <QuizStep
                  moduleId={modIdStr}
                  questions={quizItems}
                  answers={quizAnswers}
                  result={quizResult}
                  onAnswer={handleQuizAnswerChange}
                  onCheck={() => handleCheckQuiz(modIdStr, quizItems)}
                />
              )}
            </LessonStepFrame>
          );
        })()}

        <LessonFinishPanel
          finishNotice={finishNotice}
          finishPanelRef={finishPanelRef}
          lessonCert={lessonCert}
          courseCert={courseCert}
          lessonCertTitle={lessonCert ? cleanMarkdownText(lessonCert.title) : ''}
          studentName={getDisplayName(currentUser)}
          academyName={getAcademySettings().academyName}
          nextLessonTitle={nextLesson ? nextLesson.title : ''}
          onNextLesson={handleProceedToNextLesson}
          onBack={onBack}
        />
      </div>
    </div>
  );
}
