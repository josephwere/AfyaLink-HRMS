import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as mutationService from './mutations';
import { apiFetch } from '../../utils/apiFetch';

vi.mock('../../utils/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

describe('encounter mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls create encounter with POST and payload', async () => {
    const payload = { patientId: 'patient-1' };
    apiFetch.mockResolvedValue({ _id: 'enc1' });

    const result = await mutationService.create(payload);

    expect(apiFetch).toHaveBeenCalledWith('/api/encounters', {
      method: 'POST',
      body: payload,
    });
    expect(result).toEqual({ _id: 'enc1' });
  });

  it('calls close encounter with POST', async () => {
    apiFetch.mockResolvedValue({ ok: true });

    const result = await mutationService.close('enc1');

    expect(apiFetch).toHaveBeenCalledWith('/api/encounters/enc1/close', {
      method: 'POST',
    });
    expect(result).toEqual({ ok: true });
  });

  it('calls apply closeout effects with POST and payload', async () => {
    const payload = { diagnosis: 'flu' };
    apiFetch.mockResolvedValue({ labOrders: [] });

    const result = await mutationService.applyCloseoutEffects('enc1', payload);

    expect(apiFetch).toHaveBeenCalledWith('/api/encounters/enc1/closeout-effects', {
      method: 'POST',
      body: payload,
    });
    expect(result).toEqual({ labOrders: [] });
  });

  it('propagates errors consistently', async () => {
    const error = new Error('bad request');
    apiFetch.mockRejectedValue(error);

    await expect(mutationService.close('enc1')).rejects.toThrow('bad request');
  });
});
