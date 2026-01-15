export function calculateCourseProgressDetailed(course, studentKey) {
    const result = {
        totalLessons: 0,
        completedLessons: 0,
        totalModules: 0,
        approvedModules: 0,
        percent: 0,
    };

    if (!course?.lessons?.length) return result;

    result.totalLessons = course.lessons.length;

    course.lessons.forEach((lesson) => {
        let lessonModules = 0;
        let lessonApproved = 0;

        (lesson.modules || []).forEach((mod) => {
            if (!mod.assignment) return;

            lessonModules++;
            result.totalModules++;

            const approved = (mod.assignment.submissions || []).some(
                (s) => s.student === studentKey && s.status === "approved"
            );

            if (approved) {
                lessonApproved++;
                result.approvedModules++;
            }
        });

        if (lessonModules > 0 && lessonModules === lessonApproved) {
            result.completedLessons++;
        }
    });

    if (result.totalModules > 0) {
        result.percent = Math.round(
            (result.approvedModules / result.totalModules) * 100
        );
    }
    return result;   
}

export function calculateCourseProgress(course, studentKey) {
    const detailed = calculateCourseProgressDetailed(course, studentKey);
    return detailed.percent;
}