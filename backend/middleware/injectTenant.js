export const injectTenant = (req, res, next) => {
  if (req.method === "POST" || req.method === "PUT") {
    req.body.hospital = req.tenant.hospitalId;
  }
  next();
};
