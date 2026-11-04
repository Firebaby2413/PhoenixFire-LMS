import { useState } from 'react';
import phoenixLogo from '../assets/Images/phoenix.jpg';

export default function AuthScreen({ view, setView, onSignIn, onCreate, onResetPassword, theme, setTheme }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [role, setRole] = useState('student');
  const [ownerKey, setOwnerKey] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const handleSignInSubmit = (e) => {
    e.preventDefault();
    onSignIn(email, password);
  };

  const handleResetSubmit = (e) => {
    e.preventDefault();
    onResetPassword(email);
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    onCreate(email, password, role, ownerKey, {
      firstName,
      lastName, 
      studentId,
      securityQuestion,
      securityAnswer,
    });
  };

  return (
    <div id='auth-container'>
      <div id='auth-card'>
        <button
          type='button'
          className='theme-toggle'
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>

        <img
          src={phoenixLogo}
          alt='Phoenix Fire Technical Academy'
          className='auth-logo'
        />
        <h1 className='app-title'>Phoenix Fire Technical Academy</h1>

        {view === 'signin' && (
          <form onSubmit={handleSignInSubmit}>
            <h2>Sign In</h2>
            <input
              className='input-wide'
              placeholder='Email'
              type='email'
              autoComplete='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className='input-wide'
              type='password'
              placeholder='Password'
              autoComplete='current-password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type='submit' className='btn'>
              Sign in 
            </button>
            <button type='button' className='btn-secondary' onClick={() => setView('forgot')}>
              Forgot password?
            </button>
            <button type='button' className='btn-secondary' onClick={() => setView('create')}>
              Create Account
            </button>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleResetSubmit}>
            <h2>Reset Password</h2>
            <input
              className='input-wide'
              placeholder='Email'
              type='email'
              autoComplete='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type='submit' className='btn'>
              Email Reset Link
            </button>
            <button type='button' className='btn-secondary' onClick={() => setView('signin')}>
              Back to Sign In
            </button>
          </form>
        )}

        {view === 'create' && (
          <form onSubmit={handleCreateSubmit}>
            <h2>Create Account</h2>
            <input
              className='input-wide'
              placeholder='First Name'
              autoComplete='given-name'
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              className='input-wide'
              placeholder='Last Name'
              autoComplete='family-name'
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <input
              className='input-wide'
              placeholder='Student ID'
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
            <input
              className='input-wide'
              placeholder='Email'
              type='email'
              autoComplete='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className='input-wide'
              type='password'
              placeholder='Password'
              autoComplete='new-password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <select
              className='input-wide'
              value={securityQuestion}
              onChange={(e) => setSecurityQuestion(e.target.value)}
            >
              <option value=''>Select Security Question</option>
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
              placeholder='Security Answer'
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
            />
            <select
              className='input-wide'
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value='student'>Student</option>
              <option value='ta'>TA</option>
              <option value='instructor'>Instructor</option>
              <option value='mentor'>Mentor</option>
              <option value='admin'>Admin</option>
            </select>
            <input
              className='input-wide'
              placeholder={role === 'admin' ? 'Owner Key' : 'Enrollment Key'}
              value={ownerKey}
              onChange={(e) => setOwnerKey(e.target.value)}
            />
            <button type='submit' className='btn'>
              Create Account
            </button>
            <button type='button' className='btn-secondary' onClick={() => setView('signin')}>
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}