import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReload = () => {
    location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0f',
            color: 'rgba(255, 255, 255, 0.85)',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            padding: 24,
            textAlign: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(255, 77, 79, 0.15), rgba(255, 77, 79, 0.08))',
              border: '1px solid rgba(255, 77, 79, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 24, fontWeight: 800, color: '#ff4d4f' }}>!</span>
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: 'rgba(255, 255, 255, 0.9)',
              letterSpacing: -0.3,
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'rgba(255, 255, 255, 0.45)',
              maxWidth: 320,
              lineHeight: 1.5,
            }}
          >
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              marginTop: 8,
              padding: '10px 28px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #7c5cfc 0%, #5b8def 100%)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: 0.3,
              boxShadow: '0 4px 16px rgba(124, 92, 252, 0.3)',
              transition: 'transform 0.15s ease',
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
