export const verifyWithGovernment = async ({
  idNumber,
  agency = "NATIONAL_ID",
}) => {
  // 🔐 Placeholder (real API via VPN / Gov Gateway)
  return {
    verified: true,
    fullName: "MATCHED",
    status: "ACTIVE",
    agency,
    verifiedAt: new Date(),
  };
};
