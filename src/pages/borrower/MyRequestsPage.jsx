import React from 'react';
import PageHeader from '../../components/PageHeader';
import StatusMessage from '../../components/StatusMessage';

export default function MyRequestsPage() {
  return (
    <main className="container">
      <PageHeader title="My Requests" subtitle="Track the status of your borrow requests." />
      <p className="skeleton-note">Skeleton - request history and status indicators arrive in Sprint 2.</p>
      <StatusMessage type="empty">You have no requests yet.</StatusMessage>
    </main>
  );
}
