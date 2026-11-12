import React from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import FormField from '../../components/FormField';
import Card from '../../components/Card';

// Placeholder data - replaced by Firestore queries in Sprint 1.
const sample = [
  { id: 'res-001', name: 'Folding tables (x10)', club: 'Sample Club' },
  { id: 'res-002', name: 'PA speaker set', club: 'Sample Club' },
  { id: 'res-003', name: 'Event banner stands', club: 'Sample Club' },
];

export default function MarketplacePage() {
  return (
    <main className="container">
      <PageHeader title="Resource Marketplace" subtitle="Find equipment other clubs are lending." />
      <p className="skeleton-note">Skeleton - search and filters are placeholders.</p>
      <div className="toolbar" role="search">
        <FormField label="Search" type="search" name="q" placeholder="Search resources" />
        <FormField label="Category" as="select" name="category" defaultValue="">
          <option value="">All categories</option>
        </FormField>
      </div>
      <div className="card-grid">
        {sample.map((r) => (
          <Card key={r.id} title={r.name}>
            <p>{r.club}</p>
            <Link to={`/marketplace/${r.id}`}>View details</Link>
          </Card>
        ))}
      </div>
    </main>
  );
}
