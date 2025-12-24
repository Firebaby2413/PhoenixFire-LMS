import { calculateCourseProgress } from "../utils/progress";

export default function CourseList({
    courses,
    currentUser,
    isStudent,
    isStaff, 
    onCreateCourse,
    onOpenCourse,
    onEditCourse,
    onDeleteCourse,
}) {
    return (
        <div>
            {/* STAFF: Create Course at the top (NOT inside a lesson) */}
            {isStaff && (
                <button
                    onClick={onCreateCourse}
                    style={{
                        background: "#f97316", //orange
                        color: "#111827",
                        border: "none",
                        padding: "10px 14px",
                        borderRadius: 10,
                        fontWeight: 800,
                        marginBottom: 16,
                        cursor: "pointer",
                    }}
                >
                    Create Course
                </button>
            )}

            {courses.length === 0 && <p>No courses yet.</p>}

            {courses.map((course) => {
                const percent = isStudent
                    ? calculateCourseProgress(course, currentUser.username)
                    : null;
                
                return (
                    <div
                        key={course.id}
                        style={{
                            background: "#111827", // dark gray
                            color: "#e5e7eb",
                            border: "1px solid #374151",
                            padding: 14,
                            marginBottom: 12,
                            borderRadius: 14,
                        }}
                    >
                        <h3 style={{ margin: "0 0 6px 0", color: "#f472b6" /* pink */ }}>
                            {course.title}
                        </h3>
                        <p style={{ marginTop: 0, color: "#cbd5e1" }}>
                            {course.description}
                        </p>

                        {isStudent && (
                            <div style={{ marginBottom: 10 }}>
                                <div
                                    style={{
                                        background: "#334155",
                                        height: 12,
                                        borderRadius: 999,
                                        overflow: "hidden",
                                        marginBottom: 6,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${percent}%`,
                                            background: percent === 100 ? "#22c55e" : "#3b82f6", // green / blue
                                            height: "100%",
                                        }}
                                    />
                                </div>
                                <small style={{ color: "35e7eb" }}>
                                    {percent}% complete {percent === 100 ? "🏅" : ""}
                                </small>
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                                onClick={() => onOpenCourse(course)}
                                style={{
                                    background: "#3b82f6",
                                    color: "#0b1220",
                                    border: "none",
                                    padding: "8px 12px",
                                    borderRadius: 10,
                                    fontWeight: 800,
                                    cursor: "pointer",
                                }}
                            >
                                Open Course
                            </button>

                            {isStaff && (
                                <>
                                    <button
                                        onClick={() => onEditCourse(course)}
                                        style={{
                                            background: "#a855f7",
                                            color: "#0b1220",
                                            border: "none",
                                            padding: "8px 12px",
                                            borderRadius: 10,
                                            fontWeight: 800,
                                            cursor: "pointer",
                                        }}
                                    >
                                        Edit
                                    </button>

                                    <button
                                        onClick={() => onDeleteCourse(course)}
                                        style={{
                                            background: "#ef4444",
                                            color: "#0b1220",
                                            border: "none",
                                            padding: "8px 12px",
                                            borderRadius: 10,
                                            fontWeight: 800,
                                            cursor: "pointer",
                                        }}
                                    >
                                        Delete
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}