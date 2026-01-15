/* LOCAL STORAGE ADAPTER */
/* Temporary. Will be replaced by Supabase */
const LS_USERS = "pfta_users";
const LS_CURRENT = "pfta_CurrentUser";
const LS_COURSES = "pfta_courses";


console.log("✅ USING storage.js FROM:", import.meta.url);
/* USERS */
export function loadUsers() {
    try {
        const stored = JSON.parse(localStorage.getItem(LS_USERS) || "[]");
        return Array.isArray(stored) ? stored : [];
    } catch {
        return [];
    }
}

export function saveUsers(users) {
    localStorage.setItem(LS_USERS, JSON.stringify(users));
}

/* CURRENT USER */
export function loadCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem(LS_CURRENT) || "null");
    } catch {
        return null;
    }
}

export function saveCurrentUser(user) {
    localStorage.setItem(LS_CURRENT, JSON.stringify(user));
}

export function clearCurrentUser() {
    localStorage.removeItem("pfta_CurrentUser");
}

/* COURSES */
export function loadCourses() {
    try {
        const stored = JSON.parse(localStorage.getItem(LS_COURSES) || "[]");
        return Array.isArray(stored) ? stored : [];
    } catch {
        return [];
    }
}

export function saveCourses(courses) {
    localStorage.setItem(LS_COURSES, JSON.stringify(courses));
}

