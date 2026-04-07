/**
 * Toast Notification Component
 * Shows success/error/loading messages that auto-dismiss
 */
import React, { useEffect } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'loading' | 'info';
  message: string;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (toast.type !== 'loading') {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.type, onDismiss]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'loading':
        return '⟳';
      default:
        return 'ℹ';
    }
  };

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return { backgroundColor: '#10b981', color: '#fff' };
      case 'error':
        return { backgroundColor: '#ef4444', color: '#fff' };
      case 'loading':
        return { backgroundColor: '#3b82f6', color: '#fff' };
      default:
        return { backgroundColor: '#6b7280', color: '#fff' };
    }
  };

  return (
    <div
      style={{
        padding: '12px 20px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        animation: 'slideIn 0.3s ease-out',
        cursor: toast.type !== 'loading' ? 'pointer' : 'default',
        ...getStyles(),
      }}
      onClick={() => toast.type !== 'loading' && onDismiss(toast.id)}
    >
      <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{getIcon()}</span>
      <span style={{ fontSize: '14px', fontWeight: 500 }}>{toast.message}</span>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <Toast toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
