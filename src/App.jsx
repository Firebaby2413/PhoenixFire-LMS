import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import StudentBoard from './components/StudentProgressBoard';
import CourseEditor from './components/CourseEditor';
import CourseList from './components/CourseList';
import LessonView from './components/LessonView';
import Messages from './components/Messages';
import SubmissionsDashboard from './components/SubmissionsDashboard';
import UserManagement from './components/UserManagement';
import Dashboard from './components/Dashboard';

import { useAuth } from './context/AuthContext';
import { exportData, importData, deleteCourse } from './utils/storage';
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
          modules: lesson.modules.filter((mod) => {
            const modTitle = mod.title || mod.name || '';
            if (!mod.id || modTitle === 'New Module') {
              return false;
            }
            return true;
          }),
        };
      }),
    };
  });
};

export default function App() {
  const { currentUser: authUser, logout: contextLogout } = useAuth() || {};

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

  useEffect(() => {
    localStorage.setItem('app_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('app_courses', JSON.stringify(courses));
  }, [courses]);


  const [view, setView] = useState('dashboard');
  const [authView, setAuthView] = useState('signin');
  const [theme, setTheme] = useState('dark');
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
  }, [theme]);

  const activeUser = authUser || localUser;

  /* --- Auth Handlers --- */
  const handleSignIn = (email, password) => {
    const user = users.find((u) => u.email === email && u.password === password);
    if (user) {
      setLocalUser(user);
      setView('dashboard');
    } else {
      alert('Invalid email or password.');
    }
  };

  const handleCreateAccount = (email, password, role, ownerKey, profileData = {}) => {
    const {
      firstName = '',
      lastName = '',
      studentId = '',
      securityQuestion = '',
      securityAnswer = ''
    } = profileData;

    if (users.some((u) => u.email === email)) {
      alert('User with this email already exists.');
      return;
    }

    const newUser = {
      id: Date.now().toString(),
      email,
      password,
      role: role || 'student',
      ownerKey,
      studentId,
      firstName,
      lastName, 
      name: `${firstName} ${lastName}`.trim() || email.split('@')[0],
      securityQuestion,
      securityAnswer
    };
    setUsers((prev) => [...prev, newUser]);
    setLocalUser(newUser);
    setView('dashboard');
  };

  const handleResetPassword = (email, newPassword, securityAnswer) => {
    const userIndex = users.findIndex((u) => u.email === email);
    if (userIndex === -1) {
      alert('User not found.');
      return false;
    }
    if (
      users[userIndex].securityAnswer &&
      users[userIndex].securityAnswer.toLowerCase() !== securityAnswer.toLowerCase()
    ) {
      alert('Incorrect security answer.');
      return false;
    }
    const updatedUsers = [...users];
    updatedUsers[userIndex].password = newPassword;
    setUsers(updatedUsers);
    alert('Password updated successfully!');
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
    editor: 'Course Editor',
    users: 'User Management',
    settings: 'Account Settings',
    lesson: 'Lesson Viewer'
  };

  const handleCourseSelection = (courseOrId) => {
    const targetId = typeof courseOrId === 'object' ? courseOrId?.id : courseOrId;
    const targetCourse = courses.find((c) => c.id === targetId);

    setSelectedCourseId(targetId);

    const firstLessonId =
      targetCourse?.lessons?.[0]?.id ||
      targetCourse?.modules?.[0]?.id ||
      null;

    setActiveLessonId(firstLessonId);
    setView('lesson');
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
          onExportBackup={() => exportData({ users, courses })}
          onImportBackup={(file) => importData(file, setUsers, setCourses)}
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
                onApproveCourse={(courseOrId) => {
                  const idToApprove = typeof courseOrId === 'object' ? courseOrId.id : courseOrId;
                  setCourses((prev) =>
                    prev.map((c) => (c.id === idToApprove ? { ...c, status: 'published' } : c))
                  );
                }}
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
                      onSave={(updatedCourse) => {
                        setCourses((prev) => {
                          const exists = prev.some((c) => c.id === updatedCourse.id);
                          if (exists) {
                            return prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c));
                          }
                          return [...prev, updatedCourse];
                        });
                        setEditingCourse(null);
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
                      const idToDelete = typeof courseOrId === 'object' ? courseOrId.id : courseOrId;
                      if (window.confirm('Are you sure you want to delete this course?')) {
                        setCourses((prev) => prev.filter((c) => c.id !== idToDelete));
                      }
                    }}
                    onApproveCourse={(courseOrId) => {
                      const idToApprove = typeof courseOrId === 'object' ? courseOrId.id : courseOrId;
                      setCourses((prev) =>
                        prev.map((c) => (c.id === idToApprove ? { ...c, status: 'published' } : c))
                      );
                    }}
                    onSelectCourse={handleCourseSelection}
                  />
                )}
              </div>
            )}

            {view === 'lesson' && (
              <LessonView
                key={`${selectedCourseId || 'no-course'}-${activeLessonId || 'no-lesson'}`}
                courses={courses}
                course={selectedCourse}
                lesson={selectedLesson}
                courseId={selectedCourseId}
                lessonId={activeLessonId}
                currentUser={activeUser}
                setCourses={setCourses}
                onBack={() => setView(isStaff ? 'course-management' : 'courses')}
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

            {view === 'users' && activeUser.role === 'admin' && (
              <UserManagement
                currentUser={activeUser}
                users={users}
                onUserCreated={(existingUsers, email, password, role, studentId, securityQuestion, securityAnswer) => {
                  const newUser = {
                    id: Date.now().toString(),
                    email,
                    password,
                    role: role || 'student',
                    studentId,
                    securityQuestion,
                    securityAnswer
                  };
                  setUsers((prev) => [...prev, newUser]);
                }}
                onUserDeleted={(userIdOrEmail) => {
                  setUsers((prev) => prev.filter((u) => u.id !== userIdOrEmail && u.email !== userIdOrEmail));
                }}
              />
            )}

            {view === 'progress' && (
              <div>
                <h2 className='section-subheading'>
                  {isStaff ? 'Progress Tracking' : 'My Progress'}
                </h2>
                <StudentBoard courses={courses} users={users} currentUser={activeUser} />
              </div>
            )}

            {view === 'reports' && isStaff && (
              <div>
                <h2 className='section-subheading'>Staff Reports & Overview</h2>
                <StudentBoard courses={courses} users={users} currentUser={activeUser} />
              </div>
            )}

            {view === 'settings' && (
              <div>
                <h2 className='section-subheading'>Account Settings</h2>
                <div className="course-box" style={{ padding: '20px' }}>
                  <p style={{ opacity: 0.8 }}>Logged in as: <strong>{activeUser?.email}</strong></p>
                  <p style={{ opacity: 0.8 }}>Role: <strong style={{ textTransform: 'uppercase' }}>{activeUser?.role}</strong></p>
                </div>
              </div>
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [role, setRole] = useState('student');
  const [ownerKey, setOwnerKey] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const handleResetSubmit = (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    const success = onResetPassword(email, password, securityAnswer);
    if (success) {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setSecurityAnswer('');
    }
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
          src='/src/assets/Images/phoenix.jpg'
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
            <input
              className='input-wide'
              placeholder='Security Answer'
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
            />
            <input
              className='input-wide'
              type='password'
              placeholder='New Password'
              autoComplete='new-password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              className='input-wide'
              type='password'
              placeholder='Confirm New Password'
              autoComplete='new-password'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button type='submit' className='btn'>
              Reset Password
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
              placeholder='Owner Key'
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