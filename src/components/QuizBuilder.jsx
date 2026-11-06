export default function QuizBuilder({
  lessonId,
  mod,
  addQuizQuestion,
  updateQuizQuestion,
  updateQuizOption,
  deleteQuizQuestion
}) {
  return (
    <div className='card' style={{ marginTop: '1rem', borderColor: '#3b82f6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h5 className='assignment-title' style={{ margin: 0, color: '#3b82f6' }}>
          Module Quiz Assessment (Required 90% Passing Grade)
        </h5>
      </div>
      <p className='help-text' style={{ marginBottom: 12 }}>
        Add manual questions to verify student mastery before they advance. Students can retake unlimited times until passing.
      </p>

      {(!mod.quiz || mod.quiz.length === 0) && (
        <p style={{ fontSize: '0.9rem', fontStyle: 'italic', opacity: 0.7 }}>No quiz questions added yet.</p>
      )}

      {(mod.quiz || []).map((q, qIndex) => (
        <div key={q.id} style={{ background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '8px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Question {qIndex + 1} ({q.type === 'multiple_choice' ? 'Multiple Choice' : 'True/False'})</span>
            <button
              type='button'
              className='btn-outline btn-danger'
              style={{ padding: '2px 6px', fontSize: '0.75rem' }}
              onClick={() => deleteQuizQuestion(lessonId, mod.id, q.id)}
            >
              Remove Question
            </button>
          </div>

          <input
            className='input-wide'
            placeholder='Enter question prompt...'
            value={q.question}
            onChange={(e) => updateQuizQuestion(lessonId, mod.id, q.id, 'question', e.target.value)}
            style={{ marginBottom: '8px' }}
          />

          {q.type === 'multiple_choice' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
              <small className='help-text'>Options (Type choices and mark exact correct answer):</small>
              {q.options.map((opt, optIdx) => (
                <div key={optIdx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    className='input-wide'
                    placeholder={`Option ${optIdx + 1}`}
                    value={opt}
                    onChange={(e) => updateQuizOption(lessonId, mod.id, q.id, optIdx, e.target.value)}
                    style={{ margin: 0 }}
                  />
                  <button
                    type='button'
                    style={{
                      background: q.answer === opt && opt !== '' ? '#22c55e' : '#334155',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={() => updateQuizQuestion(lessonId, mod.id, q.id, 'answer', opt)}
                  >
                    {q.answer === opt && opt !== '' ? 'Correct ✓' : 'Set Correct'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginBottom: '8px' }}>
              <label className='help-text'>Correct Answer:</label>
              <select
                className='input-wide'
                value={q.answer}
                onChange={(e) => updateQuizQuestion(lessonId, mod.id, q.id, 'answer', e.target.value)}
              >
                <option value='True'>True</option>
                <option value='False'>False</option>
              </select>
            </div>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          type='button'
          className='btn-secondary btn-inline'
          onClick={() => addQuizQuestion(lessonId, mod.id, 'multiple_choice')}
        >
          + Add Multiple Choice
        </button>
        <button
          type='button'
          className='btn-secondary btn-inline'
          onClick={() => addQuizQuestion(lessonId, mod.id, 'true_false')}
        >
          + Add True/False
        </button>
      </div>
    </div>
  );
}