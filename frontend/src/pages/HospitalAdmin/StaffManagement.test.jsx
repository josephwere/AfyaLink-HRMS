import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import StaffManagement from './StaffManagement';

vi.mock('../../utils/auth', () => ({
  useAuth: () => ({ user: { actualRole: 'HOSPITAL_ADMIN' } }),
}));

vi.mock('../../utils/normalizeRole', () => ({
  normalizeRole: (value) => value,
}));

vi.mock('../../hooks/useHospitalAdminOperations', () => ({
  useHospitalAdminOperations: () => ({
    staff: [],
    staffLoading: false,
    staffMsg: '',
    staffPage: 1,
    setStaffPage: vi.fn(),
    staffTotal: 0,
    staffQuery: '',
    setStaffQuery: vi.fn(),
    missingPharmacyOnly: false,
    setMissingPharmacyOnly: vi.fn(),
    loadStaff: vi.fn(),
    hospitalOptions: [],
    pharmacyOptions: [],
    staffSaving: false,
    staffForm: {},
    setStaffForm: vi.fn(),
    registerStaff: vi.fn(),
    deactivateStaff: vi.fn(),
    demoteStaffToPatient: vi.fn(),
    updateStaffRole: vi.fn(),
  }),
}));

vi.mock('../../utils/appLanguage.jsx', () => ({
  useAppLanguage: () => ({ translateText: (value) => value }),
}));

describe('StaffManagement', () => {
  it('renders the staff management page without crashing', () => {
    render(
      <MemoryRouter>
        <StaffManagement />
      </MemoryRouter>
    );

    expect(screen.getByText('Staff Management')).toBeInTheDocument();
  });
});
