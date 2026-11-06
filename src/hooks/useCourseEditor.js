import { useEffect, useState } from 'react';
import { withModuleClassification } from '../utils/moduleTypes';

function newId() {
  if (typeof crypto !== 'undefined' && crypto?.randomUUID)
    return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getUserKey(user) {
  return user?.studentId ?? user?.email ?? user?.username ?? null;
}

export function getStudentKeys(student) {
  if (!student) return [];
  return [student.studentId, student.email, student.username, student.id].filter(Boolean);
}

function ensureModuleHasAssignment(mod) {
  if (!mod) return mod;
  return withModuleClassification({
    ...mod,
    quiz: Array.isArray(mod?.quiz) ? mod.quiz : []
  });
}

function deepCloneCourseLessons(course) {
  const lessons = JSON.parse(JSON.stringify(course?.lessons ?? []));
  return lessons.map((lesson) => ({
    ...lesson,
    modules: (lesson.modules || []).map((m) => ensureModuleHasAssignment(m))
  }));
}

export function useCourseEditor({ course, users, onSave }) {
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
      { id: newId(), title: 'New Lesson', description: '', modules: [], flashcards: [] }
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

  function addFlashcard(lessonId) {
    setLessons((prev) =>
      prev.map((l) =>
        l.id === lessonId
          ? {
            ...l,
            flashcards: [...(l.flashcards || []), { id: newId(), front: '', back: '' }]
          }
        : l
      )
    );
  }

  function updateFlashcard(lessonId, cardId, field, value) {
    setLessons((prev) =>
      prev.map((l) =>
        l.id === lessonId
          ? {
              ...l,
              flashcards: (l.flashcards || []).map((card) =>
                card.id === cardId ? { ...card, [field]: value } : card
              )
          }
        : l
      )
    );
  }

  function deleteFlashcard(lessonId, cardId) {
    setLessons((prev) =>
      prev.map((l) =>
        l.id === lessonId
          ? {
              ...l,
              flashcards: (l.flashcards || []).filter((card) => card.id !== cardId)
          }
        : l
      )
    );
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
                type: 'reading',
                is_reading: true,
                requires_submission: false,
                assignment: null
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
                // Repo URL is the only thing that makes this an assignment.
                const currentRepo = field === 'repoUrl' ? value : (m.repo_url || m.assignment?.repoUrl || '');
                const currentPrompt = field === 'instructionsText' ? value : (m.assignment_prompt || m.assignment?.instructionsText || '');
                const currentVideo = field === 'instructionsVideoUrl' ? value : (m.video_url || m.assignment?.instructionsVideoUrl || '');
                return withModuleClassification({
                  ...m,
                  [rootField]: value,
                  repo_url: currentRepo,
                  assignment_prompt: currentPrompt,
                  video_url: currentVideo
                });
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
      lessons: lessons.map((lesson) => ({
        ...lesson,
        modules: (lesson.modules || []).map((m) => withModuleClassification(m))
      }))
    });
  }

  const studentUsers = (Array.isArray(users) ? users : []).filter(
    (u) => u?.role === 'student'
  );

  return {
    mentorKey,
    setMentorKey,
    title,
    setTitle,
    description,
    setDescription,
    assignedStudentKeys,
    lessons,
    studentUsers,
    addLesson,
    updateLessonField,
    deleteLesson,
    addFlashcard,
    updateFlashcard,
    deleteFlashcard,
    addModule,
    updateModule,
    updateAssignmentField,
    deleteModule,
    addQuizQuestion,
    updateQuizQuestion,
    updateQuizOption,
    deleteQuizQuestion,
    handleStudentToggle,
    saveCourse
  };
}
