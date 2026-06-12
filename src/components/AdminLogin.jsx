import { useState } from 'react';

const ADMIN_PIN = 'ftfc2025';

export default function AdminLogin({ onLogin, onClose }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      onLogin(true);
    } else {
      setError('Incorrect PIN. Try again.');
      setPin('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon-wrap">🔐</div>
        <h2 className="modal-title">Admin Login</h2>
        <form onSubmit={handleSubmit}>
          <input
            className="form-input"
            type="password"
            placeholder="Enter admin PIN"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(''); }}
            autoFocus
          />
          {error && <p className="form-error">{error}</p>}
          <div className="btn-row">
            <button type="submit" className="btn btn-primary">Login</button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
