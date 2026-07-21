import { useCallback } from "react";
import {
  clearAssistantMemory as clearAssistantMemoryApi,
  getAssistantContext as getAssistantContextApi,
  streamAssistantChat as streamAssistantChatApi,
  submitAssistantFeedback as submitAssistantFeedbackApi,
} from "../services/assistantApi";

export function useChatbotPage() {
  const getAssistantContext = useCallback(() => getAssistantContextApi(), []);
  const streamAssistantChat = useCallback((payload, handlers) => streamAssistantChatApi(payload, handlers), []);
  const submitAssistantFeedback = useCallback((payload) => submitAssistantFeedbackApi(payload), []);
  const clearAssistantMemory = useCallback(() => clearAssistantMemoryApi(), []);

  return {
    getAssistantContext,
    streamAssistantChat,
    submitAssistantFeedback,
    clearAssistantMemory,
  };
}

export default useChatbotPage;
