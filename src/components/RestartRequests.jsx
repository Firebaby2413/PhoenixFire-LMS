import { useCallback, useEffect, useState } from 'react';
import { getDisplayName } from '../utils/academySettings';
import {
  approveCourseRestart,
  denyCourseRestart,
  listRestartRequests,
  sendRestartMessage
} from '../utils/courseRestart';

export default function RestartRequests({ courses = [], users = [], currentUser, onResolved }) {
  const [rows, setRows] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(() => {
    listRestartRequests({ status: 'pending' })
      .then((next) => {
        setRows(next);
        setLoadError('');
      })
      .catch((err) => {
        setRows([]);
        setLoadError(err.message || 'Could not load restart requests.');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const studentFor = (row) =>
    (users || []).find((user) => String(user.id) === String(row.student_id)) || {
      id: row.student_id,
      email: row.student_email,
      name: row.student_name
    };

  const courseFor = (row) =>
    (courses || []).find((course) => String(course.id) === String(row.course_id)) || {
      id: row.course_id,
      title: row.course_title || 'Course',
      lessons: []
    };

  const decide = async (row, approved) => {
    const student = studentFor(row);
    const course = courseFor(row);
    const name = row.student_name || getDisplayName(student);
    const title = course.title || row.course_title || 'this course';
    const ok = window.confirm(
      approved
        ? `Restart ${title} for ${name}? This deletes their progress, submissions, and certificates for that course. They start again at 0%.`
        : `Deny ${name}'s request to restart ${title}? Their progress stays as it is.`
    );
    if (!ok) return;
    setBusyId(row.id);
    try {
      if (approved) {
        await approveCourseRestart(row, course, student);
        await sendRestartMessage(
          currentUser,
          student,
          `An admin approved your restart of ${title}. That course is back to 0%.`
        );
      } else {
        await denyCourseRestart(row.id);
        await sendRestartMessage(
          currentUser,
          student,
          `An admin denied your request to restart ${title}. Your progress was not changed.`
        );
      }
      onResolved?.();
      load();
    } catch (err) {
      alert(err.message || 'Could not update that request.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div
      className="course-box"
      style={{ marginBottom: 16, padding: 16, borderRadius: 8 }}
    >
      <h3 className="pf-title" style={{ marginTop: 0 }}>
        Course restart requests
      </h3>
      <p style={{ marginTop: 0, opacity: 0.85 }}>
        Only an admin can approve these. Approving erases that student&apos;s work in the course and sets it back to 0%.
      </p>
      {loadError && <p style={{ color: '#f87171' }}>{loadError}</p>}
      {!loadError && rows.length === 0 && <p style={{ opacity: 0.8 }}>No restart requests waiting.</p>}
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((row) => {
          const busy = busyId === row.id;
          return (
            <div
              key={row.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                alignItems: 'center',
                border: '1px solid var(--slate-700, #334155)',
                borderRadius: 8,
                padding: 10
              }}
            >
              <div>
                <strong>{row.student_name || row.student_email || row.student_id}</strong>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  {row.course_title || 'Course'} · {row.student_email || 'No email'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn-inline"
                  disabled={busy}
                  onClick={() => decide(row, true)}
                  style={{
                    background: '#22c55e',
                    color: '#0b1220',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {busy ? 'Saving…' : 'Approve restart'}
                </button>
                <button
                  type="button"
                  className="btn-outline btn-danger btn-inline"
                  disabled={busy}
                  onClick={() => decide(row, false)}
                >
                  Deny
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
