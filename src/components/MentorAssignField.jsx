import { getDisplayName } from '../utils/academySettings';
import { getUserKey } from '../hooks/useCourseEditor';

export default function MentorAssignField({ currentUser, users, mentorKey, setMentorKey }) {
  if (currentUser?.role !== 'admin') return null;

  return (
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
                {getDisplayName(m)} - {key}
              </option>
            );
          })}
      </select>

      <small className='help-text'>
        Only the assigned mentor (and admins) will see submissions for this course.
      </small>
    </div>
  );
}