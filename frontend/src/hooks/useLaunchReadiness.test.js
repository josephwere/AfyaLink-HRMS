import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the service before importing the hook
vi.mock('../services/launchReadinessApi', () => ({
  fetchSignals: vi.fn(),
}));

import { fetchSignals } from '../services/launchReadinessApi';
import { useLaunchReadiness } from './useLaunchReadiness';

describe('useLaunchReadiness', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loads signals and computes readiness', async () => {
    const mockSignals = {
      backendHealth: { ok: true },
      aiGatewayHealth: { ok: false },
      systemSettings: { foo: true },
      offlineOps: null,
      trainingTracker: { items: [1] },
    };
    fetchSignals.mockResolvedValue(mockSignals);

    const { result } = renderHook(() => useLaunchReadiness());

    // initial state should be loading
    expect(result.current.loading).toBe(true);

    // wait for effect to finish
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.err).toBe("");
    expect(result.current.signals.backendHealth).toEqual({ ok: true });
    expect(result.current.readinessScore).toBeGreaterThanOrEqual(0);

    // manual reload
    fetchSignals.mockResolvedValue({ ...mockSignals, aiGatewayHealth: { ok: true } });
    await act(async () => {
      await result.current.loadSignals();
    });

    expect(fetchSignals).toHaveBeenCalled();
  });
});
