import React, { useEffect } from 'react';
import AppHeader from './components/AppHeader';
import AuthScreen from './components/AuthScreen';
import Sidebar from './components/Sidebar';
import StudentBoard from './components/StudentProgressBoard';
import CourseManagementPage from './components/CourseManagementPage';
import CourseList from './components/CourseList';
import LessonView from './components/LessonView';
import CourseOutline from './components/CourseOutline';
import FlashcardStudy from './components/FlashcardStudy';
import Messages from './components/Messages';
import SubmissionsDashboard from './components/SubmissionsDashboard';
import UserManagement from './components/UserManagement';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import LiveClasses from './components/LiveClasses';
import StudentLounge from './components/StudentLounge';

import { supabase } from './utils/supabaseClient';
import { useAuth } from './context/AuthContext';
import { exportData, importData, deleteCourse } from './utils/storage';
import { validateAccountKeyRemote } from './utils/academySettings';
import { useMessageInbox } from './hooks/useMessageInbox';
import { profileFromRow } from './utils/profileShape';
import { saveCourse } from './utils/courseService';
import { applyApprovedRestarts } from './utils/courseRestart';

import { useAppNavigation } from './hooks/useAppNavigation';
import { sanitizeCourses, useAcademyData } from './hooks/useAcademyData';
import './styles.css';



