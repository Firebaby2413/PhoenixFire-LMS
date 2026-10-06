import React from 'react';
import { calculateCourseProgress } from '../utils/progress';
import '../styles.css';

export default function CourseList({
  courses = [],
  users = [],
  currentUser,
  isStudent: isStudentProp,
  isStaff: isStaffProp,
  onCreateCourse,
  onImportMarkdown,
  onOpenCourse,
  onSelectCourse,
  onEditCourse,
  onDeleteCourse,
  onApproveCourse,
  onUpdateCourse
}) {
  const safeCourses = Array.isArray(courses) ? courses : [];

  // Infer roles if not explicitly passed as props
  const userRole = (currentUser?.role || 'student').toLowerCase();
  const computedIsStaff = ['instructor', 'ta', 'admin', 'mentor'].includes(userRole);
  const computedIsStudent = userRole === 'student';

  const isStaff = isStaffProp !== undefined ? isStaffProp : computedIsStaff;
  const isStudent = isStudentProp !== undefined ? isStudentProp : computedIsStudent;

  // STRICT PERMISSION CHECK: Only Admins and Mentors can approve/publish courses
  const canApproveCourses = ['admin', 'mentor'].includes(userRole);

  const studentKey =
    currentUser?.studentId ||
    currentUser?.email ||
    currentUser?.username ||
    currentUser?.id;

  // Filter courses: Students only see PUBLISHED courses assigned to them
  const visibleCourses = isStudent
    ? safeCourses.filter((c) => {
        const isPublished = !c.status || c.status === 'published';
        if (!isPublished) return false;

        if (!c.assignedStudentKeys || c.assignedStudentKeys.length === 0) {
          return true;
        }

        const userIdentifiers = [
          currentUser?.studentId,
          currentUser?.email,
          currentUser?.username,
          currentUser?.id
        ].filter(Boolean);

        return userIdentifiers.some((id) => c.assignedStudentKeys.includes(id));
      })
    : safeCourses;

  const handleOpen = (course) => {
    if (onSelectCourse) {
      onSelectCourse(course);
    } else if (onOpenCourse) {
      onOpenCourse(course);
    }
  };

  const handleDelete = (course) => {
    if (window.confirm(`Are you sure you want to delete "${course.title || 'this course'}"?`)) {
      onDeleteCourse?.(course);
    }
  };

  const handlePublishCourse = (course) => {
    const updatedCourse = { ...course, status: 'published' };

    if (onApproveCourse) {
      onApproveCourse(updatedCourse);
    } else if (onUpdateCourse) {
      onUpdateCourse(updatedCourse);
    } else if (onEditCourse) {
      onEditCourse(updatedCourse);
    }
  };

  const handleToggleStudentAssignment = (course, student) => {
    const studentKeys = [student?.studentId, student?.email, student?.username, student?.id].filter(Boolean);
    const currentKeys = course.assignedStudentKeys || [];

    const isAssigned = studentKeys.some((k) => currentKeys.includes(k));

    const updatedKeys = isAssigned
      ? currentKeys.filter((k) => !studentKeys.includes(k))
      : Array.from(new Set([...currentKeys, ...studentKeys]));

    const updatedCourse = { ...course, assignedStudentKeys: updatedKeys };

    if (onUpdateCourse) {
      onUpdateCourse(updatedCourse);
    } else if (onEditCourse) {
      onEditCourse(updatedCourse);
    }
  };

  const availableStudents = (users || []).filter(
    (u) => (u.role || '').toLowerCase() === 'student'
  );

  return (
    <div className="course-list-container">
      {/* STAFF ACTIONS BAR */}
      {isStaff && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {onCreateCourse && (
            <button type="button" className="btn" onClick={onCreateCourse}>
              + Create Course
            </button>
          )}
          {onImportMarkdown && (
            <button type="button" className="btn-secondary" onClick={onImportMarkdown}>
              📄 Import Markdown File
            </button>
          )}
        </div>
      )}

      {/* EMPTY STATE */}
      {visibleCourses.length === 0 && (
        <p className="section-subheading" style={{ opacity: 0.8, fontStyle: 'italic' }}>
          {isStudent ? 'No courses assigned to you yet.' : 'No courses available yet.'}
        </p>
      )}

      {/* COURSE CARDS */}
      {visibleCourses.map((course, index) => {
        const percent =
          isStudent && studentKey
            ? calculateCourseProgress(course, studentKey)
            : 0;

        const courseKey = course?.id || course?.slug || `course-${index}`;
        const isDraft = course.status === 'draft' || course.status === 'pending_approval';

        return (
          <div
            key={courseKey}
            className="course-box"
            style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '8px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="pf-title">{course.title || 'Untitled Course'}</h3>
              {/* STAGING BADGE FOR STAFF */}
              {isStaff && (
                <span className={`badge badge-${course.status || 'draft'}`}>
                  {course.status || 'draft'}
                </span>
              )}
            </div>

            <p>{course.description || 'No description provided.'}</p>

            {/* STUDENT PROGRESS BAR */}
            {isStudent && (
              <div className="course-progress">
                <div className="course-progress-bar">
                  <div
                    className="course-progress-fill"
                    style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                  />
                </div>
                <small>
                  {percent}% complete {percent === 100 ? '🏅' : ''}
                </small>
              </div>
            )}

            {/* STAFF ASSIGNMENT PANEL */}
            {isStaff && availableStudents.length > 0 && (
              <div
                className="student-assignment-panel"
                style={{
                  marginTop: '1rem',
                  padding: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px'
                }}
              >
                <small style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                  Assigned Students:
                </small>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {availableStudents.map((student) => {
                    const studentKeys = [student?.studentId, student?.email, student?.username, student?.id].filter(Boolean);
                    const currentKeys = course.assignedStudentKeys || [];
                    const isAssigned = studentKeys.some((k) => currentKeys.includes(k));

                    return (
                      <label
                        key={student.id || student.email || student.username}
                        style={{ fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => handleToggleStudentAssignment(course, student)}
                        />
                        <span>{student.email || student.username} {student.studentId ? `(${student.studentId})` : ''}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ACTIONS */}
            <div
              className="course-actions"
              style={{ display: 'flex', gap: '8px', marginTop: '1rem', flexWrap: 'wrap' }}
            >
              <button
                type="button"
                className="btn btn-inline"
                onClick={() => handleOpen(course)}
              >
                Open Course
              </button>

              {isStaff && (
                <>
                  <button
                    type="button"
                    className="btn-secondary btn-inline"
                    onClick={() => onEditCourse?.(course)}
                  >
                    Edit
                  </button>

                  {/* ONLY ADMIN & MENTOR CAN APPROVE & PUBLISH DRAFTS */}
                  {isDraft && canApproveCourses && (
                    <button
                      type="button"
                      className="btn-success btn-inline"
                      style={{
                        backgroundColor: '#22c55e',
                        color: '#0b1220',
                        fontWeight: 'bold',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        cursor: 'pointer'
                      }}
                      onClick={() => handlePublishCourse(course)}
                    >
                      ✓ Approve & Publish
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-outline btn-danger btn-inline"
                    onClick={() => handleDelete(course)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}