import { getDisplayName } from '../utils/academySettings';
import { getStudentKeys } from '../hooks/useCourseEditor';

export default function AssignedStudentsCard({
  currentUser,
  studentUsers,
  assignedStudentKeys,
  handleStudentToggle
}) {
  if (!['admin', 'instructor', 'mentor', 'ta'].includes(currentUser?.role)) return null;

  return (
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
                  {getDisplayName(student)}{' '}
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
  );
}