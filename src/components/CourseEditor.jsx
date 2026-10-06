import { useEffect, useState } from 'react';
import MarkdownPreview from './MarkdownPreview';
import '../styles.css';

function newId() {
  if (typeof crypto !== 'undefined' && crypto?.randomUUID)
    return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getUserKey(user) {
  return user?.studentId ?? user?.email ?? user?.username ?? null;
}

function getStudentKeys(student) {
  if (!student) return [];
  return [student.studentId, student.email, student.username, student.id].filter(Boolean);
}

function ensureModuleHasAssignment(mod) {
  if (!mod) return mod;

  const repoUrl = mod.repo_url || mod.repoUrl || mod?.assignment?.repoUrl || '';
  const instructionsText = mod.assignment_prompt || mod.instructions || mod?.assignment?.instructionsText || '';
  const instructionsVideoUrl = mod.video_url || mod.videoUrl || mod?.assignment?.instructionsVideoUrl || '';

  // If there is no repoUrl, it's a content-only / reading module
  const assignmentObj = repoUrl ? {
    repoUrl,
    instructionsText,
    instructionsVideoUrl,
    submissions: Array.isArray(mod?.assignment?.submissions) ? mod.assignment.submissions : []
  } : null;

  return {
    ...mod,
    repo_url: repoUrl,
    assignment_prompt: instructionsText,
    video_url: instructionsVideoUrl,
    quiz: Array.isArray(mod?.quiz) ? mod.quiz : [],
    assignment: assignmentObj
  };
}

function deepCloneCourseLessons(course) {
  const lessons = JSON.parse(JSON.stringify(course?.lessons ?? []));
  return lessons.map((lesson) => ({
    ...lesson,
    modules: (lesson.modules || []).map((m) => ensureModuleHasAssignment(m))
  }));
}

export default function CourseEditor({
  course,
  users,
  currentUser,
  onSave,
  onCancel
}) {
  const [mentorKey, setMentorKey] = useState(course?.mentorKey ?? '');
  const [title, setTitle] = useState(course?.title ?? '');
  const [description, setDescription] = useState(course?.description ?? '');
  const [assignedStudentKeys, setAssignedStudentKeys] = useState(
    course?.assignedStudentKeys ?? []
  );
  const [lessons, setLessons] = useState(() => deepCloneCourseLessons(course));

  // Sync editor state when switching active course target
  useEffect(() => {
    if (!course) return;
    setMentorKey(course.mentorKey ?? '');
    setTitle(course.title ?? '');
    setDescription(course.description ?? '');
    setAssignedStudentKeys(course.assignedStudentKeys ?? []);
    setLessons(deepCloneCourseLessons(course));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id]);

  function addLesson() {
    setLessons((prev) => [
      ...prev,
      { id: newId(), title: 'New Lesson', description: '', modules: [] }
    ]);
  }

  function updateLessonField(lessonId, field, value) {
    setLessons((prev) =>
      prev.map((l) => (l.id === lessonId ? { ...l, [field]: value } : l))
    );
  }

  function deleteLesson(lessonId) {
    setLessons((prev) => prev.filter((l) => l.id !== lessonId));
  }

  function addModule(lessonId) {
    setLessons((prev) =>
      prev.map((lesson) =>
        lesson.id === lessonId
          ? {
              ...lesson,
              modules: [
                ...(lesson.modules || []),
                {
                  id: newId(),
                  title: 'New Module',
                  content: '',
                  repo_url: '',
                  assignment_prompt: '',
                  video_url: '',
                  quiz: [],
                  assignment: null // Content-only by default
                }
              ]
            }
          : lesson
      )
    );
  }

  function updateModule(lessonId, moduleId, field, value) {
    setLessons((prev) =>
      prev.map((lesson) =>
        lesson.id === lessonId
          ? {
              ...lesson,
              modules: (lesson.modules || []).map((mod) =>
                mod.id === moduleId ? { ...mod, [field]: value } : mod
              )
            }
          : lesson
      )
    );
  }

  function updateAssignmentField(lessonId, moduleId, field, value) {
    setLessons((prev) =>
      prev.map((l) =>
        l.id === lessonId
          ? {
              ...l,
              modules: (l.modules || []).map((m) => {
                if (m.id !== moduleId) return m;

                let rootField = field;
                if (field === 'repoUrl') rootField = 'repo_url';
                if (field === 'instructionsText') rootField = 'assignment_prompt';
                if (field === 'instructionsVideoUrl') rootField = 'video_url';

                // If clearing repoUrl and all assignment fields become empty, nullify assignment so it's a reading module
                const currentRepo = field === 'repoUrl' ? value : (m.repo_url || m.assignment?.repoUrl || '');
                const currentPrompt = field === 'instructionsText' ? value : (m.assignment_prompt || m.assignment?.instructionsText || '');
                const currentVideo = field === 'instructionsVideoUrl' ? value : (m.video_url || m.assignment?.instructionsVideoUrl || '');

                const hasAssignmentData = Boolean(currentRepo || currentPrompt || currentVideo);

                const updatedAssignment = hasAssignmentData ? {
                  ...(m.assignment || {}),
                  [field]: value
                } : null;

                return {
                  ...m,
                  [rootField]: value,
                  assignment: updatedAssignment
                };
              })
            }
          : l
      )
    );
  }

  function deleteModule(lessonId, moduleId) {
    setLessons((prev) =>
      prev.map((lesson) =>
        lesson.id === lessonId
          ? {
              ...lesson,
              modules: (lesson.modules || []).filter((m) => m.id !== moduleId)
            }
          : lesson
      )
    );
  }

  // Quiz Editor Handlers
  function addQuizQuestion(lessonId, moduleId, type = 'multiple_choice') {
    setLessons((prev) =>
      prev.map((l) =>
        l.id === lessonId
          ? {
              ...l,
              modules: (l.modules || []).map((m) => {
                if (m.id !== moduleId) return m;
                const newQuestion = {
                  id: newId(),
                  type,
                  question: '',
                  options: type === 'multiple_choice' ? ['', '', ''] : ['True', 'False'],
                  answer: type === 'multiple_choice' ? '' : 'True'
                };
                return {
                  ...m,
                  quiz: [...(m.quiz || []), newQuestion]
                };
              })
            }
          : l
      )
    );
  }

  function updateQuizQuestion(lessonId, moduleId, questionId, field, value) {
    setLessons((prev) =>
      prev.map((l) =>
        l.id === lessonId
          ? {
              ...l,
              modules: (l.modules || []).map((m) => {
                if (m.id !== moduleId) return m;
                return {
                  ...m,
                  quiz: (m.quiz || []).map((q) =>
                    q.id === questionId ? { ...q, [field]: value } : q
                  )
                };
              })
            }
          : l
      )
    );
  }

  function updateQuizOption(lessonId, moduleId, questionId, optionIndex, value) {
    setLessons((prev) =>
      prev.map((l) =>
        l.id === lessonId
          ? {
              ...l,
              modules: (l.modules || []).map((m) => {
                if (m.id !== moduleId) return m;
                return {
                  ...m,
                  quiz: (m.quiz || []).map((q) => {
                    if (q.id !== questionId) return q;
                    const updatedOptions = [...q.options];
                    updatedOptions[optionIndex] = value;
                    return { ...q, options: updatedOptions };
                  })
                };
              })
            }
          : l
      )
    );
  }

  function deleteQuizQuestion(lessonId, moduleId, questionId) {
    setLessons((prev) =>
      prev.map((l) =>
        l.id === lessonId
          ? {
              ...l,
              modules: (l.modules || []).map((m) => {
                if (m.id !== moduleId) return m;
                return {
                  ...m,
                  quiz: (m.quiz || []).filter((q) => q.id !== questionId)
                };
              })
            }
          : l
      )
    );
  }

  function handleStudentToggle(student) {
    const keys = getStudentKeys(student);
    if (keys.length === 0) return;

    setAssignedStudentKeys((prev) => {
      const isCurrentlyAssigned = keys.some((k) => prev.includes(k));
      if (isCurrentlyAssigned) {
        return prev.filter((k) => !keys.includes(k));
      } else {
        return Array.from(new Set([...prev, ...keys]));
      }
    });
  }

  function saveCourse() {
    onSave({
      ...course,
      title,
      description,
      mentorKey,
      assignedStudentKeys,
      lessons
    });
  }

  if (!course) return null;

  const studentUsers = (Array.isArray(users) ? users : []).filter(
    (u) => u?.role === 'student'
  );

  return (
    <div className='course-box'>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0, color: '#f59e0b' }}>Edit Course</h2>
        <button type='button' className='btn-secondary btn-inline' onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className='card'>
        <label className='help-text'>Title</label>
        <input
          className='input-wide'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <label className='help-text'>Description</label>
        <textarea
          className='input-wide'
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* STAFF & ADMIN: Assign Students */}
      {['admin', 'instructor', 'mentor', 'ta'].includes(currentUser?.role) && (
        <div className='card' style={{ marginTop: '1rem' }}>
          <label className='help-text' style={{ fontWeight: 'bold' }}>
            Assigned Students
          </label>
          <p className='help-text' style={{ margin: '4px 0 10px 0' }}>
            Select students who should have access to this course. If none are selected, it will be visible to all students.
          </p>

          <div
            style={{
              maxHeight: '180px',
              overflowY: 'auto',
              padding: '10px',
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: '6px'
            }}
          >
            {studentUsers.length === 0 ? (
              <small className='help-text'>No student accounts found.</small>
            ) : (
              studentUsers.map((student) => {
                const keys = getStudentKeys(student);
                if (keys.length === 0) return null;
                const isChecked = keys.some((k) => assignedStudentKeys.includes(k));

                return (
                  <label
                    key={student.id || student.email}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type='checkbox'
                      checked={isChecked}
                      onChange={() => handleStudentToggle(student)}
                    />
                    <span>
                      {student.firstName || student.lastName
                        ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
                        : student.email}{' '}
                      <small style={{ opacity: 0.7 }}>
                        ({student.studentId ? `${student.studentId} • ` : ''}{student.email})
                      </small>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ADMIN: Assign mentor to this course */}
      {currentUser?.role === 'admin' && (
        <div style={{ marginTop: '1rem' }}>
          <label className='help-text'>Assigned Mentor (course owner)</label>

          <select
            className='input-wide'
            value={mentorKey}
            onChange={(e) => setMentorKey(e.target.value)}
          >
            <option value=''>Unassigned (visible to any mentor)</option>
            {(Array.isArray(users) ? users : [])
              .filter((u) => u?.role === 'mentor')
              .map((m) => {
                const key = getUserKey(m);
                if (!key) return null;
                return (
                  <option key={key} value={key}>
                    {m.firstName} {m.lastName} - {key}
                  </option>
                );
              })}
          </select>

          <small className='help-text'>
            Only the assigned mentor (and admins) will see submissions for this course.
          </small>
        </div>
      )}

      <h3 style={{ color: '#60a5fa' }}>Lessons</h3>

      {lessons.length === 0 && <p>No lessons yet.</p>}

      {lessons.map((lesson) => (
        <div className='lesson-box' key={lesson.id}>
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

          <h4 style={{ marginTop: 14, color: '#a855f7' }}>Modules</h4>

          {(lesson.modules || []).length === 0 && <p>No modules yet.</p>}

          {(lesson.modules || []).map((mod) => (
            <div className='module-box' key={mod.id}>
              <input
                className='input-wide'
                value={mod.title}
                onChange={(e) =>
                  updateModule(lesson.id, mod.id, 'title', e.target.value)
                }
              />

              <textarea
                className='input-wide'
                value={mod.content}
                onChange={(e) =>
                  updateModule(lesson.id, mod.id, 'content', e.target.value)
                }
                placeholder='Module content (Markdown supported)'
              />

              <MarkdownPreview markdown={mod.content} />

              {/* QUIZ BUILDER SECTION */}
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
                        onClick={() => deleteQuizQuestion(lesson.id, mod.id, q.id)}
                      >
                        Remove Question
                      </button>
                    </div>

                    <input
                      className='input-wide'
                      placeholder='Enter question prompt...'
                      value={q.question}
                      onChange={(e) => updateQuizQuestion(lesson.id, mod.id, q.id, 'question', e.target.value)}
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
                              onChange={(e) => updateQuizOption(lesson.id, mod.id, q.id, optIdx, e.target.value)}
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
                              onClick={() => updateQuizQuestion(lesson.id, mod.id, q.id, 'answer', opt)}
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
                          onChange={(e) => updateQuizQuestion(lesson.id, mod.id, q.id, 'answer', e.target.value)}
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
                    onClick={() => addQuizQuestion(lesson.id, mod.id, 'multiple_choice')}
                  >
                    + Add Multiple Choice
                  </button>
                  <button
                    type='button'
                    className='btn-secondary btn-inline'
                    onClick={() => addQuizQuestion(lesson.id, mod.id, 'true_false')}
                  >
                    + Add True/False
                  </button>
                </div>
              </div>

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
                  value={mod.assignment?.repoUrl || ''}
                  onChange={(e) =>
                    updateAssignmentField(
                      lesson.id,
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
                    updateAssignmentField(lesson.id, mod.id, 'repoUrl', '')
                  }
                >
                  Clear Repo Requirement (Content Module)
                </button>

                <textarea
                  placeholder='Assignment instructions (Markdown supported)'
                  value={mod.assignment?.instructionsText || ''}
                  onChange={(e) =>
                    updateAssignmentField(
                      lesson.id,
                      mod.id,
                      'instructionsText',
                      e.target.value
                    )
                  }
                  style={{ width: '100%', minHeight: 80, marginBottom: 8 }}
                />

                <input
                  placeholder='Instruction Video URL (optional)'
                  value={mod.assignment?.instructionsVideoUrl || ''}
                  onChange={(e) =>
                    updateAssignmentField(
                      lesson.id,
                      mod.id,
                      'instructionsVideoUrl',
                      e.target.value
                    )
                  }
                  style={{ width: '100%' }}
                />
              </div>

              <button
                type='button'
                onClick={() => deleteModule(lesson.id, mod.id)}
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
      ))}

      <button type='button' className='btn' onClick={addLesson}>
        Add Lesson
      </button>

      <hr style={{ margin: '16px 0', borderColor: '#334155' }} />

      <div className='course-actions'>
        <button type='button' className='btn' onClick={saveCourse}>
          Save Course
        </button>

        <button type='button' className='btn-secondary' onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}