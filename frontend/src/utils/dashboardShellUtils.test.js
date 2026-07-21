import { describe, it, expect } from 'vitest';

import { isDashboardRoute, sortDashboardItems } from './dashboardShellUtils';

describe('dashboardShellUtils', () => {
  it('detects dashboard-style routes', () => {
    expect(isDashboardRoute('/app')).toBe(false);
    expect(isDashboardRoute('/super-admin/dashboard')).toBe(true);
    expect(isDashboardRoute('/app/operations/pharmacy/home')).toBe(true);
    expect(isDashboardRoute('/app/operations/pharmacy/prescription-queue')).toBe(false);
  });

  it('promotes workspace-oriented cards ahead of other dashboard cards', () => {
    const ordered = sortDashboardItems([
      { id: 'appointments', title: 'Appointments' },
      { id: 'workspace', title: 'Workspace overview' },
      { id: 'queue', title: 'Queue' },
    ]);

    expect(ordered.map((item) => item.id)).toEqual(['workspace', 'appointments', 'queue']);
  });
});
