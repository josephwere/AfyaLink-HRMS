import React from 'react';
import AIChatWS from '../../components/AIChatWS';
import { useAuth } from '../../utils/auth';
export default function MedicalAssistant(){
  const { user } = useAuth();
  const token = null; // token usage: frontend stores access token in memory; WebSocket expects token param
  return (<div><h2>Medical Assistant (AI)</h2><AIChatWS token={token} /></div>);
}
