export default function LessonHeader({
  courseTitle,
  lessonTitle,
  stepNumber,
  stepCount,
  completedCount,
  onBack
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={onBack} style={{ background: '#1f2937', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
          ← Back to Courses
        </button>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{courseTitle}</h2>
        <h3 style={{ fontSize: '20px', color: '#f97316', margin: 0 }}>{lessonTitle}</h3>
        {stepCount > 0 && (
          <p style={{ margin: '8px 0 0 0', color: '#9ca3af', fontSize: '14px' }}>
            Portion {stepNumber} of {stepCount}
            {' · '}
            {completedCount} completed
          </p>
        )}
      </div>
    </>
  );
}