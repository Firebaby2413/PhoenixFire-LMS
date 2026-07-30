import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [view, setView] = useState('signin'); // 'signin' | 'create' | 'forgot'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(
    'What was the name of your first pet?'
  );
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [role, setRole] = useState('student');

  if (!isOpen) return null;

  const resetFeedback = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  const switchView = (newView) => {
    resetFeedback();
    setView(newView);
  };

  // 1. Sign In Handler
  const handleSignIn = async (e) => {
    e.preventDefault();
    resetFeedback();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setLoading(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      onAuthSuccess(data.user);
      onClose();
    }
  };

  // 2. Sign Up Handler (Supabase Auth + Metadata / Profile Insert)
  const handleSignUp = async (e) => {
    e.preventDefault();
    resetFeedback();

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);

    // Sign up the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          student_id: studentId,
          role: role
        }
      }
    });

    if (authError) {
      setLoading(false);
      setErrorMsg(authError.message);
      return;
    }

    // Insert extra profile details into a public 'profiles' table
    if (authData.user) {
      const { error: profileError } = await supabase.from('profiles').insert([
        {
          id: authData.user.id,
          first_name: firstName,
          last_name: lastName,
          student_id: studentId,
          security_question: securityQuestion,
          security_answer: securityAnswer, // Note: Hash or secure in production
          role: role
        }
      ]);

      if (profileError) {
        setErrorMsg(
          'Account created, but profile failed to save: ' + profileError.message
        );
      } else {
        setSuccessMsg(
          'Account created successfully! Check your email for verification.'
        );
        setTimeout(() => switchView('signin'), 2000);
      }
    }

    setLoading(false);
  };

  // 3. Reset Password Handler
  const handleResetPassword = async (e) => {
    e.preventDefault();
    resetFeedback();

    if (!email) {
      setErrorMsg('Please enter your account email.');
      return;
    }

    setLoading(true);

    // Send password reset email via Supabase Auth
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg('Password reset link sent to your email.');
    }
  };

  return (
    <div className='modal-overlay'>
      <div className='modal-content'>
        {errorMsg && <div className='alert alert-error'>{errorMsg}</div>}
        {successMsg && <div className='alert alert-success'>{successMsg}</div>}

        {/* --- SIGN IN VIEW --- */}
        {view === 'signin' && (
          <form onSubmit={handleSignIn}>
            <h2>Sign In</h2>
            <input
              className='input-wide'
              type='email'
              placeholder='Email'
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className='input-wide'
              type='password'
              placeholder='Password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button className='btn' type='submit' disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>

            <div className='auth-links'>
              <button
                type='button'
                className='btn-link'
                onClick={() => switchView('create')}
              >
                Create Account
              </button>
              <button
                type='button'
                className='btn-link'
                onClick={() => switchView('forgot')}
              >
                Forgot Password?
              </button>
            </div>
          </form>
        )}

        {/* --- CREATE ACCOUNT VIEW --- */}
        {view === 'create' && (
          <form onSubmit={handleSignUp}>
            <h2>Create Account</h2>

            <input
              className='input-wide'
              type='text'
              placeholder='First Name'
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              className='input-wide'
              type='text'
              placeholder='Last Name'
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <input
              className='input-wide'
              type='email'
              placeholder='Email'
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className='input-wide'
              type='text'
              placeholder='Student / Member ID'
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
            <input
              className='input-wide'
              type='password'
              placeholder='Password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              className='input-wide'
              type='password'
              placeholder='Confirm Password'
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <select
              className='input-wide'
              value={securityQuestion}
              onChange={(e) => setSecurityQuestion(e.target.value)}
            >
              <option value='What was the name of your first pet?'>
                What was the name of your first pet?
              </option>
              <option value='What city were you born in?'>
                What city were you born in?
              </option>
              <option value='What was your first car?'>
                What was your first car?
              </option>
            </select>

            <input
              className='input-wide'
              type='text'
              placeholder='Security Answer'
              required
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
            />

            <select
              className='input-wide'
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value='student'>Student</option>
              <option value='mentor'>Mentor</option>
              <option value='admin'>Admin</option>
            </select>

            <button className='btn' type='submit' disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
            <button
              type='button'
              className='btn-secondary'
              onClick={() => switchView('signin')}
            >
              Back
            </button>
          </form>
        )}

        {/* --- FORGOT PASSWORD VIEW --- */}
        {view === 'forgot' && (
          <form onSubmit={handleResetPassword}>
            <h2>Reset Password</h2>
            <p
              style={{
                fontSize: '0.85em',
                color: '#cbd5e1',
                marginBottom: '10px'
              }}
            >
              Enter your registered email to receive a password reset link.
            </p>

            <input
              className='input-wide'
              placeholder='Account Email'
              type='email'
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <button className='btn' type='submit' disabled={loading}>
              {loading ? 'Sending Link...' : 'Send Reset Link'}
            </button>

            <button
              type='button'
              className='btn-secondary'
              onClick={() => switchView('signin')}
            >
              Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
