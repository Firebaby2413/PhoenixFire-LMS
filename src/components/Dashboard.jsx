import React, { useState, useEffect, useCallback } from 'react';
import { isStatusPassing, isStatusFailing } from '../utils/progress';
import { fetchAllSubmissions, gradeSubmission, applyLocalGrade, claimOrphanSubmissions, submissionOwnerId, reassignOrphanSubmissions } from '../utils/storage';
import {
  getDisplayName,
  findStoredUser,
  pushUserNotification,
  readUserNotifications,
  markNotificationsRead
} from '../utils/academySettings';

export default function Dashboard(props) {
  const [courses, setCourses] = useState(props.courses || []);
  const user = props.user || props.currentUser || props.userObj || props.auth?.user || {};
  const onUpdateCourses = props.onUpdateCourses;
  const propSubmissions = props.submissions || [];
  const directoryUsers = props.users || [];
  const [inbox, setInbox] = useState(() => readUserNotifications(user));
  const [openStudentKeys, setOpenStudentKeys] = useState({});
  const [selectedCourseId, setSelectedCourseId] = useState('ALL');
  const [feedbackInputs, setFeedbackInputs] = useState({});
  const [videoInputs, setVideoInputs] = useState({});
  const [isUpdating, setIsUpdating] = useState({});
  const [localSubmissions, setLocalSubmissions] = useState([]);
  const [remoteSubmissions, setRemoteSubmissions] = useState([]);

  const userRole = String(user?.role || user?.user_metadata?.role || 'student').toLowerCase();
  const isStudent = userRole === 'student';
  const isMentorOrAdmin = userRole === 'mentor' || userRole === 'admin' || userRole === 'instructor';

  const userIdentifiers = [
    user?.id,
    user?.email,
    user?.studentEmail,
    user?.student_id,
    user?.username,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase().trim());

  const loadData = useCallback(async () => {
    let loadedCourses = props.courses || [];
    if (!loadedCourses.length) {
      ['courses', 'lms_courses', 'app_courses', 'markdown_courses'].forEach((key) => {
        try {
          const stored = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(stored) && stored.length > 0) {
            loadedCourses = stored;
          }
        } catch (e) {
          console.error(`Local storage read error for key ${key}:`, e);
        }
      });
    }
    setCourses(loadedCourses);

    let combinedLocal = [];
    ['app_submissions', 'submissions', 'lms_submissions', 'student_submissions'].forEach((key) => {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(stored)) combinedLocal = [...combinedLocal, ...stored];
      } catch (e) {
        console.error(`Local storage read error for key ${key}:`, e);
      }
    });
    setLocalSubmissions(combinedLocal);

    try {
      if (typeof fetchAllSubmissions === 'function') {
        const remoteData = await fetchAllSubmissions();
        if (Array.isArray(remoteData)) setRemoteSubmissions(remoteData);
      }
    } catch (err) {
      console.error('Remote fetch error:', err);
    }
  }, [props.courses]);

  useEffect(() => {
    loadData();
  }, [loadData, selectedCourseId]);

  useEffect(() => {
    setInbox(readUserNotifications(user));
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!directoryUsers.length || !remoteSubmissions.length) return;
    reassignOrphanSubmissions(remoteSubmissions, directoryUsers).catch((err) => {
      console.error('Could not attach old submissions to the enrolled student:', err);
    });
  }, [directoryUsers, remoteSubmissions]);

  const matchesStudent = (sub) => {
    if (!sub) return false;
    if (!isStudent) return true;

    const subKeys = [
      sub.student,
      sub.studentEmail,
      sub.student_email,
      sub.email,
      sub.user_email,
      sub.studentId,
      sub.student_id,
      sub.user_id,
      sub.userId,
      sub.studentKey,
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase().trim());

    if (subKeys.length === 0 || userIdentifiers.length === 0) return true; 
    return userIdentifiers.some((id) => subKeys.some((key) => key.includes(id) || id.includes(key)));
  };

  const extractSubmissions = () => {
    const list = [];
    const seenIds = new Set();

    const moduleToCourseMap = {};
    courses.forEach((c) => {
      const registerModule = (mod) => {
        if (!mod) return;
        if (mod.id) moduleToCourseMap[String(mod.id)] = c;
        if (mod.slug) moduleToCourseMap[String(mod.slug)] = c;
      };
      if (Array.isArray(c.modules)) c.modules.forEach(registerModule);
      if (Array.isArray(c.lessons)) {
        c.lessons.forEach((l) => {
          registerModule(l);
          if (Array.isArray(l.modules)) l.modules.forEach(registerModule);
          if (l.assignment) registerModule(l.assignment);
        });
      }
    });

    const addIfValid = (sub, defaultTitle = 'Assignment Submission') => {
      if (!sub) return;
      sub = applyLocalGrade(sub);
      if (isStudent && !matchesStudent(sub)) return;

      const rawCourseId = sub.courseId || sub.course_id || sub.courseID;
      const targetModuleId = sub.moduleId || sub.module_id || sub.lessonId;

      let matchedCourse = courses.find((c) => 
        String(c.id) === String(rawCourseId) || 
        String(c.title).toLowerCase().trim() === String(rawCourseId).toLowerCase().trim()
      );

      if (!matchedCourse && targetModuleId && moduleToCourseMap[String(targetModuleId)]) {
        matchedCourse = moduleToCourseMap[String(targetModuleId)];
      }

      if (!matchedCourse && targetModuleId) {
        matchedCourse = courses.find((c) => {
          const inModules = Array.isArray(c.modules) && c.modules.some((m) => String(m.id) === String(targetModuleId) || String(m.slug) === String(targetModuleId));
          const inLessons = Array.isArray(c.lessons) && c.lessons.some((l) => 
            String(l.id) === String(targetModuleId) || 
            String(l.slug) === String(targetModuleId) ||
            (Array.isArray(l.modules) && l.modules.some((m) => String(m.id) === String(targetModuleId)))
          );
          return inModules || inLessons;
        });
      }

      const directCourseTitle = 
        sub.courseTitle || 
        sub.course_title || 
        sub.courseName || 
        sub.course_name || 
        (typeof sub.course === 'string' ? sub.course : sub.course?.title);

      const resolvedCourseId = matchedCourse ? String(matchedCourse.id) : String(rawCourseId || '');
      
      const fallbackTitle = courses.length > 0 ? courses[0].title : 'General Course';
      const resolvedCourseTitle = directCourseTitle || matchedCourse?.title || fallbackTitle;

      if (selectedCourseId !== 'ALL') {
        const selId = String(selectedCourseId).toLowerCase().trim();
        const currentCourse = courses.find((c) => String(c.id) === selId);
        const currentTitle = String(currentCourse?.title || '').toLowerCase().trim();

        const selectedCourseObj = courses.find((c) => String(c.id).toLowerCase().trim() === selId);
        const selectedCourseName = String(selectedCourseObj?.title || selId).toLowerCase().trim();
        const matchesId = resolvedCourseId && resolvedCourseId.toLowerCase() === selId;
        const matchesTitle = resolvedCourseTitle.toLowerCase() === currentTitle;
        const matchesDropdownSelection = resolvedCourseTitle.toLowerCase().includes(selectedCourseName);

        if (!matchesId && !matchesTitle && !matchesDropdownSelection) return;
      }

      const uniqueSubId =
        sub.id ||
        sub._id ||
        sub.submissionId ||
        `${resolvedCourseId || 'c'}-${targetModuleId || 'm'}-${sub.studentEmail || sub.student || Math.random()}`;

      if (!seenIds.has(uniqueSubId)) {
        seenIds.add(uniqueSubId);
        list.push({
          ...sub,
          courseId: resolvedCourseId,
          moduleId: targetModuleId,
          courseTitle: resolvedCourseTitle,
          id: sub.id || uniqueSubId,
          uniqueSubId,
          moduleTitle: sub.moduleTitle || sub.title || sub.name || defaultTitle,
        });
      }
    };

    if (Array.isArray(propSubmissions)) propSubmissions.forEach((s) => addIfValid(s));
    if (Array.isArray(localSubmissions)) localSubmissions.forEach((s) => addIfValid(s));
    if (Array.isArray(remoteSubmissions)) remoteSubmissions.forEach((s) => addIfValid(s));

    courses.forEach((c) => {
      const processModule = (mod) => {
        if (!mod) return;
        const modSubs = mod.assignment?.submissions || mod.submissions || (mod.submissions ? [mod.submissions] : []);
        if (Array.isArray(modSubs)) {
          modSubs.forEach((s) => addIfValid({ ...s, courseId: c.id, courseTitle: c.title, moduleId: s.moduleId || mod.id }, mod.title || mod.name));
        }
      };

      if (Array.isArray(c.modules)) c.modules.forEach(processModule);
      if (Array.isArray(c.lessons)) {
        c.lessons.forEach((l) => {
          processModule(l);
          if (Array.isArray(l.modules)) l.modules.forEach(processModule);
          if (l.submission) addIfValid({ ...l.submission, courseId: c.id, courseTitle: c.title, moduleId: l.submission.moduleId || l.id }, l.title || l.name);
          if (l.assignment?.submissions) l.assignment.submissions.forEach((s) => addIfValid({ ...s, courseId: c.id, courseTitle: c.title, moduleId: s.moduleId || l.id }, l.title));
        });
      }
    });

    const validCourseIds = new Set(courses.map(c => String(c.id)));
    const validCourseTitles = new Set(courses.map(c => String(c.title).toLowerCase().trim()));

    const filteredList = list.filter((sub) => {
      const cId = String(sub.courseId || '');
      const cTitle = String(sub.courseTitle || '').toLowerCase().trim();
      return validCourseIds.has(cId) || validCourseTitles.has(cTitle);
    });

    return filteredList;

  };

  const activeSubmissions = extractSubmissions();

  const studentThreads = (() => {
    const isEmail = (value) => String(value || '').includes('@');
    const isAccountNumber = (value) => /^\d{8,}$/.test(String(value || '').trim());
    const readableName = (value) => {
      const text = String(value || '').trim();
      if (!text || text === 'User' || isAccountNumber(text)) return '';
      return text;
    };
    const labelFor = (sub) => {
      const studentKey = submissionOwnerId(sub, directoryUsers);
      const email = [sub.email, sub.studentEmail, sub.student_email, sub.student].find(isEmail) || '';
      const person = findStoredUser(directoryUsers, {
        id: studentKey,
        studentId: studentKey,
        student_id: studentKey,
        email,
        studentEmail: email
      });
      const fromAccount = readableName(person ? getDisplayName(person) : '');
      if (fromAccount) return fromAccount;
      const fromPrefs = readableName(getDisplayName({ id: studentKey, email, preferredName: sub.preferredName }));
      if (fromPrefs) return fromPrefs;
      if (email && !isAccountNumber(email)) return email;
      return person?.email || 'Student';
    };

    const ownedSubmissions = claimOrphanSubmissions(activeSubmissions, directoryUsers);
    const latestByThread = new Map();
    ownedSubmissions.forEach((sub) => {
      const studentKey = submissionOwnerId(sub, directoryUsers);
      const modKey = String(sub.moduleId || sub.module_id || '');
      const threadId = `${studentKey}::${modKey}`;
      const prev = latestByThread.get(threadId);
      const t = new Date(sub.created_at || sub.submittedAt || 0).getTime();
      const pt = prev ? new Date(prev.created_at || prev.submittedAt || 0).getTime() : -1;
      if (!prev || t >= pt) latestByThread.set(threadId, sub);
    });
    const byStudent = {};
    [...latestByThread.values()].forEach((sub) => {
      const studentKey = submissionOwnerId(sub, directoryUsers);
      if (!byStudent[studentKey]) {
        byStudent[studentKey] = {
          key: studentKey,
          name: labelFor(sub),
          subs: []
        };
      }
      byStudent[studentKey].subs.push(sub);
    });
    return Object.values(byStudent).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const handleGrade = async (targetModuleId, targetSub, newStatus) => {
    const subId = targetSub.id || targetSub.uniqueSubId;
    const feedbackText = feedbackInputs[subId] !== undefined ? feedbackInputs[subId] : targetSub.feedback || '';
    const videoUrl = videoInputs[subId] !== undefined ? videoInputs[subId] : targetSub.feedbackVideoUrl || '';

    setIsUpdating((prev) => ({ ...prev, [subId]: true }));

    try {
      let saved = null;
      const isFakeId = !targetSub.id || String(targetSub.id).startsWith('c-');
      if (typeof gradeSubmission === 'function' && !isFakeId) {
        saved = await gradeSubmission(targetSub.id, newStatus, feedbackText, videoUrl);
      }

      const appliedStatus = saved?.status || newStatus;
      const isPassed = isStatusPassing(appliedStatus);

      setRemoteSubmissions((prev) =>
        prev.map((s) =>
          String(s.id) === String(targetSub.id)
            ? {
                ...s,
                ...(saved || {}),
                status: appliedStatus,
                feedback: saved?.feedback || feedbackText,
                feedbackText: saved?.feedbackText || feedbackText,
                feedback_text: saved?.feedback_text || feedbackText,
                feedbackVideoUrl: saved?.feedbackVideoUrl || videoUrl,
                feedback_video_url: saved?.feedback_video_url || videoUrl
              }
            : s
        )
      );

      if (typeof onUpdateCourses === 'function') {
        const updatedCourses = courses.map((course) => {
          if (String(course.id) !== String(targetSub.courseId)) return course;

          const updatedLessons = (course.lessons || []).map((lesson) => ({
            ...lesson,
            modules: (lesson.modules || []).map((mod) => {
              if (String(mod.id) !== String(targetModuleId)) return mod;
              const existingSubs = mod.assignment?.submissions || mod.submissions || [];
              const updatedSubs = existingSubs.map((s) => {
                if (s.studentKey === targetSub.studentKey || s.studentEmail === targetSub.studentEmail || s.id === targetSub.id) {
                  return { ...s, status: newStatus, feedback: feedbackText, feedbackVideoUrl: videoUrl };
                }
                return s;
              });
              return {
                ...mod,
                assignment: mod.assignment ? { ...mod.assignment, submissions: updatedSubs } : mod.assignment,
                submissions: updatedSubs
              };
            })
          }));

          return {
            ...course,
            lessons: updatedLessons,
          };
        });
        onUpdateCourses(updatedCourses);
      }

      const studentUser = findStoredUser(directoryUsers, targetSub);
      if (studentUser) {
        pushUserNotification(
          studentUser,
          isPassed ? 'passed' : 'revision',
          isPassed
            ? 'Your assignment was marked passed'
            : 'Your assignment needs revision.'
        );
      }

      await loadData();
      alert(isPassed ? 'Assignment marked as Passed.' : 'Revision requested.');
    } catch (err) {
      console.error('Grading error:', err);
      alert(`Failed to save grade: ${err.message || 'unknown error'}`);
    } finally {
      setIsUpdating((prev) => ({ ...prev, [subId]: false }));
    }
  };

  return (
    <div className="dashboard-container p-6 max-w-6xl mx-auto text-gray-100">
      {/* Enforce dark color scheme and block browser default styles */}
      <style>{`
        .dashboard-container textarea,
        .dashboard-container input[type="text"] {
          background-color: #0b0f19 !important;
          background: #0b0f19 !important;
          color: #f8fafc !important;
          -webkit-text-fill-color: #f8fafc !important;
          border-color: #1e293b !important;
          color-scheme: dark !important;
          -webkit-appearance: none !important;
          appearance: none !important;
        }
        .dashboard-container textarea:focus,
        .dashboard-container input[type="text"]:focus {
          background-color: #0b0f19 !important;
          background: #0b0f19 !important;
          color: #f8fafc !important;
          -webkit-text-fill-color: #f8fafc !important;
          border-color: #ec4899 !important;
          color-scheme: dark !important;
          outline: none !important;
        }
        .dashboard-container textarea:-webkit-autofill,
        .dashboard-container input[type="text"]:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #0b0f19 inset !important;
          -webkit-text-fill-color: #f8fafc !important;
          color-scheme: dark !important;
        }
      `}</style>

      <div className="mb-6 flex justify-end">
        <div className="flex items-center gap-2">
          <label htmlFor="course-filter" className="text-sm font-medium text-gray-300">
            Filter Course:
          </label>
          <select
            id="course-filter"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md shadow-sm text-sm text-gray-200 focus:outline-none focus:border-pink-500"
          >
            <option value="ALL">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {inbox.filter((n) => !n.read).length > 0 && (
        <div className='mb-6 p-4 rounded-xl border border-pink-500/30 bg-slate-900'>
          <div className='flex justify-between items-center mb-2'>
            <h3 className='text-sm font-semibold text-pink-300'>Notifications</h3>
            <button
              type='button'
              className='text-xs text-gray-300 underline'
              onClick={() => setInbox(markNotificationsRead(user))}
            >
              Mark all read
            </button>
          </div>
          {inbox.filter((n) => !n.read).map((n) => (
            <p key={n.id} className='text-sm text-gray-200 m-0 mb-1'>
              {n.message}
            </p>
          ))}
        </div>
      )}

      <main className="space-y-6">
        <section className="bg-slate-900/85 backdrop-blur-md p-5 rounded-xl shadow-lg border border-slate-800">
          <h2 className="text-lg font-semibold mb-4 text-gray-200">
            {isMentorOrAdmin ? 'Submissions Requiring Review' : 'Your Submissions & Progress'}
          </h2>

          {activeSubmissions.length === 0 ? (
            <p className="text-gray-400 italic py-4">No submissions found.</p>
          ) : (
            <div className="space-y-3">
              {studentThreads.map((thread) => {
                const pendingCount = thread.subs.filter((s) => {
                  const st = s.status || 'pending';
                  return !isStatusPassing(st) && !isStatusFailing(st);
                }).length;
                const isOpen = !!openStudentKeys[thread.key];
                return (
                  <div key={thread.key} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenStudentKeys((prev) => ({ ...prev, [thread.key]: !prev[thread.key] }))
                      }
                      style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        textAlign: 'left',
                        background: '#020617',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#f8fafc'
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{thread.name}</span>
                      <span style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {thread.subs.length} assignment{thread.subs.length === 1 ? '' : 's'}
                        {pendingCount ? ` · ${pendingCount} pending` : ''}
                        {'  '}{isOpen ? '▲' : '▼'}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="space-y-4 p-4 pt-0">
              {thread.subs.map((sub) => {
                const subId = sub.uniqueSubId || sub.id;
                const status = sub.status || 'pending';
                const isPassed = isStatusPassing(status);
                const isFailed = isStatusFailing(status);
                const isSubUpdating = !!isUpdating[subId];

                const rawRepoUrl = sub.repoUrl || sub.url || sub.submission_url || sub.link || sub.submissionUrl || '';
                const repoUrl = rawRepoUrl.startsWith('http') ? rawRepoUrl : (rawRepoUrl ? `https://${rawRepoUrl}` : '');

                const feedbackTxt = sub.feedback || sub.feedbackText || sub.feedback_text || '';
                const videoUrl = sub.feedbackVideoUrl || sub.feedback_video_url || '';

                return (
                  <div key={subId} className="p-4 border border-slate-800 rounded-lg bg-slate-950/60 flex flex-col gap-3 transition-all hover:border-slate-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-100">{sub.moduleTitle}</h3>
                          {sub.courseTitle && (
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-pink-500/30 text-pink-300 font-medium">
                              {sub.courseTitle}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Student: <span className="text-gray-300">{thread.name}</span>
                        </p>
                        {repoUrl && (
                          <div className="mt-2 text-xs flex items-center gap-1.5 flex-wrap">
                            <span className="text-gray-400 font-medium">Submitted Link:</span>
                            <a
                              href={repoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-pink-400 hover:text-pink-300 underline font-mono break-all"
                            >
                              {repoUrl}
                            </a>
                          </div>
                        )}
                      </div>

                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${
                          isPassed
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : isFailed
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        }`}
                      >
                        {isPassed ? 'Passed' : isFailed ? 'Needs Revision' : 'Pending'}
                      </span>
                    </div>

                    {isStudent && (feedbackTxt || videoUrl) && (
                      <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 text-sm text-gray-300 space-y-2">
                        {feedbackTxt && (
                          <div>
                            <span className="font-semibold block text-xs text-pink-400 mb-1">Feedback:</span>
                            <p className="m-0 text-gray-200">{feedbackTxt}</p>
                          </div>
                        )}
                        {videoUrl && (
                          <div>
                            <a
                              href={videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-orange-400 hover:text-orange-300 underline font-medium inline-flex items-center gap-1"
                            >
                              📺 Watch Video Feedback
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {isMentorOrAdmin && (
                      <div className="mt-2 space-y-3 pt-3 border-t border-slate-800/80">
                        <div>
                          <label className="text-xs text-gray-400 font-medium block mb-1">Written Feedback:</label>
                          <textarea
                            placeholder="Add feedback for student..."
                            value={feedbackInputs[subId] !== undefined ? feedbackInputs[subId] : feedbackTxt}
                            onChange={(e) => setFeedbackInputs({ ...feedbackInputs, [subId]: e.target.value })}
                            rows={3}
                            style={{
                              backgroundColor: '#0b0f19',
                              color: '#f8fafc',
                              colorScheme: 'dark'
                            }}
                            className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-800 text-gray-100 focus:outline-none focus:border-pink-500 resize-y"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 font-medium block mb-1">Video Feedback URL (Optional):</label>
                          <input
                            type="text"
                            placeholder="https://..."
                            value={videoInputs[subId] !== undefined ? videoInputs[subId] : videoUrl}
                            onChange={(e) => setVideoInputs({ ...videoInputs, [subId]: e.target.value })}
                            style={{
                              backgroundColor: '#0b0f19',
                              color: '#f8fafc',
                              colorScheme: 'dark'
                            }}
                            className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-800 text-gray-100 focus:outline-none focus:border-pink-500"
                          />
                        </div>
                        <div className="flex gap-2.5 justify-end">
                          <button
                            disabled={isSubUpdating}
                            onClick={() => handleGrade(sub.moduleId, sub, 'fail')}
                            style={{
                              backgroundColor: 'rgba(220, 38, 38, 0.8)',
                              color: '#ffffff',
                              borderRadius: '0.5rem 1rem',
                              padding: '0.5rem 1rem',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              cursor: 'pointer',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                          >
                            {isSubUpdating ? 'Saving...' : 'Request Revision'}
                          </button>
                          <button
                            disabled={isSubUpdating}
                            onClick={() => handleGrade(sub.moduleId, sub, 'pass')}
                            style={{
                              background: 'linear-gradient(to right, #f97316, #ec4899, #9333ea)', 
                              color: '#ffffff',
                              borderRadius: '0.5rem 1rem',
                              padding: '0.5rem 1rem',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              border: 'none',
                              cursor: 'pointer',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                          >
                            {isSubUpdating ? 'Saving...' : 'Approve / Pass'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}