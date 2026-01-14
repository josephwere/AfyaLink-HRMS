import crypto from "crypto";

/*
  This simulates anchoring.
  Later replaced with:
  - Polygon tx
  - National blockchain
*/
export const anchorHash = async (hash) => {
  // Deterministic fake tx hash (safe placeholder)
  const txHash = crypto
    .createHash("sha256")
    .update(hash + Date.now())
    .digest("hex");

  return {
    blockchain: "POLYGON",
    txHash,
  };
};
