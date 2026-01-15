import phoenixLogo from "../assets/Images/phoenix.jpg";
export default function Sidebar({
    currentUser,
    isStudent,
    isStaff,
    setView,
    signOut,
}) {
    return (
        <aside id="sidebar">
            {/* HEADER */}
            <div className="sidebar-header">
                <img
                    src={phoenixLogo}
                    alt="Phoenix Fire Technical Academy"
                    className="sidebar-logo-img"
                />
                <div className="sidebar-logo-text">
                    Phoenix Fire<br />Technical Academy
                </div>
            </div>

            {/* USER INFO */}
            <div className="sidebar-user">
                <div className="sidebar-username">{currentUser.email ?? currentUser.username}</div>
                <div className="sidebar-role">{currentUser.role}</div>
            </div>

            {/* SHARED */}
            <button className="sidebar-btn" onClick={() => setView("dashboard")}>
                Dashboard
            </button>
            <button className="sidebar-btn" onClick={() => setView("courses")}>
                Courses
            </button>
            <button className="sidebar-btn" onClick={() => setView("messages")}>
                Messages
            </button>

            {/* STUDENT */}
            {isStudent && (
                <>
                    <button className="sidebar-btn" onClick={() => setView("progress")}>
                        My Progress
                    </button>
                    <button className="sidebar-btn" onClick={() => setView("settings")}>
                        Settings
                    </button>
                </>
            )}

            {/* STAFF */}
            {isStaff && (
                <>
                <button className="sidebar-btn" onClick={() => setView("progress")}>
                    Progress
                </button>
                <button className="sidebar-btn" onClick={() => setView("reports")}>
                    Reports
                </button>
                <button className="sidebar-btn" onClick={() => setView("submissions")}>
                    Submissions
                </button> 
                <button className="sidebar-btn" onClick={() => setView("studentProgress")}>
                    Student Progress
                </button>
                <button className="sidebar-btn" onClick={() => setView("settings")}>
                    Settings
                </button>
                </>
            )}

            {/* ADMIN ONLY */}
            {currentUser?.role === "admin" && (
                <>
                    <button className="sidebar-btn" onClick={() => setView("users")}>
                        Users
                    </button>
                </>
            )}

            {/* LOGOUT */}
            <button className="sidebar-btn sidebar-logout" onClick={signOut}>
                Logout
            </button>

        </aside>
    );
}