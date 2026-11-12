import React from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import Button from '../../components/Button';

export default function ResourceDetailsPage() {
  const { resourceId } = useParams();
  return (
    <main className="container">
      <PageHeader title="Resource Details" subtitle={`Resource ID: ${resourceId}`} />
      <p className="skeleton-note">Skeleton - name, images, quantity and owner club come from Firestore.</p>
      <Button to={`/marketplace/${resourceId}/request`}>Request to borrow</Button>{' '}
      <Button to="/marketplace" variant="secondary">Back to marketplace</Button>
    </main>
  );
}
