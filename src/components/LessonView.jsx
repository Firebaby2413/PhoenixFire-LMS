import MArkdownPreveiw from "./MarkdownPreview";

export default function LessonView({
  lesson,
  selectedCourseId,
  currentUser,
  isStudent,
  isStaff,
  setCourses,
  canAccessModuleByPrereq,
  newId
}) {
  if (!lesson) return null;

  function upsertSubmission(submissions, submission) {
    const list = Array.isArray(submissions) ? submissions : [];
    const idx = list.findIndex((s) => s.student === submission.student);
    if (idx === -1) return [...list, submission];
    return list.map((s, i) => (i === idx ? { ...s, ...submission} : s));
  }

  return (
    <div>
      <h2 style={{ marginTop: 0, color: "#f472b6" }}>{lesson.title}</h2>

      {(lesson.modules || []).map((mod, index) => {
        const unlocked = canAccessModuleByPrereq(
          lesson,
          index,
          currentUser.username
        );

        const assignment = mod.assignment || null;
        const submissions = assignment?.submissions || [];

        const mySubmission = submissions.find(
          (s) => s.student === currentUser.username
        );

        let statusLabel = "Not Submitted";
        let statusColor = "#6b7280";

        if (mySubmission) {
          if (mySubmission.status === "pending") {
            statusLabel = "Submitted (Pending Review)";
            statusColor: "#a855f7";
          } else if (mySubmission.status === "revision") {
            statusLabel = "Needs Revision";
            statusColor = "#f59e0b";
          } else if (mySubmission.status === "approved") {
            statusLabel = "Approved";
            statusColor = "22c55e";
          }
        }

        return (
          <div
            key={mod.id}
            style={{
              background: "#111827",
              color: "#e5e7eb",
              border: "1px solid #374151",
              padding: 14,
              marginBottom: 14, 
              borderRadius: 14,
              opacity: unlocked ? 1 : 0.55,
            }}
          >
            <h4 style={{ marginTop: 0, color: "#60a5fa" }}>
              {mod.title} {!unlocked ? " 🔒" : ""}
            </h4>

            {/* Student status badge */}
            {isStudent && (
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                  background: statusColor,
                  color: "#0b1220",
                  marginBottom: 10,
                }}
              >
                {statusLabel}
              </div>
            )}

            {/* Module content */}
            {unlocked ? (
              <MarkdownPreview markdown={mod.content || ""} />
            ) : (
              <p style={{ fontStyle: "italic", color: "#cbd5e1" }}>
                Complete the previous modules's assignment (approved) to unlock this content.
              </p>
            )}

            {/* Assignment instructions */}
            {unlocked && assignment?.instructionsText && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 900, color: "#f97316" }}>
                  Assignment
                </div>
                <MarkdownPreview markdown={assignment.instructionsText} />
              </div>
            )}

            {unlocked && assignment?.instructionsVideoUrl && (
              <iframe
                title="assignment-video"
                src={assignment.instructionsVideoUrl}
                style={{
                  width: "100%",
                  height: 340,
                  marginTop: 10,
                  borderRadius: 12,
                  border: "1px solid #334155",
                }}
                allowFullScreen
              />
            )}

            {/* Student submission */}
            {isStudent && unlocked && assinment && (
              <div style={{ marginTop: 12}}>
                <input
                  placeholder="Paste Github repo URL and press Enter"
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #334155",
                    background: "#0b1220",
                    color: "#e5e7eb",
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const url = e.target.value.trim();
                    if (!url) return;

                    const submission = {
                      id: mySubmission?.id || newId(),
                      student: currentUser.username,
                      url,
                      status: mySubmission?.status || "pending",
                      feedbackText: mySubmission?.feedbackText || "",
                      feedbackVideoUrl: mySubmission?.feedbackVideoUrl || "",
                      submittedAt: mySubmission?.submittedAt || Date.now(),
                      updatedAt: Date.now(),
                    };

                    setCourses((prev) =>
                      prev.map((course) =>
                        course.id === selectedCourseId
                          ? {
                            ...course,
                            lessons: (course.lessons || []).map(l) =>
                              l.id === lesson.id
                                ? {
                                  ...l,
                                  modules: (l.modules || []).map((m) =>
                                    m.id === mod.id
                                      ? {
                                        ...m,
                                        assignment: {
                                          ...(m.assignment || {}),
                                          submissions: upsertSubmission(
                                            m.assignment?.submissions,
                                            submission
                                          ),
                                        },
                                      }
                                      : m
                                  ),
                                }
                                : l
                          },
                        }
                        : course
                      )
                    );
                    e.target.value = "";
                  }}
                />
                <small style={{ color: "#cbd5e1" }}>
                  Press Enter to submit. Progress unlocks only after mentor approval.
                </small>
              </div>
            )}

            {/* Student Feedback surfaced prominently */}
            {isStudent && mySubmission?.feedbackText && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid #335155",
                  background: "#0b1220",
                }}
              >
                <div style={{ fontWeight: 900, color: "#f59e0b" }}>
                  Mentor Feedback
                </div>
                <p style={{ marginBottom: 0 }}>{mySubmission.feedbackText}</p>
              </div>
            )}
            
            {isStudent && mySubmission?.feedbackVideoUrl && (
              <iframe
                title="feedback-video"
                src={mySubmission.feedbackVideoUrl}
                style={{
                  width: "100%",
                  height: 300,
                  marginTop: 10,
                  borderRadius: 12,
                  border: "1px solid #334155"
                }}
                allowFullScreen
              />
            )}

            {/* Mentor/Admin review UI */}
            {isStaff && assignemnt && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 900, color: "#a855f7"}}>
                  Mentor Review
                </div>

                {submissions.length === 0 ? (
                  <p style={{ color: "#cbd5e1" }}>No submissions yet.</p>
                ) : (
                  submissions.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        marginTop: 10,
                        padding: 12,
                        borderRadius: 14,
                        border: "1px solid #334155",
                        background: "#0b1220",
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, flexWrap: "flex" }}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#60a5fa", fontWeight: 900 }}
                        >
                          {s.student}
                        </a>

                        <span stlye={{ color: "#cbd5e1"}}>
                          Status:{" "}
                          <b
                            style={{
                              color:
                                s.status === "approved"
                                ? "#22c55e",
                                : s.status === "revision"
                                ? "#f59e0b",
                                : "#a855f7"
                            }}
                          >
                            {s.status || "pending"}
                          </b>
                        </span>
                      </div>

                      <textarea
                        placeholder="Feedback (text)"
                        value={s.feedbackText || ""}
                        style={{
                          width: 100%,
                          minHeight: 70,
                          marginTop: 10,
                          padding: 10,
                          borderRadius: 10,
                          border: "1px solid #334155",
                          background: "111827",
                          color: "#e5e7eb"
                        }}
                        onChange={(e) => {
                          const feedbackText = e.target.value;

                          setCourses((prev) =>
                            prev.map((course) =>
                              course.id === selectedCourseId
                                ? {
                                  ...course,
                                  lessons: course.lessons.map((l) =>
                                    l.id === lesson.id
                                      ? {
                                        ...l,
                                        modules: l.modules.map((m) =>
                                          m.id === mod.id
                                            ? {
                                              ...m,
                                              assignment: {
                                                ...(m.assignment || {}),
                                                submissions: (m.assignment?.submissions || []).map((sub) =>
                                                  sub.id === s.id
                                                    ? { ...sub, feedbackText }
                                                    : sub
                                                ),
                                              },
                                            }
                                            : m
                                        ),
                                      }
                                      : l
                                  ),
                                }
                                : course
                            )
                          );
                        }}
                      />

                      <input
                        placeholder="Feedback video URL (optional)"
                        value={s.feedbackVideoUrl || ""}
                        style={{
                          width: "100%",
                          marginTop: 8,
                          padding: 10,
                          borderRadius: 10,
                          border: "1px solid #334155",
                          background: "#111827",
                          color: "#e5e7eb",
                        }}
                        onChange={(e) => {
                          const feedbackVideoUrl = e.target.value;

                          setCourses((prev) =>
                            prev.map((course) =>
                              course.id === selectedCourseId
                                ? {
                                  ...course,
                                  lessons: course.lessons.map((l) => 
                                    l.id === lesson.id
                                      ? {
                                        ...l,
                                        modules: l.modules.map((m) =>
                                          m.id === mod.id
                                            ? {
                                              ...m,
                                              assignment: {
                                                ...(m.assignment || {}),
                                                submissions: (m.assignment?.submissions || []),map((sub) =>
                                                  sub.id === s.id
                                                    ? {...sub, feedbackVideoUrl }
                                                    : sub
                                                ),
                                              },
                                            }
                                            : m
                                          ),
                                      }
                                      : l
                                    ),
                                  }
                                  : course
                            )
                          );
                        }}
                      />

                      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                        <button
                          onClick={() => {
                            setCourses((prev) =>
                              prev.map((course) =>
                                course.id === selectedCourseId
                                  ? {
                                      ...course,
                                      lessons: course.lessons.map((l) =>
                                        l.id === lesson.id
                                          ? {
                                              ...l,
                                              modules: l.modules.map((m) =>
                                                m.id === mod.id
                                                  ? {
                                                      ...m,
                                                      assignment: {
                                                        ...(m.assignment || {}),
                                                        submissions: (m.assignment?.submissions || []).map((sub) =>
                                                          sub.id === s.id
                                                            ? { ...sub, status: "approved", reviewedAt: Date.now() }
                                                            : sub
                                                        ),
                                                      },
                                                    }
                                                  : m
                                              ),
                                            }
                                          : l
                                      ),
                                    }
                                  : course
                              )
                            );
                          }}
                          style={{
                            background: "#22c55e",
                            color: "#0b1220",
                            border: "none",
                            padding: "8px 12px",
                            borderRadius: 10,
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          Approve
                        </button>

                        <button
                          onClick={() => {
                            setCourses((prev) =>
                              prev.map((course) =>
                                course.id === selectedCourseId
                                  ? {
                                      ...course,
                                      lessons: course.lessons.map((l) =>
                                        l.id === lesson.id
                                          ? {
                                              ...l,
                                              modules: l.modules.map((m) =>
                                                m.id === mod.id
                                                  ? {
                                                      ...m,
                                                      assignment: {
                                                        ...(m.assignment || {}),
                                                        submissions: (m.assignment?.submissions || []).map((sub) =>
                                                          sub.id === s.id
                                                            ? { ...sub, status: "revision", reviewedAt: Date.now() }
                                                            : sub
                                                        ),
                                                      },
                                                    }
                                                  : m
                                              ),
                                            }
                                          : l
                                      ),
                                    }
                                  : course
                              )
                            );
                          }}
                          style={{
                            background: "#f59e0b",
                            color: "#0b1220",
                            border: "none",
                            padding: "8px 12px",
                            borderRadius: 10,
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          Needs Revision
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}




                  ))
                )}
            )}
        )
      })}
    </div>
  )
}