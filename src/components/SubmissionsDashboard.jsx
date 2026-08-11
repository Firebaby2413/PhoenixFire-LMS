import { useMemo, useState } from 'react';
import { canMentorSeeCourse } from '../utils/permissions';
import '../styles.css';

export default function SubmissionsDashboard({
  courses,
  setCourses,
  currentUser
}) {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [courseFilterId, setCourseFilterId] = useState('all');
  const [studentQuery, setStudentQuery] = useState('');

  const allItems = useMemo(() => {
    const list = [];

    for (const course of courses || []) {
      if (!canMentorSeeCourse(course, currentUser)) continue;

      for (const lesson of course.lessons || []) {
        for (const mod of lesson.modules || []) {
          const assignment = mod.assignment;
          if (!assignment) continue;

          const submissions = assignment.submissions || [];
          for (const s of submissions) {
            list.push({
              submission: s,
              course,
              lesson,
              module: mod
            });
          }
        }
      }
    }

    list.sort(
      (a, b) =>
        (b.submission.submittedAt || 0) - (a.submission.submittedAt || 0)
    );
    return list;
  }, [courses, currentUser]);

  const filteredItems = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();

    return allItems.filter(({ submission, course }) => {
      const statusOk =
        statusFilter === 'all'
          ? true
          : (submission.status || 'pending') === statusFilter;

      const courseOk =
        courseFilterId === 'all' ? true : course.id === courseFilterId;

      const studentText = String(submission.student || '').toLowerCase();
      const studentOk = q ? studentText.includes(q) : true;

      return statusOk && courseOk && studentOk;
    });
  }, [allItems, statusFilter, courseFilterId, studentQuery]);

  function updateSubmission(courseId, lessonId, moduleId, submissionId, patch) {
    setCourses((prev) =>
      (prev || []).map((c) => {
        if (c.id !== courseId) return c;

        return {
          ...c,
          lessons: (c.lessons || []).map((l) => {
            if (l.id !== lessonId) return l;

            return {
              ...l,
              modules: (l.modules || []).map((m) => {
                if (m.id !== moduleId) return m;

                const a = m.assignment;
                if (!a) return m;

                return {
                  ...m,
                  assignment: {
                    ...a,
                    submissions: (a.submissions || []).map((sub) =>
                      sub.id === submissionId ? { ...sub, ...patch } : sub
                    )
                  }
                };
              })
            };
          })
        };
      })
    );
  }

  if (allItems.length === 0) {
    return (
      <div className='section-container'>
        <h2 style={{ marginTop: 0 }}>Student Submissions</h2>
        <p>No submissions yet.</p>
      </div>
    );
  }

  return (
    <div className='section-container'>
      <h2 style={{ marginTop: 0 }}>Student Submissions</h2>

      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}
      >
        <select
          className='input-wide'
          style={{ maxWidth: 200 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value='pending'>Pending</option>
          <option value='revision'>Needs Revision</option>
          <option value='approved'>Approved</option>
          <option value='all'>All Statuses</option>
        </select>

        <select
          className='input-wide'
          style={{ maxWidth: 280 }}
          value={courseFilterId}
          onChange={(e) => setCourseFilterId(e.target.value)}
        >
          <option value='all'>All Courses</option>
          {(courses || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>

        <input
          className='input-wide'
          style={{ maxWidth: 280 }}
          placeholder='Search by student (id/email/username)...'
          value={studentQuery}
          onChange={(e) => setStudentQuery(e.target.value)}
        />

        <button
          className='btn-secondary'
          type='button'
          onClick={() => {
            setStatusFilter('pending');
            setCourseFilterId('all');
            setStudentQuery('');
          }}
        >
          Reset
        </button>
      </div>

      <p style={{ marginTop: 0, marginBottom: 16 }}>
        Showing <b>{filteredItems.length}</b> of <b>{allItems.length}</b>
      </p>

      {filteredItems.length === 0 ? (
        <p>No submissions match your filters.</p>
      ) : (
        filteredItems.map(({ submission, course, lesson, module }) => {
          const status = submission.status || 'pending';

          let badgeText = 'Pending';
          let badgeBg = 'rgba(234, 179, 8, 0.15)';
          let badgeBorder = '#eab308';

          if (status === 'approved') {
            badgeText = 'Approved';
            badgeBg = 'rgba(34, 197, 94, 0.15)';
            badgeBorder = '#22c55e';
          } else if (status === 'revision') {
            badgeText = 'Needs Revision';
            badgeBg = 'rgba(239, 68, 68, 0.15)';
            badgeBorder = '#ef4444';
          }

          return (
            <div
              key={submission.id}
              className='course-box'
              style={{ marginBottom: 16 }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    Student:{' '}
                    <span style={{ fontWeight: 700 }}>
                      {submission.student}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, lineHeight: 1.5 }}>
                    <b>Course:</b> {course.title}
                    <br />
                    <b>Lesson:</b> {lesson.title}
                    <br />
                    <b>Module:</b> {module.title}
                  </div>
                </div>

                <div
                  style={{
                    alignSelf: 'flex-start',
                    padding: '4px 12px',
                    borderRadius: 999,
                    border: `1px solid ${badgeBorder}`,
                    background: badgeBg,
                    fontWeight: 800,
                    fontSize: 12,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {badgeText}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <a href={submission.url} target='_blank' rel='noreferrer'>
                  View GitHub Submission →
                </a>
              </div>

              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                <textarea
                  className='input-wide'
                  style={{ minHeight: 80 }}
                  placeholder='Mentor feedback (saved instantly)...'
                  value={submission.feedbackText || ''}
                  onChange={(e) => {
                    updateSubmission(
                      course.id,
                      lesson.id,
                      module.id,
                      submission.id,
                      { feedbackText: e.target.value }
                    );
                  }}
                />

                <input
                  className='input-wide'
                  placeholder='YouTube Video Feedback Link'
                  value={submission.feedbackVideoUrl || ''}
                  onChange={(e) => {
                    updateSubmission(
                      course.id,
                      lesson.id,
                      module.id,
                      submission.id,
                      { feedbackVideoUrl: e.target.value }
                    );
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap'
                }}
              >
                <button
                  className='btn'
                  type='button'
                  onClick={() =>
                    updateSubmission(
                      course.id,
                      lesson.id,
                      module.id,
                      submission.id,
                      {
                        status: 'approved',
                        reviewedAt: Date.now()
                      }
                    )
                  }
                >
                  Approve
                </button>

                <button
                  className='btn-secondary'
                  type='button'
                  onClick={() =>
                    updateSubmission(
                      course.id,
                      lesson.id,
                      module.id,
                      submission.id,
                      {
                        status: 'revision',
                        reviewedAt: Date.now()
                      }
                    )
                  }
                >
                  Needs Revision
                </button>

                <button
                  className='btn-secondary'
                  type='button'
                  onClick={() =>
                    updateSubmission(
                      course.id,
                      lesson.id,
                      module.id,
                      submission.id,
                      {
                        status: 'pending',
                        reviewedAt: Date.now()
                      }
                    )
                  }
                >
                  Mark Pending
                </button>
              </div>

              <div style={{ marginTop: 12, opacity: 0.8, fontSize: 12 }}>
                Submitted:{' '}
                {submission.submittedAt
                  ? new Date(submission.submittedAt).toLocaleString()
                  : '-'}
                {' • '}
                Reviewed:{' '}
                {submission.reviewedAt
                  ? new Date(submission.reviewedAt).toLocaleString()
                  : '-'}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
