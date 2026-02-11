import { useEffect, useMemo, useState } from "react";

import MarkdownPreview from "./components/MarkdownPreview";
import CourseEditor from "./components/CourseEditor";
import Sidebar from "./components/Sidebar";
import CourseList from "./components/CourseList";
import LessonView from "./components/LessonView";
import SubmissionsDashboard from "./components/SubmissionsDashboard";
import StudentProgressBoard from "./components/StudentProgressBoard";

import { calculateCourseProgress, getPendingRevisionCount, getModulesNeedingRevision, getStudentFeedbackHistory } from "./utils/progress";
import { canMentorSeeCourse } from "./utils/permissions";
import * as storage from "./utils/storage.js";
import * as auth from "./utils/authService.js";

import "./styles.css";
import UserManagement from "./components/UserManagement.jsx";

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
          if (mod.assignment.submission && !mod.assignment.submissions) {
            mod.assignment.submissions = Array.isArray(mod.assignment.submission)
              ? mod.assignment.submission
              : [mod.assignment.submission];
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

function getStudentKey(user) {
  return user?.studentId ?? user?.email ?? user?.username ?? null;
}

function canAccessModuleByPrereq(lesson, modIndex, currentUser) {
  if (modIndex === 0) return true;

  const studentKey = getStudentKey(currentUser);
  if (!studentKey) return false;

  const prevModule = lesson?.modules?.[modIndex - 1];
  if (!prevModule) return false;

  const assignment = prevModule?.assignment || null;

  // "Repo submission required" ONLY if repoUrl exists
  const requiresSubmission = !!assignment?.repoUrl;

  // If repo submission is required, unlock only when APPROVED
  if (requiresSubmission) {
    const subs = Array.isArray(assignment?.submissions) ? assignment.submissions : [];
    return subs.some((s) => s?.student === studentKey && s?.status === "approved");
  }

  // Otherwise it's a content module: unlock when marked complete
  const completions = Array.isArray(prevModule?.completions) ? prevModule.completions : [];
  return completions.some((c) => c?.student === studentKey);
}

function isLessonCompletedForStudent(lesson, currentUser) {
  const studentKey = currentUser?.studentId ?? currentUser?.email ?? currentUser?.username;
  if (!studentKey) return false;

  const modules = Array.isArray(lesson?.modules) ? lesson.modules : [];
  if (modules.length === 0) return false;

  return modules.every((mod) => {
    const assignment = mod?.assignment || null;
    const requiresSubmission = !!assignment?.repoUrl;

    if (requiresSubmission) {
      const subs = Array.isArray(assignment?.submissions) ? assignment.submissions : [];
      return subs.some((s) => s?.student === studentKey && s?.status === "approved");
    }

    const completions = Array.isArray(mod?.completions) ? mod.completions : [];
    return completions.some((c) => c?.student === studentKey);
  });
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

  const revisionCount = useMemo(() =>
    getPendingRevisionCount(courses, currentUser),
    [courses, currentUser]
  );

  const revisionList = useMemo(() =>
    getModulesNeedingRevision(courses, currentUser),
    [courses, currentUser]
  );
  
  const visibleCourses = useMemo(() => {
    const list = Array.isArray(courses) ? courses : [];
    if (!currentUser) return [];

    // mentors only see assigned courses + unassigned courses
    if (currentUser.role === "mentor") {
      return list.filter((c) => canMentorSeeCourse(c, currentUser));
    }

    // admin + students see all courses
    return list;
  }, [courses, currentUser]);

  const safeViewTitle = useMemo(() => {
    if (!view) return "";
    return String(view).toUpperCase();
  }, [view]);

  const selectedCourse = useMemo(
    () => visibleCourses.find((c) => c.id === selectedCourseId) || null,
    [visibleCourses, selectedCourseId]
  );

  const courseBeingEdited = useMemo(
    () => visibleCourses.find((c) => c.id === editingCourseId) || null,
    [visibleCourses, editingCourseId]
  );

  const activeLesson = useMemo(() => {
    if (!selectedCourse || !activeLessonId) return null;
    return (selectedCourse.lessons || []).find((l) => l.id === activeLessonId) || null;
  }, [selectedCourse, activeLessonId]);

  useEffect(() => {
    storage.saveCourses(courses);
  }, [courses]);

  useEffect(() => {
    storage.saveUsers(users);
  }, [users]);

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
    const exists = visibleCourses.some((c) => c.id === selectedCourseId);
    if (!exists) {
      setSelectedCourseId(null);
      setActiveLessonId(null);
      setPreviewMode(false);
      if (view === "courseDetail" || view === "lesson") setView("courses");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCourses]);

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

  function handleUserCreation(email, password, role, ownerKey, profile) {
    // 1. Unified validation
    if (!email || !password || !role || !profile) {
      alert("All fields are required.");
      return;
    }

    const { firstName, lastName, studentId } = profile;
    if (!firstName || !lastName) {
      alert("First and last names are required.");
      return;
    }

    // 2. Call authService logic
    try {
      const updatedUsers = auth.createUser(
        users,
        email,
        password,
        role,
        ownerKey,
        firstName,
        lastName,
        studentId
      );

      // 3. Update state
      setUsers(updatedUsers);

      // 4. Context-Aware UI Response
      if (view === "create") {
        // If they are on the public sign-up screen
        alert("Account created successfully. Please sign in.");
        setView("signin");
      } else {
        // If you are on the Admin User Management dashboard
        alert(`Student ${firstName} enrolled successfully.`);
        // We stay on the current view so you can add the next student
      }
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
        onCreate={handleUserCreation}
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

  function exportBackup() {
    const payload = {
      version: 1,
      exportedAt: Date.now(),
      users,
      courses,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pfta-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed?.users) || !Array.isArray(parsed?.courses)) {
        alert("Invalid backup file. Expected { users: [], courses: [] }");
        return;
      }
      setUsers(parsed.users);
      setCourses(normalizeCourses(parsed.courses));
      alert("Backup imported successfully.");
      setView("dashboard");
    } catch (err) {
      alert("Import failed: " + err.message);
    }
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
        onExportBackup={exportBackup}
        onImportBackup={importBackup}
        courses={visibleCourses}
        revisionCount={revisionCount}
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
                <p>You can view courses, submit assignments, and track your progress.</p>
              )}

              {isStudent && revisionList.length > 0 && (
                <div className="course-box" style={{
                  border: "1px solid var(--pf-fire)",
                  background: "rgba(245, 158, 11, 0.05)",
                  marginTop: "20px",
                  padding: "20px"
                }}>
                  <h3 style={{ color: "var(--pf-fire)", marginTop: 0 }}>⚠️ Revisions Required</h3>
                  <p>A mentor has requrested updates on the following assignments. Click below to view the feedback video:</p>
                  
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "16px" }}>
                    {revisionList.map((item) => (
                      <button
                        key={item.moduleId}
                        className="btn-inline"
                        onClick={() => {
                          setSelectedCourseId(item.courseId);
                          setActiveLessonId(item.lessonId);
                          setView("lesson");
                        }}
                        style={{ padding: "8px 16px", background: "#1e29eb" }}
                      >
                        {item.courseTitle} → {item.moduleTitle}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* USER MANAGEMENT */}
          {view === "users" && (
            <UserManagement
              users={users}
              currentUser={currentUser}
              onUserCreated={(usersList, email, pass, role, key, fName, lName, sId) => {
                // Mapping the flast userManagement props to our profile object structure
                handleUserCreation(email, pass, role, key, { firstName: fName, lastName: lName, studentId: sId });
              }}
            />
          )}

          {/* COURSES */}
          {view === "courses" && (
            <>
              {courseBeingEdited ? (
                <CourseEditor
                  course={courseBeingEdited}
                  users={users}
                  currentUser={currentUser}
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
                  courses={visibleCourses}
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
                      if (!window.confirm("Delete this course?")) return;
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
              courses={visibleCourses}
              setCourses={setCourses}
              currentUser={currentUser}
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

                  {/* FEEDBACK HISTORY SECTION */}
                  <h2 style={{ marginTop: 40, color: "#f472b6" }}>Mentor Feedback Archive</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {getStudentFeedbackHistory(courses, currentUser).length === 0 ? (
                      <p style={{ color: "#94e3b8"}}>No feedback history found yet.</p>
                    ) : (
                        getStudentFeedbackHistory(courses, currentUser).map((item, idx) => (
                          <div key={idx} className="course-box" style={{ borderLeft: "4px solid #f472b6" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                              <strong style={{ color: "#60a5fa" }}>{item.moduleTitle}</strong>
                              <span style={{ fontSize: "0.8em", opacity: 0.7 }}>
                                {new Date(item.date).toLocaleDateString()}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontStyle: "italic" }}>"{item.feedbackText}"</p>
                            <div style={{ marginTop: "5px", fontSize: "0.85em" }}>
                              Status: <span style={{ color: item.status === "approved" ? "#22c55e" : "#f59e0b" }}>
                                {item.status.toUpperCase()}
                              </span>
                            </div>

                            <button
                              className="btn-inline"
                              style={{ fontSize: "0.75em", padding: "4px 8px" }}
                              onClick={() => {
                                setSelectedCourseId(item.courseId);
                                setActiveLessonId(item.lessonId);
                                setView("lesson");
                              }}
                            >
                              View Lesson
                            </button>
                          </div>

                        ))
                    )}
                  </div>
                </>
              )}

              {isStaff && (
                <>
                  <h2 style={{ marginTop: 0, color: "#f472b6" }}>Student Progress</h2>
                  <p style={{ color: "#cbd5e1" }}>
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

          {/* STAFF PROGRESS BOARD (Mentor/Admin) */}
          {view === "studentProgress" && isStaff && (
            <StudentProgressBoard
              courses={visibleCourses}
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




            


