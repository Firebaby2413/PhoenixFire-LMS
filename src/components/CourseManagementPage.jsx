import CourseEditor from './CourseEditor';
import CourseList from './CourseList';

export default function CourseManagementPage({
  editingCourse,
  setEditingCourse,
  activeUser,
  users,
  courses,
  progressRevision,
  onSaveCourse,
  onDeleteCourse,
  onApproveCourse,
  onSelectCourse
}) {
  return (
    <div className='course-management-container'>
      <div className='flex justify-between items-center mb-6'>
        {!editingCourse && (
          <button
            onClick={() => {
              const newCourse = {
                id: `course_${Date.now()}`,
                title: 'Untitled New Course',
                description: '',
                status: 'draft',
                mentorKey: activeUser?.email || '',
                assignedStudentKeys: [],
                lessons: [
                  {
                    id: `lesson_${Date.now()}`,
                    title: 'Module 1: Introduction',
                    description: '',
                    modules: []
                  }
                ]
              };
              setEditingCourse(newCourse);
            }}
            className='btn-primary flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold'
          >
            <span>+</span> Create New Course
          </button>
        )}
      </div>

      {editingCourse ? (
        <div>
          <button
            onClick={() => setEditingCourse(null)}
            className='mb-4 text-sm text-gray-400 hover:text-white flex items-center gap-1'  
          >
            ← Back to Course Management
          </button>

          <CourseEditor
            course={editingCourse}
            users={users}
            currentUser={activeUser}
            onSave={async (updatedCourse) => {
              const saved = await onSaveCourse(updatedCourse);
              if (saved) setEditingCourse(null);
            }}
            onCancel={() => setEditingCourse(null)}
          />
        </div>
      ) : (
        <CourseList
          courses={courses}
          currentUser={activeUser}
          users={users}
          onEditCourse={(course) => setEditingCourse(course)}
          onDeleteCourse={(courseOrId) => {
            const course = typeof courseOrId === 'object'
              ? courseOrId
              : courses.find((item) => item.id === courseOrId);
            if (course && window.confirm('Are you sure you want to delete this course?')) {
              onDeleteCourse(course);
            }
          }}
          onApproveCourse={onApproveCourse}
          onSelectCourse={onSelectCourse}
          refreshKey={progressRevision}
        />
      )}
    </div>
  );
}