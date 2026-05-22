import React, { Component } from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error caught by boundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', background: '#fff', color: '#ff4d4f', border: '2px solid #ff4d4f', borderRadius: '12px', margin: '20px', fontFamily: 'monospace', maxWidth: '800px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 'bold' }}>Hệ thống gặp lỗi nghiêm trọng (React Crash)</h2>
          <p style={{ margin: '0 0 12px 0' }}><strong>Thông tin lỗi:</strong> {this.state.error ? this.state.error.message : 'Unknown'}</p>
          <pre style={{ background: '#f8f9fa', padding: '12px', overflowX: 'auto', border: '1px solid #e9ecef', borderRadius: '6px', fontSize: '12px', color: '#333' }}>
            {this.state.error ? this.state.error.stack : ''}
          </pre>
          <pre style={{ background: '#f8f9fa', padding: '12px', overflowX: 'auto', border: '1px solid #e9ecef', borderRadius: '6px', fontSize: '12px', color: '#333', marginTop: '12px' }}>
            {this.state.errorInfo ? this.state.errorInfo.componentStack : ''}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: '8px 16px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '12px', fontWeight: 'bold' }}
          >
            Tải lại trang (Reload)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
