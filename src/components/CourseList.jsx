import { calculateCourseProgress } from "../utils/progress";
import "../styles.css";

export default function CourseList({
    courses,
    currentUser,
    isStudent,
    isStaff, 
    onCreateCourse,
    onOpenCourse,
    onEditCourse,
    onDeleteCourse
}) {

    const studentKey = 
        currentUser?.studentId ??
        currentUser?.email ??
        currentUser?.username;

    return (
        <div>
            {/* STAFF: Create Course  */}
            {isStaff && (
                <button className="btn" onClick={onCreateCourse}>
                    Create Course
                </button>
            )}

            {courses.length === 0 && <p>No courses yet.</p>}

            {courses.map((course) => {
                const percent = 
                    isStudent && studentKey
                        ? calculateCourseProgress(course, studentKey)
                        : 0;
                
                return (
                    <div key={course.id} className="course-box">
                        <h3 className="pf-title">{course.title}</h3>
                        <p>{course.description}</p>
                        
                        {/* STUDENT PROGRESS */}
                        {isStudent && (
                            <div className="course-progress">
                                <div className="course-progress-bar">
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
                                <small>
                                    {percent}% complete {percent === 100 ? "🏅" : ""}
                                </small>
                            </div>
                        )}

                        <div className="course-actions">
                            <button className="btn btn-inline" onClick={() => onOpenCourse(course)}>
                                Open Course
                            </button>

                            {isStaff && (
                                <>
                                    <button className="btn-secondary btn-inline" onClick={() => onEditCourse(course)}>
                                        Edit
                                    </button>

                                    <button className="btn-secondary btn-inline" onClick={() => onDeleteCourse(course)}>
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