import { randomUUID } from "crypto";

export const trace = (req, res, next) => {
  const inboundTraceId =
    req.get("x-trace-id") ||
    req.get("x-correlation-id") ||
    req.get("x-request-id");
  req.traceId = inboundTraceId || randomUUID();
  req.correlationId = req.traceId;

  res.setHeader("X-Trace-Id", req.traceId);
  res.setHeader("X-Correlation-Id", req.correlationId);

  next();
};
