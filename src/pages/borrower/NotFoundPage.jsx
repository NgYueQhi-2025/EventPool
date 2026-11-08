import React from 'react';
import PageHeader from '../../components/PageHeader';
import Button from '../../components/Button';

export default function NotFoundPage() {
  return (
    <main className="container">
      <PageHeader title="Page not found" subtitle="The page you are looking for does not exist." />
      <Button to="/">Back to home</Button>
    </main>
  );
}
