import React, { useState } from 'react';
import { gradeSubmission } from '../utils/storage';
import { isStatusPassing, isStatusFailing } from '../utils/progress';
import { requiresAssignmentSubmission } from '../utils/moduleTypes';

export default function Dashboard({ courses, setCourses, currentUser, submissions = [] }) {
  const [activeTab, setActiveTab] = useState('reviewed');
  const [hidePassed, setHidePassed] = useState(false);
  const [videoInputs, setVideoInputs] = useState({});
  const [textInputs, setTextInputs] = useState({});
  const [isUpdating, setIsUpdating] = useState({});

  const role = (currentUser?.role || 'student').toLowerCase();
  const isAdmin = role === 'admin';
  const isMentor = role === 'mentor';
  const isStaff = isAdmin || isMentor;
  const isStudent = role === 'student';

  const userEmail = (currentUser?.email || '').toLowerCase();
  const userId = currentUser?.id ? String(currentUser.id).toLowerCase() : '';

  // 1. EXTRACT ALL VALID SUBMISSIONS & FILTER ORPHANS / "NEW MODULE" GHOST CARDS
  const allSubmissions = [];

  if (Array.isArray(submissions) && submissions.length > 0) {
    submissions.forEach((s) => {
      const subStudent = String(s.studentId || s.student_id || s.studentEmail || '').toLowerCase();
      if (isStudent && subStudent !== userEmail && subStudent !== userId) {
        return;
      }

      let courseTitle = s.courseTitle || '';
      let moduleTitle = s.moduleTitle || '';
      let lessonId = s.lessonId || s.lesson_id;
      let isValidCourse = false;

      (courses || []).forEach((c) => {
        if (String(c.id) === String(s.courseId || s.course_id)) {
          isValidCourse = true;
          courseTitle = c.title || courseTitle;
          (c.lessons || []).forEach((l) => {
            (l.modules || []).forEach((m) => {
              if (String(m.id) === String(s.moduleId || s.module_id)) {
                moduleTitle = m.title || m.name || moduleTitle;
                lessonId = l.id;
              }
            });
          });
        }
      });

      // Drop orphaned entries or literal "New Module" artifacts not tied to active courses
      if (!isValidCourse || !courseTitle || moduleTitle === 'New Module' || !s.courseId) {
        return;
      }

      allSubmissions.push({
        submission: s,
        courseId: s.courseId || s.course_id,
        courseTitle,
        lessonId,
        moduleId: s.moduleId || s.module_id,
        moduleTitle,
      });
    });
  } else {
    (courses || []).forEach((course) => {
      if (!course || !course.id) return;
      (course.lessons || []).forEach((lesson) => {
        (lesson.modules || []).forEach((mod) => {
          // Prevent ghost/orphaned "New Module" entries without real IDs or assignment data
          const modTitle = mod.title || mod.name || '';
          if (!mod.id || modTitle === 'New Module' || !requiresAssignmentSubmission(mod)) return;

          const assignment = mod.assignment;
          const subs = assignment.submissions || [];

          subs.forEach((s, subIdx) => {
            const subStudent = String(s.student || s.studentEmail || s.studentId || '').toLowerCase();
            if (isStudent && subStudent !== userEmail && subStudent !== userId) {
              return;
            }

            const uniqueSubId = s.id || `${course.id}-${lesson.id}-${mod.id}-${subStudent || subIdx}`;

            allSubmissions.push({
              submission: { ...s, id: uniqueSubId },
              courseId: course.id,
              courseTitle: course.title || 'Course',
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              moduleId: mod.id,
              moduleTitle: modTitle || 'Assignment',
            });
          });
        });
      });
    });
  }

  const pendingCount = allSubmissions.filter(
    (item) => (item.submission.status || 'pending') === 'pending'
  ).length;

  const reviewedCount = allSubmissions.filter(
    (item) => (item.submission.status || 'pending') !== 'pending'
  ).length;

  const displayedItems = allSubmissions.filter((item) => {
    const st = item.submission.status || 'pending';
    let matchesTab = false;
    if (activeTab === 'pending') {
      matchesTab = st === 'pending';
    } else {
      matchesTab = isStatusPassing(st) || isStatusFailing(st);
    }

    if (!matchesTab) return false;

    // Archive / Collapse filter for passed submissions
    if (hidePassed && isStatusPassing(st)) {
      return false;
    }

    return true;
  });

  // 2. GRADE SUBMISSION AND PERSIST TO SUPABASE & LOCAL STATE
  const handleGrade = async (targetCourseId, targetLessonId, targetModuleId, targetSubmission, newStatus) => {
    const subId = targetSubmission.id;
    const feedbackText =
      textInputs[subId] !== undefined
        ? textInputs[subId]
        : targetSubmission.feedbackText || targetSubmission.feedback || targetSubmission.feedback_text || '';
    const videoUrl =
      videoInputs[subId] !== undefined
        ? videoInputs[subId]
        : targetSubmission.feedbackVideoUrl || targetSubmission.videoFeedbackUrl || targetSubmission.feedback_video_url || '';

    setIsUpdating((prev) => ({ ...prev, [subId]: true }));

    try {
      if (subId && typeof gradeSubmission === 'function') {
        await gradeSubmission(subId, newStatus, feedbackText, videoUrl);
      }

      if (typeof setCourses === 'function') {
        setCourses((prevCourses) => {
          const updated = (prevCourses || []).map((c) => {
            if (String(c.id) !== String(targetCourseId)) return c;
            return {
              ...c,
              lessons: (c.lessons || []).map((l) => {
                if (targetLessonId && String(l.id) !== String(targetLessonId)) return l;
                return {
                  ...l,
                  modules: (l.modules || []).map((m) => {
                    if (String(m.id) !== String(targetModuleId)) return m;

                    const targetAssignment = m.assignment || m;
                    const existingSubs = targetAssignment.submissions || [];

                    const updatedSubs = existingSubs.map((s, idx) => {
                      const currentSubUniqueId = s.id || `${c.id}-${l.id}-${m.id}-${s.student || s.studentEmail || idx}`;
                      if (
                        currentSubUniqueId === subId ||
                        s.id === subId ||
                        (targetSubmission.student && s.student === targetSubmission.student)
                      ) {
                        return {
                          ...s,
                          id: currentSubUniqueId,
                          status: newStatus,
                          feedbackText: feedbackText,
                          feedback_text: feedbackText,
                          feedback: feedbackText,
                          feedbackVideoUrl: videoUrl,
                          feedback_video_url: videoUrl,
                          reviewedAt: Date.now(),
                          reviewedBy: userEmail,
                        };
                      }
                      return s;
                    });

                    const isPassed = isStatusPassing(newStatus);

                    if (m.assignment) {
                      return {
                        ...m,
                        completed: isPassed,
                        isCompleted: isPassed,
                        status: newStatus,
                        assignment: { ...m.assignment, submissions: updatedSubs },
                      };
                    }

                    return {
                      ...m,
                      completed: isPassed,
                      isCompleted: isPassed,
                      status: newStatus,
                      submissions: updatedSubs,
                    };
                  }),
                };
              }),
            };
          });

          try {
            localStorage.setItem('app_courses', JSON.stringify(updated));
          } catch (e) {
            console.error('Failed to sync grade to localStorage:', e);
          }
          return updated;
        });
      }

      alert(`Submission evaluated as: ${isStatusPassing(newStatus) ? 'Passed' : 'Needs Revision'}`);
    } catch (err) {
      console.error('Grading failed:', err);
      alert('Failed to update grade. Please try again.');
    } finally {
      setIsUpdating((prev) => ({ ...prev, [subId]: false }));
    }
  };

  return (
    <div style={{ padding: '24px', color: '#fff', background: '#0b0f19', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>Dashboard</h1>
      <p style={{ color: '#9ca3af', marginTop: '4px' }}>
        Welcome back, <strong style={{ color: '#fff' }}>{userEmail}</strong>
      </p>

      {/* METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', margin: '24px 0' }}>
        <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '20px', borderRadius: '12px' }}>
          <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'bold', textTransform: 'uppercase' }}>
            Total Submissions
          </span>
          <div style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '8px' }}>{allSubmissions.length}</div>
        </div>
        <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '20px', borderRadius: '12px' }}>
          <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'bold', textTransform: 'uppercase' }}>
            Pending Review
          </span>
          <div style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '8px', color: '#f59e0b' }}>
            {pendingCount}
          </div>
        </div>
      </div>

      {/* TABS & ARCHIVE TOGGLE BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
            {isStudent ? 'My Submissions & Feedback' : 'Student Submissions'}
          </h3>
          {isStaff && activeTab === 'reviewed' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#9ca3af', cursor: 'pointer', background: '#111827', padding: '6px 12px', borderRadius: '8px', border: '1px solid #1f2937' }}>
              <input
                type="checkbox"
                checked={hidePassed}
                onChange={(e) => setHidePassed(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Archive / Hide Passed Items
            </label>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', background: '#111827', padding: '4px', borderRadius: '8px', border: '1px solid #1f2937' }}>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            style={{
              background: activeTab === 'pending' ? '#2563eb' : 'transparent',
              color: '#fff',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
            }}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reviewed')}
            style={{
              background: activeTab === 'reviewed' ? '#2563eb' : 'transparent',
              color: '#fff',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
            }}
          >
            Reviewed ({reviewedCount})
          </button>
        </div>
      </div>

      {/* SUBMISSION CARDS */}
      {displayedItems.length === 0 ? (
        <div style={{ background: '#111827', padding: '40px', borderRadius: '12px', textAlign: 'center', border: '1px solid #1f2937', color: '#9ca3af' }}>
          No {activeTab} submissions found {hidePassed ? '(passed items are hidden)' : ''}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {displayedItems.map(({ submission, courseId, courseTitle, lessonId, lessonTitle, moduleId, moduleTitle }) => {
            const subId = submission.id;
            const currentStatus = submission.status || 'pending';

            const isPassed = isStatusPassing(currentStatus);
            const isFailed = isStatusFailing(currentStatus);
            const isSubUpdating = !!isUpdating[subId];

            const subUrl = submission.url || submission.submission_url || submission.repoUrl || submission.link;
            const feedbackTxt = submission.feedbackText || submission.feedback_text || submission.feedback || '';
            const feedbackVid = submission.feedbackVideoUrl || submission.feedback_video_url || submission.videoFeedbackUrl || '';

            return (
              <div key={subId} style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
                      {courseTitle} — <span style={{ color: '#38bdf8' }}>{moduleTitle || lessonTitle}</span>
                    </h4>
                    <p style={{ fontSize: '13px', color: '#9ca3af', margin: '4px 0 0 0' }}>
                      Submitted by: <strong>{submission.student || submission.studentEmail || submission.student_id || submission.studentId}</strong>
                    </p>
                  </div>

                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 'bold',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      textTransform: 'uppercase',
                      background: isPassed
                        ? 'rgba(34, 197, 94, 0.2)'
                        : isFailed
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(245, 158, 11, 0.2)',
                      color: isPassed ? '#4ade80' : isFailed ? '#f87171' : '#fbbf24',
                      border: `1px solid ${isPassed ? '#22c55e' : isFailed ? '#ef4444' : '#f59e0b'}`,
                    }}
                  >
                    {isPassed ? '✓ PASSED' : isFailed ? '✕ NEEDS REVISION' : 'PENDING REVIEW'}
                  </span>
                </div>

                <div style={{ background: '#030712', padding: '12px', borderRadius: '8px', margin: '16px 0', border: '1px solid #1f2937' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'bold', marginBottom: '4px' }}>
                    SUBMITTED CONTENT / LINK
                  </div>
                  <a
                    href={subUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#38bdf8', textDecoration: 'underline', fontSize: '14px', wordBreak: 'break-all' }}
                  >
                    {subUrl || 'View Submission Link'}
                  </a>
                </div>

                {isStaff ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', background: '#1a2234', padding: '16px', borderRadius: '8px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>Written Feedback:</label>
                      <textarea
                        rows={3}
                        placeholder="Type mentor feedback here..."
                        value={textInputs[subId] !== undefined ? textInputs[subId] : feedbackTxt}
                        onChange={(e) => setTextInputs({ ...textInputs, [subId]: e.target.value })}
                        style={{ width: '100%', background: '#0b0f19', border: '1px solid #374151', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '14px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>YouTube Video Feedback Link:</label>
                      <input
                        type="text"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={videoInputs[subId] !== undefined ? videoInputs[subId] : feedbackVid}
                        onChange={(e) => setVideoInputs({ ...videoInputs, [subId]: e.target.value })}
                        style={{ width: '100%', background: '#0b0f19', border: '1px solid #374151', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '14px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button
                        type="button"
                        disabled={isSubUpdating}
                        onClick={() => handleGrade(courseId, lessonId, moduleId, submission, 'fail')}
                        style={{
                          background: isSubUpdating ? '#7f1d1d' : '#dc2626',
                          color: '#fff',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          cursor: isSubUpdating ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isSubUpdating ? 'Saving...' : '✕ Mark as Fail (Needs Revision)'}
                      </button>
                      <button
                        type="button"
                        disabled={isSubUpdating}
                        onClick={() => handleGrade(courseId, lessonId, moduleId, submission, 'pass')}
                        style={{
                          background: isSubUpdating ? '#14532d' : '#16a34a',
                          color: '#fff',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          cursor: isSubUpdating ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isSubUpdating ? 'Saving...' : '✓ Mark as Pass (Approve)'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {isFailed && (
                      <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '6px', color: '#fca5a5', fontSize: '13px', fontWeight: '500' }}>
                        ⚠️ This submission requires revisions. Please review mentor feedback below and resubmit your updated repository link in the module page.
                      </div>
                    )}

                    {(feedbackTxt || feedbackVid) && (
                      <div style={{ background: '#064e3b', border: '1px solid #059669', padding: '14px', borderRadius: '8px', color: '#ecfdf5', marginTop: '8px' }}>
                        <strong style={{ display: 'block', marginBottom: '4px' }}>Mentor Feedback:</strong>
                        <p style={{ margin: 0, fontSize: '14px' }}>{feedbackTxt}</p>

                        {feedbackVid && (
                          <div style={{ marginTop: '10px' }}>
                            <a href={feedbackVid} target="_blank" rel="noreferrer" style={{ color: '#6ee7b7', fontWeight: 'bold', textDecoration: 'underline' }}>
                              📺 Watch Video Feedback
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}