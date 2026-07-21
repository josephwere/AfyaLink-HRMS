import { describe, it, expect } from 'vitest';

import {
  canManageBeds,
  canManageRooms,
  canManageWards,
  canManageStaff,
  canCreateAppointments,
} from './permissions';

describe('permissions helpers', () => {
  it('allows facility management by role fallback', () => {
    expect(canManageBeds({ role: 'HOSPITAL_ADMIN' })).toBe(true);
    expect(canManageRooms({ role: 'HOSPITAL_ADMIN' })).toBe(true);
    expect(canManageWards({ role: 'HOSPITAL_ADMIN' })).toBe(true);
  });

  it('allows staff and appointments by capability fallback', () => {
    expect(canManageStaff(['users.manage'])).toBe(true);
    expect(canCreateAppointments(['clinical.appointments.manage'])).toBe(true);
  });

  it('rejects unsupported actions for patients', () => {
    expect(canManageBeds({ role: 'PATIENT' })).toBe(false);
    expect(canManageStaff({ role: 'PATIENT' })).toBe(false);
    expect(canCreateAppointments({ role: 'PATIENT' })).toBe(false);
  });
});
