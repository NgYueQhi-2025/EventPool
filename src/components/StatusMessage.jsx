import React from 'react';

// type: 'loading' | 'error' | 'success' | 'empty'
const defaults = {
  loading: 'Loading...',
  error: 'Something went wrong.',
  success: 'Done.',
  empty: 'Nothing to show yet.',
};

export default function StatusMessage({ type = 'loading', children }) {
  const cls = type === 'error' ? ' status--error' : type === 'success' ? ' status--success' : '';
  return (
    <div className={`status${cls}`} role={type === 'error' ? 'alert' : 'status'}>
      {children ?? defaults[type]}
    </div>
  );
}
