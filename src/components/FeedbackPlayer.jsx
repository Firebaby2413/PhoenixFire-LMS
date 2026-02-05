export default function FeedbackPlayer({ submission }) {
    if (!submission || (!submission.feedbackText && !submission.feedbackVideoUrl)) return null;

    const embedVideoUrl = submission.feedbackVideoUrl?.includes("watch?v=")
        ? submission.feedbackVideoUrl.replace("watch?v=", "embed/")
        : submission.feedbackVideoUrl;
    
    return (
        <div className="feedback-box" style={{ marginTop: "20px", borderLeft: "4px solid var(--pf-fire)" }}>
            <h4 style={{ color: "var(--pf-fire)", marginTop: 0 }}>Mentor Feedback</h4>

            {submission.feedbackText && (
                <p style={{ whiteSpace: "pre-wrap" }}>{submission.feedbackText}</p>
            )}

            {embedVideoUrl && (
                <div style={{ marginTop: "16px" }}>
                    <iframe
                        title="mentor-video-feedback"
                        src={embedVideoUrl}
                        style={{ width: "100%", aspectRatio: "16/9", borderRadius: "8px", border: "none" }}
                        allowFullScreen
                    />
                </div>
            )}
        </div>
    );
}

