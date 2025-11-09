/**
 * Login.js
 * Login page for users with existing accounts.
 * Includes validation, error handling, and links to signup.
 * Theme: lightblue/darkblue/grey.
 * AUTHORS: Victor, Success, David
 */
// React imports and styles
// loginUser: API helper to send login requests (currently mocked if backend is off)
/**
 * Login component
 * Handles form state, validation, and submission.
 * Shows error messages and navigates to home on success.
 */
  // Handles input changes and resets error
  // Handles form submission, calls loginUser, and manages loading/error states
  // Renders login form, error messages, and link to signup
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Signup.css';
import { loginUser } from '../utils/api';
import { cacheUser } from '../utils/userStorage';
import logo from '../assets/Axis_logo.png';

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await loginUser(form);
      if (res?.ok) {
        cacheUser(res.user);
        navigate('/dashboard');
      } else {
        setError(res?.message || 'Invalid credentials.');
      }
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
        <h2 className="auth-title">Welcome back</h2>
        <form className="signup-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
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
              placeholder="Your password"
              required
            />
          </label>
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Log in'}
          </button>
        </form>
        <p className="auth-switch">
          New here? <Link to="/" className="link">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
