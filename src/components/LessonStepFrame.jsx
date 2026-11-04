export default function LessonStepFrame({
  title,
  kind,
  done,
  canGoBack,
  isLast,
  lessonComplete,
  onBack,
  onContinue,
  children
}) {
  return (
    <div
      style={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', padding: '24px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
          {title} - {kind}
        </h4>
        <span style={{
          fontSize: '12px',
          padding: '4px 10px',
          borderRadius: '12px',
          background: done ? 'rgba(16, 185, 129, 0.2)' : 'rgba(249, 115, 22, 0.2)',
          color: done ? '#10b981' : '#fb923c'
        }}
        >
          {done ? 'Completed' : 'In Progress'}
        </span>
      </div>

      {children}

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {canGoBack ? (
          <button
            type='button'
            onClick={onBack}
            style={{
              background: '#1f2937',
              color: '#fff',
              border: '1px solid #374151',
              padding: '10px 20px',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        <button
          type='button'
          disabled={!done}
          onClick={onContinue}
          style={{
            background: done ? '#f97316' : '#374151',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: done ? 'pointer' : 'not-allowed'
          }}
        >
          {isLast
            ? (lessonComplete ? 'View certificate' : 'Finish')
            : 'Continue →'}
        </button>
      </div>
    </div>
  );
}
