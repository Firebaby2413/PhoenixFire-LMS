export default function FlashcardEditor({
  lesson,
  addFlashcard,
  updateFlashcard,
  deleteFlashcard
}) {
  return (
    <div className='card' style={{ marginTop: '1rem', borderColor: '#a855f7' }}>
      <h5 style={{ margin: '0 0 8px 0', color: '#a855f7' }}>Lesson Flashcards (study tool)</h5>
      <p className='help-text' style={{ marginBottom: 12 }}>
        Optional practice. Flashcards do not count toward progress or passing.
      </p>
      {(lesson.flashcards || []).map((card) => (
        <div key={card.id} style={{ marginBottom: 10 }}>
          <input
            className='input-wide'
            placeholder='Front (prompt)'
            value={card.front || ''}
            onChange={(e) =>
              updateFlashcard(lesson.id, card.id, 'front', e.target.value)
            }
          />
          <input
            className='input-wide'
            placeholder='Back (answer)'
            value={card.back || ''}
            onChange={(e) => updateFlashcard(lesson.id, card.id, 'back', e.target.value)}
          />
          <button
            type='button'
            className='btn-outline btn-danger'
            onClick={() => deleteFlashcard(lesson.id, card.id)}
          >
            Delete Card
          </button>
        </div>
      ))}
      <button type='button' className='btn-secondary' onClick={() => addFlashcard(lesson.id)}>
        + Add Flashcard
      </button>
    </div>
  );
}