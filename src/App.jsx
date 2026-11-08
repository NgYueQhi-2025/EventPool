import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import './App.css';

const ownerPages = [
  { path: '/club/:clubId', link: '/club/club-001', title: 'Club Profile' },
  { path: '/dashboard/resources', title: 'Resource Management' },
  { path: '/dashboard/requests', title: 'Request Approvals' },
  { path: '/dashboard/returns', title: 'Return Verification' },
  { path: '/sustainability', title: 'Sustainability Dashboard' },
];

function OwnerDashboardPage() {
  return (
    <main className="container">
      <h1>Owner Dashboard</h1>
      <p>Week 5 page skeletons</p>
      <nav aria-label="Owner pages">
        <ul>
          {ownerPages.map(({ path, link, title }) => (
            <li key={path}><Link to={link ?? path}>{title}</Link></li>
          ))}
        </ul>
      </nav>
      <Link to="/">Back to EventPool</Link>
    </main>
  );
}

function OwnerPlaceholder({ title }) {
  return (
    <main className="container">
      <h1>{title}</h1>
      <p>Week 5 placeholder</p>
      <Link to="/dashboard">Back to Owner Dashboard</Link>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dashboard" element={<OwnerDashboardPage />} />
      {ownerPages.map(({ path, title }) => (
        <Route key={path} path={path} element={<OwnerPlaceholder title={title} />} />
      ))}
    </Routes>
  );
}
