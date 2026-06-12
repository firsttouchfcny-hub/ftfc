import { useState } from 'react';

export default function Rules() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rules-card">
      <button className="rules-toggle" onClick={() => setOpen(!open)}>
        <span>📋 Rules &amp; Code of Conduct</span>
        <span className="rules-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="rules-body">
          <h4>Schedule</h4>
          <ul>
            <li>📅 Monday – Friday &amp; Weekends at McCarren Park, Brooklyn</li>
            <li>⏰ Kickoff at <strong>7:00 AM</strong></li>
            <li>📢 Roll call opens at <strong>3:00 PM the day before</strong></li>
            <li>⛔ Drop deadline: <strong>9:00 PM the night before</strong></li>
          </ul>

          <h4>What Earns a Strike</h4>
          <ul>
            <li>Dropping the morning of the game</li>
            <li>No-show (didn't drop and didn't show)</li>
            <li>Late arrival that disrupts play</li>
            <li>Playing with studs (dangerous play)</li>
            <li>Dropping after the 9:00 PM deadline</li>
            <li>Bad +1 (guest caused problems)</li>
            <li>Getting sick and dropping after 9:00 PM</li>
          </ul>

          <div className="rules-note">
            <strong>🤧 Waking up sick:</strong> Text an admin ASAP. 1-week ban applies, but <em>no strike</em> is added to your record.
          </div>

          <h4>Strike Consequences</h4>
          <table className="strike-table">
            <thead>
              <tr><th>Strike</th><th>Ban</th></tr>
            </thead>
            <tbody>
              <tr><td>1st</td><td>1 week</td></tr>
              <tr><td>2nd</td><td>2 weeks</td></tr>
              <tr><td>3rd</td><td>4 weeks</td></tr>
              <tr><td>4th</td><td>8 weeks</td></tr>
              <tr><td>5th+</td><td>Rest of year</td></tr>
            </tbody>
          </table>

          <div className="rules-note">
            ♻️ All strikes reset on <strong>January 1st</strong> each year.
          </div>

          <h4>Emergency Contacts (Admins)</h4>
          <ul className="contacts">
            <li>Sam</li>
            <li>Elle</li>
            <li>Mikey</li>
            <li>Colver</li>
            <li>Keith</li>
            <li>Eddie</li>
            <li>Felipe</li>
            <li>Euan</li>
            <li>Cris</li>
          </ul>
        </div>
      )}
    </div>
  );
}
