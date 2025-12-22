import fetch from 'node-fetch';
import OpenAI from 'openai';

const NEUROEDGE_KEY = process.env.NEUROEDGE_API_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

async function callNeuroEdge(path, body){
  const BASE = process.env.NEUROEDGE_API_BASE || 'https://api.neuroedge.example/v1';
  if(!NEUROEDGE_KEY) throw new Error('NeuroEdge key not configured');
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${NEUROEDGE_KEY}` },
    body: JSON.stringify(body),
    timeout: 120000
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

async function callOpenAI(prompt, opts = {}){
  if(!OPENAI_KEY) throw new Error('OpenAI key not configured');
  const client = new OpenAI({ apiKey: OPENAI_KEY });
  // Use chat completions for structured responses
  const resp = await client.chat.completions.create({
    model: opts.model || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: opts.max_tokens || 512,
    temperature: opts.temperature ?? 0.2
  });
  // return text
  return resp.choices?.[0]?.message?.content ?? '';
}

export async function diagnoseSymptoms(symptoms){
  // Try NeuroEdge first, fallback to OpenAI if key present
  if(NEUROEDGE_KEY){
    return callNeuroEdge('/diagnose', { symptoms });
  }
  if(OPENAI_KEY){
    const prompt = `You are a medical assistant. Given symptoms: ${JSON.stringify(symptoms)}. Provide top differential diagnoses (3) and recommended next steps.`;
    const txt = await callOpenAI(prompt, { max_tokens: 600 });
    return { text: txt };
  }
  return { placeholder: true, symptoms };
}

export async function treatmentGuidelines(condition){
  if(NEUROEDGE_KEY) return callNeuroEdge('/treatment', { condition });
  if(OPENAI_KEY){
    const prompt = `Provide evidence-based treatment guidelines for: ${condition}`;
    const txt = await callOpenAI(prompt, { max_tokens: 400 });
    return { text: txt };
  }
  return { placeholder: true, condition };
}

export async function transcribeAudioBase64(b64){
  // If NeuroEdge supports transcription, use it; otherwise use OpenAI Whisper API if OPENAI_KEY present
  if(NEUROEDGE_KEY) return callNeuroEdge('/transcribe', { audio_b64: b64 });
  if(OPENAI_KEY){
    // OpenAI's speech to text would typically require file upload; leave placeholder instructing to use client-side
    return { text: 'Transcription using OpenAI not implemented in-node; please upload to NeuroEdge or configure streaming ASR' };
  }
  return { placeholder:true };
}

export default { diagnoseSymptoms, treatmentGuidelines, transcribeAudioBase64 };
