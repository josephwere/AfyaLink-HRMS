import { audit } from "../utils/audit.js";

export const auditAction =
  (action, resource) =>
  async (req, res, next) => {
    res.on("finish", async () => {
      if (res.statusCode < 400) {
        await audit({
          req,
          action,
          resource,
          resourceId: req.params.id,
          metadata: {
            method: req.method,
            path: req.originalUrl,
          },
        });
      }
    });

    next();
  };
