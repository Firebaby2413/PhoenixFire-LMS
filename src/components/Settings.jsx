import { useEffect, useState } from 'react';
import {
  getAcademySettings,
  saveAcademySettings,
  getOwnerKey,
  getEnrollmentKey,
  getUserPrefs,
  saveUserPrefs
} from '../utils/academySettings';
import { supabase } from '../utils/supabaseClient';

const box = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: '12px',
  padding: '20px',
  marginBottom: '20px'
};

const label = {
  display: 'block',
  fontSize: '12px',
  color: '#9ca3af',
  marginBottom: '6px',
  fontWeight: 600
};

const input = {
  width: '100%',
  background: '#0b0f19',
  border: '1px solid #1e293b',
  borderRadius: '8px',
  color: '#f8fafc',
  padding: '8px 12px',
  marginBottom: '12px'
};

export default function Settings({
  currentUser,
  theme,
  setTheme,
  onSaveUser,
  academySettings,
  onSaveAcademy
}) {
  const role = String(currentUser?.role || 'student').toLowerCase();
  const isStudent = role === 'student';
  const isMentor = role === 'mentor' || role === 'instructor' || role === 'ta';
  const isAdmin = role === 'admin';
  const isStaff = isMentor || isAdmin;

  const storedPrefs = getUserPrefs(currentUser);

  const [firstName, setFirstName] = useState(currentUser?.firstName || '');
  const [lastName, setLastName] = useState(currentUser?.lastName || '');
  const [preferredName, setPreferredName] = useState(storedPrefs.preferredName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notifyPassed, setNotifyPassed] = useState(storedPrefs.notifyPassed);
  const [notifyRevision, setNotifyRevision] = useState(storedPrefs.notifyRevision);
  const [notifyMessage, setNotifyMessage] = useState(storedPrefs.notifyMessage);
  const [feedbackSnippets, setFeedbackSnippets] = useState(storedPrefs.feedbackSnippets);
  const [academyName, setAcademyName] = useState(
    academySettings?.academyName || getAcademySettings().academyName
  );
  const [currentOwnerKey, setCurrentOwnerKey] = useState('');
  const [newOwnerKey, setNewOwnerKey] = useState('');
  const [confirmOwnerKey, setConfirmOwnerKey] = useState('');
  const [enrollOwnerConfirm, setEnrollOwnerConfirm] = useState('');
  const [newEnrollmentKey, setNewEnrollmentKey] = useState('');
  const [confirmEnrollmentKey, setConfirmEnrollmentKey] = useState('');

  useEffect(() => {
    if (!currentUser?.id) return;
    supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setPreferredName(data.preferred_name || '');
        setNotifyPassed(data.notify_passed !== false);
        setNotifyRevision(data.notify_revision !== false);
        setNotifyMessage(data.notify_message !== false);
        setFeedbackSnippets(data.feedback_snippets || '');
      });
  }, [currentUser?.id]);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    saveUserPrefs(currentUser, {
      preferredName: preferredName.trim(),
      notifyPassed,
      notifyRevision,
      notifyMessage,
      feedbackSnippets
    });
    if (typeof onSaveUser === 'function') {
      onSaveUser({
        ...currentUser,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        preferredName: preferredName.trim(),
        name: preferredName.trim() || `${firstName.trim()} ${lastName.trim()}`.trim() || currentUser.email
      });
    }
    alert('Profile saved.');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      alert('Enter your current password and a new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match.');
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: currentPassword
    });
    if (signInError) {
      alert('Current password is incorrect.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      alert(error.message);
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    alert('Password updated.');
  };

  const handleSavePrefs = (e) => {
    e.preventDefault();
    saveUserPrefs(currentUser, {
      preferredName: preferredName.trim(),
      notifyPassed,
      notifyRevision,
      notifyMessage,
      feedbackSnippets
    });
    alert('Preferences saved.');
  };

  const handleSaveAcademy = (e) => {
    e.preventDefault();
    const trimmed = academyName.trim() || 'Phoenix Fire Technical Academy';
    const next = saveAcademySettings({ academyName: trimmed });
    if (typeof onSaveAcademy === 'function') onSaveAcademy(next);
    setAcademyName(trimmed);
    alert('Academy name saved.');
  };

  const handleChangeOwnerKey = (e) => {
    e.preventDefault();
    if (currentOwnerKey !== getOwnerKey()) {
      alert('Current owner key is incorrect.');
      return;
    }
    if (!newOwnerKey.trim()) {
      alert('Enter a new owner key.');
      return;
    }
    if (newOwnerKey !== confirmOwnerKey) {
      alert('New owner keys do not match.');
      return;
    }
    const next = saveAcademySettings({ ownerKey: newOwnerKey.trim() });
    if (typeof onSaveAcademy === 'function') onSaveAcademy(next);
    setCurrentOwnerKey('');
    setNewOwnerKey('');
    setConfirmOwnerKey('');
    alert('Owner key updated. Use the new key next time you create an admin.');
  };

  const handleChangeEnrollmentKey = (e) => {
    e.preventDefault();
    if (enrollOwnerConfirm !== getOwnerKey()) {
      alert('Enter the current owner key to change the enrollment key.');
      return;
    }
    if (!newEnrollmentKey.trim()) {
      alert('Enter a new enrollment key.');
      return;
    }
    if (newEnrollmentKey !== confirmEnrollmentKey) {
      alert('New enrollment keys do not match.');
      return;
    }
    const next = saveAcademySettings({ enrollmentKey: newEnrollmentKey.trim() });
    if (typeof onSaveAcademy === 'function') onSaveAcademy(next);
    setEnrollOwnerConfirm('');
    setNewEnrollmentKey('');
    setConfirmEnrollmentKey('');
    alert('Enrollment key updated. Give the new key to staff who enroll students.');
  }

  const mask = (key) => {
    if (!key || key.length < 4) return '****';
    return `****${key.slice(-4)}`;
  };
  const maskedKey = mask(getOwnerKey());
  const maskedEnrollmentKey = mask(getEnrollmentKey());

  return (
    <div>
      <div style={box}>
        <h3 style={{ marginTop: 0, color: '#f8fafc'}}>Profile</h3>
        <p style={{ color: '#9ca3af', fontSize: '14px' }}>
          Signed in as <strong style={{ color: '#e5e7eb' }}>{currentUser?.email}</strong>
          {' · '}  
        <span style={{ textTransform: 'uppercase' }}>{role}</span>
        </p>
        <form onSubmit={handleSaveProfile}>
          <label style={label}>First name</label>
          <input style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <label style={label}>Last name</label>
          <input style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <label style={label}>Preferred name (how mentors see you)</label>
          <input style={input} value={preferredName} onChange={(e) => setPreferredName(e.target.value)}/>
          <label style={label}>{isStudent ? 'Student ID' : 'Account ID'}</label>
          <input
            style={{ ...input, opacity: 0.7 }}
            value={currentUser?.studentId || currentUser?.id || ''}
            readOnly
          />
          <button type='submit' className='btn'>Save profile</button>
        </form>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Password</h3>
        <form onSubmit={handleChangePassword}>
          <label style={label}>Current password</label>
          <input
            style={input}
            type='password'
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <label style={label}>New password</label>
          <input
            style={input}
            type='password'
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <label style={label}>Confirm new password</label>
          <input
            style={input}
            type='password'
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button type='submit' className='btn'>Update password</button>
        </form>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: '#f8fafc'}}>Preferences</h3>
        <form onSubmit={handleSavePrefs}>
          <label style={label}>Theme</label>
          <select
            style={input}
            value={theme}
            onChange={(e) => typeof setTheme === 'function' && setTheme(e.target.value)}
          >
            <option value='dark'>Dark</option>
            <option value='light'>Light</option>
          </select>
          <label style={{ ...label, marginBottom: '10px'}}>In-app alerts</label>
          <label style={{ display: 'flex', gap: '8px', color: '#e5e7eb', marginBottom: '8px' }}>
            <input
              type='checkbox'
              checked={notifyPassed}
              onChange={(e) => setNotifyPassed(e.target.checked)}
            />
            Assignment passed
          </label>
          <label style={{ display: 'flex', gap: '8px', color: '#e5e7eb', marginBottom: '8px' }}>
            <input
              type='checkbox'
              checked={notifyRevision}
              onChange={(e) => setNotifyRevision(e.target.checked)}
            />
            Needs revision
          </label>
          <label style={{ display: 'flex', gap: '8px', color: '#e5e7eb', marginBottom: '16px' }}>
            <input
              type='checkbox'
              checked={notifyMessage}
              onChange={(e) => setNotifyMessage(e.target.checked)}
            />
            New message
          </label>
          <button type='submit' className='btn'>Save preferences</button>
        </form>
      </div>

      {isStaff && (
        <div style={box}>
          <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Mentor feedback snippets</h3>
          <p style={{ color: '#9ca3af', fontSize: '13px' }}>
            Optional notes you reuse when grading. Not shown to students from this page.
          </p>
          <textarea
            style={{ ...input, minHeight: '90px', resize: 'vertical' }}
            value={feedbackSnippets}
            onChange={(e) => setFeedbackSnippets(e.target.value)}
            placeholder='Great Job! Add your name in an h3...'
          />
          <button type='button' className='btn' onClick={handleSavePrefs}>
            Save snippets
          </button>
        </div>
      )}

      {isAdmin && (
        <>
          <div style={box}>
            <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Academy</h3>
            <form onSubmit={handleSaveAcademy}>
              <label style={label}>Academy display name</label>
              <input
                style={input}
                value={academyName}
                onChange={(e) => setAcademyName(e.target.value)}
              />
              <button type='submit' className='btn'>Save academy name</button>
            </form>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: '#f8fafc'}}>Owner key</h3>
            <p style={{ color: '#9ca3af', fontSize: '13px' }}>
              Head admin only. Required to create admin accounts and to change keys. Current key ends with {maskedKey}.
            </p>
            <form onSubmit={handleChangeOwnerKey}>
              <label style={label}>Current owner key</label>
              <input
                style={input}
                type='password'
                value={currentOwnerKey}
                onChange={(e) => setCurrentOwnerKey(e.target.value)}
              />
              <label style={label}>New owner key</label>
              <input
                style={input}
                type='password'
                value={newOwnerKey}
                onChange={(e) => setNewOwnerKey(e.target.value)}
              />
              <label style={label}>Confirm new owner key</label>
              <input
                style={input}
                type='password'
                value={confirmOwnerKey}
                onChange={(e) => setConfirmOwnerKey(e.target.value)}
              />
              <button type='submit' className='btn'>Update owner key</button>
            </form>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Enrollment key</h3>
            <p style={{ color: '#9ca3af', fontSize: '13px' }}>
              Give this to staff who create students, mentors, TAs, and instructors. Do not share the owner key. Current key ends with {maskedEnrollmentKey}.
            </p>
            <form onSubmit={handleChangeEnrollmentKey}>
              <label style={label}>Current owner key (required to change enrollment key)</label>
              <input
                style={input}
                type='password'
                value={enrollOwnerConfirm}
                onChange={(e) => setEnrollOwnerConfirm(e.target.value)}
              />
              <label style={label}>New enrollment key</label>
              <input
                style={input}
                type='password'
                value={newEnrollmentKey}
                onChange={(e) => setNewEnrollmentKey(e.target.value)}
              />
              <label style={label}>Confirm new enrollment key</label>
              <input
                style={input}
                type='password'
                value={confirmEnrollmentKey}
                onChange={(e) => setConfirmEnrollmentKey(e.target.value)}
              />
              <button type='submit' className='btn'>Update enrollment key</button>
            </form>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Billing</h3>
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>
              Coming soon. This is where tuition, invoices, or seat licenses will live.
            </p>
          </div>
        </>
      )}
    </div>
  );
}