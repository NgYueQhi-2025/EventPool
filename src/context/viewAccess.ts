import type { AppView, CurrentUser } from '../types/eventpool';

export type ViewAccess = 'public' | 'authenticated' | 'club' | 'admin';

/** Who may open each view. Anything not 'public' requires a verified sign-in. */
export const VIEW_ACCESS: Record<AppView, ViewAccess> = {
  home: 'public',
  clubs: 'public',
  club_detail: 'public',
  // BUG-003 Option A: Marketplace catalogue and resource details are publicly browsable
  marketplace: 'public',
  resource_detail: 'public',
  sustainability: 'public',
  borrow_form: 'club',
  my_club: 'club',
  request_detail: 'authenticated',
  admin_dashboard: 'admin',
};

export type AccessDecision = 'allowed' | 'login_required' | 'forbidden';

export function checkViewAccess(view: AppView, user: CurrentUser | null): AccessDecision {
  const required = VIEW_ACCESS[view];
  if (required === 'public') return 'allowed';
  if (!user) return 'login_required';
  if (required === 'authenticated') return 'allowed';
  if (required === 'admin') return user.role === 'admin' ? 'allowed' : 'forbidden';
  return user.role === 'club_rep' ? 'allowed' : 'forbidden';
}

/** Landing view after sign-in. */
export function homeViewFor(user: CurrentUser): AppView {
  return user.role === 'admin' ? 'admin_dashboard' : 'my_club';
}
