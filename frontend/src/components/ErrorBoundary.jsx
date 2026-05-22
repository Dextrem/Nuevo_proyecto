import { Component } from 'react';
import { Link } from 'react-router-dom';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleHardReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      }
      
      sessionStorage.clear();
      localStorage.removeItem('finandex_settings'); // Limpiar settings por si acaso
      
      window.location.reload(true);
    } catch (e) {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <div className="error-icon">⚠️</div>
            <h1>Algo salió mal</h1>
            <p className="error-message">
              {this.state.error?.message || 'Ha ocurrido un error inesperado'}
            </p>
            {this.state.errorInfo && (
              <details className="error-details">
                <summary>Detalles técnicos</summary>
                <pre style={{ fontSize: '0.7rem', textAlign: 'left', background: '#f4f4f4', padding: '10px' }}>
                  {this.state.error?.stack}
                </pre>
              </details>
            )}
            <div className="error-actions">
              <button onClick={this.handleHardReload} className="btn-reload" style={{ background: 'var(--danger)', color: 'white' }}>
                🧹 Limpiar Caché y Forzar Recarga
              </button>
              <button onClick={this.handleReload} className="btn-reload">
                🔄 Recargar página
              </button>
              <Link to="/login" className="btn-login" onClick={() => this.setState({ hasError: false })}>
                🔐 Ir al Login
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
