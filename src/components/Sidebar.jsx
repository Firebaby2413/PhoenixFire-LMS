// src/components/Sidebar.jsx
import { useRef } from 'react';
import { canMentorSeeCourse } from '../utils/permissions';
import phoenixLogo from '../assets/Images/phoenix.jpg';
import { useAuth } from '../context/AuthContext'; // 1. Import useAuth hook

export default function Sidebar({
  isStudent,
  isStaff,
  setView,
  onExportBackup,
  onImportBackup,
  courses,
  revisionCount = 0
}) {
  const { currentUser, logout } = useAuth(); // 2. Grab auth values directly from context
  const fileRef = useRef(null);

  const isAdmin = currentUser?.role === 'admin';
  const userEmailOrName = currentUser?.firstName
    ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
    : (currentUser?.email ?? 'User');

  const canSeeSubmissions = (() => {
    const list = Array.isArray(courses) ? courses : [];
    for (const course of list) {
      if (!canMentorSeeCourse(course, currentUser)) continue;
      for (const lesson of course.lessons || []) {
        for (const mod of lesson.modules || []) {
          const subs = mod?.assignment?.submissions || [];
          if (subs.length > 0) return true;
        }
      }
    }
    return false;
  })();

  return (
    <aside id='sidebar'>
      {/* HEADER */}
      <div className='sidebar-header'>
        <img
          src={phoenixLogo}
          alt='Phoenix Fire Technical Academy'
          className='sidebar-logo-img'
        />
        <div className='sidebar-logo-text'>
          Phoenix Fire
          <br />
          Technical Academy
        </div>
      </div>

      {/* USER INFO */}
      <div className='sidebar-user'>
        <div className='sidebar-username'>{userEmailOrName}</div>
        <div className='sidebar-role'>{currentUser?.role || 'Student'}</div>
      </div>

      {/* SHARED NAVIGATION */}
      <button
        type='button'
        className='sidebar-btn'
        onClick={() => setView('dashboard')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}
      >
        <span>Dashboard</span>
        {revisionCount > 0 && (
          <span
            style={{
              background: 'var(--pf-fire, #e63946)',
              color: 'white',
              fontSize: '11px',
              minWidth: '20px',
              height: '20px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              boxShadow: '0 0 10px var(--pf-fire, #e63946)',
              padding: '2px'
            }}
          >
            {revisionCount}
          </span>
        )}
      </button>

      <button
        type='button'
        className='sidebar-btn'
        onClick={() => setView('courses')}
      >
        Courses
      </button>

      <button
        type='button'
        className='sidebar-btn'
        onClick={() => setView('messages')}
      >
        Messages
      </button>

      {/* STUDENT NAVIGATION */}
      {isStudent && (
        <>
          <button
            type='button'
            className='sidebar-btn'
            onClick={() => setView('progress')}
          >
            My Progress
          </button>
          <button
            type='button'
            className='sidebar-btn'
            onClick={() => setView('settings')}
          >
            Settings
          </button>
        </>
      )}

      {/* STAFF NAVIGATION */}
      {isStaff && (
        <>
          <button
            type='button'
            className='sidebar-btn'
            onClick={() => setView('progress')}
          >
            Progress
          </button>
          <button
            type='button'
            className='sidebar-btn'
            onClick={() => setView('reports')}
          >
            Reports
          </button>

          {canSeeSubmissions && (
            <button
              type='button'
              className='sidebar-btn'
              onClick={() => setView('submissions')}
            >
              Submissions
            </button>
          )}

          <button
            type='button'
            className='sidebar-btn'
            onClick={() => setView('studentProgress')}
          >
            Student Progress
          </button>
          <button
            type='button'
            className='sidebar-btn'
            onClick={() => setView('settings')}
          >
            Settings
          </button>
        </>
      )}

      {/* ADMIN NAVIGATION & BACKUPS */}
      {isAdmin && (
        <>
          <button
            type='button'
            className='sidebar-btn'
            onClick={() => setView('users')}
          >
            Users
          </button>

          <button
            className='sidebar-btn'
            type='button'
            onClick={() => onExportBackup?.()}
          >
            Export Backup
          </button>

          <button
            className='sidebar-btn'
            type='button'
            onClick={() => fileRef.current?.click()}
          >
            Import Backup
          </button>

          <input
            ref={fileRef}
            type='file'
            accept='application/json'
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportBackup?.(file);
              e.target.value = '';
            }}
          />
        </>
      )}

      {/* LOGOUT */}
      <button
        type='button'
        className='sidebar-btn sidebar-logout'
        onClick={logout} // 3. Wire up the logout function directly
      >
        Logout
      </button>
    </aside>
  );
}
