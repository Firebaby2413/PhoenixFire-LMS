import * as storage from "./storage";

console.log("✅ USING authService.js FROM:", import.meta.url);

const OWNER_KEY = "FireKey-Creation-2026";
const OWNER_ACCOUNT = "PhoenixFireTechnical@gmail.com";

// AUTH FUNCTIONS

export function initializeUsers() {
    let users = storage.loadUsers();

    if (!Array.isArray(users)) {
        users = [];
    }

    if (users.length === 0) {
        users = [
            {
                id: crypto.randomUUID(),
                email: OWNER_ACCOUNT,
                password: "OwnerOperator2026",
                role: "admin",
                firstName: "Phoenix",
                lastName: "Fire",
                adminId: "ADMIN-0001",
                createAt: new Date().toISOString(),
            },
        ];
        storage.saveUsers(users);
    }
    return users;
}


export function signInUser(users, email, password) {
    const safeUsers = Array.isArray(users) ? users : [];

    console.log("SIGN IN USERS:", users, "safeUsers", safeUsers, Array.isArray(users));

    const user = safeUsers.find((u) => u.email === email && u.password === password);

    if (!user) {
        throw new Error("Invalid email or password");
    }

    storage.saveCurrentUser(user);
    return user;
}

export function createUser(users, email, password, role, ownerKey, firstName, lastName, studentId) {
    if (!Array.isArray(users)) {
        throw new Error("Internal Error: users is not an array");
    }

    if (!email || !password || !role) {
        throw new Error("Missing required account fields");
    }


    if (!email.includes("@")) {
        throw new Error("Email must be a valid email address");
    }

    if (users.some((u) => u.email === email)) {
        throw new Error("An account with this email already exists");
    }

    if (!firstName || !lastName) {
        throw new Error("First and last name are required");
    }

    if (role === "student" && !studentId) {
        throw new Error("Student ID is required for students");
    }

    if (role === "admin" && ownerKey !== OWNER_KEY) {
        throw new Error("Invalid Owner Key");
    }

    const baseUser = {
        id: crypto.randomUUID(),
        email,
        password,
        role,
        firstName,
        lastName,
        createdAt: new Date().toISOString(),
    };

    if (role === "student") {
        baseUser.studentId = studentId || `STU-${Date.now()}`;
    }

    if (role === "mentor") {
        baseUser.mentorId = `MEN-${Date.now()}`;
    }

    if (role === "admin") {
        baseUser.adminId = `ADM-${Date.now()}`;
    }

    const updatedUsers = [...users, baseUser];
    storage.saveUsers(updatedUsers);
    return updatedUsers;
}
