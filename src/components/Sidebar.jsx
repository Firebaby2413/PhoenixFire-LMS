import { useRef } from "react";
import { canMentorSeeCourse } from "../utils/permissions";
import phoenixLogo from "../assets/Images/phoenix.jpg";

export default function Sidebar({
    currentUser,
    isStudent,
    isStaff,
    setView,
    signOut,
    onExportBackup,
    onImportBackup,
    courses,
    revisionCount,
}) {
    const fileRef = useRef(null);
    const isAdmin = currentUser?.role === "admin";

    const canSeeSubmissions = (() => {
        const list = Array.isArray(courses) ? courses : [];
        for (const course of list) {
            if (!canMentorSeeCourse(course, currentUser)) continue;
            for (const lesson of course.lessons || []) {
                for (const mod of lesson.modules || []) {
                    const subs = mod?.assignment?.submissions || [];
                    if (subs.length > 0) return true;
                }
            }
        }
        return false;
    })();

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
            <button
                className="sidebar-btn"
                onClick={() => setView("dashboard")}
                style={{ 
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px"
                    }}
                >
                    <span>Dashboard</span>
                    {/* NOTIFICATION BADGE */}
                    {revisionCount > 0 && (
                        <span style={{
                            background: "var(--pf-fire)",
                            color: "white",
                            fontSize: "11px",
                            minWidth: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "bold",
                            boxShadow: "0 0 10px var(--pf-fire)",
                            padding: "2px"
                        }}>
                            {revisionCount}
                        </span>
                    )}
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
                    
                {canSeeSubmissions && (
                    <button className="sidebar-btn" onClick={() => setView("submissions")}>
                        Submissions        
                    </button> 
                )}
                    
                <button className="sidebar-btn" onClick={() => setView("studentProgress")}>
                    Student Progress
                </button>
                <button className="sidebar-btn" onClick={() => setView("settings")}>
                    Settings
                </button>
                </>
            )}

            {/* ADMIN ONLY */}
            {isAdmin && (
                <>
                    <button className="sidebar-btn" onClick={() => setView("users")}>
                        Users
                    </button>

                    <button
                        className="sidebar-btn"
                        type="button"
                        onClick={() => onExportBackup?.()}
                    >
                        Export Backup
                    </button>

                    <button
                        className="sidebar-btn"
                        type="button"
                        onClick={() => fileRef.current?.click()}
                    >
                        Import Backup
                    </button>

                    <input
                        ref={fileRef}
                        type="file"
                        accept="application/json"
                        style={{ display: "none" }}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onImportBackup?.(file);
                            e.target.value = "";
                        }}
                    />
                </>
            )}

            {/* LOGOUT */}
            <button className="sidebar-btn sidebar-logout" onClick={signOut}>
                Logout
            </button>

        </aside>
    );
}