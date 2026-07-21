// Mock service before importing hook
vi.mock('../services/webhooksApi', () => ({
  sendWebhook: vi.fn(),
}));

import { renderHook, act } from '@testing-library/react';
import { sendWebhook } from '../services/webhooksApi';
import { useRealTimeIntegrations } from './useRealTimeIntegrations';

describe('useRealTimeIntegrations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sends HL7 and FHIR payloads', async () => {
    sendWebhook.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useRealTimeIntegrations());

    await act(async () => {
      await result.current.sendHL7();
    });

    expect(sendWebhook).toHaveBeenCalled();

    // set a valid JSON for FHIR and ensure state updates before calling sendFHIR
    await act(async () => {
      result.current.setFhir(JSON.stringify({ resourceType: 'Patient' }));
    });

    await act(async () => {
      await result.current.sendFHIR();
    });

    expect(sendWebhook).toHaveBeenCalledTimes(2);
  });
});
