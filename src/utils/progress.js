export function calculateCourseProgress(course, studentUsername) {
    if (!course?.lessons) return 0;

    let total = 0;
    let completed = 0;

    course.lessons.forEach((lesson) => {
        (lesson.modules || []).forEach((mod) => {
            total++;
            if (
                (mod.submissions || []).some(
                    (s) =>
                        s.student === studentUsername &&
                        s.status === "approved"
                )
            ) {
                completed++;
            }
        });
    });

    return total === 0 ? 0 : Math.round((completed / total) * 100);
}