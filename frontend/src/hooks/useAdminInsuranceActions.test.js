import { renderHook, act } from '@testing-library/react-hooks';

vi.mock('../services/insuranceApi', () => ({
  approveInsurance: vi.fn(),
  rejectInsurance: vi.fn(),
}));

import useAdminInsuranceActions from './useAdminInsuranceActions';
import * as api from '../services/insuranceApi';

describe('useAdminInsuranceActions', () => {
  const encounter = { _id: 'enc1', workflow: { allowedTransitions: ['INSURANCE_APPROVED'] } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state and can call approve', async () => {
    api.approveInsurance.mockResolvedValue({});
    const { result } = renderHook(() => useAdminInsuranceActions(encounter));

    expect(result.current.canApprove).toBe(true);
    expect(result.current.canReject).toBe(false);

    await act(async () => {
      result.current.setJustification('reason');
    });

    await act(async () => {
      await result.current.approve();
    });

    expect(api.approveInsurance).toHaveBeenCalledWith({ encounterId: 'enc1', justification: 'reason' });
    expect(result.current.msg).toMatch(/approved/i);
  });
});