export default function App() {
  const {
    currentUser: authUser,
    login,
    signUp,
    logout: contextLogout,
    refreshUser
  } = useAuth() || {};

  const {
    users,
    setUsers,
    courses,
    setCourses,
    localUser,
    setLocalUser,
    liveClasses,
    setLiveClasses,
    liveClassNotice,
    academySettings,
    setAcademySettings
  } = useAcademyData(authUser);
  
  const {
    view,
    setView,
    authView,
    setAuthView,
    theme,
    setTheme,
    selectedCourseId,
    setSelectedCourseId,
    activeLessonId,
    setActiveLessonId,
    resumeStepIndex,
    setResumeStepIndex,
    skipAutoResume,
    setSkipAutoResume,
    editingCourse,
    setEditingCourse,
    progressRevision,
    setProgressRevision
  } = useAppNavigation();

  const activeUser = authUser || localUser;
  const messageInbox = useMessageInbox(activeUser, users);

  useEffect(() => {
    if (!activeUser || String(activeUser.role || '').toLowerCase() !== 'student') return undefined;
    let cancelled = false;

    const syncRestart = async () => {
      if (!courses.length) return;
      const changed = await applyApprovedRestarts(activeUser, courses);
      if (!cancelled && changed) setProgressRevision((value) => value + 1);
    };

    syncRestart();
    const timer = window.setInterval(syncRestart, 20000);
    window.addEventListener('focus', syncRestart);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', syncRestart);
    };
  }, [activeUser, courses]);

  /* --- Auth Handlers --- */
  const handleSignIn = async (email, password) => {
    try {
      await login(email, password);
      setView('dashboard');
    } catch (err) {
      alert(err.message || 'Invalid email or password.');
    }
  };

  const handleCreateAccount = async (email, password, role, ownerKey, profileData = {}) => {
    const {
      firstName = '',
      lastName = '',
      studentId = '',
      securityQuestion = '',
      securityAnswer = ''
    } = profileData;

    try {
      await validateAccountKeyRemote(role || 'student', ownerKey);
      const result = await signUp(email, password, {
        first_name: firstName,
        last_name: lastName,
        role: role || 'student',
        student_id: studentId
      });
      const userId = result?.user?.id;
      if (!userId || !result.session) {
        alert('Account created. Confirm the email, then sign in.');
        setAuthView('signin');
        return;
      }
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        role: role || 'student',
        student_id: studentId,
        security_question: securityQuestion,
        security_answer: securityAnswer
      });
      if (error) throw error;
      if (refreshUser) await refreshUser();
      setView('dashboard');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      alert(error.message);
      return false;
    }
    alert('Check your email for a reset link.');
    setAuthView('signin');
    return true;
  };

  const handleLogout = () => {
    setLocalUser(null);
    if (contextLogout) {
      contextLogout();
    }
    setAuthView('signin');
  };

  if (!activeUser) {
    return (
      <AuthScreen
        view={authView}
        setView={setAuthView}
        onSignIn={handleSignIn}
        onCreate={handleCreateAccount}
        onResetPassword={handleResetPassword}
        theme={theme}
        setTheme={setTheme}
      />
    );
  }

  const isStaff = ['instructor', 'ta', 'admin', 'mentor'].includes(activeUser.role);

  const viewTitles = {
    dashboard: 'Dashboard',
    courses: 'Courses',
    'course-management': 'Course Management',
    progress: 'Progress',
    reports: 'Reports & Analytics',
    submissions: 'Submissions',
    messages: 'Messages',
    'live-classes': 'Live Classes',
    lounge: 'Student Lounge',
    editor: 'Course Editor',
    users: 'User Management',
    settings: 'Account Settings',
    lesson: 'Lesson Viewer', 
    'course-outline': 'Course Contents',
    flashcards: 'Flashcards' 
  };

  const handleCourseSelection = (courseOrId) => {
    const targetId = typeof courseOrId === 'object' ? courseOrId?.id : courseOrId;
    setSelectedCourseId(targetId);
    setSkipAutoResume(false);
    setView('course-outline');
  };

  const handleOpenOutlineItem = ({ lessonId, stepIndex }) => {
    setActiveLessonId(lessonId);
    setResumeStepIndex(Number.isFinite(stepIndex) ? stepIndex : 0);
    setSkipAutoResume(true);
    setView('lesson');
  };

  const handleOpenFlashcards = ({ lessonId }) => {
    setActiveLessonId(lessonId);
    setView('flashcards');
  };

  const handleDeleteCourse = async (course) => {
    try {
      await deleteCourse(course.id);
      setCourses(prevCourses => prevCourses.filter(c => c.id !== course.id));
    } catch (err) {
      console.error('Failed to delete course and its submissions.', err);
      alert('Could not delete course. Please check the console');
    }
  };

  const persistCourse = async (course) => {
    try {
      const saved = await saveCourse(course);
      setCourses((prev) => {
        const rest = prev.filter((item) => item.id !== course.id && item.id !== saved.id);
        return sanitizeCourses([...rest, saved]);
      });
      return saved;
    } catch (err) {
      console.error(err);
      alert(err.message || 'Could not save this course to Supabase.');
      return null;
    }
  };

  const handleApproveCourse = async (courseOrId) => {
    const idToApprove = typeof courseOrId === 'object' ? courseOrId.id : courseOrId;
    const course = typeof courseOrId === 'object'
      ? courseOrId
      : courses.find((item) => item.id === idToApprove);
    if (!course) return;
    await persistCourse({ ...course, status: 'published' });
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || courses[0] || null;
  const selectedLesson =
    selectedCourse?.lessons?.find((l) => l.id === activeLessonId) ||
    selectedCourse?.lessons?.[0] ||
    null;

  const fillsWindow = view === 'messages' || view === 'lounge';

  return (
    <div id='app-wrapper' className={theme}>
      <div id='layout' className={fillsWindow ? 'layout-messages' : undefined}>
        <Sidebar
          setView={setView}
          currentView={view}
          onExportBackup={() => exportData({ users, courses, liveClasses })}
          onImportBackup={(file) => importData(file, setUsers, setCourses, setLiveClasses)}
          academyName={academySettings.academyName}
          courses={courses}
          currentUser={activeUser}
          onLogout={handleLogout}
          messageUnread={messageInbox.unreadCount}
        />

        <main id='content' className={fillsWindow ? 'content-messages' : undefined}>
          <AppHeader
            title={viewTitles[view] || view}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          />

          <div className='content-body'>
            {view === 'dashboard' && (
              <Dashboard
                currentUser={activeUser}
                courses={courses}
                users={users}
                onUpdateCourses={setCourses}
              />
            )}

            {view === 'courses' && (
              <CourseList
                courses={courses}
                currentUser={activeUser}
                users={users}
                onEditCourse={(course) => {
                  if (isStaff) {
                    setEditingCourse(course);
                    setView('course-management');
                  }
                }}
                onDeleteCourse={handleDeleteCourse}
                onApproveCourse={handleApproveCourse}
                onSelectCourse={handleCourseSelection}
                refreshKey={progressRevision}
              />
            )}

            {view === 'course-management' && isStaff && (
              <CourseManagementPage
                editingCourse={editingCourse}
                setEditingCourse={setEditingCourse}
                activeUser={activeUser}
                users={users}
                courses={courses}
                progressRevision={progressRevision}
                onSaveCourse={persistCourse}
                onDeleteCourse={handleDeleteCourse}
                onApproveCourse={handleApproveCourse}
                onSelectCourse={handleCourseSelection}
              />
            )}

            {view === 'course-outline' && (
              <CourseOutline
                course={courses.find((c) => c.id === selectedCourseId) || null}
                currentUser={activeUser}
                users={users}
                isStaff={isStaff}
                refreshKey={progressRevision}
                onBack={() => setView(isStaff ? 'course-management' : 'courses')}
                onOpenItem={handleOpenOutlineItem}
                onOpenFlashcards={handleOpenFlashcards}
              />
            )}

            {view === 'flashcards' && (
              <FlashcardStudy
                course={courses.find((c) => c.id === selectedCourseId) || null}
                lesson={(courses.find((c) => c.id === selectedCourseId)?.lessons || []).find(
                  (l) => l.id === activeLessonId
                ) || null}
                currentUser={activeUser}
                onBack={() => setView('course-outline')}
              />
            )}

            {view === 'lesson' && (
              <LessonView
                key={`${selectedCourseId || 'no-course'}-${activeLessonId || 'no-lesson'}-${resumeStepIndex}-${progressRevision}`}
                courses={courses}
                course={selectedCourse}
                lesson={selectedLesson}
                courseId={selectedCourseId}
                lessonId={activeLessonId}
                resumeStepIndex={resumeStepIndex}
                skipAutoResume={skipAutoResume}
                currentUser={activeUser}
                setCourses={setCourses}
                onBack={() => setView('course-outline')}
                onSelectLesson={(nextLesson) => {
                  setActiveLessonId(nextLesson.id || nextLesson._id);
                  setResumeStepIndex(0);
                  setSkipAutoResume(true);
                }}
              />
            )}

            {view === 'submissions' && isStaff && (
              <SubmissionsDashboard
                courses={courses}
                users={users}
                setCourses={setCourses}
                currentUser={activeUser} 
              />
            )}

            {view === 'messages' && (
              <Messages
                currentUser={activeUser}
                users={users}
                messages={messageInbox.rows}
                notices={messageInbox.notices}
                onOpenThread={messageInbox.markThreadRead}
                onSendMessage={messageInbox.sendMessage}
              />
            )}

            {view === 'live-classes' && (
              <LiveClasses
                currentUser={activeUser}
                courses={courses}
                users={users}
                sessions={liveClasses}
                onChange={setLiveClasses}
                remoteNotice={liveClassNotice}
              />
            )}

            {view === 'lounge' && (
              <StudentLounge currentUser={activeUser} />
            )}

            {view === 'users' && activeUser.role === 'admin' && (
              <UserManagement
                currentUser={activeUser}
                users={users}
                academySettings={academySettings}
                onUserUpdated={async (userId, formData) => {
                  const { error } = await supabase
                    .from('profiles')
                    .update({
                      email: formData.email || '',
                      first_name: formData.firstName || '',
                      last_name: formData.lastName || '',
                      role: formData.role || 'student',
                      student_id: formData.studentId || ''
                    })
                    .eq('id', userId);
                  if (error) {
                    alert(error.message);
                    return;
                  }
                  setUsers((prev) =>
                    prev.map((user) =>
                      user.id === userId
                        ? {
                            ...user,
                            email: formData.email,
                            firstName: formData.firstName,
                            lastName: formData.lastName,
                            role: formData.role,
                            studentId: formData.studentId
                          }
                        : user
                    )
                  );
                  alert('Account updated.');
                }}
                onUserCreated={async (existingUsers, formData) => {
                  try {
                    await validateAccountKeyRemote(formData.role || 'student', formData.accessKey);
                    const result = await signUp(formData.email, formData.password, {
                      first_name: formData.firstName,
                      last_name: formData.lastName,
                      role: formData.role || 'student',
                      student_id: formData.studentId
                    });
                    if (result?.user?.id && result.session) {
                      const { error } = await supabase.from('profiles').upsert({
                        id: result.user.id,
                        email: formData.email,
                        first_name: formData.firstName || '',
                        last_name: formData.lastName || '',
                        role: formData.role || 'student',
                        student_id: formData.studentId || ''
                      });
                      if (error) throw error;
                    }
                    const { data } = await supabase.from('profiles').select('*');
                    setUsers((data || []).map(profileFromRow).filter(Boolean));
                    alert('Account created in Supabase. If you were signed out, sign in again.');
                  } catch (err) {
                    alert(err.message);
                  }
                }}
                
              />
            )}

            {view === 'progress' && (
                <StudentBoard courses={courses} users={users} currentUser={activeUser} refreshKey={progressRevision} />
            )}

            {view === 'reports' && isStaff && (
              <div>
                <h2 className='section-subheading'>Staff Reports & Overview</h2>
                <StudentBoard courses={courses} users={users} currentUser={activeUser} refreshKey={progressRevision} />
              </div>
            )}

            {view === 'settings' && (
              <Settings
                currentUser={activeUser}
                theme={theme}
                setTheme={setTheme}
                academySettings={academySettings}
                onSaveAcademy={setAcademySettings}
                onSaveUser={async (updated) => {
                  const { error } = await supabase
                    .from('profiles')
                    .update({
                      first_name: updated.firstName || '',
                      last_name: updated.lastName || '',
                      email: updated.email || activeUser.email
                    })
                    .eq('id', updated.id);
                  if (error) {
                    alert(error.message);
                    return;
                  }
                  setUsers((prev) =>
                    prev.map((u) =>
                      u.id === updated.id || u.email === updated.email ? { ...u, ...updated } : u
                    )
                  );
                  if (refreshUser) await refreshUser();
                }}
              />
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
