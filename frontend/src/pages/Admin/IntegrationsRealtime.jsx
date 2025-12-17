import React from 'react';

export default function IntegrationsRealtime(){
  return (<div>
    <h2>Real-time Integrations (Webhooks)</h2>
    <p>To push HL7 or FHIR messages into AfyaLink, send an HTTP POST to:</p>
    <pre>POST {window.location.origin}/api/integrations/webhook/:connectorId</pre>
    <p>Headers:</p>
    <pre>X-AFYA-SIGNATURE: &lt;hmac_sha256_hex&gt;</pre>
    <p>Payload: HL7 raw text or FHIR JSON resource.</p>
    <h3>Example (Node)</h3>
    <pre>const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
fetch(url, { method:'POST', headers:{ 'X-AFYA-SIGNATURE': sig, 'Content-Type':'text/plain' }, body });</pre>
    <p>Incoming webhooks are verified and queued for processing. Results will appear in the Integrations Logs.</p>
  </div>);
}
