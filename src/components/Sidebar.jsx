import React, { useState } from 'react';
import { getDisplayName } from '../utils/academySettings';
import phoenixLogo from '../assets/Images/phoenix.jpg';

const Sidebar = ({
  setView,
  currentView,
  onExportBackup,
  onImportBackup,
  courses = [],
  currentUser,
  onLogout,
  academyName = 'Phoenix Fire Technical Academy'
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const role = currentUser?.role || 'student';
  const isStaff = ['instructor', 'ta', 'mentor', 'admin'].includes(role);
  const isAdmin = role === 'admin';

  const courseCount = courses?.length || 0;

  return (
    <aside id="sidebar" className={isCollapsed ? 'collapsed' : ''}>
      {/* HEADER WITH LOGO & COLLAPSE TOGGLE */}
      <div className="sidebar-header">
        <img
          src={phoenixLogo}
          alt="Academy Logo"
          className="sidebar-logo-img"
        />

        {!isCollapsed && (
          <div className="sidebar-logo-text">
            {academyName}
          </div>
        )}

        <button
          type="button"
          className="theme-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{ position: 'static', marginLeft: 'auto' }}
        >
          {isCollapsed ? '❯' : '❮'}
        </button>
      </div>

      {/* USER PROFILE INFO BOX */}
      {!isCollapsed && (
        <div className="sidebar-user">
          <span className="sidebar-username">
            {getDisplayName(currentUser)}
          </span>
          <span className="sidebar-role">{role.toUpperCase()}</span>
        </div>
      )}

      {/* NAVIGATION LINKS */}
      <nav className="sidebar-nav">
        <button
          type="button"
          className={`sidebar-btn ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setView('dashboard')}
          title="Dashboard"
        >
          <span className="nav-icon">📊</span>
          {!isCollapsed && <span className="nav-label">Dashboard</span>}
        </button>

        {/* COURSE MANAGEMENT (STAFF ONLY) */}
        {isStaff && (
          <button
            type="button"
            className={`sidebar-btn ${
              currentView === 'course-management' || currentView === 'editor' ? 'active' : ''
            }`}
            onClick={() => setView('course-management')}
            title="Course Management"
          >
            <span className="nav-icon">🛠️</span>
            {!isCollapsed && <span className="nav-label">Course Management</span>}
          </button>
        )}

        <button
          type="button"
          className={`sidebar-btn ${currentView === 'courses' ? 'active' : ''}`}
          onClick={() => setView('courses')}
          title={courseCount > 0 ? `Courses (${courseCount})` : 'Courses'}
        >
          <span className="nav-icon">📚</span>
          {!isCollapsed && <span className="nav-label">Courses</span>}
        </button>

        <button
          type="button"
          className={`sidebar-btn ${currentView === 'live-classes' ? 'active' : ''}`}
          onClick={() => setView('live-classes')}
          title="Live Classes"
        >
          <span className="nav-icon">🎥</span>
          {!isCollapsed && <span className="nav-label">Live Classes</span>}
        </button>

        <button
          type='button'
          className={`sidebar-btn ${currentView === 'lounge' ? 'active' : ''}`}
          onClick={() => setView('lounge')}
          title='Student Lounge'
        >
          <span className='nav-icon'>🛋️</span>
          {!isCollapsed && <span className='nav-label'>Student Lounge</span>}
        </button>

        <button
          type="button"
          className={`sidebar-btn ${currentView === 'messages' ? 'active' : ''}`}
          onClick={() => setView('messages')}
          title="Messages"
        >
          <span className="nav-icon">💬</span>
          {!isCollapsed && <span className="nav-label">Messages</span>}
        </button>

        <button
          type="button"
          className={`sidebar-btn ${currentView === 'progress' ? 'active' : ''}`}
          onClick={() => setView('progress')}
          title="My Progress"
        >
          <span className="nav-icon">📈</span>
          {!isCollapsed && <span className="nav-label">My Progress</span>}
        </button>

        <button
          type="button"
          className={`sidebar-btn ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => setView('settings')}
          title="Settings"
        >
          <span className="nav-icon">⚙️</span>
          {!isCollapsed && <span className="nav-label">Settings</span>}
        </button>

        {isAdmin && (
          <button
            type="button"
            className={`sidebar-btn ${currentView === 'users' ? 'active' : ''}`}
            onClick={() => setView('users')}
            title="User Management"
          >
            <span className="nav-icon">👥</span>
            {!isCollapsed && <span className="nav-label">User Management</span>}
          </button>
        )}

        {/* ADMIN BACKUP CONTROLS */}
        {isAdmin && !isCollapsed && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              type="button"
              className="sidebar-outline-btn"
              onClick={onExportBackup}
            >
              Export JSON Backup
            </button>
            <label className="sidebar-outline-btn" style={{ cursor: 'pointer', textAlign: 'center' }}>
              Import JSON Backup
              <input
                type="file"
                accept=".json"
                onChange={(e) => e.target.files?.[0] && onImportBackup(e.target.files[0])}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}

        {/* LOGOUT BUTTON */}
        <button
          type="button"
          className="sidebar-btn sidebar-logout"
          onClick={onLogout}
          title="Sign Out"
        >
          <span className="nav-icon">🚪</span>
          {!isCollapsed && <span className="nav-label">Sign Out</span>}
        </button>
      </nav>
    </aside>
  );
};

export default Sidebar;