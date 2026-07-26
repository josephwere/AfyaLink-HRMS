import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import * as encounterService from '../services/encounter';
import { useEncounter } from './useEncounter';
import { clearResourceCache } from '../services/shared/resourceCache';

vi.mock('../services/encounter', () => ({
  getLatestEncounterForPatient: vi.fn(),
  close: vi.fn(),
  applyCloseoutEffects: vi.fn(),
  createBillingHandoff: vi.fn(),
  resolveNurseEscalation: vi.fn(),
}));

describe('useEncounter', () => {
  beforeEach(() => {
    clearResourceCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearResourceCache();
  });

  it('loads the latest encounter and returns state', async () => {
    encounterService.getLatestEncounterForPatient.mockResolvedValue({ _id: 'enc1' });

    const { result, waitForNextUpdate } = renderHook(() => useEncounter('patient-1'));

    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.encounter).toEqual({ _id: 'enc1' });
  });

  it('surfaces loading state during refresh', async () => {
    encounterService.getLatestEncounterForPatient.mockResolvedValue({ _id: 'enc1' });

    const { result, waitForNextUpdate } = renderHook(() => useEncounter('patient-1'));
    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);

    act(() => {
      result.current.refresh();
    });

    expect(result.current.loading).toBe(true);
    await waitForNextUpdate();
    expect(result.current.loading).toBe(false);
  });

  it('propagates error from service and sets error state', async () => {
    const error = new Error('failed load');
    encounterService.getLatestEncounterForPatient.mockRejectedValue(error);

    const { result, waitForNextUpdate } = renderHook(() => useEncounter('patient-1'));
    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(error);
    expect(result.current.encounter).toBeNull();
  });

  it('refreshes encounter state after close', async () => {
    encounterService.getLatestEncounterForPatient.mockResolvedValueOnce({ _id: 'enc1' }).mockResolvedValueOnce({ _id: 'enc1', state: 'closed' });
    encounterService.close.mockResolvedValue({ ok: true });

    const { result, waitForNextUpdate } = renderHook(() => useEncounter('patient-1'));
    await waitForNextUpdate();

    await act(async () => {
      await result.current.closeEncounter('enc1');
    });

    expect(encounterService.close).toHaveBeenCalledWith('enc1');
    expect(result.current.encounter).toEqual({ _id: 'enc1', state: 'closed' });
  });
});
