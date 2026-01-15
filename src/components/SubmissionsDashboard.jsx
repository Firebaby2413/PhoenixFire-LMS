import { useMemo, useState } from "react";
import "../styles.css";

export default function SubmissionsDashboard({ courses, setCourses }) {
    //Filters (inbox defaults)
    const [statusFilter, setStatusFilter] = useState("pending"); // pending | approved | revision | all
    const [courseFilterId, setCourseFilterId] = useState("all");
    const [studentQuery, setStudentQuery] = useState("");

    // 1) Build a flat "inbox" list from nested course data
    const allItems = useMemo(() => {
        const list = [];

        for (const course of courses || []) {
            for (const lesson of course.lessons || []) {
                for (const mod of lesson.modules || []) {
                    const assignment = mod.assignment;
                    if (!assignment) continue;

                    const submissions = assignment.submissions || [];
                    for (const s of submissions) {
                        list.push({
                            submission: s,
                            course,
                            lesson,
                            module: mod,
                        });
                    }
                }
            }
        }

        // Sort newest first (pending work feels like an inbox)
        list.sort((a, b) => (b.submission.submittedAt || 0) - (a.submission.submittedAt || 0));
        return list;
    }, [courses]);

    // 2) Apply filters
    const filteredItems = useMemo(() => {
        const q = studentQuery.trim().toLowerCase();

        return allItems.filter(({ submission, course }) => {
            const statusOk =
                statusFilter === "all" ? true : (submission.status || "pending") === statusFilter;
            
            const courseOk = courseFilterId === "all" ? true : course.id === courseFilterId;

            const studentText = String(submission.student || "").toLowerCase();
            const studentOk = q ? studentText.includes(q) : true;

            return statusOk && courseOk && studentOk;
        });
    }, [allItems, statusFilter, courseFilterId, studentQuery]);

    // 3) One safe updater function so we NEVER "miss a level" in the nested structure
    function updateSubmission(courseId, lessonId, moduleId, submissionId, patch) {
        setCourses((prev) =>
            (prev || []).map((c) => {
                if (c.id !== courseId) return c;

                return {
                    ...c,
                    lessons: (c.lessons || []).map((l) => {
                        if (l.id !== lessonId) return l;

                        return {
                            ...l,
                            modules: (l.modules || []).map((m) => {
                                if (m.id !== moduleId) return m;

                                const a = m.assignment;
                                if (!a) return m;

                                return {
                                    ...m,
                                    assignment: {
                                        ...a,
                                        submissions: (a.submissions || []).map((sub) =>
                                            sub.id === submissionId ? { ...sub, ...patch } : sub
                                        ),
                                    },
                                };
                            }),
                        };
                    }),
                };
            })
        );
    }

    // 4) Empty states (based on ALL submissions, not just filtered)
    if (allItems.length === 0) {
        return (
            <div className="section-container">
                <h2 style={{ marginTop: 0 }}>Student Submissions</h2>
                <p>No submissions yet.</p>
            </div>
        );
    }

    return (
        <div className="section-container">
            <h2 style={{ marginTop: 0 }}>Student Submissions</h2>

            {/* FILTER BAR */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                <select
                    className="input-wide"
                    style={{ maxWidth: 240 }}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="pending">Pending</option>
                    <option value="revision">Needs Revision</option>
                    <option value="approved">Approved</option>
                    <option value="all">All</option>
                </select>

                <select
                    className="input-wide"
                    style={{ maxWidth: 320 }}
                    value={courseFilterId}
                    onChange={(e) => setCourseFilterId(e.target.value)}
                >
                    <option value="all">All Courses</option>
                    {(courses || []).map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.title}
                        </option>
                    ))}
                </select>

                <input
                    className="input-wide"
                    style={{ maxWidth: 320 }}
                    placeholder="Search by student (id/email/username)..."
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                />

                <button
                    className="btn-secondary"
                    onClick={() => {
                        setStatusFilter("pending");
                        setCourseFilterId("all");
                        setStudentQuery("");
                    }}
                >
                    Reset
                </button>
            </div>

            {/* RESULT COUNT */}
            <p style={{ marginTop: 0 }}>
                Showing <b>{filteredItems.length}</b> of <b>{allItems.length}</b>
            </p>

            {/* LIST */}
            {filteredItems.length === 0 ? (
                <p>No submissions match your filters.</p>
            ) : (
                filteredItems.map(({ submission, course, lesson, module }) => {
                    const status = submission.status || "pending";

                    const badgeText =
                        status === "approved"
                            ? "Approved"
                            : status === "revision"
                                ? "Needs Revision"
                                : "Pending";
                        
                    return (
                        <div key={submission.id} className="course-box" style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                <div>
                                    <div style={{ fontWeight: 900 }}>
                                        Student: <span style={{ fontWeight: 700 }}>{submission.student}</span>
                                    </div>
                                    <div style={{ marginTop: 6 }}>
                                        <b>Course:</b> {course.title}
                                        <br />
                                        <b>Lesson:</b> {lesson.title}
                                        <br />
                                        <b>Module:</b> {module.title}
                                    </div>
                                </div>

                                <div
                                    style={{
                                        alignSelf: "flex-start",
                                        padding: "6px 10px",
                                        borderRadius: 999,
                                        border: "1px solid #334155",
                                        fontWeight: 900,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {badgeText}
                                </div>
                            </div>

                            {/* LINK */}
                            <div style={{ marginTop: 10 }}>
                                <a href={submission.url} target="_blank" rel="noreferrer">
                                    View Github Submission
                                </a>
                            </div>

                            {/* FEEDBACK */}
                            <div style={{ marginTop: 10 }}>
                                <textarea
                                    className="input-wide"
                                    style={{ minHeight: 90 }}
                                    placeholder="Mentor feedback (saved instantly)..."
                                    value={submission.feedbackText || ""}
                                    onChange={(e) => {
                                        updateSubmission(
                                            course.id,
                                            lesson.id,
                                            module.id,
                                            submission.id,
                                            { feedbackText: e.target.value }
                                        );
                                    }}
                                />
                            </div>

                            {/* ACTIONS */}
                            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <button
                                    className="btn"
                                    onClick={() =>
                                        updateSubmission(course.id, lesson.id, module.id, submission.id, {
                                            status: "approved",
                                            reviewedAt: Date.now(),
                                        })
                                    }
                                >
                                    Approve
                                </button>

                                <button
                                    className="btn-secondary"
                                    onClick={() =>
                                        updateSubmission(course.id, lesson.id, module.id, submission.id, {
                                            status: "revision",
                                            reviewedAt: Date.now(),
                                        })
                                    }
                                >
                                    Needs Revision
                                </button>

                                <button
                                    className="btn-secondary"
                                    onClick={() =>
                                        updateSubmission(course.id, lesson.id, module.id, submission.id, {
                                            status: "pending",
                                            reviewedAt: Date.now(),
                                        })
                                    }
                                >
                                    Mark Pending
                                </button>
                            </div>

                            {/* META */}
                            <div style={{ marginTop: 0, opacity: 0.85, fontSize: 12 }}>
                                Submitted:{" "}
                                {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : "-"}
                                {" • "}
                                {submission.reviewedAt ? new Date(submission.reviewedAt).toLocaleString() : "-"}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}