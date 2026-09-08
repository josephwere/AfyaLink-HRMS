import React from "react";

export default function ShiftStatusCard({ shift }) {
  if (!shift) {
    return (
      <div>
        <strong>Current Shift:</strong>
        <div>No open shift</div>
      </div>
    );
  }

  const opening = shift.openingFloat ?? shift.openingFloatAmount ?? 0;
  const status = shift.status || "OPEN";
  const cashierName = shift.cashierName || shift.cashier || window?.USER?.name || "";

  return (
    <div>
      <strong>Current Shift:</strong>
      <div>{status} — {cashierName}</div>
      <div style={{ marginTop: 6 }}>
        <div>Opening float: {Number(opening).toLocaleString()}</div>
        <div>Opened at: {shift.openingTime || shift.openedAt || shift.createdAt || "—"}</div>
      </div>
    </div>
  );
}
