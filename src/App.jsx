import React, { useState, useEffect } from 'react';

/* ==========================================================================
   HELPERS & DATA STRUCTURES
   ========================================================================== */

// Helper to extract student feedback history across all courses
const getStudentFeedbackHistory = (courses, currentUser) => {
  if (!currentUser || !courses) return [];
  const history = [];

  courses.forEach((course) => {
    if (course.modules) {
      course.modules.forEach((module) => {
        if (module.feedback && module.feedback[currentUser.id]) {
          const userFeedbackList = module.feedback[currentUser.id];
          if (Array.isArray(userFeedbackList)) {
            userFeedbackList.forEach((fb) => {
              history.push({
                courseId: course.id,
                courseTitle: course.title,
                moduleId: module.id,
                moduleTitle: module.title,
                lessonId: module.lessonId || null,
                feedbackText: fb.text || fb.feedback || '',
                date: fb.date || fb.timestamp || new Date().toISOString(),
                status: fb.status || 'pending'
              });
            });
          }
        }
      });
    }
  });

  return history.sort((a, b) => new Date(b.date) - new Date(a.date));
};

/* ==========================================================================
   SUB-COMPONENTS
   ========================================================================== */

function StudentProgressBoard({ courses, users }) {
  const students = users ? users.filter((u) => u.role === 'student') : [];

  return (
    <div style={{ marginTop: '20px' }}>
      <h3>Student Progress Tracking</h3>
      {students.length === 0 ? (
        <p>No students registered.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {students.map((student) => (
            <div key={student.id} className='course-box'>
              <h4>
                {student.firstName || student.email} {student.lastName || ''} (
                {student.studentId || 'No ID'})
              </h4>
              <ul>
                {courses.map((course) => {
                  const totalModules = course.modules
                    ? course.modules.length
                    : 0;
                  const approvedModules = course.modules
                    ? course.modules.filter(
                        (m) =>
                          m.feedback &&
                          m.feedback[student.id] &&
                          m.feedback[student.id].some(
                            (f) => f.status === 'approved'
                          )
                      ).length
                    : 0;
                  const percent =
                    totalModules > 0
                      ? Math.round((approvedModules / totalModules) * 100)
                      : 0;

                  return (
                    <li key={course.id}>
                      <strong>{course.title}:</strong> {approvedModules} /{' '}
                      {totalModules} Modules Approved ({percent}%)
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   MAIN APP COMPONENT
   ========================================================================== */

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [view, setView] = useState('signin'); // 'signin', 'create', 'forgot', 'dashboard', 'course', 'lesson', 'studentProgress'
  const [theme, setTheme] = useState('dark');
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);

  // Apply theme class to document body
  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
  }, [theme]);

  /* --- Auth Handlers --- */
  const handleSignIn = (email, password) => {
    const user = users.find(
      (u) => u.email === email && u.password === password
    );
    if (user) {
      setCurrentUser(user);
      setView('dashboard');
    } else {
      alert('Invalid email or password.');
    }
  };

  const handleCreateAccount = (
    email,
    password,
    role,
    ownerKey,
    profileData
  ) => {
    if (users.some((u) => u.email === email)) {
      alert('User with this email already exists.');
      return;
    }
    const newUser = {
      id: Date.now().toString(),
      email,
      password,
      role,
      ...profileData
    };
    setUsers([...users, newUser]);
    setCurrentUser(newUser);
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
      users[userIndex].securityAnswer.toLowerCase() !==
        securityAnswer.toLowerCase()
    ) {
      alert('Incorrect security answer.');
      return false;
    }
    const updatedUsers = [...users];
    updatedUsers[userIndex].password = newPassword;
    setUsers(updatedUsers);
    alert('Password updated successfully!');
    setView('signin');
    return true;
  };

  const markFeedbackAsRead = (courseId, moduleId, date) => {
    // Logic for updating feedback status locally
    setCourses((prevCourses) =>
      prevCourses.map((c) => {
        if (c.id !== courseId) return c;
        return {
          ...c,
          modules: c.modules.map((m) => {
            if (m.id !== moduleId) return m;
            const userFb = m.feedback ? m.feedback[currentUser.id] : [];
            return {
              ...m,
              feedback: {
                ...m.feedback,
                [currentUser.id]: userFb.map((f) =>
                  f.date === date ? { ...f, read: true } : f
                )
              }
            };
          })
        };
      })
    );
  };

  const handleExportData = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify({ users, courses }));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'lms_backup.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportData = (e) => {
    const fileReader = new FileReader();
    fileReader.readAsText(e.target.files[0], 'UTF-8');
    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.users) setUsers(parsed.users);
        if (parsed.courses) setCourses(parsed.courses);
        alert('Data imported successfully!');
      } catch (err) {
        console.error(err);
        alert('Invalid JSON file format.');
      }
    };
  };

  // Auth Guard
  if (!currentUser) {
    return (
      <AuthScreen
        view={view}
        setView={setView}
        onSignIn={handleSignIn}
        onCreate={handleCreateAccount}
        onResetPassword={handleResetPassword}
        theme={theme}
        setTheme={setTheme}
      />
    );
  }

  const isStaff = currentUser.role === 'admin' || currentUser.role === 'mentor';
  const visibleCourses = courses;

  return (
    <div id='app-wrapper' className={theme}>
      {/* SIDEBAR NAVIGATION */}
      <aside id='sidebar'>
        <div className='sidebar-header'>
          <h3>Phoenix LMS</h3>
          <p>
            {currentUser.firstName} ({currentUser.role})
          </p>
        </div>
        <nav>
          <button onClick={() => setView('dashboard')}>Dashboard</button>
          {isStaff && (
            <button onClick={() => setView('studentProgress')}>
              Student Progress
            </button>
          )}
          <button
            onClick={() => {
              setCurrentUser(null);
              setView('signin');
            }}
          >
            Sign Out
          </button>
        </nav>
        <div className='sidebar-footer'>
          <button onClick={handleExportData}>Export Backup</button>
          <label className='btn-file-input'>
            Import Backup
            <input
              type='file'
              accept='.json'
              onChange={handleImportData}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main id='main-content'>
        <header style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h1>
            {view === 'dashboard'
              ? 'Dashboard'
              : view === 'lesson'
                ? 'Lesson View'
                : 'Student Progress'}
          </h1>
          <button
            className='theme-toggle'
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </header>

        <div className='content-body'>
          {view === 'dashboard' && (
            <div>
              {!isStaff && (
                <>
                  {/* FEEDBACK HISTORY SECTION */}
                  <h2 style={{ marginTop: 40, color: '#f472b6' }}>
                    Mentor Feedback Archive
                  </h2>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    {getStudentFeedbackHistory(courses, currentUser).length ===
                    0 ? (
                      <p style={{ color: '#94e3b8' }}>
                        No feedback history found yet.
                      </p>
                    ) : (
                      getStudentFeedbackHistory(courses, currentUser).map(
                        (item, idx) => (
                          <div
                            key={idx}
                            className='course-box'
                            style={{ borderLeft: '4px solid #f472b6' }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '5px'
                              }}
                            >
                              <strong style={{ color: '#60a5fa' }}>
                                {item.moduleTitle}
                              </strong>
                              <span style={{ fontSize: '0.8em', opacity: 0.7 }}>
                                {new Date(item.date).toLocaleDateString()}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontStyle: 'italic' }}>
                              "{item.feedbackText}"
                            </p>
                            <div
                              style={{ marginTop: '5px', fontSize: '0.85em' }}
                            >
                              Status:{' '}
                              <span
                                style={{
                                  color:
                                    item.status === 'approved'
                                      ? '#22c55e'
                                      : '#f59e0b'
                                }}
                              >
                                {item.status.toUpperCase()}
                              </span>
                            </div>

                            <button
                              className='btn-inline'
                              style={{ fontSize: '0.75em', padding: '4px 8px' }}
                              onClick={() => {
                                markFeedbackAsRead(
                                  item.courseId,
                                  item.moduleId,
                                  item.date
                                );
                                setSelectedCourseId(item.courseId);
                                setActiveLessonId(item.lessonId);
                                setView('lesson');
                              }}
                            >
                              View Lesson
                            </button>
                          </div>
                        )
                      )
                    )}
                  </div>
                </>
              )}

              {isStaff && (
                <>
                  <h2 style={{ marginTop: 0, color: '#f472b6' }}>
                    Student Progress
                  </h2>
                  <p style={{ color: '#cbd5e1' }}>
                    Progress is based on approved assignments (module unlocks).
                  </p>

                  <StudentProgressBoard
                    courses={visibleCourses}
                    users={users}
                  />
                </>
              )}
            </div>
          )}

          {/* LESSON VIEW */}
          {view === 'lesson' && (
            <div className='course-box'>
              <h2>Selected Lesson</h2>
              <p>
                <strong>Course ID:</strong> {selectedCourseId || 'N/A'}
              </p>
              <p>
                <strong>Lesson ID:</strong> {activeLessonId || 'N/A'}
              </p>
              <button className='btn' onClick={() => setView('dashboard')}>
                Back to Dashboard
              </button>
            </div>
          )}

          {/* STAFF PROGRESS BOARD (Mentor/Admin) */}
          {view === 'studentProgress' && isStaff && (
            <StudentProgressBoard courses={visibleCourses} users={users} />
          )}
        </div>
      </main>
    </div>
  );
}

