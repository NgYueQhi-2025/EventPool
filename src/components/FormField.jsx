import React, { useId } from 'react';

// Labelled input with inline validation message. `as` can be 'input', 'select' or 'textarea'.
export default function FormField({ label, error, as: Tag = 'input', children, ...rest }) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <Tag id={id} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? errorId : undefined} {...rest}>
        {children}
      </Tag>
      {error && <span id={errorId} className="field__error" role="alert">{error}</span>}
    </div>
  );
}
