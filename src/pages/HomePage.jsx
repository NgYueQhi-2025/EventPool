import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <main className="container">
      <h1>EventPool</h1>
      <p>Week 5 placeholder</p>
      <Link to="/dashboard">Open Owner Dashboard</Link>
    </main>
  );
}
