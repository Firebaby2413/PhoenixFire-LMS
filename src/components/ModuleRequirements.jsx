export default function ModuleRequirements({ lessonId, mod, updateAssignmentField }) {
  return (
    <div className='card'>
      <h5 className='assignment-title'>Module Requirements</h5>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>
          Module Type:
          <span style={{ marginLeft: 8, opacity: 0.9 }}>
            {mod.assignment?.repoUrl
              ? 'Repo Submission (mentor approval required)'
              : 'Content / Complete-only (no repo)'}
          </span>
        </div>

        <small className='help-text'>
          If you add a starter Repo URL below, students will submit a
          GitHub link and it will require mentor approval. If you
          leave it blank, students will see a "Mark Complete" button
          instead.
        </small>
      </div>

      <input
        placeholder='Starter Github repository URL (students clone this)'
        value={mod.assignment?.repoUrl || mod.repo_url || ''}
        onChange={(e) =>
          updateAssignmentField(
            lessonId,
            mod.id,
            'repoUrl',
            e.target.value
          )
        }
        style={{ width: '100%', marginBottom: 8 }}
      />

      <button
        type='button'
        className='btn-secondary btn-inline'
        style={{ marginBottom: 10 }}
        onClick={() =>
          updateAssignmentField(lessonId, mod.id, 'repoUrl', '')
        }
      >
        Clear Repo Requirement (Content Module)
      </button>

      <textarea
        placeholder='Assignment instructions (Markdown supported)'
        value={mod.assignment?.instructionsText || mod.assignment_prompt || ''}
        onChange={(e) =>
          updateAssignmentField(
            lessonId,
            mod.id,
            'instructionsText',
            e.target.value
          )
        }
        style={{ width: '100%', minHeight: 80, marginBottom: 8 }}
      />

      <input
        placeholder='Instruction Video URL (optional)'
        value={mod.assignment?.instructionsVideoUrl || mod.video_url || ''}
        onChange={(e) =>
          updateAssignmentField(
            lessonId,
            mod.id,
            'instructionsVideoUrl',
            e.target.value
          )
        }
        style={{ width: '100%' }}
      />
    </div>
  );
}