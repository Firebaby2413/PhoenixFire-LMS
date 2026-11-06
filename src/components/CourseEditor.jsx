import { useCourseEditor } from '../hooks/useCourseEditor';
import CourseDetailsCard from './CourseDetailsCard';
import AssignedStudentsCard from './AssignedStudentsCard';
import MentorAssignField from './MentorAssignField';
import LessonEditor from './LessonEditor';

export default function CourseEditor({
  course,
  users,
  currentUser,
  onSave,
  onCancel
}) {
  const {
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
  } = useCourseEditor({ course, users, onSave });

  if (!course) return null;

  return (
    <div className='course-box'>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0, color: '#f59e0b' }}>Edit Course</h2>
        <button type='button' className='btn-secondary btn-inline' onClick={onCancel}>
          Cancel
        </button>
      </div>

      <CourseDetailsCard
        title={title}
        setTitle={setTitle}
        description={description}
        setDescription={setDescription}
      />

      <AssignedStudentsCard
        currentUser={currentUser}
        studentUsers={studentUsers}
        assignedStudentKeys={assignedStudentKeys}
        handleStudentToggle={handleStudentToggle}
      />

      <MentorAssignField
        currentUser={currentUser}
        users={users}
        mentorKey={mentorKey}
        setMentorKey={setMentorKey}
      />

      <h3 style={{ color: '#60a5fa' }}>Lessons</h3>

      {lessons.length === 0 && <p>No lessons yet.</p>}

      {lessons.map((lesson) => (
        <LessonEditor
          key={lesson.id}
          lesson={lesson}
          updateLessonField={updateLessonField}
          deleteLesson={deleteLesson}
          addFlashcard={addFlashcard}
          updateFlashcard={updateFlashcard}
          deleteFlashcard={deleteFlashcard}
          addModule={addModule}
          updateModule={updateModule}
          deleteModule={deleteModule}
          updateAssignmentField={updateAssignmentField}
          addQuizQuestion={addQuizQuestion}
          updateQuizQuestion={updateQuizQuestion}
          updateQuizOption={updateQuizOption}
          deleteQuizQuestion={deleteQuizQuestion}
        />
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