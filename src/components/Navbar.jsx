import React from 'react';
import { Link, NavLink } from 'react-router-dom';

const links = [
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/requests', label: 'My Requests' },
  { to: '/dashboard', label: 'Owner Dashboard' },
  { to: '/login', label: 'Log in' },
];

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__brand">EventPool</Link>
        <nav aria-label="Main">
          <ul className="navbar__links">
            {links.map(({ to, label }) => (
              <li key={to}>
                <NavLink to={to} className={({ isActive }) => (isActive ? 'active' : undefined)}>{label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
