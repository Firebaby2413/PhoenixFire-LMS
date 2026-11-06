import MarkdownPreview from './MarkdownPreview';
import QuizBuilder from './QuizBuilder';
import ModuleRequirements from './ModuleRequirements';

export default function ModuleEditor({
  lessonId,
  mod,
  updateModule,
  deleteModule,
  updateAssignmentField,
  addQuizQuestion,
  updateQuizQuestion,
  updateQuizOption,
  deleteQuizQuestion
}) {
  return (
    <div className='module-box'>
      <input
        className='input-wide'
        value={mod.title}
        onChange={(e) =>
          updateModule(lessonId, mod.id, 'title', e.target.value)
        }
      />

      <textarea
        className='input-wide'
        value={mod.content}
        onChange={(e) =>
          updateModule(lessonId, mod.id, 'content', e.target.value)
        }
        placeholder='Module content (Markdown supported)'
      />

      <MarkdownPreview markdown={mod.content} />

      <QuizBuilder
        lessonId={lessonId}
        mod={mod}
        addQuizQuestion={addQuizQuestion}
        updateQuizQuestion={updateQuizQuestion}
        updateQuizOption={updateQuizOption}
        deleteQuizQuestion={deleteQuizQuestion}
      />

      <ModuleRequirements
        lessonId={lessonId}
        mod={mod}
        updateAssignmentField={updateAssignmentField}
      />

      <button
        type='button'
        onClick={() => deleteModule(lessonId, mod.id)}
        style={{
          background: '#ef4444',
          color: '#0b1220',
          border: 'none',
          padding: '8px 12px',
          borderRadius: 10,
          fontWeight: 900,
          cursor: 'pointer'
        }}
      >
        Delete Module
      </button>
    </div>
  );
}