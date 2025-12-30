import { randomUUID } from "crypto";

export const trace = (req, res, next) => {
  req.traceId = randomUUID();

  res.setHeader("X-Trace-Id", req.traceId);

  next();
};
