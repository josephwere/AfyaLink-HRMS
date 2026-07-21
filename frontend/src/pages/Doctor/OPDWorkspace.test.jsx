import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEncounter } from '../../hooks/useEncounter';
import OPDWorkspace from './OPDWorkspace';

vi.mock('../../hooks/useEncounter', () => ({
  __esModule: true,
  useEncounter: vi.fn(),
}));

vi.mock('../../utils/apiFetch', () => ({
  __esModule: true,
  default: vi.fn().mockResolvedValue({}),
  apiFetch: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../services/transferApi', () => ({
  __esModule: true,
  requestTransfer: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('../../components/Cards', () => ({
  __esModule: true,
  StatCard: ({ title, value }) => <div data-testid="stat-card">{title}: {value}</div>,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams('patientId=patient-1')],
  };
});

describe('OPDWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEncounter.mockReturnValue({
      encounter: null,
      loading: false,
      error: null,
      refresh: vi.fn(),
      closeEncounter: vi.fn(),
      applyCloseoutEffects: vi.fn(),
      createBillingHandoff: vi.fn(),
      resolveNurseEscalation: vi.fn(),
    });
  });

  it('renders the workspace and save draft button', () => {
    render(<OPDWorkspace />);

    expect(screen.getByText('OPD Clinic Workspace')).toBeInTheDocument();
    expect(screen.getByText('Save Draft')).toBeInTheDocument();
  });

  it('invokes closeEncounter when complete visit is clicked', async () => {
    const closeEncounter = vi.fn().mockResolvedValue({ ok: true });
    const refresh = vi.fn();
    useEncounter.mockReturnValue({
      encounter: { _id: 'enc1', closeout: { canClose: true } },
      loading: false,
      error: null,
      refresh,
      closeEncounter,
      applyCloseoutEffects: vi.fn(),
      createBillingHandoff: vi.fn(),
      resolveNurseEscalation: vi.fn(),
    });

    render(<OPDWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: /Complete Visit/ }));

    expect(closeEncounter).toHaveBeenCalledWith('enc1');
  });
});
