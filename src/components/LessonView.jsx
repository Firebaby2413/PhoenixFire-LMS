import MarkdownPreview from "./MarkdownPreview";
import "../styles.css";

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

        const embedVideoUrl = assignment?.instructionsVideoUrl?.includes("watch?v=")
          ? assignment.instructionsVideoUrl.replace("watch?v=", "embed/")
          : assignment?.instructionsVideoUrl;

        let statusLabel = "Not Submitted";
        let statusColor = "badge-pending";

        if (mySubmission) {
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
            {isStudent && unlocked && assignment && (
              <div className="submission-box">
                <input
                  className="input-wide"
                  placeholder="Paste your GitHub repo URL and press Enter"
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;

                    const url = e.target.value.trim();
                    if (!url) return;

                    if (!studentKey) {
                      alert("Missing student identifier (studentId/email/username).");
                      return;
                    }

                    const submission = {
                      id: mySubmission?.id || newId(),
                      student: studentKey,
                      url,
                      status: "pending",
                      feedbackText: "",
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
                <small className="help-text">
                  Progress unlocks only after mentor approval.
                </small>
              </div>
            )}

            {/* STUDENT FEEDBACK */}
            {isStudent && mySubmission?.feedbackText && (
              <div className="feedback-box">
                <strong>Mentor Feedback</strong>
                <p>{mySubmission.feedbackText}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
