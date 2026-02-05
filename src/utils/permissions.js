export function getUserKey(user) {
    return user?.studentId ?? user?.email ?? user?.username ?? null;
}

export function canMentorSeeCourse(course, user) {
    if (!user) return false;

    const role = user.role;
    if (role === "admin") return true;

    if (role === "mentor") {
        const myKey = getUserKey(user);
        if (!myKey) return false;

        const assigned = course?.mentorKey;

        // Unassigned courses are visible to ALL mentors (by choice)
        if (!assigned) return true;

        // Assigned courses visible only to that mentor
        return assigned === myKey;
    }

    return false;
}