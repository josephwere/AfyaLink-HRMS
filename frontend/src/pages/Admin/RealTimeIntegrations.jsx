import React from "react";
import useRealTimeIntegrations from "../../hooks/useRealTimeIntegrations";

const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;

export default function RealTimeIntegrations() {
  const { source, setSource, hl7, setHl7, fhir, setFhir, res, sendHL7, sendFHIR } = useRealTimeIntegrations();

  return (
    <div className="dashboard">
      <h2>Real-Time Integrations (Webhooks)</h2>

      <div className="grid info-grid" style={{ gap: 12 }}>
        <div className="card form">
          <h4>Send HL7 Message</h4>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <textarea
            value={hl7}
            onChange={(e) => setHl7(e.target.value)}
            rows={8}
            style={{ width: "100%" }}
            placeholder="Paste raw HL7 message here (\r delimited)"
          />
          <div>
            <button type="button" className="btn-primary" onClick={sendHL7}>Send HL7</button>
          </div>
        </div>

        <div className="card form">
          <h4>Send FHIR Patient Resource</h4>
          <textarea
            value={fhir}
            onChange={(e) => setFhir(e.target.value)}
            rows={8}
            style={{ width: "100%" }}
            placeholder="Paste FHIR Patient JSON here"
          />
          <div>
            <button type="button" className="btn-primary" onClick={sendFHIR}>Send FHIR</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4>Response</h4>
        <p className="muted" style={{ marginTop: 8 }}>
          {res?.error ? String(res.error) : res ? "Message delivered successfully." : "No response yet."}
        </p>
        {isDev && res ? <pre className="code-inline">{JSON.stringify(res, null, 2)}</pre> : null}
      </div>
    </div>
  );
}
