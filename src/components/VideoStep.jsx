export default function VideoStep({ embedUrl, isWatched, onToggleWatched }) {
  return (
    <>
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px', marginBottom: '16px' }}>
        <iframe
          src={embedUrl}
          title='Lesson video'
          allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
          allowFullScreen
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
        />
      </div>
      <button
        onClick={onToggleWatched}
        style={{
          background: isWatched ? '#10b981' : '#374151',
          color: '#fff',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        {isWatched ? '✓ Video Watched (Completed)' : 'Mark Video as Watched'}
      </button>
    </>
  );
}
