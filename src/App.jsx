import { useEffect, useMemo, useState } from "react";
import MarkdownPreview from "./components/MarkdownPreview";
import CourseEditor from "./components/CourseEditor";
import Sidebar from "./components/Sidebar";
import CourseList from "./components/CourseList";
import LessonView from "./components/LessonView";
import { calculateCourseProgress } from "./utils/progress";
import "./App.css";

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
        if (mod.assignment) return mod;

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

function canAccessModuleByPrereq(lesson, modIndex, studentUsername) {
  if (modIndex === 0) return true;
  const prev = lesson.modules?.[modIndex - 1];
  const a = prev?.assignment;
  if (!a) return false;
  return (a.submissions || []).some(
    (s) => s.student === studentUsername && s.status === "approved"
  );
}

function isLessonCompletedForStudent(lesson, studentUsername) {
  const mods = lesson?.modules || [];
  if (mods.length === 0) return false;

  return mods.every((m) =>
    (m.assignment?.submissions || []).some(
      (s) => s.student === studentUsername && s.status === "approved"
    )
  );
}

/* =====================
  APP
===================== */
export default function App() {
  const [users, setUsers] = useState(() => {
    let stored = [];
    try {
      stored = JSON.parse(localStorage.getItem(LS_USERS) || "[]");
    } catch {
      stored = [];
    }

    if (!Array.isArray(stored)) stored = [];

    if (stored.length === 0) {
      stored = [
        {
          username: OWNER_ACCOUNT,
          password: "OwnerOperator2026",
          role: "admin",
        },
      ];
      localStorage.setItem(LS_USERS, JSON.stringify(stored));
    }

    return stored;
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_CURRENT) || "null");
    } catch {
      return null;
    }
  });

  const [courses, setCourses] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_COURSES) || "[]");
      return normalizeCourses(Array.isArray(stored) ? stored : []);
    } catch {
      return [];
    }
  });

  const [view, setView] = useState("signin"); // signin | dashboard | courses | courseDetail | lesson | progress | submissions | users | messages | reports | settings
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
    localStorage.setItem(LS_COURSES, JSON.stringify(courses));
  }, [courses]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(LS_CURRENT, JSON.stringify(currentUser));
      setView("dashboard");
    } else {
      localStorage.removeItem(LS_CURRENT);
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

  /* =====================
    AUTH
  ===================== */
  function signIn(username, password) {
    const user = users.find((u) => u.username === username && u.password === password);
    if (!user) return alert("Invalid username or password");
    setCurrentUser(user);
  }

  function signOut() {
    setCurrentUser(null);
    setSelectedCourseId(null);
    setEditingCourseId(null);
    setActiveLessonId(null);
    setPreviewMode(false);
    setView("signin");
  }

  function createAccount(username, password, role, ownerKey) {
    if (ownerKey !== OWNER_KEY) return alert("Invalid Owner Key");
    if (users.some((u) => u.username === username)) return alert("Username already exists");

    const updated = [...users, { username, password, role }];
    setUsers(updated);
    localStorage.setItem(LS_USERS, JSON.stringify(updated));
    alert("Account created");
    setView("signin");
  }

  if (!currentUser) {
    return (
      <AuthScreen
        view={view}
        setView={setView}
        onSignIn={signIn}
        onCreate={createAccount}
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
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b1220" }}>
      <Sidebar
        currentUser={currentUser}
        isStudent={isStudent}
        isStaff={isStaff}
        setView={setView}
        signOut={signOut}
      />

      <main style={{ flex: 1, padding: 24, color: "#e5e7eb" }}>
        <h1 style={{ marginTop: 0, color: "#f59e0b" }}>{safeViewTitle}</h1>

        {view === "dashboard" && (
          <div>
            <p>Welcome to Phoenix Fire LMS.</p>
            {isStaff && <p>You have admin/mentor tools available in the sidebar.</p>}
            {isStudent && <p>You can view courses, messages, and your progress.</p>}
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
              Back to Courses
            </button>

            <h2 style={{ marginTop: 0, color: "#f472b6" }}>{selectedCourse.title}</h2>
            <p style={{ color: "#cbd5e1" }}>{selectedCourse.description}</p>

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
                Update Course Content
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

             {previewMode && isStaff && (
              <div>
                <h3 style={{ color: "#f97316" }}>Student Preview</h3>

                {(selectedCourse.lessons || []).length === 0 && <p>No lessons yet.</p>}

                {(selectedCourse.lessons || []).map((lesson) => (
                  <div key={lesson.id} style={{ marginBottom: 14 }}>
                    <h4 style={{ color: "#60a5fa" }}>{lesson.title}</h4>

                    {(lesson.modules || []).length === 0 && <p>No modules yet.</p>}

                    {(lesson.modules || []).map((mod) => (
                      <div
                        key={mod.id}
                        style={{
                          border: "1px solid #334155",
                          padding: 12,
                          marginBottom: 10,
                          borderRadius: 14,
                          background: "#111827",
                        }}
                      >
                        <strong style={{ color: "#f59e0b" }}>{mod.title}</strong>
                        <MarkdownPreview markdown={mod.content || ""} />

                        {mod.assignment?.instructionsText && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontWeight: 900, color: "#f97316" }}>
                              Assignment
                            </div>
                            <MarkdownPreview markdown={mod.assignment.instructionsText} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {!previewMode && (
              <div>
                <h3 style={{ color: "#60a5fa" }}>Lessons</h3>

                {(selectedCourse.lessons || []).length === 0 && <p>No lessons yet.</p>}

                {(selectedCourse.lessons || []).map((lesson) => {
                  const completedBadge = isStudent
                    ? isLessonCompletedForStudent(lesson, currentUser.username)
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
                        {lesson.title} {completedBadge ? "🏅" : ""}
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
              setCourses={setCourses}
              canAccessModuleByPrereq={canAccessModuleByPrereq}
              newId={newId}
            />
          </div>
        )}

         {/* PROGRESS */}
        {view === "progress" && (
          <div>
            {isStudent && (
              <>
                <h2 style={{ marginTop: 0, color: "#f472b6" }}>My Progress</h2>
                {courses.length === 0 && <p>No courses yet.</p>}

                {courses.map((course) => {
                  const percent = calculateCourseProgress(course, currentUser.username);
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
                      <h3 style={{ marginTop: 0, color: "#60a5fa" }}>{course.title}</h3>

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
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/* =====================
  AUTH SCREEN
===================== */
function AuthScreen({ view, setView, onSignIn, onCreate }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [ownerKey, setOwnerKey] = useState("");

  return (
    <div style={{ padding: 40, maxWidth: 520, color: "#e5e7eb" }}>
      <h1 style={{ color: "#f59e0b" }}>Phoenix Fire Technical Academy</h1>

      {view === "signin" && (
        <>
          <h3 style={{ color: "#f472b6" }}>Sign In</h3>

          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 10 }}
          />

           <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 10 }}
          />

          <button onClick={() => onSignIn(username, password)}>Sign In</button>

          <p style={{ marginTop: 12 }}>
            <button onClick={() => setView("create")}>Create Account</button>
          </p>
        </>
      )}

      {view === "create" && (
        <>
          <h3 style={{ color: "#f472b6" }}>Create Account</h3>

          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 10 }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 10 }}
          />

           <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 10 }}
          >
            <option value="student">Student</option>
            <option value="mentor">Mentor</option>
            <option value="admin">Admin</option>
          </select>

          <input
            placeholder="Owner Key"
            value={ownerKey}
            onChange={(e) => setOwnerKey(e.target.value)}
            style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 10 }}
          />

          <button onClick={() => onCreate(username, password, role, ownerKey)}>
            Create Account
          </button>

          <p style={{ marginTop: 12 }}>
            <button onClick={() => setView("signin")}>Back</button>
          </p>
        </>
      )}
    </div>
  );
}




            


