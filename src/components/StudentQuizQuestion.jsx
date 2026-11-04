export default function StudentQuizQuestion({ question, answer, onChange, groupName }) {
  const prompt = question.question || question.text || '';
  const type = String(question.type || '').toLowerCase();
  const options = Array.isArray(question.options)
    ? question.options.filter((opt) => String(opt).trim() !== '')
    : [];
  const showChoices =
    type === 'multiple_choice' || type === 'true_false' || options.length > 0;
  return (
    <div style={{ marginBottom: '12px' }}>
      <p style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>{prompt}</p>

      {showChoices ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {options.map((opt, optIdx) => {
            const checked = answer === opt;
            return (
              <label
                key={`${groupName}_${optIdx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: checked ? 'rgba(249, 115, 22, 0.15)' : '#0f172a',
                  border: `1px solid ${checked ? '#f97316' : '#475569'}`,
                  borderRadius: '6px',
                  padding: '8px 12px',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name={groupName}
                  value={opt}
                  checked={checked}
                  onChange={() => onChange(opt)}
                />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <input
          type="text"
          placeholder="Type your answer..."
          value={answer || ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%', background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#fff', padding: '8px 12px' }}
        />
      )}
    </div>
  );
}