import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  if (typeof crypto !== "undefined" && crypto?.randomUUID)
    return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isModuleApprovedForStudent(mod, studentUsername) {
  return (mod?.submissions || []).some(
    (s) => s.student === studentUsername && s.status === "approved"
  );
}

function calculateCourseProgress(course, studentUsername) {
  if (!course?.lessons) return 0;

  let totalModules = 0;
  let completedModules = 0;

  course.lessons.forEach((lesson) => {
    (lesson.modules || []).forEach((mod) => {
      totalModules++;
      if (isModuleApprovedForStudent(mod, studentUsername)) completedModules++;
    });
  });

  if (totalModules === 0) return 0;
  return Math.round((completedModules / totalModules) * 100);
}

function isLessonCompletedForStudent(lesson, studentUsername) {
  const mods = lesson?.modules || [];
  if (mods.length === 0) return false;
  return mods.every((m) => isModuleApprovedForStudent(m, studentUsername));
}

function canAccessModuleByPrereq(activeLesson, modIndex, studentUsername) {
  // Module 0 is always unlocked.
  if (modIndex === 0) return true;

  const prev = (activeLesson?.modules || [])[modIndex - 1];
  if (!prev) return true;

  // Unlock only if previous module is approved for this student.
  return isModuleApprovedForStudent(prev, studentUsername);
}

/* =====================
   MARKDOWN PREVIEW
===================== */
function MarkdownPreview({ markdown }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 12,
        marginTop: 10,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Preview</div>

      <div style={{ lineHeight: 1.5 }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ node, ...props }) => (
              <a {...props} target="_blank" rel="noreferrer noopener" />
            ),
            code: ({ inline, children, ...props }) =>
              inline ? (
                <code
                  {...props}
                  style={{
                    background: "rgba(0,0,0,0.06)",
                    padding: "2px 6px",
                    borderRadius: 6,
                  }}
                >
                  {children}
                </code>
              ) : (
                <pre
                  style={{
                    background: "rgba(0,0,0,0.06)",
                    padding: 12,
                    borderRadius: 8,
                    overflowX: "auto",
                  }}
                >
                  <code {...props}>{children}</code>
                </pre>
              ),
          }}
        >
          {markdown || ""}
        </ReactMarkdown>
      </div>
    </div>
  );
}

