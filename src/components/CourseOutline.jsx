import React, { useEffect, useState } from 'react';
import { getCourseOutline } from '../utils/progress';
import { getLessonFlashcards } from '../utils/moduleTypes';
import { fetchAllSubmissions } from '../utils/storage';
import RestartCourseButton from './RestartCourseButton';

const KIND_LABELS = {
  reading: 'Reading',
  video: 'Video',
  quiz: 'Quiz',
  assignment: 'Assignment'
};

export default function CourseOutline({
  course,
  currentUser,
  users = [],
  isStaff = false,
  onBack,
  onOpenItem,
  onOpenFlashcards,
  refreshKey = 0
}) {
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchAllSubmissions()
      .then((rows) => {
        if (!cancelled) setSubmissions(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setSubmissions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!course) {
    return (
      <div style={{ color: '#fff', padding: '20px' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: '#1f2937',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '15px'
          }}
        >
          ← Back to Courses
        </button>
        <p>No course selected.</p>
      </div>
    );
  }

  const outline = getCourseOutline(course, currentUser, submissions);
  const lessons = isStaff
    ? outline.map((entry) => ({
        ...entry,
        unlocked: true,
        steps: entry.steps.map((step) => ({ ...step, unlocked: true }))
      }))
    : outline;

  let continueTarget = null;
  for (const entry of lessons) {
    const incomplete = entry.steps.find((step) => !step.complete);
    if (incomplete) {
      continueTarget = {
        lessonId: entry.lesson.id,
        stepIndex: incomplete.stepIndex
      };
      break;
    }
  }

  if (!continueTarget && lessons.length > 0) {
    const lastLesson = lessons[lessons.length - 1];
    const lastStep = lastLesson.steps[lastLesson.steps.length - 1];
    if (lastStep) {
      continueTarget = {
        lessonId: lastLesson.lesson.id,
        stepIndex: lastStep.stepIndex
      };
    }
  }

  const handleContinue = () => {
    if (!continueTarget) return;
    onOpenItem(continueTarget);
  };

  const handleOpenStep = (lessonId, step, event) => {
    if (event) event.stopPropagation();
    if (!step.unlocked && !step.complete) {
      alert('Complete the previous portions of this course first.');
      return;
    }
    onOpenItem({ lessonId, stepIndex: step.stepIndex });
  };

  const handleOpenLesson = (entry) => {
    if (!entry.unlocked && !entry.complete) {
      alert('Complete the previous lesson first.');
      return;
    }
    const firstIncomplete = entry.steps.find((step) => !step.complete);
    const stepIndex = firstIncomplete ? firstIncomplete.stepIndex : 0;
    onOpenItem({ lessonId: entry.lesson.id, stepIndex });
  };

  return (
    <div style={{ color: '#fff', padding: '10px' }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: '#1f2937',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '6px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        ← Back to Courses
      </button>

      <h2 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{course.title}</h2>
      <p style={{ color: '#9ca3af', margin: '0 0 16px 0' }}>
        {course.description ||
          'Choose a lesson or portion to open. Locked items need earlier work finished first.'}
      </p>

      <RestartCourseButton
        course={course}
        currentUser={currentUser}
        users={users}
        refreshKey={refreshKey}
      />

      {continueTarget && (
        <button
          type="button"
          onClick={handleContinue}
          style={{
            background: 'linear-gradient(to right, #f97316, #ec4899)',
            border: 'none',
            color: '#fff',
            fontWeight: 'bold',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '24px'
          }}
        >
          Continue where I left off
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {lessons.map((entry, lessonIndex) => (
          <div
            key={entry.lesson.id || lessonIndex}
            style={{
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: '12px',
              padding: '18px 20px',
              opacity: entry.unlocked ? 1 : 0.55
            }}
          >
            <button
              type="button"
              onClick={() => handleOpenLesson(entry)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                padding: 0,
                cursor: entry.unlocked || entry.complete ? 'pointer' : 'not-allowed',
                textAlign: 'left',
                width: '100%'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <h3 style={{ margin: 0, fontSize: '18px' }}>
                  Lesson {lessonIndex + 1}: {entry.lesson.title || 'Untitled lesson'}
                </h3>
                <span
                  style={{
                    fontSize: '12px',
                    color: entry.complete ? '#34d399' : entry.unlocked ? '#fb923c' : '#9ca3af'
                  }}
                >
                  {entry.complete ? 'Completed' : entry.unlocked ? 'Available' : 'Locked'}
                </span>
              </div>
            </button>

            <div
              style={{
                marginTop: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {entry.steps.map((step) => (
                <button
                  key={`${step.mod.id}-${step.kind}-${step.stepIndex}`}
                  type="button"
                  onClick={(event) => handleOpenStep(entry.lesson.id, step, event)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#e5e7eb',
                    cursor: step.unlocked || step.complete ? 'pointer' : 'not-allowed',
                    textAlign: 'left'
                  }}
                >
                  <span>
                    {(step.mod.title || 'Module') + ' — ' + (KIND_LABELS[step.kind] || step.kind)}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: step.complete ? '#34d399' : step.unlocked ? '#fb923c' : '#9ca3af'
                    }}
                  >
                    {step.complete ? 'Done' : step.unlocked ? 'Open' : 'Locked'}
                  </span>
                </button>
              ))}

              <button
                type='button'
                onClick={() => {
                  if (!isStaff && !entry.unlocked && !entry.complete) {
                    alert('Complete the previous lesson first.');
                    return;
                  }
                  onOpenFlashcards({ lessonId: entry.lesson.id });
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#0f172a',
                  border: '1px dashed #4338ca',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: '#e5e7eb',
                  cursor: isStaff || entry.unlocked || entry.complete ? 'pointer' : 'not-allowed',
                  textAlign: 'left'
                }}
              >
                <span>
                  Flashcards
                  <span style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                    {getLessonFlashcards(entry.lesson).length} course card{getLessonFlashcards(entry.lesson).length === 1 ? '' : 's'}
                    {' · '}
                    add your own on the next screen. Does not count toward progress.
                  </span>
                </span>
                <span style={{ fontSize: '12px', color: '#c7d2fe'}}>
                  Practice
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
