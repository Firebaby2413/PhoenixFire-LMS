function studentKeys(input) {
    // input can be: 
    // - string key (studentId/email/username)
    // - user object with {studentId,email,username}
    if (!input) return [];
    if (typeof input === "string") return [input];
    return [input.studentId, input.email, input.username].filter(Boolean);
}

export function isModuleCompletedByStudent(mod, student) {
    const keys = studentKeys(student);
    if (keys.length === 0) return false;

    const completions = Array.isArray(mod?.completions) ? mod.completions : [];
    return completions.some((c) => keys.includes(c?.student));
}

export function isModuleApprovedByStudent(mod, student) {
    const keys = studentKeys(student);
    if (keys.length === 0) return false;

    const subs = Array.isArray(mod?.assignment?.submissions)
        ? mod.assignment.submissions
        : [];
    
    return subs.some((s) => keys.includes(s?.student) && s?.status === "approved");
}

/**
 * PROGRESS RULE
 *  - If modules REQUIRES submission (repoUrl exists) => completed ONLY when APPROVED
 * - Else (content module) => completed when student marks complete (mod.completions)
 */
export function calculateCourseProgressDetailed(course, student) {
    const keys = studentKeys(student);

    const result = {
        totalLessons: 0,
        completedLessons: 0,
        totalModules: 0,
        completedModules: 0,
        approvedModules: 0,
        percent: 0,
    };

    const lessons = Array.isArray(course?.lessons) ? course.lessons : [];
    if (lessons.length === 0 || keys.length === 0) return result;
    
    result.totalLessons = lessons.length;

    for (const lesson of lessons) {
        const modules = Array.isArray(lesson?.modules) ? lesson.modules : [];
        if (modules.length === 0) continue;

        let lessonTotal = 0;
        let lessonCompleted = 0;

        for (const mod of modules) {
            lessonTotal++;
            result.totalModules++;

            const assignment = mod?.assignment || null;
            const requiresSubmission = !!assignment?.repoUrl;

            const approved = requiresSubmission ? isModuleApprovedByStudent(mod, student) : false;
            const completed = requiresSubmission ? approved : isModuleCompletedByStudent(mod, student);

            if (approved) result.approvedModules++;
            if (completed) {
                result.completedModules++;
                lessonCompleted++;
            }
        }

        if (lessonTotal > 0 && lessonCompleted === lessonTotal) {
            result.completedLessons++;
        }
    }

    if (result.totalModules > 0) {
        result.percent = Math.round((result.completedModules / result.totalModules) * 100);
    }

    return result;
}

export function calculateCourseProgress(course, student) {
    return calculateCourseProgressDetailed(course, student).percent;
}

export function getPendingRevisionCount(courses, student) {
    const keys = studentKeys(student);
    if (keys.length === 0 || !Array.isArray(courses)) return 0;

    let count = 0;
    courses.forEach((course) => {
        (course.lessons || []).forEach((lesson) => {
            (lesson.modules || []).forEach((mod) => {
                const submissions = mod.assignment?.submissions || [];
                // Check if any submissions matching the student's keys is marked as 'revision'
                const hasRevision = submissions.some(
                    (s) => keys.includes(s.student) && s.status === "revision"
                );

                if (hasRevision) {
                    count++;
                }
            });
        });
    });

    return count;
}

export function getModulesNeedingRevision(courses, student) {
    const keys = studentKeys(student);
    if (keys.length === 0 || !Array.isArray(courses)) return [];

    const needingRevision = [];

    courses.forEach((course) => {
        (course.lessons || []).forEach((lesson) => {
            (lesson.modules || []).forEach((mod) => {
                const submissions = mod.assignemnt?.submissions || [];
                const mySub = submissions.find((s) => keys.includes(s.student));

                if (mySub?.status === "revision") {
                    needingRevision.push({
                        courseId: course.id,
                        courseTitle: course.title,
                        lessonId: lesson.id,
                        lessonTitle: lesson.title,
                        moduleId: mod.id,
                        moduleTitle: mod.title
                    });
                }
            });
        });
    });

    return needingRevision;
}

export function getStudentFeedbackHistory(courses, currentUser) {
    if (!currentUser) return [];
    const studentKey = currentUser.studentId ?? currentUser.email ?? currentUser.username;
    const history = [];

    courses.forEach((course) => {
        course.lessons?.forEach((lesson) => {
            lesson.modules?.forEach((mod) => {
                const subs = mod.assignment?.submissions || [];
                //Find submissions by this student that have feedback
                const studentSubs = subs.filter(s => s.student === studentKey && s.feedback);

                studentSubs.forEach(s => {
                    history.push({
                        courseId: course.id,
                        lessonId: lesson.id,
                        courseTitle: course.title,
                        moduleTitle: mod.title,
                        feedbackText: s.feedback,
                        status: s.status,
                        date: s.submittedAt
                    });
                });
            });
        });
    });

    return history.sort((a, b) => new Date(b.date) - new Date(a.date));
}