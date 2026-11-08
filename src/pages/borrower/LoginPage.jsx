import React from 'react';
import PageHeader from '../../components/PageHeader';
import FormField from '../../components/FormField';
import Button from '../../components/Button';

export default function LoginPage() {
  return (
    <main className="container">
      <PageHeader title="Log in" subtitle="Club representatives sign in to borrow or lend resources." />
      <p className="skeleton-note">Skeleton - auth wiring comes from M7's authentication work.</p>
      <form className="form-narrow" onSubmit={(e) => e.preventDefault()}>
        <FormField label="Email" type="email" name="email" autoComplete="email" />
        <FormField label="Password" type="password" name="password" autoComplete="current-password" />
        <Button type="submit">Log in</Button>
      </form>
    </main>
  );
}
