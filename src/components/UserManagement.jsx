import { useState } from "react";
import "../styles.css";

export default function UserManagement({ users, onUserCreated, currentUser }) {
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        studentId: "",
        ownerKey: "",
    });
    const [msg, setMsg] = useState({ text: "", type: "" });
    const formatRelativeDate = (dateString) => {
        if (!dateString) return "Never";
        const date = new Date(dateString);
        return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (currentUser?.role !== "admin")
        return <div className="section-container">Access Denied.</div>;

    const handleEnroll = (e) => {
        e.preventDefault();
        try {
        onUserCreated(
            users,
            formData.email,
            formData.password,
            "student",
            formData.ownerKey,
            formData.firstName,
            formData.lastName,
            formData.studentId,
        );
        setMsg({ text: "Student enrolled successfully!", type: "success" });
        setFormData({
            firstName: "",
            lastName: "",
            email: "",
            password: "",
            studentId: "",
            ownerKey: "",
        });
        } catch (err) {
        setMsg({ text: err.message, type: "error" });
        }

    const downloadStudentReport = () => {
        // 1. Define CSV Headers
        const headers = ["Student Name", "Email", "Student ID", "Last Login", "Overall Progress %"];

        // 2. Map student data to rows
        const rows = users
            .filter((u) => u.role === "student")
            .map((u) => {
                // Calculate an average progress across all available courses
                const totalProgress = course.reduce((acc, course) => {
                    return acc + calculateCourseProgress(course, u.studentId || u.email);
                }, 0);

                const avgProgress = courses.length > 0 ? Math.round(totalProgress / courses.length) : 0;

                return [
                    `${u.firstName} ${u.lastName}`,
                    u.email,
                    u.studentId || "N/A",
                    u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never",
                    `${avgProgress}%`
                ];
            });
        
        // Construct CSV String
        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(","))
            .join("\n");

        // 4. Trigger Download
        const blob = new Blob([csvContent], { type: "text/cs;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Phoenix_FIre_Student_Report_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    };

    return (
        <div className="section-container">
        <h2 className="pf-title">User Management</h2>

        {/* Manual Enrollment Form */}
        <div
            className="course-box"
            style={{ marginBottom: "30px", border: "1px solid var(--pf-border)" }}
        >
            <h3 style={{ marginTop: 0, color: "var(--pf-fire)" }}>
            Enroll Individual Student
            </h3>
            <form onSubmit={handleEnroll} style={{ display: "grid", gap: "12px" }}>
            <div style={{ display: "flex", gap: "10px" }}>
                <input
                className="input-wide"
                placeholder="First Name"
                value={formData.firstName}
                onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                }
                required
                />
                <input
                className="input-wide"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                }
                required
                />
            </div>
            <input
                className="input-wide"
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
                }
                required
            />
            <input
                className="input-wide"
                type="password"
                placeholder="Initial Password"
                value={formData.password}
                onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
                }
                required
            />
            <input
                className="input-wide"
                placeholder="Student ID"
                value={formData.studentId}
                onChange={(e) =>
                setFormData({ ...formData, studentId: e.target.value })
                }
                required
            />

            <div
                style={{
                padding: "10px",
                background: "rgba(245, 158, 11, 0.05)",
                borderRadius: "8px",
                border: "1px solid rgba(245, 158, 11, 0.2)",
                }}
            >
                <label
                className="help-text"
                style={{ color: "var(--pf-fire)", fontWeight: "bold" }}
                >
                Owner Authorization Key
                </label>
                <input
                className="input-wide"
                type="password"
                placeholder="Enter Key to Authorize"
                value={formData.ownerKey}
                onChange={(e) =>
                    setFormData({ ...formData, ownerKey: e.target.value })
                }
                required
                />
            </div>

            <button type="submit" className="btn">
                Create Account
            </button>
            {msg.text && (
                <p
                style={{
                    color: msg.type === "success" ? "#22c55e" : "#ef4444",
                    textAlign: "center",
                }}
                >
                {msg.text}
                </p>
            )}
            </form>
        </div>

        {/* Student Status Table */}
        <h3 className="pf-title">Enrollment Status</h3>
        <div className="course-box" style={{ padding: 0, overflow: "hidden" }}>
            <table
            style={{ width: "100%", borderCollapse: "collapse", color: "#fff" }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                    <h3 className="pf-title" style={{ margin: 0 }}>Enrollment Status</h3>
                    <button
                        className="btn-secondary"
                        onClick={downloadStudentReport}
                        style={{ padding: "8px 16px", fontSize: "12px", border: "1px solid var(--pf-fire)", color: "var(--pf-fire)" }}
                    >
                        📥 Download Student Report (CSV)
                    </button>
                </div>
                <thead style={{ background: "rgba(255,255,255,0.05)" }}>
                    <tr style={{ textAlign: "left" }}>
                    <th style={{ padding: "12px" }}>Student</th>
                    <th>ID</th>
                    <th>Role</th>
                    <th>Account Status</th>
                    </tr>
                </thead>
                <tbody>
                    {users
                        .filter((u) => u.role === "student")
                        .map((u) => (
                            <tr
                            key={u.id}
                            style={{ borderBottom: "1px solid var(--pf-border)" }}
                            >
                                <td style={{ padding: "12px" }}>
                                    <div>{u.firstName} {u.lastName}</div>
                                    <div style={{ fontSize: "11px", opacity: 0.6 }}>{u.email}</div>
                                </td>
                                <td style={{ fontSize: "13px" }}>{u.studentId}</td>
                                <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <div
                                            style={{ 
                                                width: "8px",
                                                height: "8px",
                                                borderRadius: "50%",
                                                // Green if they've logged in at least once
                                                background: u.lastLogin ? "#22c55e" : "#f59e0b",
                                                boxShadow: u.lastLogin ? "0 0 5px #22c55e" : "none",
                                            }}
                                        />
                                        <span style={{ fontSize: "12px", color: u.lastLogin ? "#22c55e" : "#f59e0b" }}>
                                            {u.lastLogin ? "Active" : "Pending Setup"}
                                        </span>
                                    </div>
                                </td>
                                {/* NEW COLUMN BELOW */}
                                <td style={{ fontSize: "12px", opacity: 0.8 }}>
                                    {formatRelativeDae(u.lastLogin)}
                                </td>
                            </tr>
                        ))
                    }
                </tbody>
            </table>
        </div>
        </div>
    );
}
