// Rules & code of conduct — reached from the top-left nav button, which switches
// to the back variant here (see TopNav). Built pixel-exact from Figma 2965:5407.
//
// Content is the polished copy from the design. The "Emergency contacts" list is
// mocked for now — real data comes from the admin roster once identity lands.

import PlayerRow from '../components/PlayerRow';
import calendarIcon from '../assets/icons/calendar.svg';
import locationIcon from '../assets/icons/location.svg';
import clockIcon from '../assets/icons/clock.svg';
import dropIcon from '../assets/icons/strike-drop.svg';
import noshowIcon from '../assets/icons/strike-noshow.svg';
import studsIcon from '../assets/icons/strike-studs.svg';
import plusOneIcon from '../assets/icons/strike-plusone.svg';
import sampleAvatar from '../assets/sample-avatar.png';

// 18px Bold section title — sits between the type-heading-h2 (28) and body (16)
// tokens, so it's composed directly from the primitives.
const sectionTitle = {
  fontFamily: 'var(--font-family-base)',
  fontWeight: 'var(--font-weight-bold)',
  fontSize: 18,
  lineHeight: 'normal',
  color: 'var(--color-dark-gray)',
};

const bold = { fontWeight: 'var(--font-weight-bold)' };

// A titled section: 16px gap between the title and its body.
function Section({ title, children }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      <h2 style={sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

// One icon + text row (24px vertical padding), with hairline dividers between.
function IconItem({ icon, children, underline }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '24px 0', width: '100%' }}>
      <img src={icon} alt="" style={{ width: 24, height: 24, flexShrink: 0 }} />
      <p
        className="type-body-regular"
        style={{ flex: '1 0 0', minWidth: 0, color: 'var(--color-dark-gray)', textDecoration: underline ? 'underline' : 'none' }}
      >
        {children}
      </p>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--color-tan)', width: '100%' }} />;
}

// Renders a list of IconItems interleaved with dividers.
function ItemList({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {items.map((it, i) => (
        <div key={i}>
          <IconItem icon={it.icon} underline={it.underline}>{it.node}</IconItem>
          {i < items.length - 1 && <Divider />}
        </div>
      ))}
    </div>
  );
}

const strikeConsequences = [
  ['1st strike', '1 week ban'],
  ['2nd strike', '2 weeks ban'],
  ['3rd strike', '4 weeks ban'],
  ['4th strike', '8 weeks ban'],
  ['5th strike', 'Rest of the year'],
];

// Mock — real emergency contacts come from the admin roster. Photo/initials mix
// mirrors the design (most have a photo; one falls back to initials).
const emergencyContacts = [
  { id: 'ec1', name: 'Sam Herzog', photoURL: sampleAvatar },
  { id: 'ec2', name: 'Elle', photoURL: sampleAvatar },
  { id: 'ec3', name: 'Mikey Gries', photoURL: sampleAvatar },
  { id: 'ec4', name: 'John Colver', photoURL: sampleAvatar },
  { id: 'ec5', name: 'Keith Lang', photoURL: null },
  { id: 'ec6', name: 'Eddie Guo', photoURL: sampleAvatar },
  { id: 'ec7', name: 'Felipe Di Carli', photoURL: sampleAvatar },
  { id: 'ec8', name: 'Euan Watson', photoURL: sampleAvatar },
];

export default function RulesScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, padding: '8px 20px 40px', color: 'var(--color-dark-gray)' }}>
      <h1 className="type-heading-h2" style={{ paddingRight: 24 }}>Rules &amp; Code of conduct</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
        <Section title="Schedule & location">
          <ItemList items={[
            { icon: calendarIcon, node: 'Monday – Friday 7:00 AM' },
            { icon: locationIcon, node: 'McCarren Park, BK', underline: true },
          ]} />
        </Section>

        <Section title="Roll call">
          <ItemList items={[
            { icon: clockIcon, node: <>Opens at <span style={bold}>3 PM</span> the day before</> },
            { icon: clockIcon, node: <>Drop deadline at <span style={bold}>9 PM</span> the night before</> },
          ]} />
        </Section>

        <Section title="What results in a strike?">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <ItemList items={[
              { icon: dropIcon, node: 'Dropping out: After 9PM deadline or the morning of the game.' },
              { icon: noshowIcon, node: 'No-show or arriving late disrupting play' },
              { icon: studsIcon, node: 'Playing with studs (Dangerous play)' },
              { icon: plusOneIcon, node: 'Your +1 commits any of the above' },
            ]} />
            {/* Sick note */}
            <div
              style={{
                background: 'var(--color-tan)', borderRadius: 16, padding: 16,
                color: 'var(--color-dark-gray)', fontSize: 14, lineHeight: '16px',
                fontFamily: 'var(--font-family-base)',
              }}
            >
              <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>Feeling sick? </span>
              <span style={{ fontWeight: 'var(--font-weight-regular)' }}>
                Contact an admin ASAP. You’ll receive a 1-week ban, but no strike added.
              </span>
            </div>
          </div>
        </Section>

        <Section title="Strike consequences">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {/* 5×2 cream cells on 2px olive gaps; only the outer corners are rounded */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, width: '100%' }}>
              {strikeConsequences.flatMap(([label, value], r) => {
                const last = r === strikeConsequences.length - 1;
                const cell = {
                  background: 'var(--color-cream)', padding: '8px 12px',
                  display: 'flex', alignItems: 'center',
                };
                return [
                  <div key={`${r}l`} style={{ ...cell,
                    borderTopLeftRadius: r === 0 ? 8 : 0, borderBottomLeftRadius: last ? 8 : 0 }}>
                    <span className="type-small-regular">{label}</span>
                  </div>,
                  <div key={`${r}r`} style={{ ...cell,
                    borderTopRightRadius: r === 0 ? 8 : 0, borderBottomRightRadius: last ? 8 : 0 }}>
                    <span className="type-small-regular">{value}</span>
                  </div>,
                ];
              })}
            </div>
            <p className="type-small-regular" style={{ color: 'var(--color-dark-gray)' }}>
              Strikes reset every January 1st.
            </p>
          </div>
        </Section>

        <Section title="Emergency contacts (Admins)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            {emergencyContacts.map((c) => (
              <PlayerRow key={c.id} name={c.name} photoURL={c.photoURL} />
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
