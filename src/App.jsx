import { useEffect, useMemo, useState } from "react";

import MarkdownPreview from "./components/MarkdownPreview";
import CourseEditor from "./components/CourseEditor";
import Sidebar from "./components/Sidebar";
import CourseList from "./components/CourseList";
import LessonView from "./components/LessonView";
import SubmissionsDashboard from "./components/SubmissionsDashboard";
import StudentProgressBoard from "./components/StudentProgressBoard";

import { calculateCourseProgress } from "./utils/progress";
import * as storage from "./utils/storage.js";
import * as auth from "./utils/authService.js";

import "./styles.css";

/* =====================
  CONSTANTS
===================== */
const LS_USERS = "pfta_users";
const LS_CURRENT = "pfta_CurrentUser";
const LS_COURSES = "pfta_courses";
const OWNER_KEY = "FireKey-Creation-2026";
const OWNER_ACCOUNT = "PhoenixFireTechnical@gmail.com";

/* =====================
  HELPERS
===================== */
function newId() {
  if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeCourses(courses) {
  // Migrates old data shapes to the new stable shape:
  // module.assignment (single assignment)
  return (courses || []).map((course) => ({
    ...course,
    lessons: (course.lessons || []).map((lesson) => ({
      ...lesson,
      modules: (lesson.modules || []).map((mod) => {
        // Already new shape:
        if (mod.assignment) {
          if (
            mod.assignment.submission &&
            !mod.assignment.submissions
          ) {
            mod.assignment.submissions = mod.assignment.submission;
            delete mod.assignment.submission;
          }
          return mod;
        }
          

        // Old: assignments array
        const a0 = Array.isArray(mod.assignments) ? mod.assignments[0] : null;

        // Old: mod.submissions
        const legacySubmissions = Array.isArray(mod.submissions) ? mod.submissions : [];

        return {
          ...mod,
          assignment: {
            instructionsText: a0?.instructions ?? "",
            instructionsVideoUrl: a0?.instructionsVideoUrl ?? "",
            submissions: Array.isArray(a0?.submissions) ? a0.submissions : legacySubmissions,
          },
        };
      }),
    })),
  }));
}

function matchesStudent(submissionStudent, user) {
  if (!submissionStudent || !user) return false;
  return (
    submissionStudent === user?.studentId ||
    submissionStudent === user?.email ||
    submissionStudent === user?.username
  );
}


function canAccessModuleByPrereq(lesson, modIndex, currentUser) {
  if (modIndex === 0) return true;

  const prevModule = lesson.modules?.[modIndex - 1];
  const assignment = prevModule?.assignment;
  if (!assignment) return false;

  return (assignment.submissions || []).some(
    (s) => matchesStudent(s.student, currentUser) && s.status === "approved"
  );
}

function isLessonCompletedForStudent(lesson, currentUser) {
  const modules = lesson?.modules || [];
  if (modules.length === 0) return false;

  return modules.every((mod) =>
    (mod.assignment?.submissions || []).some(
      (s) => 
        matchesStudent(s.student, currentUser) &&
        s.status === "approved"
    )
  );
}

/* =====================
  APP
===================== */
export default function App() {
  const [users, setUsers] = useState(() => auth.initializeUsers());

  const [currentUser, setCurrentUser] = useState(() => storage.loadCurrentUser());
    

  const [courses, setCourses] = useState(() => 
    normalizeCourses(storage.loadCourses())
  );
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("pf-theme") || "dark";
  });
  const [view, setView] = useState("signin"); // signin | dashboard | courses | courseDetail | lesson | progress | studentProgress | submissions | users | messages | reports | settings
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [activeLessonId, setActiveLessonId] = useState(null);

  const isStudent = currentUser?.role === "student";
  const isStaff = currentUser?.role === "admin" || currentUser?.role === "mentor";

  const safeViewTitle = useMemo(() => {
    if (!view) return "";
    return String(view).toUpperCase();
  }, [view]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );

  const courseBeingEdited = useMemo(
    () => courses.find((c) => c.id === editingCourseId) || null,
    [courses, editingCourseId]
  );

  const activeLesson = useMemo(() => {
    if (!selectedCourse || !activeLessonId) return null;
    return (selectedCourse.lessons || []).find((l) => l.id === activeLessonId) || null;
  }, [selectedCourse, activeLessonId]);

  useEffect(() => {
    storage.saveCourses(courses);
  }, [courses]);

  useEffect(() => {
    if (currentUser) {
      storage.saveCurrentUser(currentUser);
      setView("dashboard");
    } else {
      storage.clearCurrentUser();
      setView("signin");
    }
  }, [currentUser]);

  useEffect(() => {
    if (!selectedCourseId) return;
    const exists = courses.some((c) => c.id === selectedCourseId);
    if (!exists) {
      setSelectedCourseId(null);
      setActiveLessonId(null);
      setPreviewMode(false);
      if (view === "courseDetail" || view === "lesson") setView("courses");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses]);

  useEffect(() => {
    document.body.classList.remove("dark", "light");
    document.body.classList.add(theme);
    localStorage.setItem("pf-theme", theme);
  }, [theme]);

  /* =====================
    AUTH
  ===================== */
  function signIn(email, password) {
    try {
      const user = auth.signInUser(users, email, password);
      setCurrentUser(user);
    } catch (err) {
      alert(err.message);
    }
  }

  function signOut() {
    storage.clearCurrentUser();
    setCurrentUser(null);

    // reset UI state
    setSelectedCourseId(null);
    setEditingCourseId(null);
    setActiveLessonId(null);
    setPreviewMode(false);
    setView("signin");
  }

  function createAccount(email, password, role, ownerKey, profile) {
    // Runtime guards
    if (!email || typeof email !== "string") {
      alert("Create Account Error: email is required");
      return;
    }

    if (!password || typeof password !== "string") {
      alert("Create Account Error: password is required");
      return;
    }

    if (!role || typeof role !== "string") {
      alert("Create Account Error: role is required");
      return;
    }

    if (!profile || typeof profile !== "object") {
      alert("Create Account Error: profile object is missing");
      return;
    }

    const { firstName, lastName, studentId } = profile;

    if (!firstName || !lastName) {
      alert("Create Account Error: first and last name are required");
      return;
    }

    if (role === "student" && !studentId) {
      alert("Create Account Error: studentId is required for students");
      return;
    }

    if (role === "admin" && !ownerKey) {
      alert("Create Account Error: owner key is required for admins");
      return;
    }
    try {
      const updatedUsers = auth.createUser(
        users,
        email,
        password,
        role,
        ownerKey,
        profile.firstName,
        profile.lastName,
        profile.studentId
      );

      setUsers(updatedUsers);
      alert("Account created");
      setView("signin");
    } catch (err) {
      alert(err.message);
    }
  }

  if (!currentUser) {
    return (
      <AuthScreen
        view={view}
        setView={setView}
        onSignIn={signIn}
        onCreate={createAccount}
        theme={theme}
        setTheme={setTheme}
      />
    );
  }

  /* =====================
    COURSE ACTIONS
  ===================== */
  function handleCreateCourse() {
    const title = window.prompt("Course title?");
    if (!title) return;

    const description = window.prompt("Course description?") || "";

    const newCourse = {
      id: newId(),
      title,
      description,
      lessons: [],
    };

    setCourses((prev) => [...prev, newCourse]);
    setSelectedCourseId(newCourse.id);
    setEditingCourseId(newCourse.id);
    setView("courses");
  }

  /* =====================
    UI
  ===================== */
  return (
    <div id="layout">
      <Sidebar
        currentUser={currentUser}
        isStudent={isStudent}
        isStaff={isStaff}
        setView={setView}
        signOut={signOut}
        theme={theme}
        setTheme={setTheme}
      />

      <main id="content">
        <div className="section-container">
          <h1 style={{ marginTop: 0, color: "#f59e0b" }}>{safeViewTitle}</h1>

          {view === "dashboard" && (
            <div>
              <p>Welcome to Phoenix Fire LMS.</p>

              {currentUser?.role === "admin" && (
                <p>You have full administrative access.</p>
              )}

              {currentUser?.role === "mentor" && (
                <p>You have mentor tools for reviewing submissions, reports, and progress.</p>
              )}
              
              {currentUser?.role === "student" && (
                <p>You can view courses, submit assignment, and track your progress.</p>
              )}
            </div>
          )}

          {/* COURSES */}
          {view === "courses" && (
            <>
              {courseBeingEdited ? (
                <CourseEditor
                  course={courseBeingEdited}
                  onSave={(updatedCourse) => {
                    setCourses((prev) =>
                      prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c))
                    );
                    setEditingCourseId(null);
                    setView("courseDetail");
                    setSelectedCourseId(updatedCourse.id);
                  }}
                  onCancel={() => setEditingCourseId(null)}
                />
              ) : (
                <CourseList
                  courses={courses}
                  currentUser={currentUser}
                  isStudent={isStudent}
                  isStaff={isStaff}
                  onCreateCourse={handleCreateCourse}
                  onOpenCourse={(course) => {
                    setSelectedCourseId(course.id);
                    setPreviewMode(false);
                    setActiveLessonId(null);
                    setView("courseDetail");
                  }}
                  onEditCourse={(course) => {
                    setEditingCourseId(course.id);
                    setView("courses");
                  }}
                  onDeleteCourse={(course) => {
                    const ok = window.confirm("Delete this course?");
                    if (!ok) return;

                    setCourses((prev) => prev.filter((c) => c.id !== course.id));

                    if (selectedCourseId === course.id) {
                      setSelectedCourseId(null);
                      setView("courses");
                    }
                  }}
                />
              )}
            </>
          )}

          {/* COURSE DETAIL */}
          {view === "courseDetail" && selectedCourse && (
            <div>
              <button
                onClick={() => {
                  setSelectedCourseId(null);
                  setPreviewMode(false);
                  setActiveLessonId(null);
                  setView("courses");
                }}
                style={{
                  marginBottom: 12,
                  background: "#334155",
                  color: "#e5e7eb",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Back to courses
              </button>

              <h2 style={{ marginTop: 0, color: "#f472b6" }}>
                {selectedCourse.title}
              </h2>

              <p style={{ color: "#cbd5e1" }}>
                {selectedCourse.description}
              </p>

              {isStaff && (
                <button
                  onClick={() => {
                    setEditingCourseId(selectedCourse.id);
                    setView("courses");
                  }}
                  style={{
                    marginBottom: 12,
                    background: "#a855f7",
                    color: "#0b1220",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: 10,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Update Course content
                </button>
              )}

              {isStaff && (
                <button
                  onClick={() => setPreviewMode((p) => !p)}
                  style={{
                    marginBottom: 12,
                    marginLeft: 8,
                    background: "#60a5fa",
                    color: "#0b1220",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: 10,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {previewMode ? "Exit Preview" : "Preview as Student"}
                </button>
              )}

              {!previewMode && (
                <div>
                  <h3 style={{ color: "#60a5fa" }}>Lessons</h3>

                  {(selectedCourse.lessons || []).map((lesson) => {
                    const completed = isStudent
                      ? isLessonCompletedForStudent(lesson, currentUser)
                      : false;

                  return (
                    <div key={lesson.id} style={{ marginBottom: 8 }}>
                      <button
                        onClick={() => {
                          setActiveLessonId(lesson.id);
                          setView("lesson");
                        }}
                        style={{
                          background: "#111827",
                          color: "#e5e7eb",
                          border: "1px solid #334155",
                          padding: "10px 12px",
                          borderRadius: 12,
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        {lesson.title} {completed ? "🏅" : ""}
                      </button>
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          )}
          
          {/* LESSON */}
          {view === "lesson" && activeLesson && selectedCourse && (
            <div>
              <button
                onClick={() => {
                  setActiveLessonId(null);
                  setView("courseDetail");
                }}
                style={{
                  marginBottom: 12,
                  background: "#334155",
                  color: "#e5e7eb",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Back to Course
              </button>

              <LessonView
                lesson={activeLesson}
                selectedCourseId={selectedCourseId}
                currentUser={currentUser}
                isStudent={isStudent}
                isStaff={isStaff}
                previewMode={previewMode}
                setCourses={setCourses}
                canAccessModuleByPrereq={canAccessModuleByPrereq}
                newId={newId}
              />
            </div>
          )}

          {view === "submissions" && isStaff && (
            <SubmissionsDashboard
              courses={courses}
              setCourses={setCourses}
            />
          )}

          {/* PROGRESS */}
          {view === "progress" && (
            <div>
              {isStudent && (
                <>
                  <h2 style={{ marginTop: 0, color: "#f472b6" }}>
                    My Progress
                  </h2>

                  {courses.length === 0 && <p>No courses yet.</p>}

                  {courses.map((course) => {
                    const studentKey = 
                      currentUser.studentId ??
                      currentUser.email ??
                      currentUser.username;

                    const percent = calculateCourseProgress(course, studentKey);
                    return (
                      <div
                        key={course.id}
                        style={{
                          border: "1px solid #334155",
                          padding: 12,
                          marginBottom: 12,
                          borderRadius: 14,
                          background: "#111827",
                        }}
                      >
                        <h3 style={{ marginTop: 0, color: "#60a5fa" }}>
                          {course.title}
                        </h3>

                        <div
                          style={{
                            background: "#334155",
                            borderRadius: 999,
                            overflow: "hidden",
                            height: 14,
                            marginBottom: 6,
                          }}
                        >
                          <div
                            style={{
                              width: `${percent}%`,
                              background: "#22c55e",
                              height: "100%",
                            }}
                          />
                        </div>

                        <strong>
                          {percent}% complete {percent === 100 ? "🏅" : ""}
                        </strong>
                      </div>
                    );
                  })}
                </>
              )}

              {isStaff && (
                <>
                  <h2 style={{ marginTop: 0, color: "#f472b6" }}>Student Progress</h2>
                  <p style={{ color: "#cbd5e1" }}>
                    Progress is based on approved assignments (module unlocks).
                  </p>

                  <StudentProgressBoard
                    courses={courses}
                    users={users}
                  />
                </>
              )}
            </div>
          )}

          {/* STAFF PROGRESS BOARD (Mentor/Admin) */}
          {view === "studentProgress" && isStaff && (
            <StudentProgressBoard
              courses={courses}
              users={users}
            />
          )}
        </div>
      </main>
    </div>
  );
}

/* =====================
  AUTH SCREEN
===================== */
function AuthScreen({ view, setView, onSignIn, onCreate, theme, setTheme }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [role, setRole] = useState("student");
  const [ownerKey, setOwnerKey] = useState("");

  return (
    <div id="auth-container">
      <div id="auth-card">
        <button
          className="theme-toggle"
          onClick={() => 
            setTheme(theme === "dark" ? "light" : "dark")
          }
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        <img
          src="/src/assets/Images/phoenix.jpg"
          alt="Phoenix Fire Technical Academy"
          className="auth-logo"
        />
        <h1 className="app-title">Phoenix Fire Technical Academy</h1>

        {view === "signin" && (
          <>
            <h2>Sign In</h2>

            <input
              className="input-wide"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="input-wide"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button className="btn" onClick={() => onSignIn(email, password)}>
              Sign In
            </button>

            <button
              className="btn-secondary"
              onClick={() => alert("Password recovery coming soon")}
            >
              Forgot Password?
            </button>

            <button className="btn-secondary" onClick={() => setView("create")}>
              Create Account
            </button>
          </>
        )}

        {view === "create" && (
          <>
            <h2>Create Account</h2>

            <input
              className="input-wide"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />

            <input
              className="input-wide"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />

            <input
              className="input-wide"
              placeholder="Student ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />

            <input
              className="input-wide"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="input-wide"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <select
              className="input-wide"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="student">Student</option>
              <option value="mentor">Mentor</option>
              <option value="admin">Admin</option>
            </select>

            <input
              className="input-wide"
              placeholder="Owner Key"
              value={ownerKey}
              onChange={(e) => setOwnerKey(e.target.value)}
            />

            <button
              className="btn"
              onClick={() =>
                onCreate(
                  email,
                  password,
                  role,
                  ownerKey,
                  {
                    firstName,
                    lastName,
                    studentId,
                  })
              }
            >
              Create Account
            </button>

            <button className="btn-secondary" onClick={() => setView("signin")}>
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}




            


