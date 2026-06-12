import { useState } from 'react';

export default function NameEntry({ onSave, initialName = '', onClose }) {
  const isEdit = Boolean(initialName);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setError('Please enter your full name (at least 2 characters)');
      return;
    }
    onSave(trimmed);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-icon-wrap">⚽</div>
        <h2 className="modal-title">
          {isEdit ? 'Edit your name' : 'Welcome to FTFC!'}
        </h2>
        <p className="modal-subtitle">
          {isEdit
            ? 'Update the name shown on the roll call.'
            : 'Enter your name to join pickup soccer'}
        </p>
        <form onSubmit={handleSubmit}>
          <input
            className="form-input"
            type="text"
            placeholder="Your full name"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            autoFocus
          />
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-full">
            {isEdit ? 'Save changes' : 'Save & Continue'}
          </button>
          {isEdit && onClose && (
            <button
              type="button"
              className="btn btn-ghost btn-full"
              onClick={onClose}
              style={{ marginTop: 8 }}
            >
              Cancel
            </button>
          )}
        </form>
        <p className="modal-note">
          {isEdit
            ? 'Your name is saved to this device.'
            : 'Your name is saved to this device permanently.'}
        </p>
      </div>
    </div>
  );
}
