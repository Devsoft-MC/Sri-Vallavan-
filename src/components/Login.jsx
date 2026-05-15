import React, { useState } from 'react';
import API_BASE_URL from '../api';
import { saveAuth } from '../auth';
import './HomePage.css';

const Login = ({ onLogin }) => {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.username.trim() || !form.password.trim()) {
      setError('Enter your user name and password.');
      return;
    }

    setSubmitting(true);
    setError('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 404) {
          setError('Login API not found. Deploy and restart the VPS backend.');
          return;
        }

        setError(data.error || 'Invalid user name or password.');
        return;
      }

      saveAuth(data);
      onLogin();
    } catch (err) {
      setError(
        err.name === 'AbortError'
          ? 'Login server did not respond. Check VPS/network access.'
          : 'Unable to reach the login server.'
      );
    } finally {
      clearTimeout(timeoutId);
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="login-mark">SV</span>
          <div>
            <p className="login-eyebrow">Sri Vallavan</p>
            <h1 id="login-title">Sign in</h1>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="username">User name</label>
          <input
            id="username"
            name="username"
            type="text"
            value={form.username}
            onChange={handleChange}
            autoComplete="username"
            autoFocus
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
          />

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default Login;
