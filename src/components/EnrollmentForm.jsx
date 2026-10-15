import { useState } from 'react';

export default function EnrollmentForm({ users, onUserCreated }) {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        studentId: '',
        ownerKey: '',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (field) => (e) => {
        const value = e.target.value;
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        setIsSubmitting(true);

        try {
            await onUserCreated(
                users,
                formData.email,
                formData.password,
                'student',
                formData.ownerKey,
                formData.firstName,
                formData.lastName,
                formData.studentId
            );

            setSuccess(true);
            setFormData({
                firstName: '',
                lastName: '',
                email: '',
                password: '',
                studentId: '',
                ownerKey: '',
            });
        } catch (err) {
            setError(err?.message || 'Failed to create student account.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className='course-box'
            style={{ maxWidth: '500px', margin: '20px auto' }}
        >
            <h3 className='pf-title'>Enroll Individual Student</h3>
            <p className='help-text'>Authorized enrollment using Enrollment Key.</p>

            <form
                onSubmit={handleSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        className='input-wide'
                        placeholder='First Name'
                        value={formData.firstName}
                        onChange={handleChange('firstName')}
                        required
                        disabled={isSubmitting}
                    />
                    <input
                        className='input-wide'
                        placeholder='Last Name'
                        value={formData.lastName}
                        onChange={handleChange('lastName')}
                        required
                        disabled={isSubmitting}
                    />
                </div>

                <input
                    className='input-wide'
                    type='email'
                    placeholder='Student Email'
                    value={formData.email}
                    onChange={handleChange('email')}
                    required
                    disabled={isSubmitting}
                />

                <input
                    className='input-wide'
                    type='password'
                    placeholder='Temporary Password'
                    value={formData.password}
                    onChange={handleChange('password')}
                    required
                    disabled={isSubmitting}
                />

                <input
                    className="input-wide"
                    placeholder='Student ID (e.g. STU-101)'
                    value={formData.studentId}
                    onChange={handleChange('studentId')}
                    required
                    disabled={isSubmitting}
                />

                <hr style={{ borderColor: 'var(--pf-border)', margin: '10px 0' }} />

                <label className='help-text' style={{ color: 'var(--pf-fire)' }}>
                    Security Authorization
                </label>
                <input
                    className='input-wide'
                    type='password'
                    placeholder='Enter Enrollment Key'
                    value={formData.ownerKey}
                    onChange={handleChange('ownerKey')}
                    required
                    disabled={isSubmitting}
                    style={{ border: '1px solid var(--pf-fire)' }}
                />

                {error && (
                    <div
                        style={{ color: '#ef4444', fontSize: '14px', fontWeight: 'bold' }}
                    >
                        {error}
                    </div>
                )}

                {success && (
                    <div style={{ color: '#22c55e', fontSize: '14px', fontWeight: 'bold' }}
                    >
                        Student enrolled successfully!
                    </div>
                )}

                <button
                    className="btn"
                    type='submit'
                    disabled={isSubmitting}
                    style={{ marginTop: '10px' }}
                >
                    {isSubmitting ? 'Create Account...' : 'Create Student Account'}
                </button>
            </form>
        </div>
    );
}