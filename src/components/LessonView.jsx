import MarkdownPreview from "./MarkdownPreview";
import "../styles.css";

/* HELPER COMPONENT FOR VIDEO FEEDBACK */
function FeedbackPlayer({ submission }) {
  // Only render if there is actual feedback data (text or video)
  if (!submission || (!submission.feedbackText && !submission.feedbackVideoUrl)) return null;

  const getEmbedUrl = (url) => {
    if (!url) return null;
    // Standard YouTube regex to find video ID and convert to embed format
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  const embedUrl = getEmbedUrl(submission.feedbackVideoUrl);

  return (
    <div className="feedback-box" style={{
      marginTop: "20px",
      borderLeft: "4px solid var(--pf-fire)",
      background: "rgba(245, 158, 11, 0.03)",
      padding: "15px",
      borderRadius: "8px"
    }}>
      <strong style={{ color: "var(--(pf-fire)", display: "block", marginBottom: "8px" }}>
        📋 Mentor Feedback & Revision Notes
      </strong>

      {submission.feedbackText && (
        <p style={{ whiteSpace: "pre-wrap", marginBottom: embedUrl ? "15px" : "0" }}>
          {submission.feedbackText}
        </p>
      )}

      {embedUrl && (
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "8px", marginTop: "10px" }}>
          <iframe
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
            src={embedUrl}
            title="Video Feedback"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

export default function LessonView({
  lesson,
  selectedCourseId,
  currentUser,
  isStudent,
  isStaff,
  previewMode,
  setCourses,
  canAccessModuleByPrereq,
  newId,
}) {
  if (!lesson) return null;
  void isStaff;

  const studentKey =
    currentUser?.studentId ??
    currentUser?.email ??
    currentUser?.username;

  function matchesStudent(submissionStudent, user) {
    return (
      submissionStudent === user?.studentId ||
      submissionStudent === user?.email ||
      submissionStudent === user?.username
    );
  }

  return (
    <div className="lesson-box">
      <h2 className="lesson-title">{lesson.title}</h2>

      {(lesson.modules || []).map((mod, index) => {
        const unlocked = previewMode
          ? true
          : canAccessModuleByPrereq(lesson, index, currentUser);

        const assignment = mod.assignment || null;
        const submissions = assignment?.submissions || [];

        const mySubmission = submissions.find((s) =>
          matchesStudent(s.student, currentUser)
        );

        const requiresSubmission = !!assignment?.repoUrl;

        // Content module = no repo required
        const isContentModule = !requiresSubmission;

        const isCompleted = isContentModule
          ? (mod.completions || []).some((c) => c?.student === studentKey)
          : mySubmission?.status === "approved";

        const embedVideoUrl = assignment?.instructionsVideoUrl?.includes("watch?v=")
          ? assignment.instructionsVideoUrl.replace("watch?v=", "embed/")
          : assignment?.instructionsVideoUrl;

        let statusLabel = "Not Submitted";
        let statusColor = "badge-pending";

        //Content module completion
        if (isContentModule && isCompleted) {
          statusLabel = "Completed";
          statusColor = "badge-approved";
        }

        if (requiresSubmission && mySubmission) {
          if (mySubmission.status === "pending") {
            statusLabel = "Submitted (Pending Review)";
            statusColor = "badge-pending";
          } else if (mySubmission.status === "revision") {
            statusLabel = "Needs Revision";
            statusColor = "badge-revision";
          } else if (mySubmission.status === "approved") {
            statusLabel = "Approved";
            statusColor = "badge-approved";
          }
        }

        return (
          <div key={mod.id} className={`module-box ${unlocked ? "" : "locked"}`}>
            <h4 className="module-title">
              {mod.title} {!unlocked && "🔒"}
            </h4>

            {/* STUDENT STATUS */}
            {isStudent && (
              <div className={`status-badge ${statusColor}`}>{statusLabel}</div>
            )}

            {/* MODULE CONTENT */}
            {unlocked ? (
              <MarkdownPreview markdown={mod.content || ""} />
            ) : (
              <p className="locked-text">
                Complete the previous module’s assignment to unlock.
              </p>
            )}

            {/* CONTENT-ONLY MODULE COMPLETION */}
            {isStudent && unlocked && isContentModule && (
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn btn-inline"
                  type="button"
                  disabled={!studentKey || isCompleted}
                  onClick={() => {
                    if (!studentKey) {
                      alert("Missing student identifier (studentId/email/username).");
                      return;
                    }

                    setCourses((prev) =>
                      (prev || []).map((course) =>
                        course.id !== selectedCourseId
                          ? course
                          : {
                            ...course,
                            lessons: (course.lessons || []).map((l) =>
                              l.id !== lesson.id
                                ? l
                                : {
                                  ...l,
                                  modules: (l.modules || []).map((m) =>
                                    m.id !== mod.id
                                      ? m
                                      : {
                                        ...m,
                                        completions: [
                                          ...(m.completions || []).filter(
                                            (c) => c?.student !== studentKey
                                          ),
                                          { student: studentKey, completedAt: Date.now() },
                                        ],
                                      }
                                  ),
                                }
                            ),
                          }
                      )
                    );
                  }}
                >
                  {isCompleted ? "Completed ✅" : "Mark Complete"}
                </button>
              </div>
            )}

            {/* ASSIGNMENT (VISIBLE TO STUDENTS + STAFF) */}
            {unlocked && assignment && (
              <div className="assignment-box">
                <h5 className="assignment-title">Assignment</h5>

                {/* Starter Repo */}
                {assignment.repoUrl && (
                  <p>
                    <strong>Starter Repository:</strong>{" "}
                    <a href={assignment.repoUrl} target="_blank" rel="noreferrer">
                      {assignment.repoUrl}
                    </a>
                  </p>
                )}

                {/* Instructions */}
                {assignment.instructionsText && (
                  <MarkdownPreview markdown={assignment.instructionsText} />
                )}

                {/* Instructional Video */}
                {embedVideoUrl && (
                  <iframe
                    title="assignment-video"
                    src={embedVideoUrl}
                    className="assignment-video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>
            )}

            {/* STUDENT SUBMISSION */}
            {isStudent && unlocked && requiresSubmission && assignment && (
              <div className="submission-box">
                <input
                  className="input-wide"
                  placeholder={mySubmission?.status === "revision" ? "Paste revision GitHub URL and press Enter" : "Paste your GitHub repo URL and press Enter"}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;

                    const url = e.target.value.trim();
                    if (!url || !studentKey) return;

                    if (!studentKey) {
                      alert("Missing student identifier (studentId/email/username).");
                      return;
                    }

                    const submission = {
                      id: mySubmission?.id || newId(),
                      student: studentKey,
                      url,
                      status: "pending",
                      feedbackText: mySubmission?.feedbackText || "",
                      feedbackVideoUrl: mySubmission?.feedbackVideoUrl || "",
                      submittedAt: Date.now(),
                    };

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
                                                ...assignment,
                                                submissions: [
                                                  ...submissions.filter(
                                                    (s) => !matchesStudent(s.student, currentUser)
                                                  ),
                                                  submission,
                                                ],
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

                    e.target.value = "";
                  }}
                />
              </div>
            )}

            {isStudent && (
              <FeedbackPlayer submission={mySubmission} />
            )}
          </div>
        );
      })}
    </div>
  );
}
