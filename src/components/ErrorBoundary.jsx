// Catches render errors so a failure shows a readable message instead of a
// blank white page. Without this, one thrown error anywhere takes the whole app
// down silently — which is exactly what happened when Firebase was misconfigured
// on a preview deploy: HTTP 200, blank screen, no clue why.

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[FTFC] Unhandled error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        padding: 24, fontFamily: 'system-ui, sans-serif', lineHeight: 1.5,
        maxWidth: 480, margin: '40px auto', textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ marginBottom: 16, opacity: 0.75 }}>
          Try reloading. If it keeps happening, let an admin know.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px', borderRadius: 8, border: '1px solid #ccc',
            background: '#fff', cursor: 'pointer', font: 'inherit',
          }}
        >
          Reload
        </button>
        {import.meta.env.DEV && (
          <pre style={{
            marginTop: 24, textAlign: 'left', fontSize: 12, whiteSpace: 'pre-wrap',
            background: '#f5f5f5', padding: 12, borderRadius: 8, overflow: 'auto',
          }}>
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        )}
      </div>
    );
  }
}
