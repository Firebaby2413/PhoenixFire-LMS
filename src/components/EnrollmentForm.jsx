import { useState } from "react";

export default function EnrollmentForm({ users, onUserCreated }) {
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        studentId: "",
        ownerKey: "",
    });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError("");
        setSuccess(false);

        try {
        // Direct call to your existing authService logic
        onUserCreated(
            users,
            formData.email,
            formData.password,
            "student", // Hardcoded to student for this form
            formData.ownerKey,
            formData.firstName,
            formData.lastName,
            formData.studentId,
        );

        setSuccess(true);
        setFormData({
            firstName: "",
            lastName: "",
            email: "",
            password: "",
            studentId: "",
            ownerKey: "",
        });
        } catch (err) {
        setError(err.message);
        }
    };

    return (
        <div
        className="course-box"
        style={{ maxWidth: "500px", margin: "20px auto" }}
        >
        <h3 className="pf-title">Enroll Individual Student</h3>
        <p className="help-text">Authorized enrollment using Owner Key.</p>

        <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
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
            placeholder="Student Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            />

            <input
            className="input-wide"
            type="password"
            placeholder="Temporary Password"
            value={formData.password}
            onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
            }
            required
            />

            <input
            className="input-wide"
            placeholder="Student ID (e.g. STU-101)"
            value={formData.studentId}
            onChange={(e) =>
                setFormData({ ...formData, studentId: e.target.value })
            }
            required
            />

            <hr style={{ borderColor: "var(--pf-border)", margin: "10px 0" }} />

            <label className="help-text" style={{ color: "var(--pf-fire)" }}>
            Security Authorization
            </label>
            <input
            className="input-wide"
            type="password"
            placeholder="Enter Owner Key"
            value={formData.ownerKey}
            onChange={(e) =>
                setFormData({ ...formData, ownerKey: e.target.value })
            }
            required
            style={{ border: "1px solid var(--pf-fire)" }}
            />

            {error && (
            <div
                style={{ color: "#ef4444", fontSize: "14px", fontWeight: "bold" }}
            >
                {error}
            </div>
            )}
            {success && (
            <div
                style={{ color: "#22c55e", fontSize: "14px", fontWeight: "bold" }}
            >
                Student enrolled successfully!
            </div>
            )}

            <button className="btn" type="submit" style={{ marginTop: "10px" }}>
            Create Student Account
            </button>
        </form>
        </div>
    );
}
