import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import StudentBoard from './components/StudentProgressBoard';
import CourseEditor from './components/CourseEditor';
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
import { readLiveClasses, LIVE_CLASSES_KEY } from './utils/liveClasses';
import { fetchLiveClasses, migrateLocalLiveClasses, subscribeLiveClasses } from './utils/liveClassService';
import { supabase } from './utils/supabaseClient';

import { useAuth } from './context/AuthContext';
import { exportData, importData, deleteCourse } from './utils/storage';
import { withModuleClassification } from './utils/moduleTypes';
import { getAcademySettings, validateAccountKeyRemote } from './utils/academySettings';
import { profileFromRow } from './utils/profileShape';
import { loadCourses, saveCourse, uploadCourses } from './utils/courseService';
import phoenixLogo from './assets/Images/phoenix.jpg';
import './styles.css';

// Helper function to sanitize courses and strip orphaned/placeholder modules
const sanitizeCourses = (rawCourses) => {
  if (!Array.isArray(rawCourses)) return [];
  
  return rawCourses.map((course) => {
    if (!course || !course.lessons) return course;

    return {
      ...course,
      lessons: course.lessons.map((lesson) => {
        if (!lesson || !lesson.modules) return lesson;

        return {
          ...lesson,
          modules: lesson.modules
            .filter((mod) => {
              const modTitle = mod.title || mod.name || '';
              if (!mod.id || modTitle === 'New Module') {
                return false;
              }
              return true;
            })
            .map((mod) => withModuleClassification(mod)),
        };
      }),
    };
  });
};

