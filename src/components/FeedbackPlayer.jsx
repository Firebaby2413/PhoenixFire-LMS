import React from 'react';

/**
 * Robustly converts YouTube links (watch, share, embed, shorts) into valid iframe embed URLs.
 */
function getYouTubeEmbedUrl(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11
        ? `https://www.youtube.com/embed/${match[2]}`
        : url; // Fallback to raw URL if not standard YouTube match
}

export default function FeedbackPlayer({ submission }) {
    if (
        !submission ||
        (!submission.feedbackText && !submission.feedbackVideoUrl)
    ) {
        return null;
    }

    const embedVideoUrl = getYouTubeEmbedUrl(submission.feedbackVideoUrl);

    return (
        <div
            className='feedback-box'
            style={{
                marginTop: '20px',
                borderLeft: '4px solid var(--pf-fire)',
                padding: '16px',
                background: 'rgba(245, 158, 11, 0.03)',
                borderRadius: '8px'
            }}
        >
        <h4 style={{ color: 'var(--pf-fire)', marginTop: 0, marginBottom: '8px' }}>
            Mentor Feedback
        </h4>

        {submission.feedbackText && (
            <p style={{ whiteSpace: 'pre-wrap', marginBottom: embedVideoUrl ? '16px' : 0 }}>
                {submission.feedbackText}
            </p>
        )}

        {embedVideoUrl && (
                <div style={{ width: '100%', aspectRatio: '16/9' }}>
                    <iframe
                        title='mentor-video-feedback'
                        src={embedVideoUrl}
                        style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '8px',
                            border: 'none'
                        }}
                        allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                        allowFullScreen
                    />
                </div>
            )}
        </div>
    );
}
