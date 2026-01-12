import jwt from "jsonwebtoken";

/**
 * Generates a short-lived, signed QR token
 * Used for offline & online verification
 */
export const generateQRToken = (accessEntry) => {
  return jwt.sign(
    {
      code: accessEntry.code,
      hospital: accessEntry.hospital.toString(),
    },
    process.env.QR_SECRET,
    {
      expiresIn: "12h", // configurable
    }
  );
};
