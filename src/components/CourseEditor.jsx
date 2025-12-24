import { useEffect, useState } from "react";
import MarkdownPreview from "./MarkdownPreview";

function newId() {
  if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function ensureModuleHasAssignment(mod) {
  // Accept old shapes too:
  // - mod.assignments[0]
  // - mod.submissions
  if (mod?.assignment) return mod;

  const fromArray = Array.isArray(mod?.assignments) ? mod.assignments[0] : null;
  const fromSubmissions = Array.isArray(mod?.submissions) ? mod.submissions : [];

  return {
    ...mod,
    assignment: {
      instructionsText: fromArray?.instructions ?? "",
      instructionsVideoUrl: fromArray?.instructionsVideoUrl ?? "",
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

export default function CourseEditor({ course, onSave, onCancel }) {
  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [lessons, setLessons] = useState(() => deepCloneCourseLessons(course));

  // Sync editor when switching to a different course id
  useEffect(() => {
    if (!course) return;
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
      lessons,
    });
  }

  if (!course) return null;

  return (
    <div
      style={{
        background: "#0f172a",
        color: "#e5e7eb",
        border: "1px solid #334155",
        padding: 14,
        borderRadius: 14,
      }}
    >
        <h2 style={{ marginTop: 0, color: "#f59e0b" }}>Edit Course</h2>

      <label style={{ fontWeight: 800 }}>Title</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{
          width: "100%",
          marginBottom: 10,
          padding: 10,
          borderRadius: 10,
          border: "1px solid #334155",
          background: "#111827",
          color: "#e5e7eb",
        }}
      />

       <label style={{ fontWeight: 800 }}>Description</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{
          width: "100%",
          minHeight: 90,
          marginBottom: 12,
          padding: 10,
          borderRadius: 10,
          border: "1px solid #334155",
          background: "#111827",
          color: "#e5e7eb",
        }}
      />

      <h3 style={{ color: "#60a5fa" }}>Lessons</h3>

      {lessons.length === 0 && <p>No lessons yet.</p>}

      {lessons.map((lesson) => (
        <div
          key={lesson.id}
          style={{
            border: "1px solid #334155",
            padding: 12,
            borderRadius: 14,
            marginBottom: 12,
            background: "#111827",
          }}
        >
          <input
            value={lesson.title}
            onChange={(e) =>
              updateLessonField(lesson.id, "title", e.target.value)
            }
            style={{
              width: "100%",
              marginBottom: 6,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #334155",
              background: "#0b1220",
              color: "#e5e7eb",
              fontWeight: 800,
            }}
          />

           <textarea
            value={lesson.description || ""}
            onChange={(e) =>
              updateLessonField(lesson.id, "description", e.target.value)
            }
            placeholder="Lesson description (optional)"
            style={{
              width: "100%",
              minHeight: 70,
              marginBottom: 8,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #334155",
              background: "#0b1220",
              color: "#e5e7eb",
            }}
          />

          <button
            onClick={() => deleteLesson(lesson.id)}
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
             Delete Lesson
          </button>

          <h4 style={{ marginTop: 14, color: "#a855f7" }}>Modules</h4>

          {(lesson.modules || []).length === 0 && <p>No modules yet.</p>}

          {(lesson.modules || []).map((mod) => (
            <div
              key={mod.id}
              style={{
                border: "1px dashed #475569",
                padding: 12,
                borderRadius: 14,
                marginBottom: 10,
                background: "#0b1220",
              }}
            >
              <input
                value={mod.title}
                onChange={(e) =>
                  updateModule(lesson.id, mod.id, "title", e.target.value)
                }
                style={{
                  width: "100%",
                  marginBottom: 6,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #334155",
                  background: "#111827",
                  color: "#e5e7eb",
                  fontWeight: 800,
                }}
              />

              <textarea
                value={mod.content}
                onChange={(e) =>
                  updateModule(lesson.id, mod.id, "content", e.target.value)
                }
                placeholder="Module content (Markdown supported)"
                style={{
                  width: "100%",
                  minHeight: 100,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #334155",
                  background: "#111827",
                  color: "#e5e7eb",
                }}
              />

              <MarkdownPreview markdown={mod.content} />

              {/* Assignment (ONE per module) */}
              <h5 style={{ marginTop: 12, color: "#f97316" }}>
                Assignment Instructions
              </h5>

              <textarea
                placeholder="Assignment instructions (text / Markdown supported)"
                value={mod.assignment?.instructionsText || ""}
                onChange={(e) =>
                  updateModule(lesson.id, mod.id, "assignment", {
                    ...(mod.assignment || {}),
                    instructionsText: e.target.value,
                  })
                }
                style={{
                  width: "100%",
                  minHeight: 90,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #334155",
                  background: "#111827",
                  color: "#e5e7eb",
                  marginBottom: 8,
                }}
              />

              <input
                placeholder="Assignment video URL (optional)"
                value={mod.assignment?.instructionsVideoUrl || ""}
                onChange={(e) =>
                  updateModule(lesson.id, mod.id, "assignment", {
                    ...(mod.assignment || {}),
                    instructionsVideoUrl: e.target.value,
                  })
                }
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #334155",
                  background: "#111827",
                  color: "#e5e7eb",
                  marginBottom: 8,
                }}
              />

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

          button
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
            + Add Module
          </button>
        </div>
      ))}

      <button
        onClick={addLesson}
        style={{
          background: "#3b82f6",
          color: "#0b1220",
          border: "none",
          padding: "10px 14px",
          borderRadius: 10,
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
         Add Lesson
      </button>

      <hr style={{ margin: "16px 0", borderColor: "#334155" }} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={saveCourse}
          style={{
            background: "#f59e0b",
            color: "#0b1220",
            border: "none",
            padding: "10px 14px",
            borderRadius: 10,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Save Course
        </button>

        <button
          onClick={onCancel}
          style={{
            background: "#334155",
            color: "#e5e7eb",
            border: "none",
            padding: "10px 14px",
            borderRadius: 10,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
         </div>
    </div>
  );
}






