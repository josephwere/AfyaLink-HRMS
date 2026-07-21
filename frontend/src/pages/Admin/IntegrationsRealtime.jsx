import React from 'react';

export default function IntegrationsRealtime(){
  return (<div>
    <h2>Real-time Integrations (Webhooks)</h2>
    <p>To push HL7 or FHIR messages into AfyaLink, send an HTTP POST to:</p>
    <pre>POST {window.location.origin}/api/integrations/webhook/:connectorId</pre>
    <p>Headers:</p>
    <pre>X-AFYA-SIGNATURE: &lt;hmac_sha256_hex&gt;</pre>
    <p>Payload: HL7 raw text or FHIR JSON resource.</p>
    <h3>Example (curl)</h3>
    <pre>{`sig=$(printf "%s" "$body" | openssl dgst -sha256 -hmac "$secret" | awk '{print $2}')
curl -X POST "$url" -H "X-AFYA-SIGNATURE: $sig" -H "Content-Type: text/plain" --data-binary @payload.txt`}</pre>
    <p>Incoming webhooks are verified and queued for processing. Results will appear in the Integrations Logs.</p>
  </div>);
}