/* =====================
   COURSE EDITOR (Admin/Mentor)
===================== */
function CourseEditor({ course, onSave, onCancel }) {
  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [lessons, setLessons] = useState(() => course?.lessons ?? []);

  useEffect(() => {
    setTitle(course?.title ?? "");
    setDescription(course?.description ?? "");
    setLessons(course?.lessons ?? []);
  }, [course]);

  function addLesson() {
    setLessons((prev) => [
      ...prev,
      { id: newId(), title: "New Lesson", description: "", modules: [] },
    ]);
  }

  function updateLessonField(lessonId, field, value) {
    setLessons((prev) =>
      prev.map((l) => (l.id === lessonId ? { ...l, [field]: value } : l))
    );
  }

  function deleteLesson(lessonId) {
    setLessons((prev) => prev.filter((l) => l.id !== lessonId));
  }

  function addModule(lessonId) {
    setLessons((prev) =>
      prev.map((lesson) =>
        lesson.id === lessonId
          ? {
              ...lesson,
              modules: [
                ...(lesson.modules || []),
                {
                  id: newId(),
                  title: "New Module",
                  content: "",
                  submissions: [],
                },
              ],
            }
          : lesson
      )
    );
  }

  function updateModule(lessonId, moduleId, field, value) {
    setLessons((prev) =>
      prev.map((lesson) =>
        lesson.id === lessonId
          ? {
              ...lesson,
              modules: (lesson.modules || []).map((mod) =>
                mod.id === moduleId ? { ...mod, [field]: value } : mod
              ),
            }
          : lesson
      )
    );
  }

  function deleteModule(lessonId, moduleId) {
    setLessons((prev) =>
      prev.map((lesson) =>
        lesson.id === lessonId
          ? {
              ...lesson,
              modules: (lesson.modules || []).filter((m) => m.id !== moduleId),
            }
          : lesson
      )
    );
  }

  function saveCourse() {
    onSave({
      ...course,
      title,
      description,
      lessons,
    });
  }

  if (!course) return null;

  return (
    <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Edit Course</h2>

      <label>Title</label>
      <input
        style={{ width: "100%", marginBottom: 10 }}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <label>Description</label>
      <textarea
        style={{ width: "100%", minHeight: 80, marginBottom: 12 }}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <h3>Lessons</h3>

      {lessons.length === 0 && <p>No lessons yet.</p>}

      {lessons.map((lesson) => (
        <div
          key={lesson.id}
          style={{
            border: "1px solid #ccc",
            padding: 10,
            marginBottom: 12,
            borderRadius: 8,
          }}
        >
          <input
            value={lesson.title}
            onChange={(e) =>
              updateLessonField(lesson.id, "title", e.target.value)
            }
            style={{ width: "100%", marginBottom: 6 }}
          />

          <textarea
            value={lesson.description || ""}
            onChange={(e) =>
              updateLessonField(lesson.id, "description", e.target.value)
            }
            placeholder="Lesson description (optional)"
            style={{ width: "100%", minHeight: 60, marginBottom: 6 }}
          />

          <button onClick={() => deleteLesson(lesson.id)}>Delete Lesson</button>

          <h4 style={{ marginTop: 12 }}>Modules</h4>

          {(lesson.modules || []).length === 0 && <p>No modules yet.</p>}

          {(lesson.modules || []).map((mod) => (
            <div
              key={mod.id}
              style={{
                border: "1px dashed #999",
                padding: 8,
                marginBottom: 8,
                borderRadius: 8,
              }}
            >
              <input
                value={mod.title}
                onChange={(e) =>
                  updateModule(lesson.id, mod.id, "title", e.target.value)
                }
                style={{ width: "100%", marginBottom: 6 }}
              />

              <textarea
                value={mod.content}
                onChange={(e) =>
                  updateModule(lesson.id, mod.id, "content", e.target.value)
                }
                placeholder="Module content (Markdown supported)"
                style={{ width: "100%", minHeight: 90 }}
              />

              <MarkdownPreview markdown={mod.content} />

              <button
                onClick={() => deleteModule(lesson.id, mod.id)}
                style={{ marginTop: 6 }}
              >
                Delete Module
              </button>
            </div>
          ))}

          <button onClick={() => addModule(lesson.id)}>Add Module</button>
        </div>
      ))}

      <button onClick={addLesson} style={{ marginTop: 6 }}>
        Add Lesson
      </button>

      <hr style={{ margin: "16px 0" }} />

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={saveCourse}
          style={{
            background: "#2563eb",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: 6,
          }}
        >
          Save Course (Publish Updates)
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
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
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });

  const [view, setView] = useState("signin"); // signin | dashboard | courses | courseDetail | lesson | messages | users | progress | reports | settings | submissions
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [activeLessonId, setActiveLessonId] = useState(null);

  const isStudent = currentUser?.role === "student";
  const isStaff =
    currentUser?.role === "admin" || currentUser?.role === "mentor";

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
    return (
      (selectedCourse.lessons || []).find((l) => l.id === activeLessonId) ||
      null
    );
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

  // If a selected course was deleted, recover gracefully
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
    const user = users.find(
      (u) => u.username === username && u.password === password
    );
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
    if (users.some((u) => u.username === username))
      return alert("Username already exists");

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
     UI
  ===================== */
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* SIDEBAR — preserved */}
      <aside
        style={{
          width: "260px",
          padding: "16px",
          background: "#111827",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <h2 style={{ margin: 0 }}>Phoenix LMS</h2>

        <p
          style={{
            fontSize: "14px",
            opacity: 0.85,
            marginTop: 4,
            marginBottom: 6,
          }}
        >
          {currentUser.username}
          <br />
          <strong>{currentUser.role}</strong>
        </p>

        {/* Shared */}
        <button onClick={() => setView("dashboard")}>Dashboard</button>
        <button onClick={() => setView("courses")}>Courses</button>
        <button onClick={() => setView("messages")}>Messages</button>

        {/* Student-only */}
        {isStudent && (
          <>
            <button onClick={() => setView("progress")}>My Progress</button>
            <button onClick={() => setView("settings")}>Settings</button>
          </>
        )}

        {/* Admin/Mentor */}
        {isStaff && (
          <>
            <button onClick={() => setView("users")}>Users</button>
            <button onClick={() => setView("progress")}>Progress</button>
            <button onClick={() => setView("reports")}>Reports</button>
            <button onClick={() => setView("settings")}>Settings</button>
            <button onClick={() => setView("submissions")}>Submissions</button>
          </>
        )}

        <button onClick={signOut} style={{ marginTop: "auto" }}>
          Logout
        </button>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, padding: "24px" }}>
        <h1 style={{ marginTop: 0 }}>{safeViewTitle}</h1>

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div>
            <p>Welcome to Phoenix Fire LMS.</p>
            {isStaff && (
              <p>You have admin/mentor tools available in the sidebar.</p>
            )}
            {isStudent && (
              <p>You can view courses, messages, and your progress.</p>
            )}
          </div>
        )}

        {/* COURSES */}
        {view === "courses" && (
          <div>
            {isStaff && (
              <button
                onClick={() => {
                  const title = prompt("Course title?");
                  if (!title) return;
                  const description = prompt("Course description?") || "";
                  setCourses((prev) => [
                    ...prev,
                    { id: newId(), title, description, lessons: [] },
                  ]);
                }}
                style={{ marginBottom: "16px" }}
              >
                Create Course
              </button>
            )}

            {editingCourseId ? (
              <CourseEditor
                course={courseBeingEdited}
                onSave={(updatedCourse) => {
                  setCourses((prev) =>
                    prev.map((c) =>
                      c.id === updatedCourse.id ? updatedCourse : c
                    )
                  );

                  // keep selected course synced
                  if (selectedCourseId === updatedCourse.id)
                    setSelectedCourseId(updatedCourse.id);

                  setEditingCourseId(null);
                  // stay in courses view (editor is displayed here)
                }}
                onCancel={() => setEditingCourseId(null)}
              />
            ) : (
              <>
                {courses.length === 0 && <p>No courses yet.</p>}

                {courses.map((course) => {
                  const percent = isStudent
                    ? calculateCourseProgress(course, currentUser.username)
                    : null;

                  return (
                    <div
                      key={course.id}
                      style={{
                        border: "1px solid #ccc",
                        padding: "12px",
                        marginBottom: "10px",
                        borderRadius: 8,
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>{course.title}</h3>
                      <p>{course.description}</p>

                      {/* Progress % on course card (student) */}
                      {isStudent && (
                        <>
                          <div
                            style={{
                              background: "#e5e7eb",
                              borderRadius: 6,
                              overflow: "hidden",
                              height: 10,
                              marginBottom: 6,
                            }}
                          >
                            <div
                              style={{
                                width: `${percent}%`,
                                background:
                                  percent === 100 ? "#16a34a" : "#3b82f6",
                                height: "100%",
                              }}
                            />
                          </div>

                          <small>
                            {percent}% complete {percent === 100 ? "🏅" : ""}
                          </small>
                        </>
                      )}

                      <div style={{ marginTop: 10 }}>
                        <button
                          onClick={() => {
                            setSelectedCourseId(course.id);
                            setPreviewMode(false);
                            setActiveLessonId(null);
                            setView("courseDetail");
                          }}
                        >
                          Open Course
                        </button>

                        {isStaff && (
                          <>
                            <button
                              onClick={() => setEditingCourseId(course.id)}
                              style={{ marginLeft: "8px" }}
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => {
                                const ok = window.confirm(
                                  "Delete this course?"
                                );
                                if (!ok) return;

                                setCourses((prev) =>
                                  prev.filter((c) => c.id !== course.id)
                                );

                                if (selectedCourseId === course.id) {
                                  setSelectedCourseId(null);
                                  setPreviewMode(false);
                                  setView("courses");
                                }
                              }}
                              style={{ marginLeft: "8px" }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
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
              style={{ marginBottom: 12 }}
            >
              Back to Courses
            </button>

            <h2 style={{ marginTop: 0 }}>{selectedCourse.title}</h2>
            <p>{selectedCourse.description}</p>

            {/* Update Course Content (admin/mentor) */}
            {isStaff && (
              <button
                onClick={() => {
                  setEditingCourseId(selectedCourse.id);
                  setView("courses"); // editor lives in Courses view
                }}
                style={{ marginBottom: 12 }}
              >
                Update Course Content
              </button>
            )}

            {/* Preview as Student (staff only) */}
            {isStaff && (
              <button
                onClick={() => setPreviewMode((p) => !p)}
                style={{ marginBottom: 12, marginLeft: 8 }}
              >
                {previewMode ? "Exit Preview" : "Preview as Student"}
              </button>
            )}

            {previewMode && isStaff && (
              <div>
                <h3>Student Preview</h3>

                {(selectedCourse.lessons || []).length === 0 && (
                  <p>No lessons yet.</p>
                )}

                {(selectedCourse.lessons || []).map((lesson) => (
                  <div key={lesson.id} style={{ marginBottom: 12 }}>
                    <h4>{lesson.title}</h4>

                    {(lesson.modules || []).length === 0 && (
                      <p>No modules yet.</p>
                    )}

                    {(lesson.modules || []).map((mod) => (
                      <div
                        key={mod.id}
                        style={{
                          border: "1px solid #ddd",
                          padding: 8,
                          marginBottom: 6,
                          borderRadius: 8,
                        }}
                      >
                        <strong>{mod.title}</strong>
                        <MarkdownPreview markdown={mod.content} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {!previewMode && (
              <div>
                <h3>Lessons</h3>

                {(selectedCourse.lessons || []).length === 0 && (
                  <p>No lessons yet.</p>
                )}

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
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
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
              style={{ marginBottom: 12 }}
            >
              Back to Course
            </button>

            <h2 style={{ marginTop: 0 }}>{activeLesson.title}</h2>

            {(activeLesson.modules || []).length === 0 && (
              <p>No modules yet.</p>
            )}

            {(activeLesson.modules || []).map((mod, index) => {
              const unlocked = isStaff
                ? true
                : canAccessModuleByPrereq(
                    activeLesson,
                    index,
                    currentUser.username
                  );

              const myApproved = isStudent
                ? isModuleApprovedForStudent(mod, currentUser.username)
                : false;

              return (
                <div
                  key={mod.id}
                  style={{
                    border: "1px solid #ccc",
                    padding: 12,
                    marginBottom: 10,
                    borderRadius: 6,
                    opacity: unlocked ? 1 : 0.5,
                  }}
                >
                  <h4 style={{ marginTop: 0 }}>
                    {mod.title} {!unlocked ? "🔒" : ""}{" "}
                    {isStudent && myApproved ? "✅" : ""}
                  </h4>

                  {unlocked ? (
                    <MarkdownPreview markdown={mod.content} />
                  ) : (
                    <p>
                      Complete the previous module (approved) to unlock this
                      content.
                    </p>
                  )}

                  {/* Student submission (Github) */}
                  {isStudent && unlocked && (
                    <div style={{ marginTop: 12 }}>
                      <input
                        placeholder="Paste Github repository URL (press Enter to submit)"
                        style={{ width: "100%", marginBottom: 6 }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;

                          const url = e.target.value.trim();
                          if (!url) return;

                          setCourses((prev) =>
                            prev.map((course) =>
                              course.id === selectedCourse.id
                                ? {
                                    ...course,
                                    lessons: (course.lessons || []).map(
                                      (lesson) =>
                                        lesson.id === activeLesson.id
                                          ? {
                                              ...lesson,
                                              modules: (
                                                lesson.modules || []
                                              ).map((m) =>
                                                m.id === mod.id
                                                  ? {
                                                      ...m,
                                                      submissions: [
                                                        ...(m.submissions ||
                                                          []),
                                                        {
                                                          id: newId(),
                                                          student:
                                                            currentUser.username,
                                                          url,
                                                          submittedAt:
                                                            Date.now(),
                                                          status: "pending",
                                                          feedback: "",
                                                        },
                                                      ],
                                                    }
                                                  : m
                                              ),
                                            }
                                          : lesson
                                    ),
                                  }
                                : course
                            )
                          );

                          e.target.value = "";
                        }}
                      />
                      <small>Press Enter to submit</small>
                    </div>
                  )}

                  {/* Mentor/Admin review inside lesson */}
                  {isStaff && (mod.submissions || []).length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <strong>Submissions</strong>

                      {(mod.submissions || []).map((s) => (
                        <div
                          key={s.id}
                          style={{
                            border: "1px solid #ddd",
                            padding: 10,
                            marginTop: 8,
                            borderRadius: 6,
                          }}
                        >
                          <a href={s.url} target="_blank" rel="noreferrer">
                            {s.student}
                          </a>

                          <div style={{ marginTop: 6 }}>
                            <strong>Status:</strong>{" "}
                            <span
                              style={{
                                color:
                                  s.status === "approved"
                                    ? "green"
                                    : s.status === "revision"
                                    ? "orange"
                                    : "gray",
                              }}
                            >
                              {s.status || "pending"}
                            </span>
                          </div>

                          <textarea
                            placeholder="Mentor feedback"
                            value={s.feedback || ""}
                            style={{ width: "100%", marginTop: 6 }}
                            onChange={(e) => {
                              const feedback = e.target.value;

                              setCourses((prev) =>
                                prev.map((course) =>
                                  course.id === selectedCourse.id
                                    ? {
                                        ...course,
                                        lessons: (course.lessons || []).map(
                                          (lesson) =>
                                            lesson.id === activeLesson.id
                                              ? {
                                                  ...lesson,
                                                  modules: (
                                                    lesson.modules || []
                                                  ).map((m) =>
                                                    m.id === mod.id
                                                      ? {
                                                          ...m,
                                                          submissions: (
                                                            m.submissions || []
                                                          ).map((sub) =>
                                                            sub.id === s.id
                                                              ? {
                                                                  ...sub,
                                                                  feedback,
                                                                }
                                                              : sub
                                                          ),
                                                        }
                                                      : m
                                                  ),
                                                }
                                              : lesson
                                        ),
                                      }
                                    : course
                                )
                              );
                            }}
                          />

                          <div
                            style={{ marginTop: 6, display: "flex", gap: 6 }}
                          >
                            <button
                              onClick={() => {
                                setCourses((prev) =>
                                  prev.map((course) =>
                                    course.id === selectedCourse.id
                                      ? {
                                          ...course,
                                          lessons: (course.lessons || []).map(
                                            (lesson) =>
                                              lesson.id === activeLesson.id
                                                ? {
                                                    ...lesson,
                                                    modules: (
                                                      lesson.modules || []
                                                    ).map((m) =>
                                                      m.id === mod.id
                                                        ? {
                                                            ...m,
                                                            submissions: (
                                                              m.submissions ||
                                                              []
                                                            ).map((sub) =>
                                                              sub.id === s.id
                                                                ? {
                                                                    ...sub,
                                                                    status:
                                                                      "approved",
                                                                  }
                                                                : sub
                                                            ),
                                                          }
                                                        : m
                                                    ),
                                                  }
                                                : lesson
                                          ),
                                        }
                                      : course
                                  )
                                );
                              }}
                            >
                              Approve
                            </button>

                            <button
                              onClick={() => {
                                setCourses((prev) =>
                                  prev.map((course) =>
                                    course.id === selectedCourse.id
                                      ? {
                                          ...course,
                                          lessons: (course.lessons || []).map(
                                            (lesson) =>
                                              lesson.id === activeLesson.id
                                                ? {
                                                    ...lesson,
                                                    modules: (
                                                      lesson.modules || []
                                                    ).map((m) =>
                                                      m.id === mod.id
                                                        ? {
                                                            ...m,
                                                            submissions: (
                                                              m.submissions ||
                                                              []
                                                            ).map((sub) =>
                                                              sub.id === s.id
                                                                ? {
                                                                    ...sub,
                                                                    status:
                                                                      "revision",
                                                                  }
                                                                : sub
                                                            ),
                                                          }
                                                        : m
                                                    ),
                                                  }
                                                : lesson
                                          ),
                                        }
                                      : course
                                  )
                                );
                              }}
                            >
                              Needs Revision
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* SUBMISSIONS DASHBOARD (staff) */}
        {view === "submissions" && isStaff && (
          <div>
            <h2 style={{ marginTop: 0 }}>Student Submissions</h2>

            {courses.flatMap((course) =>
              (course.lessons || []).flatMap((lesson) =>
                (lesson.modules || []).flatMap((mod) =>
                  (mod.submissions || []).map((sub) => ({
                    courseTitle: course.title,
                    lessonTitle: lesson.title,
                    moduleTitle: mod.title,
                    ...sub,
                  }))
                )
              )
            ).length === 0 && <p>No submissions yet.</p>}

            {courses.flatMap((course) =>
              (course.lessons || []).flatMap((lesson) =>
                (lesson.modules || []).flatMap((mod) =>
                  (mod.submissions || []).map((sub) => (
                    <div
                      key={sub.id}
                      style={{
                        border: "1px solid #ddd",
                        padding: 12,
                        marginBottom: 12,
                        borderRadius: 8,
                      }}
                    >
                      <strong>{sub.student}</strong>
                      <div>
                        <b>Course:</b> {course.title}
                      </div>
                      <div>
                        <b>Lesson:</b> {lesson.title}
                      </div>
                      <div>
                        <b>Module:</b> {mod.title}
                      </div>

                      <div style={{ marginTop: 6 }}>
                        <a href={sub.url} target="_blank" rel="noreferrer">
                          View Github Submission
                        </a>
                      </div>

                      <div style={{ marginTop: 6 }}>
                        <b>Status:</b>{" "}
                        <span
                          style={{
                            color:
                              sub.status === "approved"
                                ? "green"
                                : sub.status === "revision"
                                ? "orange"
                                : "gray",
                          }}
                        >
                          {sub.status || "pending"}
                        </span>
                      </div>

                      {sub.feedback && (
                        <div style={{ marginTop: 6 }}>
                          <b>Feedback:</b>
                          <p style={{ marginTop: 4 }}>{sub.feedback}</p>
                        </div>
                      )}
                    </div>
                  ))
                )
              )
            )}
          </div>
        )}

        {/* MESSAGES */}
        {view === "messages" && (
          <div>
            <p>
              Messages view placeholder (we’ll merge your full messaging next).
            </p>
          </div>
        )}

        {/* USERS */}
        {view === "users" && (
          <div>
            {isStaff ? (
              <p>
                User management placeholder (we’ll merge your full user tools
                next).
              </p>
            ) : (
              <p>Students do not have access to user management.</p>
            )}
          </div>
        )}

        {/* PROGRESS */}
        {view === "progress" && (
          <div>
            {/* STUDENT VIEW */}
            {isStudent && (
              <>
                <h2 style={{ marginTop: 0 }}>My Progress</h2>

                {courses.length === 0 && <p>No courses yet.</p>}

                {courses.map((course) => {
                  const percent = calculateCourseProgress(
                    course,
                    currentUser.username
                  );

                  return (
                    <div
                      key={course.id}
                      style={{
                        border: "1px solid #ccc",
                        padding: 12,
                        marginBottom: 12,
                        borderRadius: 8,
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>{course.title}</h3>

                      <div
                        style={{
                          background: "#e5e7eb",
                          borderRadius: 6,
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

            {/* ADMIN / MENTOR VIEW */}
            {isStaff && (
              <>
                <h2 style={{ marginTop: 0 }}>Student Progress</h2>

                {users.filter((u) => u.role === "student").length === 0 && (
                  <p>No student accounts yet.</p>
                )}

                {users
                  .filter((u) => u.role === "student")
                  .map((student) => (
                    <div key={student.username} style={{ marginBottom: 20 }}>
                      <h3 style={{ marginBottom: 6 }}>{student.username}</h3>

                      {courses.length === 0 && <p>No courses yet.</p>}

                      {courses.map((course) => {
                        const percent = calculateCourseProgress(
                          course,
                          student.username
                        );
                        return (
                          <div key={course.id} style={{ marginBottom: 6 }}>
                            <strong>{course.title}</strong> — {percent}%{" "}
                            {percent === 100 ? "🏅" : ""}
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </>
            )}
          </div>
        )}

        {/* REPORTS */}
        {view === "reports" && (
          <div>
            {isStaff ? (
              <p>Reports placeholder.</p>
            ) : (
              <p>Students do not have access to reports.</p>
            )}
          </div>
        )}

        {/* SETTINGS */}
        {view === "settings" && (
          <div>
            <p>Settings placeholder.</p>
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
    <div style={{ padding: 40, maxWidth: 420 }}>
      <h1>Phoenix Fire Technical Academy</h1>

      {view === "signin" && (
        <>
          <h3>Sign In</h3>

          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />

          <button onClick={() => onSignIn(username, password)}>Sign In</button>

          <p style={{ marginTop: 12 }}>
            <button onClick={() => setView("create")}>Create Account</button>
          </p>
        </>
      )}

      {view === "create" && (
        <>
          <h3>Create Account</h3>

          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          >
            <option value="student">Student</option>
            <option value="mentor">Mentor</option>
            <option value="admin">Admin</option>
          </select>

          <input
            placeholder="Owner Key"
            value={ownerKey}
            onChange={(e) => setOwnerKey(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
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
