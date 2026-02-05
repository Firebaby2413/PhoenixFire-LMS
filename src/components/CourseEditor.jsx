import { useEffect, useState } from "react";
import MarkdownPreview from "./MarkdownPreview";
import "../styles.css";


function newId() {
  if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getUserKey(user) {
  return user?.studentId ?? user?.email ?? user?.username ?? null;
}

function ensureModuleHasAssignment(mod) {
  // Accept old shapes too:
  // - mod.assignments[0]
  // - mod.submissions
  if (mod?.assignment) return mod;

  const fromArray = Array.isArray(mod?.assignments) ? mod.assignments[0] : null;
  const fromSubmissions = Array.isArray(mod?.submissions) ? mod.submissions : [];
  const legacyVideo =
    fromArray?.instructionsVideoUrl ??
    fromArray?.instructionVideoUrl ?? // legacy typo support
    mod?.assignment?.instructionVideoUrl ??
    "";

  return {
    ...mod,
    assignment: {
      repoUrl: fromArray?.repoUrl ?? mod?.repoUrl ?? "",
      instructionsText: fromArray?.instructions ?? "",
      instructionsVideoUrl: fromArray?.instructionsVideoUrl ?? legacyVideo ?? "",
      submissions: Array.isArray(fromArray?.submissions)
        ? fromArray.submissions
        : fromSubmissions,
    },
  };
}


function deepCloneCourseLessons(course) {
  const lessons = JSON.parse(JSON.stringify(course?.lessons ?? []));
  return lessons.map((lesson) => ({
    ...lesson,
    modules: (lesson.modules || []).map((m) => ensureModuleHasAssignment(m)),
  }));
}

export default function CourseEditor({ course, users, currentUser, onSave, onCancel }) {
  const [mentorKey, setMentorKey] = useState(course?.mentorKey ?? "");
  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [lessons, setLessons] = useState(() => deepCloneCourseLessons(course));

  // Sync editor when switching to a different course id
  useEffect(() => {
    if (!course) return;
    setMentorKey(course.mentorKey ?? "");
    setTitle(course.title ?? "");
    setDescription(course.description ?? "");
    setLessons(deepCloneCourseLessons(course));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id]);

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
                  assignment: {
                    repoUrl: "",
                    instructionsText: "",
                    instructionsVideoUrl: "",
                    submissions: [],
                  },
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
      mentorKey,
      lessons,
    });
  }

  if (!course) return null;

  return (
    <div
      className="course-box"
    >
        <h2 style={{ marginTop: 0, color: "#f59e0b" }}>Edit Course</h2>
        <div className="card">
          <label className="help-text">Title</label>
          <input
            className="input-wide"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <label className="help-text">Description</label>
          <textarea
            className="input-wide"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
      </div>
      
      {/* ADMIN: ASSign mentor to this course */}
      {currentUser?.role === "admin" && (
        <>
          <label className="help-text">Assigned Mentor (course owner)</label>

          <select
            className="input-wide"
            value={mentorKey}
            onChange={(e) => setMentorKey(e.target.value)}
          >
            <option value="">Unassigned (visible to any mentor)</option>
            {(Array.isArray(users) ? users : [])
              .filter((u) => u?.role === "mentor")
              .map((m) => {
                const key = getUserKey(m);
                if (!key) return null;
                return (
                  <option key={key} value={key}>
                    {m.firstName} {m.lastName} - {key}
                  </option>
                );
              })}
          </select>

          <small className="help-text">
            Only the assigned mentor (and admins) will see submissions for this course.
          </small>
        </>
      )}
      
      <h3 style={{ color: "#60a5fa" }}>Lessons</h3>

      {lessons.length === 0 && <p>No lessons yet.</p>}

      {lessons.map((lesson) => (
        <div
          className="lesson-box"
          key={lesson.id}
        >
          <input
            className="input-wide"
            value={lesson.title}
            onChange={(e) =>
              updateLessonField(lesson.id, "title", e.target.value)
            }
          />

          <textarea
            className="input-wide"
            value={lesson.description || ""}
            onChange={(e) =>
              updateLessonField(lesson.id, "description", e.target.value)
            }
            placeholder="Lesson description (optional)"
          />

          <div className="course-actions">
            <button
              onClick={() => deleteLesson(lesson.id)}
              className="btn-outline btn-danger"
            >
              Delete Lesson
            </button>
          </div>

          <h4 style={{ marginTop: 14, color: "#a855f7" }}>Modules</h4>

          {(lesson.modules || []).length === 0 && <p>No modules yet.</p>}

          {(lesson.modules || []).map((mod) => (
            <div
              className="module-box"
              key={mod.id}
            >
              <input
                className="input-wide"
                value={mod.title}
                onChange={(e) =>
                  updateModule(lesson.id, mod.id, "title", e.target.value)
                }
              />

              <textarea
                className="input-wide"
                value={mod.content}
                onChange={(e) =>
                  updateModule(lesson.id, mod.id, "content", e.target.value)
                }
                placeholder="Module content (Markdown supported)"
              />

              <MarkdownPreview markdown={mod.content} />

              <div
                className="card"
              >
                <h5 className="assignment-title">
                  Module Requirements
                </h5>

                {/* MODULE TYPE INFO */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>
                    Module Type:
                    <span style={{ marginLeft: 8, opacity: 0.9 }}>
                      {mod.assignment?.repoUrl ? "Repo Submission (mentor approval required)" : "Content / Complete-only (no repo)"}
                    </span>
                  </div>

                  <small className="help-text">
                    If you add a starter Repo URL below, students will submit a GitHub link and it will require mentor approval.
                    If you leave it blank, students will see a "Mark Complete" button instead.
                  </small>
                </div>

                {/* Starter Repo */}
                <input
                  placeholder="Starter Github repository URL (students clone this)"
                  value={mod.assignment?.repoUrl || ""}
                  onChange={(e) => {
                    const repoUrl = e.target.value;
                    setLessons((prev) =>
                      prev.map((l) =>
                        l.id === lesson.id
                          ? {
                            ...l,
                            modules: l.modules.map((m) =>
                              m.id === mod.id
                                ? {
                                  ...m,
                                  assignment: {
                                    ...(m.assignment || {}),
                                    repoUrl,
                                  },
                                }
                                : m
                            ),
                          }
                          : l
                      )
                    );
                  }}
                  style={{ width: "100%", marginBottom: 8 }}
                />

                <button
                  type="button"
                  className="btn-secondary btn-inline"
                  style={{ marginBottom: 10 }}
                  onClick={() => {
                    setLessons((prev) =>
                      prev.map((l) =>
                        l.id === lesson.id
                          ? {
                            ...l,
                            modules: l.modules.map((m) =>
                              m.id === mod.id
                                ? {
                                  ...m,
                                  assignment: {
                                    ...(m.assignment || {}),
                                    repoUrl: "",
                                  },
                                }
                                : m
                            ),
                          }
                          : l
                      )
                    );
                  }}
                >
                  Clear Repo Requirement (Content Module)
                </button>


                {/* Instructions (Markdown) */}
                <textarea
                  placeholder="Assignment instructions (Markdown supported)"
                  value={mod.assignment?.instructionsText || ""}
                  onChange={(e) => {
                    const instructionsText = e.target.value;
                    setLessons((prev) =>
                      prev.map((l) =>
                        l.id === lesson.id
                          ? {
                            ...l,
                            modules: l.modules.map((m) =>
                              m.id === mod.id
                                ? {
                                  ...m,
                                  assignment: {
                                    ...(m.assignment || {}),
                                    instructionsText,
                                  },
                                }
                                : m
                            ),
                          }
                          : l
                      )
                    );
                  }}
                  style={{ width: "100%", minHeight: 80, marginBottom: 8 }}
                />

                {/* Optional Video */}
                <input
                  placeholder="Instruction Video URL (optional)"
                  value={mod.assignment?.instructionsVideoUrl || ""}
                  onChange={(e) => {
                    const instructionsVideoUrl = e.target.value;
                    setLessons((prev) =>
                      prev.map((l) =>
                        l.id === lesson.id
                          ? {
                            ...l,
                            modules: l.modules.map((m) =>
                              m.id === mod.id
                                ? {
                                  ...m,
                                  assignment: {
                                    ...(m.assignment || {}),
                                    instructionsVideoUrl,
                                  },
                                }
                                : m
                            ),
                          }
                          : l
                      )
                    );
                  }}
                  style={{ width: "100%" }}
                />
              </div>

              <button
                onClick={() => deleteModule(lesson.id, mod.id)}
                style={{
                  background: "#ef4444",
                  color: "#0b1220",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Delete Module
              </button>
            </div>
          ))}

          <button
            onClick={() => addModule(lesson.id)}
            style={{
              background: "#22c55e",
              color: "#0b1220",
              border: "none",
              padding: "8px 12px",
              borderRadius: 10,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Add Module
          </button>
        </div>
      ))}

      <button
        className="btn"
        onClick={addLesson}
      >
        Add Lesson
      </button>

      <hr style={{ margin: "16px 0", borderColor: "#334155" }} />

      <div className="course-actions">
        <button
          className="btn"
          onClick={saveCourse}
        >
          Save Course
        </button>

        <button
          className="btn-secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}






