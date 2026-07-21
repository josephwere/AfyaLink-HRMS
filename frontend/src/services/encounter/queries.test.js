import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as queryService from './queries';
import { apiFetch } from '../../utils/apiFetch';

vi.mock('../../utils/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

describe('encounter queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the encounter list endpoint with query params', async () => {
    apiFetch.mockResolvedValue([{ _id: 'enc1' }]);

    const result = await queryService.listEncounters({ patientId: 'patient-1', limit: 5, stage: 'active' });

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch.mock.calls[0][0]).toContain('/api/encounters?');
    expect(apiFetch.mock.calls[0][0]).toContain('patientId=patient-1');
    expect(apiFetch.mock.calls[0][0]).toContain('limit=5');
    expect(apiFetch.mock.calls[0][0]).toContain('stage=active');
    expect(result).toEqual([{ _id: 'enc1' }]);
  });

  it('returns null when getLatestEncounterForPatient receives no patientId', async () => {
    const result = await queryService.getLatestEncounterForPatient(null);
    expect(result).toBeNull();
  });

  it('propagates apiFetch errors from listEncounters', async () => {
    const error = new Error('network failed');
    apiFetch.mockRejectedValue(error);

    await expect(queryService.listEncounters({ patientId: 'patient-1' })).rejects.toThrow('network failed');
  });
});
