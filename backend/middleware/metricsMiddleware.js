import { recordHttpRequest } from "../utils/metrics.js";

export function metricsMiddleware(req, res, next) {
  const startNs = process.hrtime.bigint();

  res.on("finish", () => {
    const endNs = process.hrtime.bigint();
    const durationMs = Number(endNs - startNs) / 1e6;
    recordHttpRequest(req, res.statusCode, Math.round(durationMs));
  });

  next();
}

