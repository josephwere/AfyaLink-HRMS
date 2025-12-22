
import React, { useState, useRef } from 'react';
export default function AIChat(){ 
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const evtSourceRef = useRef(null);

  const send = async () => {
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    setInput('');
    // start SSE
    const res = await fetch(`import.meta.env.VITE_API_URL}'}/api/ai/chat', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ message: input }) });
    if (!res.ok) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let assistantText = '';
    while(true){
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      try {
        // attempt to parse chunked JSON lines
        const parsed = JSON.parse(chunk.trim());
        assistantText += parsed.chunk ? parsed.chunk : chunk;
        setMessages(prev => {
          const last = prev[prev.length -1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { role: 'assistant', text: assistantText }];
          }
          return [...prev, { role: 'assistant', text: assistantText }];
        });
      } catch (e) {
        // append raw chunk
        assistantText += chunk;
      }
    }
  };

  return (<div style={{border:'1px solid #eee',padding:12,borderRadius:8}}>
    <div style={{height:220,overflow:'auto',marginBottom:8,background:'#fafafa',padding:8,borderRadius:6}}>
      {messages.map((m,i)=>(<div key={i} style={{textAlign:m.role==='user'?'right':'left'}}><b>{m.role}:</b> <span>{m.text}</span></div>))}
    </div>
    <textarea value={input} onChange={e=>setInput(e.target.value)} rows={3} style={{width:'100%'}}/>
    <button onClick={send}>Send</button>
  </div>);
}
