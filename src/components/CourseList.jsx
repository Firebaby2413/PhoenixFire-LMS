import { calculateCourseProgress } from '../utils/progress';
import '../styles.css';

export default function CourseList({
    courses = [],
    currentUser,
    isStudent,
    isStaff,
    onCreateCourse,
    onOpenCourse,
    onEditCourse,
    onDeleteCourse
}) {
    // Ensure courses is always an array to prevent runtime map crashes
    const safeCourses = Array.isArray(courses) ? courses : [];

    const studentKey =
        currentUser?.studentId ??
        currentUser?.email ??
        currentUser?.username;
    
    const handleDelete = (course) => {
        if (window.confirm(`Are you sure you want to delete "${course.title || "this course"}"? This action cannot be undone.`)) {
            onDeleteCourse?.(course);
        }
    };

    return (
        <div className="course-list-container">
            {/* STAFF: Create Course Action Header */}
            {isStaff && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <button
                        type='button'
                        className='btn'
                        onClick={onCreateCourse}
                    >
                        + Create Course
                    </button>
                </div>
            )}

            {/* EMPTY STATE */}
            {safeCourses.length === 0 && (
                <p className="no-courses-msg" style={{ opacity: 0.8, fontStyle: 'italic' }}>
                    No courses available yet.
                </p>
            )}

            {/* COURSE CARDS LIST */}
            {safeCourses.map((course, index) => {
                const percent =
                    isStudent && studentKey
                        ? calculateCourseProgress(course, studentKey)
                        : 0;
                
                const courseKey = course?.id || course?.slug || `course-${index}`;

                return (
                    <div key={courseKey} className="course-box">
                        <h3 className="pf-title">{course.title || "Untitled Course"}</h3>
                        <p>{course.description || 'No description provided.'}</p>

                        {/* STUDENT PROGRESS BAR */}
                        {isStudent && (
                            <div className="course-progress">
                                <div className="course-progress-bar">
                                    <div
                                        className='course-progress-fill'
                                        style={{
                                            width: `${percent}%`,
                                            background:
                                                percent === 100
                                                    ? "var(--magic-blue, #3a86ff)"
                                                    : "var(--sky-blue, #4cc9f0)"
                                        }}
                                    />
                                </div>
                                <small>
                                    {percent}% complete {percent === 100 ? '🏅' : ''}
                                </small>
                            </div>
                        )}

                        {/* ACTIONS */}
                        <div className="course-actions">
                            <button
                                type='button'
                                className='btn btn-inline'
                                onClick={() => onOpenCourse?.(course)}
                            >
                                Open Course
                            </button>

                            {isStaff && (
                                <>
                                    <button
                                        type='button'
                                        className='btn-secondary btn-inline'
                                        onClick={() => onEditCourse?.(course)}
                                    >
                                        Edit
                                    </button>

                                    <button
                                        type='button'
                                        className='btn-secondary btn-inline'
                                        onClick={() => handleDelete(course)}
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