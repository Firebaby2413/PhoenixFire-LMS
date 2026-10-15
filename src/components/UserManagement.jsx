import React, { useState } from 'react';
import {getDisplayName } from '../utils/academySettings';

const UserManagement = ({ currentUser, users = [], onUserCreated, onUserUpdated, onUserDeleted }) => {
  const [editingUserId, setEditingUserId] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    role: 'student',
    studentId: '',
    streetAddress: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'USA',
    emergencyContactName: '',
    emergencyContactPhone: '',
    accessKey: ''
  });

  const userRole = currentUser?.role?.toLowerCase() || '';
  if (userRole !== 'admin') {
    return <div className="section-container card">Access Denied</div>;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditClick = (user) => {
    setEditingUserId(user.id || user.email);
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      password: user.password || '',
      role: user.role || 'student',
      studentId: user.studentId || '',
      streetAddress: user.streetAddress || '',
      addressLine2: user.addressLine2 || '',
      city: user.city || '',
      state: user.state || '',
      zipCode: user.zipCode || '',
      country: user.country || 'USA',
      emergencyContactName: user.emergencyContactName || '',
      emergencyContactPhone: user.emergencyContactPhone || '',
      accessKey: ''
    });

    // Smooth scroll up to form when editing
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      role: 'student',
      studentId: '',
      streetAddress: '',
      addressLine2: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'USA',
      emergencyContactName: '',
      emergencyContactPhone: '',
      accessKey: ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.email) return;

    if (editingUserId) {
      onUserUpdated?.(editingUserId, formData);
      setEditingUserId(null);
    } else {
      if (!formData.password) return;
      onUserCreated?.(users, formData);
    }

    resetForm();
  };

  // Export CSV for ALL Students
  const exportAllCSV = () => {
    const studentUsers = users.filter((u) => u.role === 'student');
    exportCSVData(studentUsers, 'all_students_progress_report.csv');
  };

  // Export CSV for a SINGLE Student
  const exportSingleCSV = (user) => {
    exportCSVData([user], `student_${user.studentId || user.email}_report.csv`);
  };

  const exportCSVData = (userList, filename) => {
    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Student ID',
      'Role',
      'Street Address',
      'City',
      'State',
      'Zip',
      'Emergency Contact Name',
      'Emergency Contact Phone',
      'Progress (%)'
    ];

    const rows = userList.map((u) => [
      u.firstName || '',
      u.lastName || '',
      u.email || '',
      u.phone || '',
      u.studentId || '',
      u.role || 'student',
      u.streetAddress || '',
      u.city || '',
      u.state || '',
      u.zipCode || '',
      u.emergencyContactName || '',
      u.emergencyContactPhone || '',
      u.progress || 0
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="section-container animate-fade-in">
      <div className="form-header-banner">
        <h2>User Management &amp; Student Enrollment</h2>
        <p>
          Enrolled student contact details are restricted to Administrator views. Students may update
          their own information via Profile Settings.
        </p>
      </div>

      {/* Enrolment / Creation / Editing Form */}
      <form onSubmit={handleSubmit} className="card form-container styled-form-card">
        <div className="form-section-title">
          <h3>
            {editingUserId ? 'Edit User / Student Record' : '1. Account Credentials & Role'}
          </h3>
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label className="form-label">
              Role <span className="required-star">*</span>
            </label>
            <select
              name="role"
              className="input-wide form-control styled-input"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="student">Student</option>
              <option value="ta">TA</option>
              <option value="instructor">Instructor</option>
              <option value="mentor">Mentor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Student / User ID</label>
            <input
              type="text"
              name="studentId"
              className="input-wide form-control styled-input"
              placeholder="e.g. STU-2026-01"
              value={formData.studentId}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label className="form-label">
              Email Address <span className="required-star">*</span>
            </label>
            <input
              type="email"
              name="email"
              className="input-wide form-control styled-input"
              placeholder="student@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">
              Password {!editingUserId && <span className="required-star">*</span>}
            </label>
            <input
              type="password"
              name="password"
              className="input-wide form-control styled-input"
              placeholder={editingUserId ? '(Leave blank to keep existing)' : '••••••••'}
              value={formData.password}
              onChange={handleChange}
              required={!editingUserId}
            />
          </div>

          {!editingUserId && (
            <div className='form-field'>
              <label className='form-label'>
                {formData.role === 'admin' ? 'Owner Key' : 'Enrollment Key'}{' '}
                <span className='required-star'>*</span>
              </label>
              <input
                className='input-wide form-control styled-input'
                type='password'
                name='accessKey'
                placeholder={formData.role === 'admin' ? 'Owner Key' : 'Enrollment Key'}
                value={formData.accessKey}
                onChange={handleChange}
                required
              />
            </div>
          )}
        </div>

        <div className="form-section-title" style={{ marginTop: '24px' }}>
          <h3>2. Detailed Student Profile</h3>
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label className="form-label">First Name</label>
            <input
              type="text"
              name="firstName"
              className="input-wide form-control styled-input"
              placeholder="First name"
              value={formData.firstName}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Last Name</label>
            <input
              type="text"
              name="lastName"
              className="input-wide form-control styled-input"
              placeholder="Last name"
              value={formData.lastName}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Phone Number</label>
            <input
              type="tel"
              name="phone"
              className="input-wide form-control styled-input"
              placeholder="(555) 000-0000"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Street Address</label>
            <input
              type="text"
              name="streetAddress"
              className="input-wide form-control styled-input"
              placeholder="123 Main St"
              value={formData.streetAddress}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Address Line 2</label>
            <input
              type="text"
              name="addressLine2"
              className="input-wide form-control styled-input"
              placeholder="Apt, Suite, Unit, etc."
              value={formData.addressLine2}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label className="form-label">City</label>
            <input
              type="text"
              name="city"
              className="input-wide form-control styled-input"
              placeholder="City"
              value={formData.city}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label className="form-label">State / Province</label>
            <input
              type="text"
              name="state"
              className="input-wide form-control styled-input"
              placeholder="State"
              value={formData.state}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Zip / Postal Code</label>
            <input
              type="text"
              name="zipCode"
              className="input-wide form-control styled-input"
              placeholder="Zip code"
              value={formData.zipCode}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Emergency Contact Name</label>
            <input
              type="text"
              name="emergencyContactName"
              className="input-wide form-control styled-input"
              placeholder="Contact Name"
              value={formData.emergencyContactName}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Emergency Contact Phone</label>
            <input
              type="tel"
              name="emergencyContactPhone"
              className="input-wide form-control styled-input"
              placeholder="(555) 000-0000"
              value={formData.emergencyContactPhone}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Centered Form Buttons */}
        <div className="form-actions form-actions-center">
          {editingUserId && (
            <button
              type="button"
              className="btn-secondary btn-inline"
              onClick={handleCancelEdit}
              style={{ marginRight: '12px' }}
            >
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary btn-inline">
            {editingUserId ? 'Update Student Record' : 'Enroll & Save User'}
          </button>
        </div>
      </form>

      {/* Roster / Directory Section */}
      <div className="card styled-form-card" style={{ marginTop: '32px' }}>
        <div className="roster-header">
          <div>
            <h3 style={{ margin: 0 }}>Registered Users Directory</h3>
            <p className="roster-subtext">Viewing all system accounts and privacy parameters.</p>
          </div>
          <button onClick={exportAllCSV} className="btn-outline btn-inline">
            Export All Students (CSV)
          </button>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>User / Name</th>
                <th>Role</th>
                <th>ID</th>
                <th>Email</th>
                <th>Phone</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, index) => {
                const fullName = getDisplayName(u);
                return (
                  <tr key={u.id || index} className="table-row-hover">
                    <td>
                      <div className="user-cell-main">{fullName || 'Unnamed User'}</div>
                    </td>
                    <td>
                      <span className={`role-badge role-${u.role || 'student'}`}>
                        {u.role || 'student'}
                      </span>
                    </td>
                    <td><code>{u.studentId || 'N/A'}</code></td>
                    <td><a href={`mailto:${u.email}`} className="contact-link">{u.email}</a></td>
                    <td>{u.phone ? <a href={`tel:${u.phone}`} className="contact-link">{u.phone}</a> : '—'}</td>
                    <td>
                      <div className="action-button-group">
                        <button
                          type="button"
                          className="btn-action-link edit-link"
                          onClick={() => handleEditClick(u)}
                          title="Edit User Profile"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-action-link csv-link"
                          onClick={() => exportSingleCSV(u)}
                          title="Export CSV for this user"
                        >
                          CSV
                        </button>
                        <button
                          type="button"
                          className="btn-action-link danger-link"
                          onClick={() => onUserDeleted?.(u.id || u.email)}
                          title="Revoke Access"
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;