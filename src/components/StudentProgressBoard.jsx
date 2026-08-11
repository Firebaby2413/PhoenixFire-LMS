import { useMemo, useState } from 'react';
import {
  calculateCourseProgress,
  calculateCourseProgressDetailed,
  isModuleApprovedByStudent,
  isModuleCompletedByStudent
} from '../utils/progress';
import '../styles.css';

function getStudentKey(user) {
  return user?.studentId ?? user?.email ?? user?.username ?? null;
}

export default function StudentProgressBoard({ courses, users }) {
  const [openMap, setOpenMap] = useState({}); // { [courseId|studentKey]: true/false }

  const studentUsers = useMemo(() => {
    return Array.isArray(users)
      ? users.filter((u) => u?.role === 'student')
      : [];
  }, [users]);

  // Compute all active student key + course combinations
  const allKeys = useMemo(() => {
    if (!courses || !studentUsers.length) return [];
    const keys = [];
    courses.forEach((course) => {
      studentUsers.forEach((student) => {
        const studentKey = getStudentKey(student);
        if (studentKey) {
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

  function toggleAll() {
    const nextState = !areAllExpanded;
    const updated = {};
    allKeys.forEach((k) => {
      updated[k] = nextState;
    });
    setOpenMap(updated);
  }

  if (!courses || courses.length === 0) {
    return <p>No courses yet.</p>;
  }

  if (studentUsers.length === 0) {
    return <p>No students found.</p>;
  }

  function toggleDetails(courseId, studentKey) {
    const k = `${courseId}_${studentKey || 'missing'}`;
    setOpenMap((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  function isOpen(courseId, studentKey) {
    const k = `${courseId}_${studentKey || 'missing'}`;
    return !!openMap[k];
  }

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
          Student Progress (Mentor/Admin)
        </h2>
        <button
          className='btn-secondary btn-inline'
          type='button'
          onClick={toggleAll}
        >
          {areAllExpanded ? 'Collapse All Details' : 'Expand All Details'}
        </button>
      </div>

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
            {studentUsers.map((student) => {
              const studentKey = getStudentKey(student);

              const detailed = studentKey
                ? calculateCourseProgressDetailed(course, studentKey)
                : {
                    totalLessons: 0,
                    completedLessons: 0,
                    totalModules: 0,
                    completedModules: 0,
                    percent: 0
                  };

              const percent = studentKey
                ? calculateCourseProgress(course, studentKey)
                : 0;

              const showDetails = isOpen(course.id, studentKey);

              return (
                <div
                  key={student.id || student.email || student.username}
                  style={{
                    border: '1px solid var(--slate-700)',
                    background: 'rgba(0,0,0,0.15)',
                    borderRadius: 12,
                    padding: 12
                  }}
                >
                  {/* HEADER ROW */}
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
                        {student.firstName} {student.lastName}
                      </strong>
                      <div
                        style={{ opacity: 0.85, fontSize: 12, marginTop: 2 }}
                      >
                        {studentKey || '(missing student key)'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900 }}>
                        {percent}% {percent === 100 ? '🏅' : ''}
                      </div>
                      <div style={{ opacity: 0.85, fontSize: 12 }}>
                        Modules: {detailed.completedModules}/
                        {detailed.totalModules} {' \u2022 '}
                        Lessons: {detailed.completedLessons}/
                        {detailed.totalLessons}
                      </div>
                    </div>
                  </div>

                  {/* PROGRESS BAR */}
                  <div
                    className='course-progress-bar'
                    style={{ marginTop: 10 }}
                  >
                    <div
                      className='course-progress-fill'
                      style={{
                        width: `${percent}%`,
                        background:
                          percent === 100
                            ? 'var(--magic-blue)'
                            : 'var(--sky-blue)'
                      }}
                    />
                  </div>

                  {/* ACTIONS */}
                  <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                    <button
                      className='btn-secondary btn-inline'
                      type='button'
                      onClick={() => toggleDetails(course.id, studentKey)}
                      disabled={!studentKey}
                      title={!studentKey ? 'Student key missing' : ''}
                    >
                      {showDetails ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>

                  {/* DETAILS (optional) */}
                  {showDetails && (
                    <div
                      style={{
                        marginTop: 12,
                        borderTop: '1px solid var(--slate-700)',
                        paddingTop: 12,
                        display: 'grid',
                        gap: 10
                      }}
                    >
                      {(course.lessons || []).length === 0 ? (
                        <p style={{ margin: 0, opacity: 0.9 }}>
                          No lessons yet.
                        </p>
                      ) : (
                        (course.lessons || []).map((lesson) => {
                          const mods = Array.isArray(lesson.modules)
                            ? lesson.modules
                            : [];
                          const total = mods.length;

                          let completed = 0;

                          for (const m of mods) {
                            const requiresSubmission = !!m?.assignment?.repoUrl;

                            const done = requiresSubmission
                              ? isModuleApprovedByStudent(m, student)
                              : isModuleCompletedByStudent(m, student);

                            if (done) completed++;
                          }

                          const lessonComplete =
                            total > 0 && completed === total;

                          return (
                            <div
                              key={lesson.id}
                              style={{
                                border: '1px solid var(--slate-700)',
                                borderRadius: 12,
                                padding: 10,
                                background: 'rgba(0,0,0,0.10)'
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
                                <div style={{ fontWeight: 900 }}>
                                  {lesson.title}
                                  {lessonComplete
                                    ? ' 🏅'
                                    : total === 0
                                      ? ' -'
                                      : ''}
                                </div>

                                <div style={{ opacity: 0.9 }}>
                                  {total === 0 ? (
                                    <span style={{ fontSize: 12 }}>
                                      No assignments.
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 12 }}>
                                      {completed}/{total} complete
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Mini bar per lesson */}
                              {total > 0 && (
                                <div
                                  className='course-progress-bar'
                                  style={{ marginTop: 8, height: 10 }}
                                >
                                  <div
                                    className='course-progress-fill'
                                    style={{
                                      width: `${Math.round((completed / total) * 100)}%`,
                                      background:
                                        completed === total
                                          ? 'var(--magic-blue)'
                                          : 'var(--sky-blue)',
                                      height: '100%'
                                    }}
                                  />
                                </div>
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
