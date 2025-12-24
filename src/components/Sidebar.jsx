export default function Sidebar({
    currentUser,
    isStudent,
    isStaff,
    setView,
    signOut,
}) {
    return (
        <aside
            style={{
                width: "260px",
                padding: "16px",
                background: "#111827",
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
            }}
        >
            <h2>Phoenix LMS</h2>

            <p style={{ fontSize: 14 }}>
                {currentUser.username}
                <br />
                <strong>{currentUser.role}</strong>
            </p>

            {/* Shared */}
            <button onClick={() => setView("dashboard")}>Dashboard</button>
            <button onClick={() => setView("courses")}>Courses</button>
            <button onClick={() => setView("messages")}>Messages</button>

            {/* Student-only */}
            {isStudent && (
                <>
                    <button onClick={() => setView("progress")}>My Progress</button>
                    <button onClick={() => setView("settings")}>Settings</button>
                </>
            )}

            {/* Admin / Mentor */}
            {isStaff && (
                <>
                    <button onClick={() => setView("users")}>Users</button>
                    <button onClick={() => setView("progress")}>Progress</button>
                    <button onClick={() => setView("reports")}>Reports</button>
                    <button onClick={() => setView("submissions")}>Submissions</button>
                    <button onClick={() => setView("settings")}>Settings</button>
                </>
            )}

            <button onClick={signOut} style={{ marginTop: "auto" }}>
                Logout
            </button>
        </aside>
    );
}