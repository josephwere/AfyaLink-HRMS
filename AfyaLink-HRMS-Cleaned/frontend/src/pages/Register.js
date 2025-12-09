import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function Register({ onRegister, toggleLogin, currentRole, editingStaff }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient'); // default
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');

  const backendURL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
  const apiBase = `${backendURL}/api`;

  // Pre-fill form if editing
  useEffect(() => {
    if (editingStaff) {
      setName(editingStaff.name || '');
      setEmail(editingStaff.email || '');
      setRole(editingStaff.role || 'patient');
      setPassword(''); // leave password blank
    }
  }, [editingStaff]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setSuccess('');

    try {
      const payload = { name, email, role };
      if (password) payload.password = password; // only send if changed

      let res;
      if (editingStaff) {
        res = await axios.put(`${apiBase}/auth/users/${editingStaff._id}`, payload, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setSuccess(`${role.charAt(0).toUpperCase() + role.slice(1)} updated successfully!`);
      } else {
        res = await axios.post(
          `${apiBase}/auth/register`,
          { ...payload, password },
          { headers: { 'Content-Type': 'application/json' } }
        );

        if (res.data?.token) {
          // Auto-login for normal users or keep token for admin-created users
          if (currentRole === 'patient' || !currentRole) {
            localStorage.setItem('token', res.data.token);
            onRegister(res.data.token);
            return;
          } else {
            setSuccess(`${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully!`);
          }
        } else {
          setSuccess('Registration successful! You can now log in.');
        }
      }

      setName('');
      setEmail('');
      setPassword('');
      setRole(currentRole === 'superadmin' ? 'hospitaladmin' : currentRole === 'hospitaladmin' ? 'doctor' : 'patient');
      onRegister();
    } catch (error) {
      console.error('Registration error:', error.response || error);
      setErr(error.response?.data?.msg || 'Registration failed');
    }
  };

  // Role options based on currentRole
  const roleOptions = () => {
    if (currentRole === 'superadmin') return ['hospitaladmin'];
    if (currentRole === 'hospitaladmin') return ['doctor', 'nurse', 'labtech'];
    return ['patient']; // normal users
  };

  return (
    <div className="container">
      <div className="card">
        <h2>{editingStaff ? 'Edit Staff' : 'Register'} {currentRole ? `(${currentRole})` : ''}</h2>

        {err && <div style={{ color: 'red', marginBottom: 10 }}>{err}</div>}
        {success && <div style={{ color: 'green', marginBottom: 10 }}>{success}</div>}

        <form onSubmit={submit}>
          <label>Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Full name"
            required
          />

          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            required
          />

          <label>Password {editingStaff ? '(leave blank to keep current)' : ''}</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            required={!editingStaff}
          />

          <label>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} required>
            {roleOptions().map((r, i) => (
              <option key={i} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>

          <button type="submit" className="button gradient-blue">
            {editingStaff ? 'Update' : 'Register'}
          </button>
        </form>

        {!currentRole && !editingStaff && (
          <p style={{ marginTop: 10 }}>
            Already have an account?{' '}
            <button type="button" onClick={toggleLogin} className="link-btn">
              Login
            </button>
          </p>
        )}
      </div>

      <style>{`
        .container {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: 40px;
        }
        .card {
          width: 100%;
          max-width: 420px;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          background: rgba(255,255,255,0.9);
        }
        .card h2 {
          text-align: center;
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-top: 10px;
          margin-bottom: 4px;
          font-weight: 500;
        }
        input, select {
          width: 100%;
          padding: 8px;
          border-radius: 6px;
          border: 1px solid #ccc;
          margin-bottom: 10px;
        }
        .button {
          width: 100%;
          padding: 10px;
          border-radius: 6px;
          border: none;
          background: #4f46e5;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          margin-top: 10px;
        }
        .button:hover {
          background: #3730a3;
        }
        .link-btn {
          background: none;
          border: none;
          color: #4f46e5;
          cursor: pointer;
          text-decoration: underline;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