export default function App() {
  const {
    currentUser: authUser,
    login,
    signUp,
    logout: contextLogout,
    refreshUser
  } = useAuth() || {};

  const [users, setUsers] = useState(() => {
    try {
      const saved = localStorage.getItem('app_users');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse users from localStorage', e);
      return [];
    }
  });

  const [courses, setCourses] = useState(() => {
    try {
      const saved = localStorage.getItem('app_courses');
      const parsed = saved ? JSON.parse(saved) : [];
      return sanitizeCourses(parsed);
    } catch (e) {
      console.error('Failed to parse courses from localStorage', e);
      return [];
    }
  });

  const [localUser, setLocalUser] = useState(null);
  const [liveClasses, setLiveClasses] = useState(() => readLiveClasses());
  const [liveClassNotice, setLiveClassNotice] = useState('');

  useEffect(() => {
    localStorage.setItem('app_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('app_courses', JSON.stringify(courses));
  }, [courses]);

  useEffect(() => {
    localStorage.setItem(LIVE_CLASSES_KEY, JSON.stringify(liveClasses));
  }, [liveClasses]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === LIVE_CLASSES_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          if (Array.isArray(parsed)) setLiveClasses(parsed);
        } catch (err) {
          console.error('Failed to sync live classes', err);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const user = authUser || localUser;

    (async () => {
      const remote = await fetchLiveClasses();
      if (cancelled) return;
      if (!remote.ok) {
        if (remote.missingTable) setLiveClassNotice(remote.message);
        return;
      }

      if (remote.rows.length === 0) {
        const migrated = await migrateLocalLiveClasses(user);
        if (cancelled || !migrated.ok) return;
        setLiveClassNotice('');
        setLiveClasses(migrated.rows);
        return;
      }

      setLiveClassNotice('');
      setLiveClasses(remote.rows);
    })();

    const channel = subscribeLiveClasses((rows) => {
      if (cancelled) return;
      setLiveClassNotice('');
      setLiveClasses(rows);
    });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [authUser, localUser]);

  useEffect(() => {
    if (!authUser?.id) return undefined;
    let cancelled = false;

    supabase.from('profiles').select('*').then(({ data, error }) => {
      if (cancelled || error) {
        if (error) console.error('Could not load profiles:', error.message);
        return;
      }
      const rows = (data || []).map(profileFromRow).filter(Boolean);
      if (!rows.some((user) => user.id === authUser.id)) {
        rows.push(profileFromRow({
          id: authUser.id,
          email: authUser.email,
          role: authUser.role,
          first_name: authUser.firstName,
          last_name: authUser.lastName,
          student_id: authUser.studentId
        }));
      }

      setUsers(rows);
    });

    loadCourses().then(async (result) => {
      if (cancelled || !result.ok) return;
      if (result.rows.length > 0) {
        setCourses(sanitizeCourses(result.rows));
        return;
      }

      const role = String(authUser.role || '').toLowerCase();
      const canUpload = ['admin', 'mentor', 'instructor'].includes(role);
      if (!canUpload) return;

      let localCourses = [];
      try {
        const saved = JSON.parse(localStorage.getItem('app_courses') || '[]');
        if (Array.isArray(saved)) localCourses = sanitizeCourses(saved);
      } catch (err) {
        console.error('Could not read saved courses:', err);
      }
      if (localCourses.length === 0) return;

      try {
        const uploaded = await uploadCourses(localCourses);
        if (!cancelled && uploaded.length > 0) setCourses(sanitizeCourses(uploaded));
      } catch (err) {
        console.error('Could not store courses in Supabase:', err);
      }
    });

    if (String(authUser.role || '').toLowerCase() === 'admin') {
      supabase.from('academy_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
        if (cancelled || !data) return;
        setAcademySettings({
          academyName: data.academy_name,
          ownerKey: data.owner_key,
          enrollmentKey: data.enrollment_key
        });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [authUser]);


  const [view, setView] = useState('dashboard');
  const [authView, setAuthView] = useState('signin');
  const [theme, setTheme] = useState('dark');
  const [academySettings, setAcademySettings] = useState(() => getAcademySettings());
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [resumeStepIndex, setResumeStepIndex] = useState(0);
  const [skipAutoResume, setSkipAutoResume] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
  }, [theme]);

  const activeUser = authUser || localUser;

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

  return (
    <div id='app-wrapper' className={theme}>
      <div id='layout'>
        <Sidebar
          setView={setView}
          currentView={view}
          onExportBackup={() => exportData({ users, courses, liveClasses })}
          onImportBackup={(file) => importData(file, setUsers, setCourses, setLiveClasses)}
          academyName={academySettings.academyName}
          courses={courses}
          currentUser={activeUser}
          onLogout={handleLogout}
        />

        <main id='content'>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 className='pf-title bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent' style={{ margin: 0 }}>
              {viewTitles[view] || view}
            </h1>
            <button
              className='theme-toggle'
              style={{ position: 'static' }}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </header>

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
              />
            )}

            {view === 'course-management' && isStaff && (
              <div className="course-management-container">
                <div className="flex justify-between items-center mb-6">
                  {!editingCourse && (
                    <button
                      onClick={() => {
                        const newCourse = {
                          id: `course_${Date.now()}`,
                          title: 'Untitled New Course',
                          description: '',
                          status: 'draft',
                          mentorKey: activeUser?.email || '',
                          assignedStudentKeys: [],
                          lessons: [
                            {
                              id: `lesson_${Date.now()}`,
                              title: 'Module 1: Introduction',
                              description: '',
                              modules: []
                            }
                          ]
                        };
                        setEditingCourse(newCourse);
                      }}
                      className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold"
                    >
                      <span>+</span> Create New Course
                    </button>
                  )}
                </div>

                {editingCourse ? (
                  <div>
                    <button
                      onClick={() => setEditingCourse(null)}
                      className="mb-4 text-sm text-gray-400 hover:text-white flex items-center gap-1"
                    >
                      ← Back to Course Management
                    </button>

                    <CourseEditor
                      course={editingCourse}
                      users={users}
                      currentUser={activeUser}
                      onSave={async (updatedCourse) => {
                        const saved = await persistCourse(updatedCourse);
                        if (saved) setEditingCourse(null);
                      }}
                      onCancel={() => setEditingCourse(null)}
                    />
                  </div>
                ) : (
                  <CourseList
                    courses={courses}
                    currentUser={activeUser}
                    users={users}
                    onEditCourse={(course) => setEditingCourse(course)}
                    onDeleteCourse={(courseOrId) => {
                      const course = typeof courseOrId === 'object'
                        ? courseOrId
                        : courses.find((item) => item.id === courseOrId);
                      if (course && window.confirm('Are you sure you want to delete this course?')) {
                        handleDeleteCourse(course);
                      }
                    }}
                    onApproveCourse={handleApproveCourse}
                    onSelectCourse={handleCourseSelection}
                  />
                )}
              </div>
            )}

            {view === 'course-outline' && (
              <CourseOutline
                course={courses.find((c) => c.id === selectedCourseId) || null}
                currentUser={activeUser}
                isStaff={isStaff}
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
                ) || null
              }
              onBack={() => setView('course-outline')}
              />
            )}

            {view === 'lesson' && (
              <LessonView
                key={`${selectedCourseId || 'no-course'}-${activeLessonId || 'no-lesson'}-${resumeStepIndex}`}
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
              <Messages currentUser={activeUser} users={users} />
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
                <StudentBoard courses={courses} users={users} currentUser={activeUser} />
            )}

            {view === 'reports' && isStaff && (
              <div>
                <h2 className='section-subheading'>Staff Reports & Overview</h2>
                <StudentBoard courses={courses} users={users} currentUser={activeUser} />
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

function AuthScreen({ view, setView, onSignIn, onCreate, onResetPassword, theme, setTheme }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [role, setRole] = useState('student');
  const [ownerKey, setOwnerKey] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const handleResetSubmit = (e) => {
    e.preventDefault();
    onResetPassword(email);
  };

  const handleSignInSubmit = (e) => {
    e.preventDefault();
    onSignIn(email, password);
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    onCreate(email, password, role, ownerKey, {
      firstName,
      lastName,
      studentId,
      securityQuestion,
      securityAnswer
    });
  };

  return (
    <div id='auth-container'>
      <div id='auth-card'>
        <button
          type='button'
          className='theme-toggle'
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>

        <img
          src={phoenixLogo}
          alt='Phoenix Fire Technical Academy'
          className='auth-logo'
        />
        <h1 className='app-title'>Phoenix Fire Technical Academy</h1>

        {view === 'signin' && (
          <form onSubmit={handleSignInSubmit}>
            <h2>Sign In</h2>
            <input
              className='input-wide'
              placeholder='Email'
              type='email'
              autoComplete='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className='input-wide'
              type='password'
              placeholder='Password'
              autoComplete='current-password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type='submit' className='btn'>
              Sign In
            </button>
            <button type='button' className='btn-secondary' onClick={() => setView('forgot')}>
              Forgot Password?
            </button>
            <button type='button' className='btn-secondary' onClick={() => setView('create')}>
              Create Account
            </button>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleResetSubmit}>
            <h2>Reset Password</h2>
            <input
              className='input-wide'
              placeholder='Email'
              type='email'
              autoComplete='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type='submit' className='btn'>
              Email Reset Link
            </button>
            <button type='button' className='btn-secondary' onClick={() => setView('signin')}>
              Back to Sign In
            </button>
          </form>
        )}

        {view === 'create' && (
          <form onSubmit={handleCreateSubmit}>
            <h2>Create Account</h2>
            <input
              className='input-wide'
              placeholder='First Name'
              autoComplete='given-name'
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              className='input-wide'
              placeholder='Last Name'
              autoComplete='family-name'
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <input
              className='input-wide'
              placeholder='Student ID'
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
            <input
              className='input-wide'
              placeholder='Email'
              type='email'
              autoComplete='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className='input-wide'
              type='password'
              placeholder='Password'
              autoComplete='new-password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <select
              className='input-wide'
              value={securityQuestion}
              onChange={(e) => setSecurityQuestion(e.target.value)}
            >
              <option value=''>Select Security Question</option>
              <option value='What was the name of your first pet?'>
                What was the name of your first pet?
              </option>
              <option value='What city were you born in?'>
                What city were you born in?
              </option>
              <option value='What was your first car?'>
                What was your first car?
              </option>
            </select>
            <input
              className='input-wide'
              placeholder='Security Answer'
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
            />
            <select
              className='input-wide'
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value='student'>Student</option>
              <option value='ta'>TA</option>
              <option value='instructor'>Instructor</option>
              <option value='mentor'>Mentor</option>
              <option value='admin'>Admin</option>
            </select>
            <input
              className='input-wide'
              placeholder={role === 'admin' ? 'Owner Key' : 'Enrollment Key'}
              value={ownerKey}
              onChange={(e) => setOwnerKey(e.target.value)}
            />
            <button type='submit' className='btn'>
              Create Account
            </button>
            <button type='button' className='btn-secondary' onClick={() => setView('signin')}>
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}