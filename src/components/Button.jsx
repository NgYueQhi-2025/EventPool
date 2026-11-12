import React from 'react';
import { Link } from 'react-router-dom';

// Renders a <Link> when `to` is given, otherwise a <button>.
export default function Button({ to, variant = 'primary', type = 'button', children, ...rest }) {
  const className = `btn${variant === 'secondary' ? ' btn--secondary' : ''}`;
  if (to) return <Link to={to} className={className} {...rest}>{children}</Link>;
  return <button type={type} className={className} {...rest}>{children}</button>;
}
