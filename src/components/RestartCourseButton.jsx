import { useEffect, useState } from 'react';
import { getDisplayName } from '../utils/academySettings';
import { listRestartRequests, requestCourseRestart, sendRestartMessage } from '../utils/courseRestart';

export default function RestartCourseButton({
  course,
  currentUser,
  users = [],
  refreshKey = 0
}) {
  const role = String(currentUser?.role || '').toLowerCase();
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (role !== 'student' || !course?.id || !currentUser?.id) return undefined;
    let cancelled = false;
    listRestartRequests({ studentId: currentUser.id, courseId: course.id })
      .then((rows) => {
        if (!cancelled) setPending(rows.some((row) => row.status === 'pending'));
      })
      .catch(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role, course?.id, currentUser?.id, refreshKey]);

  if (role !== 'student' || !course) return null;

  const send = async () => {
    const title = course.title || 'this course';
    const ok = window.confirm(
      `Ask an admin to restart "${title}"? Your progress, submissions, and certificates for this course are erased only after an admin approves it.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      await requestCourseRestart(currentUser, course);
      const admins = (users || []).filter((user) => String(user.role || '').toLowerCase() === 'admin');
      await Promise.all(
        admins.map((admin) =>
          sendRestartMessage(
            currentUser,
            admin,
            `${getDisplayName(currentUser)} asked to restart ${title}. Approve or deny it on My Progress.`
          )
        )
      );
      setPending(true);
      alert('Request sent. An admin has to approve it before this course restarts.');
    } catch (err) {
      alert(err.message || 'Could not send the restart request.');
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#fb923c' }}>
        Restart requested. Waiting for an admin to approve it.
      </p>
    );
  }

  return (
    <button type="button" className="btn-outline btn-inline" onClick={send} disabled={busy}>
      {busy ? 'Sending…' : 'Request course restart'}
    </button>
  );
}
