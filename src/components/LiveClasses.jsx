import { useMemo, useState } from 'react';
import { getDisplayName, pushUserNotification } from '../utils/academySettings';
import {
  canHostLiveClass,
  canManageSession,
  coursesHostCanSchedule,
  formatClassWhen,
  getClassTiming,
  getYouTubeEmbedUrl,
  isHttpUrl,
  sessionsForUser,
  studentsForCourse,
  toDatetimeLocalValue
} from '../utils/liveClasses';
import { deleteLiveClass, upsertLiveClass } from '../utils/liveClassService';

const EMPTY_FORM = {
  title: '',
  courseId: '',
  startsAt: '',
  durationMinutes: '60',
  meetingUrl: '',
  recordingUrl: '',
  description: ''
};

const STATUS_LABEL = {
  upcoming: 'Upcoming',
  live: 'Live now',
  ended: 'Ended',
  cancelled: 'Cancelled'
};

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `class_${Date.now()}`;
}

export default function LiveClasses({
  currentUser,
  courses = [],
  users = [],
  sessions = [],
  onChange,
  remoteNotice = ''
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [remoteNote, setRemoteNote] = useState('');
  const [filter, setFilter] = useState('upcoming');

  const isHost = canHostLiveClass(currentUser);
  const hostCourses = useMemo(
    () => coursesHostCanSchedule(courses, currentUser),
    [courses, currentUser]
  );
  const visible = useMemo(
    () => sessionsForUser(sessions, courses, currentUser),
    [sessions, courses, currentUser]
  );

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses]
  );

  const listed = useMemo(() => {
    const withTiming = visible.map((session) => ({
      ...session,
      timing: getClassTiming(session)
    }));
    const filtered = withTiming.filter((session) => {
      if (filter === 'upcoming') return session.timing === 'upcoming' || session.timing === 'live';
      if (filter === 'past') return session.timing === 'ended';
      return true;
    });
    filtered.sort((a, b) => {
      const aTime = new Date(a.startsAt).getTime() || 0;
      const bTime = new Date(b.startsAt).getTime() || 0;
      return filter === 'past' ? bTime - aTime : aTime - bTime;
    });
    return filtered;
  }, [visible, filter]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError('');
  };

  const notifyStudents = (course, message) => {
    studentsForCourse(course, users).forEach((student) => {
      pushUserNotification(student, 'live', message);
    });
  };

  const commitSession = async (session, replaceId) => {
    const result = await upsertLiveClass(session, currentUser);
    if (!result.ok && !result.missingTable) {
      setError(result.message);
      return false;
    }

    const saved = result.ok ? result.session : session;
    const targetId = replaceId || session.id;
    const exists = sessions.some((item) => item.id === targetId);
    const next = exists
      ? sessions.map((item) => (item.id === targetId ? saved : item))
      : [...sessions, saved];
    onChange?.(next);
    setRemoteNote(result.missingTable ? result.message : '');
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const title = form.title.trim();
    const course = hostCourses.find((item) => item.id === form.courseId);
    const durationMinutes = Number(form.durationMinutes);
    const meetingUrl = form.meetingUrl.trim();
    const recordingUrl = form.recordingUrl.trim();
    const startsAtDate = new Date(form.startsAt);

    if (!title) {
      setError('Add a class title.');
      return;
    }
    if (!course) {
      setError('Choose a course for this class.');
      return;
    }
    if (Number.isNaN(startsAtDate.getTime())) {
      setError('Choose a start date and time.');
      return;
    }
    if (!editingId && startsAtDate.getTime() <= Date.now()) {
      setError('Choose a future start time.');
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) {
      setError('Duration must be between 15 and 240 minutes.');
      return;
    }
    if (!isHttpUrl(meetingUrl)) {
      setError('Meeting link must start with http:// or https://.');
      return;
    }
    if (recordingUrl && !isHttpUrl(recordingUrl)) {
      setError('Recording link must start with http:// or https://.');
      return;
    }

    const existing = sessions.find((session) => session.id === editingId);
    const nextSession = {
      id: existing?.id || newId(),
      title,
      description: form.description.trim(),
      courseId: course.id,
      startsAt: startsAtDate.toISOString(),
      durationMinutes,
      meetingUrl,
      recordingUrl,
      hostEmail: existing?.hostEmail || currentUser?.email || '',
      hostName: existing?.hostName || getDisplayName(currentUser),
      status: existing?.status || 'scheduled',
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await commitSession(nextSession, existing?.id);
    if (!saved) return;

    const when = formatClassWhen(nextSession.startsAt);
    const scheduleChanged =
      !existing ||
      existing.startsAt !== nextSession.startsAt ||
      existing.meetingUrl !== nextSession.meetingUrl ||
      existing.title !== nextSession.title;
    if (scheduleChanged && nextSession.status !== 'cancelled') {
      const verb = existing ? 'updated' : 'scheduled';
      notifyStudents(
        course,
        `Live class ${verb}: ${title} · ${when}`
      );
    }

    resetForm();
  };

  const startEdit = (session) => {
    setEditingId(session.id);
    setError('');
    setForm({
      title: session.title || '',
      courseId: session.courseId || '',
      startsAt: toDatetimeLocalValue(session.startsAt),
      durationMinutes: String(session.durationMinutes || 60),
      meetingUrl: session.meetingUrl || '',
      recordingUrl: session.recordingUrl || '',
      description: session.description || ''
    });
  };

  const cancelSession = async (session) => {
    if (!window.confirm(`Cancel "${session.title}"? Students will no longer see it as upcoming.`)) {
      return;
    }
    const course = courseById.get(session.courseId);
    const saved = await commitSession(
      { ...session, status: 'cancelled', updatedAt: new Date().toISOString() },
      session.id
    );
    if (!saved) return;
    if (course) {
      notifyStudents(course, `Live class cancelled: ${session.title}`);
    }
    if (editingId === session.id) resetForm();
  };

  const deleteSession = async (session) => {
    if (!window.confirm(`Delete "${session.title}"? This cannot be undone.`)) return;
    const result = await deleteLiveClass(session.id);
    if (!result.ok && !result.missingTable) {
      setError(result.message);
      return;
    }
    onChange?.(sessions.filter((item) => item.id !== session.id));
    setRemoteNote(result.missingTable ? result.message : '');
    if (editingId === session.id) resetForm();
  };

  return (
    <div className="section-container live-classes">
      {(remoteNote || remoteNotice) && (
        <p className="live-class-note live-class-banner" role="status">
          {remoteNote || remoteNotice}
        </p>
      )}
      {isHost && (
        <form className="course-box live-class-form" onSubmit={handleSubmit}>
          <h2 className="section-subheading span-2">
            {editingId ? 'Edit live class' : 'Schedule a live class'}
          </h2>
          <p className="span-2 live-class-note">
            Paste a Zoom, Google Meet, or Teams link. Students enrolled in the course get a Join button.
          </p>

          <label className="live-class-field">
            Title
            <input
              className="input-wide"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="Week 3 workshop"
            />
          </label>

          <label className="live-class-field">
            Course
            <select
              className="input-wide"
              value={form.courseId}
              onChange={(event) => updateField('courseId', event.target.value)}
            >
              <option value="">Select a course</option>
              {hostCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title || 'Untitled course'}
                  {course.status && course.status !== 'published' ? ` (${course.status})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="live-class-field">
            Starts
            <input
              className="input-wide"
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => updateField('startsAt', event.target.value)}
            />
          </label>

          <label className="live-class-field">
            Duration (minutes)
            <input
              className="input-wide"
              type="number"
              min="15"
              max="240"
              value={form.durationMinutes}
              onChange={(event) => updateField('durationMinutes', event.target.value)}
            />
          </label>

          <label className="live-class-field span-2">
            Meeting link
            <input
              className="input-wide"
              type="url"
              value={form.meetingUrl}
              onChange={(event) => updateField('meetingUrl', event.target.value)}
              placeholder="https://meet.google.com/..."
            />
          </label>

          <label className="live-class-field span-2">
            Recording link (optional)
            <input
              className="input-wide"
              type="url"
              value={form.recordingUrl}
              onChange={(event) => updateField('recordingUrl', event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </label>

          <label className="live-class-field span-2">
            Notes
            <textarea
              className="input-wide"
              rows="3"
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="What should students bring or review beforehand?"
            />
          </label>

          {hostCourses.length === 0 && (
            <p className="span-2 live-class-note">
              Create or get assigned to a course before scheduling a class.
            </p>
          )}
          {error && (
            <p className="span-2 live-class-error" role="alert">
              {error}
            </p>
          )}

          <div className="course-actions span-2">
            <button type="submit" className="btn btn-inline">
              {editingId ? 'Save changes' : 'Schedule class'}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary btn-inline" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      )}

      <div className="live-class-filters" role="tablist" aria-label="Class list">
        {[
          ['upcoming', 'Upcoming'],
          ['past', 'Past'],
          ['all', 'All']
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={`btn-secondary btn-inline ${filter === id ? 'is-active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {listed.length === 0 && (
        <p className="section-subheading live-class-empty">
          {filter === 'past' ? 'No past classes yet.' : 'No live classes scheduled yet.'}
        </p>
      )}

      {listed.map((session) => {
        const course = courseById.get(session.courseId);
        const manageable = canManageSession(currentUser, session, course);
        const embedUrl = getYouTubeEmbedUrl(session.recordingUrl);
        const showJoin = session.timing !== 'cancelled' && session.timing !== 'ended' && session.meetingUrl;
        const unpublished = course && course.status && course.status !== 'published';

        return (
          <article key={session.id} className="course-box">
            <div className="live-class-heading">
              <h3 className="pf-title">{session.title}</h3>
              <span className={`badge live-status live-status-${session.timing}`}>
                {STATUS_LABEL[session.timing] || 'Scheduled'}
              </span>
            </div>
            <p className="live-class-meta">
              {course?.title || 'Course removed'} · {formatClassWhen(session.startsAt)} ·{' '}
              {session.durationMinutes || 60} min
              {session.hostName ? ` · ${session.hostName}` : ''}
            </p>
            {session.description && <p>{session.description}</p>}
            {manageable && unpublished && (
              <p className="live-class-note">
                Students will see this after the course is published
                {course.assignedStudentKeys?.length ? ' and they are assigned to it' : ''}.
              </p>
            )}

            <div className="course-actions">
              {showJoin && (
                <a
                  className="btn btn-inline"
                  href={session.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Join class
                </a>
              )}
              {session.recordingUrl && !embedUrl && (
                <a
                  className="btn-secondary btn-inline"
                  href={session.recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Watch recording
                </a>
              )}
              {manageable && (
                <>
                  <button type="button" className="btn-secondary btn-inline" onClick={() => startEdit(session)}>
                    Edit
                  </button>
                  {session.status !== 'cancelled' && (
                    <button type="button" className="btn-outline btn-inline" onClick={() => cancelSession(session)}>
                      Cancel class
                    </button>
                  )}
                  <button type="button" className="btn-outline btn-inline" onClick={() => deleteSession(session)}>
                    Delete
                  </button>
                </>
              )}
            </div>

            {embedUrl && (
              <div className="live-class-recording">
                <iframe
                  title={`${session.title} recording`}
                  src={embedUrl}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