/* ==========================================================================
   AUTH SCREEN
   ========================================================================== */
function AuthScreen({
  view,
  setView,
  onSignIn,
  onCreate,
  onResetPassword,
  theme,
  setTheme
}) {
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

  const handleResetSubmit = () => {
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

  return (
    <div id='auth-container'>
      <div id='auth-card'>
        <button
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
          <>
            <h2>Sign In</h2>

            <input
              className='input-wide'
              placeholder='Email'
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className='input-wide'
              type='password'
              placeholder='Password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button className='btn' onClick={() => onSignIn(email, password)}>
              Sign In
            </button>

            <button className='btn-secondary' onClick={() => setView('forgot')}>
              Forgot Password?
            </button>

            <button className='btn-secondary' onClick={() => setView('create')}>
              Create Account
            </button>
          </>
        )}

        {view === 'create' && (
          <>
            <h2>Create Account</h2>

            <input
              className='input-wide'
              placeholder='First Name'
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />

            <input
              className='input-wide'
              placeholder='Last Name'
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className='input-wide'
              type='password'
              placeholder='Password'
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
              <option value='mentor'>Mentor</option>
              <option value='admin'>Admin</option>
            </select>

            <input
              className='input-wide'
              placeholder='Owner Key'
              value={ownerKey}
              onChange={(e) => setOwnerKey(e.target.value)}
            />

            <button
              className='btn'
              onClick={() =>
                onCreate(email, password, role, ownerKey, {
                  firstName,
                  lastName,
                  studentId,
                  securityQuestion,
                  securityAnswer
                })
              }
            >
              Create Account
            </button>

            <button className='btn-secondary' onClick={() => setView('signin')}>
              Back
            </button>
          </>
        )}

        {/* FORGOT PASSWORD */}
        {view === 'forgot' && (
          <>
            <h2>Reset Password</h2>
            <p
              style={{
                fontSize: '0.85em',
                color: '#cbd5e1',
                marginBottom: '10px'
              }}
            >
              Enter your email to reset your password.
            </p>

            <input
              className='input-wide'
              placeholder='Account Email'
              type='email'
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <input
              className='input-wide'
              type='password'
              placeholder='Confirm New Password'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <button className='btn' onClick={handleResetSubmit}>
              Update Password
            </button>

            <button className='btn-secondary' onClick={() => setView('signin')}>
              Back to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}
