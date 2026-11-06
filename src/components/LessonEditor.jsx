import FlashcardEditor from './FlashcardEditor';
import ModuleEditor from './ModuleEditor';

export default function LessonEditor({
  lesson,
  updateLessonField,
  deleteLesson,
  addFlashcard,
  updateFlashcard,
  deleteFlashcard,
  addModule,
  updateModule,
  deleteModule,
  updateAssignmentField,
  addQuizQuestion,
  updateQuizQuestion,
  updateQuizOption,
  deleteQuizQuestion
}) {
  return (
    <div className='lesson-box'>
      <input
        className='input-wide'
        value={lesson.title}
        onChange={(e) =>
          updateLessonField(lesson.id, 'title', e.target.value)
        }
      />

      <textarea
        className='input-wide'
        value={lesson.description || ''}
        onChange={(e) =>
          updateLessonField(lesson.id, 'description', e.target.value)
        }
        placeholder='Lesson description (optional)'
      />

      <div className='course-actions'>
        <button
          type='button'
          onClick={() => deleteLesson(lesson.id)}
          className='btn-outline btn-danger'
        >
          Delete Lesson
        </button>
      </div>

      <FlashcardEditor
        lesson={lesson}
        addFlashcard={addFlashcard}
        updateFlashcard={updateFlashcard}
        deleteFlashcard={deleteFlashcard}
      />

      <h4 style={{ marginTop: 14, color: '#a855f7' }}>Modules</h4>

      {(lesson.modules || []).length === 0 && <p>No modules yet.</p>}

      {(lesson.modules || []).map((mod) => (
        <ModuleEditor
          key={mod.id}
          lessonId={lesson.id}
          mod={mod}
          updateModule={updateModule}
          deleteModule={deleteModule}
          updateAssignmentField={updateAssignmentField}
          addQuizQuestion={addQuizQuestion}
          updateQuizQuestion={updateQuizQuestion}
          updateQuizOption={updateQuizOption}
          deleteQuizQuestion={deleteQuizQuestion}
        />
      ))}

      <button
        type='button'
        onClick={() => addModule(lesson.id)}
        style={{
          background: '#22c55e',
          color: '#0b1220',
          border: 'none',
          padding: '8px 12px',
          borderRadius: 10,
          fontWeight: 900,
          cursor: 'pointer'
        }}
      >
        Add Module
      </button>
    </div>
  );
}