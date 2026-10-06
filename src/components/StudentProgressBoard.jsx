import { useMemo, useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/storage';
import '../styles.css';

const isSubmissionPassed = (status) => {
  if (!status) return false;
  const normalized = String(status).trim().toLowerCase();
  return ['pass', 'passed', 'approved', 'completed', 'read'].includes(normalized);
};

export default function StudentProgressBoard({ courses = [], users = [], currentUser = null }) {
  const [openMap, setOpenMap] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [feedbackForms, setFeedbackForms] = useState({});

  // Role helpers
  const userRole = String(currentUser?.role || '').trim().toLowerCase();
  const isStudentView = userRole === 'student';
  const isAdminOrMentor = userRole === 'admin' || userRole === 'mentor';

  const loadSubmissions = useCallback(async () => {
    setLoadingSubmissions(true);
    const { data, error } = await supabase
      .from('submissions')
      .select('id, student_id, user_id, module_id, status, submission_url, url, feedback_video_url, feedback_text');

    if (error) {
      console.error('Error loading submissions:', error);
    } else {
      setSubmissions(data || []);
    }
    setLoadingSubmissions(false);
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const studentUsers = useMemo(() => {
    if (!Array.isArray(users)) return [];
    return users.filter((u) => u?.role === 'student' && (u.id || u.studentId || u.email));
  }, [users]);

  const submissionLookup = useMemo(() => {
    const map = new Map();
    submissions.forEach((s) => {
      const studentKeys = [
        s.student_id,
        s.user_id,
        s.studentId
      ].filter(Boolean).map(k => String(k).trim().toLowerCase());

      const modKeys = [
        s.module_id,
        s.moduleId
      ].filter(Boolean).map(k => String(k).trim());

      studentKeys.forEach(sKey => {
        modKeys.forEach(mKey => {
          map.set(`${sKey}_${mKey}`, s);
        });
      });
    });
    return map;
  }, [submissions]);

  const allKeys = useMemo(() => {
    const keys = [];
    courses.forEach((course) => {
      studentUsers.forEach((student) => {
        const studentKey = String(student.id || student.studentId || student.email || '').trim().toLowerCase();
        if (course.id && studentKey) {
          keys.push(`${course.id}_${studentKey}`);
        }
      });
    });
    return keys;
  }, [courses, studentUsers]);

  const areAllExpanded = useMemo(() => {
    if (allKeys.length === 0) return false;
    return allKeys.every((k) => !!openMap[k]);
  }, [allKeys, openMap]);

  const toggleAll = () => {
    const nextState = !areAllExpanded;
    const updated = {};
    allKeys.forEach((k) => {
      updated[k] = nextState;
    });
    setOpenMap(updated);
  };

  const toggleDetails = (courseId, studentKey) => {
    const k = `${courseId}_${String(studentKey).trim().toLowerCase()}`;
    setOpenMap((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const handleFeedbackChange = (submissionId, field, value) => {
    setFeedbackForms((prev) => ({
      ...prev,
      [submissionId]: {
        ...prev[submissionId],
        [field]: value
      }
    }));
  };

  const handleSaveFeedback = async (submissionId) => {
    if (!isAdminOrMentor) {
      alert('Unauthorized: Only admins and mentors can save grades.');
      return;
    }
    const currentSub = submissions.find((s) => s.id === submissionId);
    const form = feedbackForms[submissionId] || {};

    const updatedPayload = {
      status: form.status !== undefined ? form.status : (currentSub?.status || 'pending'),
      feedback_video_url: form.feedback_video_url !== undefined ? form.feedback_video_url : (currentSub?.feedback_video_url || ''),
      feedback_text: form.feedback_text !== undefined ? form.feedback_text : (currentSub?.feedback_text || '')
    };

    const { error } = await supabase
      .from('submissions')
      .update(updatedPayload)
      .eq('id', submissionId);

    if (error) {
      alert('Failed to update submission:' + error.message);
    } else {
      setSubmissions((prev) => 
        prev.map((s) => (s.id === submissionId ? { ...s, ...updatedPayload } : s))
      );
      alert('Feedback & Grade saved successfully!');
    }
  };

  if (!courses || courses.length === 0) return <p>No courses yet.</p>;
  if (studentUsers.length === 0) return <p>No students found.</p>;

  const currentStudentKey = String(currentUser?.id || currentUser?.studentId || currentUser?.email || '').trim().toLowerCase();

  const displayedStudents = isStudentView 
    ? studentUsers.filter(u => String(u.id || u.studentId || u.email || '').trim().toLowerCase() === currentStudentKey)
    : studentUsers;

  return (
    <div className='section-container'>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16
        }}
      >
        <h2 className='pf-title' style={{ margin: 0 }}>
          {isStudentView ? 'My Progress' : 'Student Progress'}
          {isAdminOrMentor} && <span style={{ fontSize: '12px', marginLeft: '8px', opacity: 0.7 }}>(Staff View)</span>
        </h2>
        {!isStudentView && (
          <button
            className='btn-secondary btn-inline'
            type='button'
            onClick={toggleAll}
          >
            {areAllExpanded ? 'Collapse All Details' : 'Expand All Details'}
          </button>
        )}
      </div>

      {loadingSubmissions && <p>Loading student submission data...</p>}

      {courses.map((course) => (
        <div
          key={course.id}
          className='course-box'
          style={{ marginBottom: 16 }}
        >
          <h3 className='pf-title' style={{ marginBottom: 6 }}>
            {course.title}
          </h3>
          <p style={{ marginTop: 0 }}>{course.description}</p>

          <div style={{ display: 'grid', gap: 10 }}>
            {displayedStudents.map((student) => {
              const rawStudentId = student.id || student.studentId || student.email;
              const studentKey = String(rawStudentId).trim().toLowerCase();
              let totalModules = 0;
              let completedModules = 0;
              const totalLessons = (course.lessons || []).length;
              let completedLessons = 0;

              (course.lessons || []).forEach((lesson) => {
                const modules = lesson.modules || [];
                let lessonModulesPassed = 0;

                modules.forEach((mod) => {
                  totalModules++;
                  const sub = submissionLookup.get(`${studentKey}_${String(mod.id).trim()}`);
                  const isReading = mod.type === 'reading' || mod.requires_submission === false || mod.is_reading === true;
                  
                  const isCompleted = isReading 
                    ? (sub ? isSubmissionPassed(sub.status) : true) 
                    : (sub && isSubmissionPassed(sub.status));

                  if (isCompleted) {
                    completedModules++;
                    lessonModulesPassed++;
                  }
                });

                if (modules.length > 0 && lessonModulesPassed === modules.length) {
                  completedLessons++;
                }
              });

              const percent = totalModules > 0
                ? Math.round((completedModules / totalModules) * 100)
                : 0;

              const accordionKey = `${course.id}_${studentKey}`;
              const showDetails = !!openMap[accordionKey];

              return (
                <div
                  key={studentKey}
                  style={{
                    border: '1px solid var(--slate-700)',
                    background: 'rgba(0,0,0,0.15)',
                    borderRadius: 12,
                    padding: 12
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong>
                        {student.firstName || student.name || 'Student'} {student.lastName || ''}
                      </strong>
                      <div style={{ opacity: 0.85, fontSize: 12, marginTop: 2 }}>
                        {student.email || studentKey}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900 }}>
                        {percent}% {percent === 100 ? '🏅' : ''}
                      </div>
                      <div style={{ opacity: 0.85, fontSize: 12 }}>
                        Modules: {completedModules}/{totalModules} • Lessons: {completedLessons}/{totalLessons}
                      </div>
                    </div>
                  </div>

                  <div className='course-progress-bar' style={{ marginTop: 10, width: '100%', background: 'rgba(255,255,255,0.1)', height: '8px', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                    <div
                      className='course-progress-fill'
                      style={{
                        width: `${percent}%`,
                        height: '100%',
                        backgroundColor: percent === 100 ? '#3b82f6' : '#0ea5e9',
                        backgroundImage: percent === 100 ? 'var(--magic-blue, #3b82f6)' : 'var(--sky-blue, #0ea5e9)',
                        transition: 'width 0.3s ease',
                        display: 'block'
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                    <button
                      className='btn-secondary btn-inline'
                      type='button'
                      onClick={() => toggleDetails(course.id, studentKey)}
                    >
                      {showDetails ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>

                  {showDetails && (
                    <div
                      style={{
                        marginTop: 12,
                        borderTop: '1px solid var(--slate-700)',
                        paddingTop: 12,
                        display: 'grid',
                        gap: 12
                      }}
                    >
                      {(course.lessons || []).length === 0 ? (
                        <p style={{ margin: 0, opacity: 0.9 }}>No lessons yet.</p>
                      ) : (
                        course.lessons.map((lesson) => {
                          const modules = lesson.modules || [];

                          return (
                            <div
                              key={lesson.id}
                              style={{
                                border: '1px solid var(--slate-700)',
                                borderRadius: 8,
                                padding: 10,
                                background: 'rgba(0,0,0,0.20)'
                              }}
                            >
                              <h4 style={{ margin: '0 0 8px 0', color: 'var(--sky-blue)' }}>
                                {lesson.title}
                              </h4>

                              {modules.length === 0 ? (
                                <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>
                                  No modules in this lesson.
                                </p>
                              ) : (
                                modules.map((mod) => {
                                  const sub = submissionLookup.get(`${studentKey}_${String(mod.id).trim()}`);
                                  const isReading = mod.type === 'reading' || mod.requires_submission === false || mod.is_reading === true;
                                  const isPassed = isSubmissionPassed(sub?.status);

                                  let displayStatus = 'Not Submitted';
                                  let statusColor = '#ff9800';

                                  if (isReading) {
                                    displayStatus = 'Completed';
                                    statusColor = '#4caf50';
                                  } else if (sub) {
                                    if (isPassed) {
                                      displayStatus = 'Passed';
                                      statusColor = '#4caf50';
                                    } else if (String(sub.status).toLowerCase() === 'fail') {
                                      displayStatus = 'Fail';
                                      statusColor = '#f44336';
                                    } else {
                                      displayStatus = sub.status || 'Pending';
                                      statusColor = '#ff9800';
                                    }
                                  }

                                  return (
                                    <div
                                      key={mod.id}
                                      style={{
                                        border: '1px solid var(--slate-700)',
                                        borderRadius: 6,
                                        padding: 8,
                                        marginTop: 6,
                                        background: 'rgba(0,0,0,0.15)'
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          marginBottom: 6
                                        }}
                                      >
                                        <strong>{mod.title || 'Module Item'}</strong>
                                        <span
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase',
                                            color: statusColor
                                          }}
                                        >
                                          Status: {displayStatus}
                                        </span>
                                      </div>

                                      {isReading ? (
                                        <p style={{ margin: 0, fontSize: 11, opacity: 0.8 }}>
                                          Reading material (No assignment submission required).
                                        </p>
                                      ) : sub ? (
                                        <div style={{ fontSize: 12, display: 'grid', gap: 6 }}>
                                          {(sub.submission_url || sub.url) && (
                                            <div>
                                              <strong>Submission Link: </strong>
                                              <a
                                                href={sub.submission_url || sub.url}
                                                target='_blank'
                                                rel='noreferrer'
                                                style={{ color: 'var(--sky-blue)' }}
                                              >
                                                {sub.submission_url || sub.url}
                                              </a>
                                            </div>
                                          )}

                                          <div
                                            style={{
                                              borderTop: '1px dashed var(--slate-700)',
                                              paddingTop: 6,
                                              marginTop: 4
                                            }}
                                          >
                                            {isPassed ? (
                                              <div
                                                style={{
                                                  background: 'rgba(16, 185, 129, 0.1)',
                                                  border: '1px solid #10b981',
                                                  padding: '8px',
                                                  borderRadius: '6px'
                                                }}
                                              >
                                                <p style={{ margin: '0 0 4px 0', color: '#34d399', fontWeight: 'bold' }}>
                                                  ✓ Approved & Passed
                                                </p>
                                                {sub.feedback_text && (
                                                  <p style={{ margin: '0 0 4px 0', color: '#e5e7eb' }}>
                                                    <strong>Written Feedback:</strong> {sub.feedback_text}
                                                  </p>
                                                )}
                                                {sub.feedback_video_url && (
                                                  <p style={{ margin: 0 }}>
                                                    <a
                                                      href={sub.feedback_video_url}
                                                      target='_blank'
                                                      rel='noreferrer'
                                                      style={{ color: '#60a5fa' }}
                                                    >
                                                      🎥 View Video Feedback
                                                    </a>
                                                  </p>
                                                )}
                                              </div>
                                            ) : isStudentView ? (
                                              <p style={{ margin: 0, opacity: 0.8 }}>
                                                Awaiting mentor review.
                                              </p>
                                            ) : (
                                              <div>
                                                <div
                                                  style={{
                                                    display: 'flex',
                                                    gap: 10,
                                                    alignItems: 'center',
                                                    marginBottom: 6
                                                  }}
                                                >
                                                  <label style={{ fontSize: 12 }}>Grade:</label>
                                                  <select
                                                    value={
                                                      feedbackForms[sub.id]?.status ??
                                                      sub.status ??
                                                      'pending'
                                                    }
                                                    onChange={(e) =>
                                                      handleFeedbackChange(sub.id, 'status', e.target.value)
                                                    }
                                                    style={{ padding: '2px 6px' }}
                                                  >
                                                    <option value='pending'>Pending</option>
                                                    <option value='pass'>Pass</option>
                                                    <option value='fail'>Fail</option>
                                                  </select>
                                                </div>

                                                <input
                                                  type='text'
                                                  placeholder='YouTube / Video Feedback Link'
                                                  value={
                                                    feedbackForms[sub.id]?.feedback_video_url ??
                                                    sub.feedback_video_url ??
                                                    ''
                                                  }
                                                  onChange={(e) =>
                                                    handleFeedbackChange(
                                                      sub.id,
                                                      'feedback_video_url',
                                                      e.target.value
                                                    )
                                                  }
                                                  style={{
                                                    width: '100%',
                                                    padding: '4px',
                                                    marginBottom: 6,
                                                    fontSize: 12
                                                  }}
                                                />

                                                <textarea
                                                  placeholder='Written mentor feedback...'
                                                  value={
                                                    feedbackForms[sub.id]?.feedback_text ??
                                                    sub.feedback_text ??
                                                    ''
                                                  }
                                                  onChange={(e) =>
                                                    handleFeedbackChange(
                                                      sub.id,
                                                      'feedback_text',
                                                      e.target.value
                                                    )
                                                  }
                                                  style={{
                                                    width: '100%',
                                                    padding: '4px',
                                                    minHeight: '40px',
                                                    marginBottom: 6,
                                                    fontSize: 12
                                                  }}
                                                />

                                                <button
                                                  type='button'
                                                  className='btn-secondary btn-inline'
                                                  onClick={() => handleSaveFeedback(sub.id)}
                                                  style={{ fontSize: 12, padding: '4px 8px' }}
                                                >
                                                  Save Grade & Feedback
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <p style={{ margin: 0, fontSize: 11, opacity: 0.6 }}>
                                          No submission found for this module.
                                        </p>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}