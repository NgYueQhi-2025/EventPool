import React from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import FormField from '../../components/FormField';
import Button from '../../components/Button';

export default function BorrowRequestPage() {
  const { resourceId } = useParams();
  return (
    <main className="container">
      <PageHeader title="Borrow Request" subtitle={`Resource ID: ${resourceId}`} />
      <p className="skeleton-note">Skeleton - validation and submission arrive in Sprint 1.</p>
      <form className="form-narrow" onSubmit={(e) => e.preventDefault()}>
        <FormField label="Quantity" type="number" name="quantity" min="1" defaultValue="1" />
        <FormField label="Borrow date" type="date" name="startDate" />
        <FormField label="Return date" type="date" name="endDate" />
        <FormField label="Purpose" as="textarea" name="purpose" rows={3} />
        <Button type="submit">Submit request</Button>{' '}
        <Button to={`/marketplace/${resourceId}`} variant="secondary">Cancel</Button>
      </form>
    </main>
  );
}
