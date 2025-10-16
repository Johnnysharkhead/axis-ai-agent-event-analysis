/**
 * Signup.js
 * Signup page for new users to create an account.
 * Includes validation, error handling, and links to login.
 * Theme: lightblue/darkblue/grey.
 * AUTHORS: Victor, Success, David
 */
// React imports and styles
// signupUser: API helper to send signup requests (currently mocked if backend is off)
/**
 * Signup component
 * Handles form state, validation, and submission.
 * Shows success message and link to login after signup.
 */
	// Handles input changes and resets error
	// Validates form fields before submission
	// Handles form submission, calls signupUser, and manages loading/error/success states
	// Renders signup form, error messages, and success state

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Signup.css';
import { signupUser } from '../utils/api';
import logo from '../assets/Axis_logo.png';

function Signup() {
	const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '', inviteKey: '' });
	const [submitted, setSubmitted] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const handleChange = (e) => {
		setForm({ ...form, [e.target.name]: e.target.value });
		setError('');
	};

	const validate = () => {
		if (!form.username || !form.email || !form.password || !form.inviteKey) return 'All fields are required.';
		// Very basic email check
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email address.';
		if (form.password.length < 6) return 'Password must be at least 6 characters.';
		if (form.password !== form.confirm) return 'Passwords do not match.';
		return '';
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		const v = validate();
		if (v) {
			setError(v);
			return;
		}
		setLoading(true);
		try {
			const res = await signupUser({
				username: form.username,
				email: form.email,
				password: form.password,
				invite_key: form.inviteKey
	});
			if (res?.ok) setSubmitted(true);
			else setError(res?.message || 'Could not sign up right now.');
		} catch (err) {
			setError('Unexpected error. Please try again.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="auth-page">
			<div className="auth-card">
				<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
					<img src={logo} alt="Axis Communications" style={{ height: 36 }} />
					<div style={{ lineHeight: 1.1 }}>
						<div style={{ fontWeight: 700 }}>Axis Analytics</div>
						<div style={{ fontSize: 12, color: '#666' }}>SaaS Platform</div>
					</div>
				</div>	
				<h2 className="auth-title">Create your account</h2>
				{submitted ? (
					<div className="signup-success">
						<p>Thank you for signing up!</p>
						<p>
							You can now <Link to="/login" className="link">log in</Link>.
						</p>
					</div>
				) : (
					<form className="signup-form" onSubmit={handleSubmit} noValidate>
						{error && <div className="auth-error">{error}</div>}

						<label>
							Username
							<input
								type="text"
								name="username"
								value={form.username}
								onChange={handleChange}
								placeholder="Your username"
								required
							/>
						</label>

						<label>
							Email
							<input
								type="email"
								name="email"
								value={form.email}
								onChange={handleChange}
								placeholder="name@example.com"
								required
							/>
						</label>

						<label>
							Password
							<input
								type="password"
								name="password"
								value={form.password}
								onChange={handleChange}
								placeholder="At least 6 characters"
								required
							/>
						</label>

						<label>
							Confirm password
							<input
								type="password"
								name="confirm"
								value={form.confirm}
								onChange={handleChange}
								placeholder="Repeat your password"
								required
							/>
						</label>
						<label>
							Invite Key
							<input
								type="text"
								name="inviteKey"
								value={form.inviteKey}
								onChange={handleChange}
								placeholder="Enter your invite key"
								required
							/>
						</label>

						<button type="submit" className="primary-btn" disabled={loading}>
							{loading ? 'Creating account…' : 'Sign up'}
						</button>
					</form>
				)}
				{!submitted && (
					<p className="auth-switch">
						Already have an account?{' '}
						<Link to="/login" className="link">Log in</Link>
					</p>
				)}
			</div>
		</div>
	);
}

export default Signup;
