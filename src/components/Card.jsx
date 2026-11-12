import React from 'react';

export default function Card({ title, children }) {
  return (
    <article className="card">
      {title && <h3 className="card__title">{title}</h3>}
      {children}
    </article>
  );
}
