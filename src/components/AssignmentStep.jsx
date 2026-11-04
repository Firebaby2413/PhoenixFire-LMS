export default function AssignmentStep({
  embedUrl,
  repoUrl,
  prompt,
  linkValue,
  hasSubmission,
  passed,
  needsRevision,
  onLinkChange,
  onSubmit
}) {
  return (
    <>
      {embedUrl && (
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px', marginBottom: '16px' }}>
          <iframe
            src={embedUrl}
            title='Assignment instruction video'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
            allowFullScreen
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>
      )}
      {repoUrl && (
        <div style={{ background: '#1e293b', border: '1px solid #475569', padding: '14px 18px', borderRadius: '8px', marginBottom: '16px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
            Starter Repository (clone this):
          </span>
          <a href={repoUrl} target='_blank' rel='noopener noreferrer' style={{ color: '#38bdf8', wordBreak: 'break-all' }}>
            {repoUrl}
          </a>
        </div>
      )}
      {prompt && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <h5 style={{ color: '#f97316', margin: '0 0 8px 0' }}>Instructions & Prompt</h5>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{prompt}</div>
        </div>
      )}
      <div style={{ background: '#1e293b', padding: '18px', borderRadius: '8px', border: '1px solid #334155' }}>
        <h5 style={{ margin: '0 0 10px 0', color: '#f97316' }}>Assignment Submission</h5>
        <input
          type="text"
          placeholder="Paste your Github repo link here..."
          value={linkValue}
          onChange={(e) => onLinkChange(e.target.value)}
          style={{
            width: '100%',
            background: '#0f172a',
            border: '1px solid #475569',
            borderRadius: '6px',
            color: '#fff',
            padding: '10px 14px',
            marginBottom: '10px'
          }}
        />
        <button
          onClick={onSubmit}
          style={{
            background: 'linear-gradient(to right, #f97316, #ec4899)',
            border: 'none',
            color: '#fff',
            fontWeight: 'bold',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {hasSubmission ? 'Resubmit' : 'Submit Assignment'}
        </button>
        {hasSubmission && (
          <p style={{
            margin: '12px 0 0 0',
            fontSize: '13px',
            color: passed ? '#34d399' : needsRevision ? '#f87171' : '#fbbf24'
          }}>
            {passed
              ? 'Passed - you can finish this lesson.'
              : needsRevision
                ? 'Needs revision. Update your repo and submit.'
                : 'Submitted. Waiting for mentor/admin feedback before you can finish.'}
          </p>
        )}
      </div>
    </>
  );
}
