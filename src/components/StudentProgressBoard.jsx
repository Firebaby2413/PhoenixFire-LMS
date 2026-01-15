import { calculateCourseProgress } from "../utils/progress";
import "../styles.css";

export default function StudentProgressBoard({ courses, users }) {
  const studentUsers = Array.isArray(users)
    ? users.filter((u) => u?.role === "student")
    : [];

  if (!courses || courses.length === 0) {
    return <p>No courses yet.</p>;
  }

  if (studentUsers.length === 0) {
    return <p>No students found.</p>;
  }

  return (
    <div>
      <h2 className="pf-title">Student Progress (Mentor/Admin)</h2>

      {courses.map((course) => (
        <div key={course.id} className="course-box" style={{ marginBottom: 16 }}>
          <h3 className="pf-title" style={{ marginBottom: 6 }}>
            {course.title}
          </h3>
          <p style={{ marginTop: 0 }}>{course.description}</p>

          <div style={{ display: "grid", gap: 10 }}>
            {studentUsers.map((student) => {
              const studentKey =
                student?.studentId ?? student?.email ?? student?.username;

              const percent = studentKey
                ? calculateCourseProgress(course, studentKey)
                : 0;

              return (
                <div
                  key={student.id || student.email || student.username}
                  style={{
                    border: "1px solid var(--slate-700)",
                    background: "rgba(0,0,0,0.15)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>
                      {student.firstName} {student.lastName}
                    </strong>
                    <span style={{ opacity: 0.85 }}>{percent}%</span>
                  </div>

                  <div
                    className="course-progress-bar"
                    style={{ marginTop: 8 }}
                  >
                    <div
                      className="course-progress-fill"
                      style={{
                        width: `${percent}%`,
                        background:
                          percent === 100
                            ? "var(--magic-blue)"
                            : "var(--sky-blue)",
                      }}
                    />
                  </div>

                  <small style={{ opacity: 0.85 }}>
                    {studentKey || "(missing student key)"}
                    {percent === 100 ? " 🏅" : ""}
                  </small>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
