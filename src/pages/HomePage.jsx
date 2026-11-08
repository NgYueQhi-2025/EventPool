import React from 'react';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';

export default function HomePage() {
  return (
    <main className="container">
      <PageHeader title="EventPool" subtitle="Borrow and lend event resources between UM clubs." />
      <Button to="/marketplace">Browse marketplace</Button>{' '}
      <Button to="/login" variant="secondary">Log in</Button>{' '}
      <Button to="/dashboard" variant="secondary">Open Owner Dashboard</Button>
    </main>
  );
}
