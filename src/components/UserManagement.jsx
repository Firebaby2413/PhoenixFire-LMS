import React, { useState } from 'react';
import '../styles.css';

export default function UserManagement({
  users = [],
  onUserCreated,
  onUserDeleted,
  currentUser,
  courses = [],
  calculateCourseProgress
}) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    studentId: '',
    ownerKey: '',
    securityQuestion: '',
    securityAnswer: ''
  });

  const [msg, setMsg] = useState({ text: '', type: '' });

  const formatRelativeDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  };

  const getOverallProgress = (user) => {
    if (!courses || courses.length === 0) return 0;
    const studentKey = user.studentId || user.email;
    const total = courses.reduce(
      (acc, c) => acc + (calculateCourseProgress?.(c, studentKey) || 0),
      0
    );
    return Math.round(total / courses.length);
  };

  if (currentUser?.role !== 'admin') {
    return <div className='section-container'>Access Denied</div>;
  }

  const handleEnroll = async (e) => {
    e.preventDefault();
    try {
      onUserCreated?.(
        users,
        formData.email,
        formData.password,
        'student',
        formData.ownerKey,
        {
          firstName: formData.firstName,
          lastName: formData.lastName,
          studentId: formData.studentId,
          securityQuestion: formData.securityQuestion,
          securityAnswer: formData.securityAnswer
        }
      );

      setMsg({ text: 'Student enrolled successfully!', type: 'success' });
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        studentId: '',
        ownerKey: '',
        securityQuestion: '',
        securityAnswer: ''
      });
    } catch (err) {
      setMsg({
        text: err.message || 'Failed to enroll student.',
        type: 'error'
      });
    }
  };

  const downloadStudentReport = () => {
    const headers = [
      'Student Name',
      'Email',
      'Student ID',
      'Last Login',
      'Overall Progress %'
    ];
    const rows = users
      .filter((u) => u.role === 'student')
      .map((u) => {
        const prog = getOverallProgress(u);
        return [
          `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'N/A',
          u.email || 'N/A',
          u.studentId || 'N/A',
          u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never',
          `${prog}%`
        ];
      });

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `PFTA_Student_Report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className='section-container animate-fade-in'>
      <div
        style={{
          display: 'flex',
          justifySpaceBetween: 'space-between',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: '20px'
        }}
      >
        <h2 className='pf-title' style={{ margin: 0 }}>
          User Management
        </h2>
        <button
          className='btn-secondary'
          onClick={downloadStudentReport}
          style={{ padding: '8px 16px', fontSize: '12px' }}
        >
          📥 Export Student Data (CSV)
        </button>
      </div>

      <div
        className='course-box'
        style={{
          border: '1px solid var(--pf-border)',
          background: 'rgba(15, 23, 42, 0.6)'
        }}
      >
        <h3
          style={{
            marginTop: 0,
            color: 'var(--pf-fire)',
            fontSize: '1.1rem',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          Manual Student Enrollment
        </h3>

        <form
          onSubmit={handleEnroll}
          style={{ display: 'grid', gap: '15px', marginTop: '20px' }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '15px'
            }}
          >
            <div className='input-group'>
              <label className='help-text'>First Name</label>
              <input
                className='input-wide'
                placeholder='e.g. John'
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                required
              />
            </div>
            <div className='input-group'>
              <label className='help-text'>Last Name</label>
              <input
                className='input-wide'
                placeholder='e.g. Doe'
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: '15px'
            }}
          >
            <div className='input-group'>
              <label className='help-text'>Email Address</label>
              <input
                className='input-wide'
                type='email'
                placeholder='student@pfta.edu'
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>
            <div className='input-group'>
              <label className='help-text'>Student ID</label>
              <input
                className='input-wide'
                placeholder='PFTA-000'
                value={formData.studentId}
                onChange={(e) =>
                  setFormData({ ...formData, studentId: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className='input-group'>
            <label className='help-text'>Temporary Password</label>
            <input
              className='input-wide'
              type='password'
              placeholder='********'
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr',
              gap: '15px'
            }}
          >
            <div className='input-group'>
              <label className='help-text'>Security Question</label>
              <select
                className='input-wide'
                value={formData.securityQuestion}
                onChange={(e) =>
                  setFormData({ ...formData, securityQuestion: e.target.value })
                }
                required
              >
                <option value=''>Select a challenge...</option>
                <option value='What was the name of your first pet?'>
                  First pet's name
                </option>
                <option value='What city were you born in?'>Birth city?</option>
                <option value='What was your first car?'>
                  First car model?
                </option>
              </select>
            </div>
            <div className='input-group'>
              <label className='help-text'>Security Answer</label>
              <input
                className='input-wide'
                placeholder='Answer...'
                value={formData.securityAnswer}
                onChange={(e) =>
                  setFormData({ ...formData, securityAnswer: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div
            style={{
              padding: '15px',
              background: 'rgba(245, 158, 11, 0.08)',
              borderRadius: '12px',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              marginTop: '10px'
            }}
          >
            <label
              className='help-text'
              style={{ color: 'var(--pf-fire)', fontWeight: 'bold' }}
            >
              Owner Key Verification
            </label>
            <input
              className='input-wide'
              type='password'
              style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}
              placeholder='Enter Creation Key'
              value={formData.ownerKey}
              onChange={(e) =>
                setFormData({ ...formData, ownerKey: e.target.value })
              }
              required
            />
          </div>

          <button type='submit' className='btn' style={{ marginTop: '10px' }}>
            Confirm & Enroll Student
          </button>
          {msg.text && (
            <p
              style={{
                color: msg.type === 'success' ? '#22c55e' : '#ef4444',
                textAlign: 'center',
                fontWeight: 'bold'
              }}
            >
              {msg.text}
            </p>
          )}
        </form>
      </div>

      <h3
        className='pf-title'
        style={{ marginTop: '40px', fontSize: '1.2rem' }}
      >
        Active Student Roster
      </h3>
      <div
        className='course-box'
        style={{
          padding: 0,
          overflow: 'hidden',
          border: '1px solid var(--pf-border)'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '15px',
            borderBottom: '1px solid var(--pf-border)'
          }}
        >
          <h2 style={{ margin: 0 }}>Student Roster</h2>
          <button
            onClick={downloadStudentReport}
            type='button'
            className='btn-secondary'
          >
            Export CSV
          </button>
        </div>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}
        >
          <thead
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderBottom: '2px solid var(--pf-border)'
            }}
          >
            <tr style={{ textAlign: 'left' }}>
              <th style={{ padding: '15px' }}>Student Profile</th>
              <th>Internal ID</th>
              <th>Overall Progress</th>
              <th>Status</th>
              <th>Last Activity</th>
              <th style={{ textAlign: 'right', paddingRight: '20px' }}>
                Management
              </th>
            </tr>
          </thead>
          <tbody>
            {users
              .filter((u) => u.role === 'student')
              .map((u, index) => {
                const prog = getOverallProgress(u) || 0;
                return (
                  <tr
                    key={u.id || u.email || index}
                    className='table-row-hover'
                    style={{ borderBottom: '1px solid var(--pf-border)' }}
                  >
                    <td style={{ padding: '15px' }}>
                      <div
                        style={{ fontWeight: 'bold', color: 'var(--pf-fire)' }}
                      >
                        {u.firstName} {u.lastName}
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.5 }}>
                        {u.email}
                      </div>
                    </td>
                    <td
                      style={{
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        opacity: 0.8
                      }}
                    >
                      {u.studentId || 'NO-ID'}
                    </td>
                    <td style={{ minWidth: '140px' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        <div
                          style={{
                            fontSize: '10px',
                            opacity: 0.8,
                            fontWeight: 'bold'
                          }}
                        >
                          {prog}%
                        </div>
                        <div
                          style={{
                            height: '6px',
                            width: '100px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '10px',
                            overflow: 'hidden'
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${prog}%`,
                              background:
                                prog === 100 ? '#22c55e' : 'var(--pf-fire)',
                              boxShadow:
                                prog > 0
                                  ? `0 0 8px ${prog === 100 ? '#22c55e' : 'var(--pf-fire)'}`
                                  : 'none',
                              transition: 'width 0.6s ease-out'
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <div
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: u.lastLogin ? '#22c55e' : '#f59e0b',
                            boxShadow: u.lastLogin
                              ? '0 0 10px #22c55e'
                              : '0 0 5px #f59e0b'
                          }}
                        />
                        <span
                          style={{
                            fontSize: '11px',
                            color: u.lastLogin ? '#22c55e' : '#f59e0b',
                            fontWeight: 'bold'
                          }}
                        >
                          {u.lastLogin ? 'ACTIVE' : 'PENDING'}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', opacity: 0.7 }}>
                      {formatRelativeDate(u.lastLogin)}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '20px' }}>
                      <button
                        className='btn-inline'
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '5px 12px',
                          fontSize: '11px'
                        }}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Permanently remove ${u.firstName} ${u.lastName}?`
                            )
                          ) {
                            onUserDeleted?.(u.id || u.email);
                          }
                        }}
                      >
                        Revoke Access
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
