import React, { useEffect, useState } from "react";
import CashCountForm from "./CashCountForm";

function buildInitialValues(shift) {
  return {
    openingFloat: shift?.openingFloat ?? shift?.openingFloatAmount ?? 0,
    expected: shift?.expectedTotal ?? 0,
    cash: 0,
    mpesa: 0,
    card: 0,
    bank: 0,
    insurance: 0,
    refunds: 0,
    notes: "",
    reason: "",
  };
}

export default function CloseShiftDialog({ shift, onCancel, onClosed, endShift }) {
  // Keep shift id compatibility for different payload shapes (id, _id, shiftId)
  const [values, setValues] = useState(() => buildInitialValues(shift));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues(buildInitialValues(shift));
  }, [shift?._id || shift?.id]);

  const handleChange = (patch) => setValues((s) => ({ ...s, ...patch }));

  const actualSum = Number(values.cash || 0) + Number(values.mpesa || 0) + Number(values.card || 0) + Number(values.bank || 0) + Number(values.insurance || 0) - Number(values.refunds || 0);
  const variance = actualSum - Number(values.expected || 0);

  async function handleConfirm() {
    if (!shift || !(shift._id || shift.id || shift.shiftId)) {
      return alert("Unable to close shift because shift data is missing. Please refresh and try again.");
    }
    if (variance !== 0 && !values.reason) {
      return alert("Please provide a reason for the variance");
    }

    const payload = {
      counts: {
        openingFloat: Number(values.openingFloat || 0),
        cash: Number(values.cash || 0),
        mpesa: Number(values.mpesa || 0),
        card: Number(values.card || 0),
        bank: Number(values.bank || 0),
        insurance: Number(values.insurance || 0),
        refunds: Number(values.refunds || 0),
      },
      expectedTotal: Number(values.expected || 0),
      actualTotal: actualSum,
      variance,
      reason: values.reason,
      notes: values.notes,
    };

    if (!confirm(`Confirm closing shift. Expected: ${payload.expectedTotal}, Actual: ${payload.actualTotal}, Variance: ${payload.variance}`)) return;

    setSubmitting(true);
    try {
      await endShift(shift._id || shift.id || shift.shiftId, payload);
      onClosed && onClosed();
    } catch (err) {
      alert(err?.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal" style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
      <div
        data-shift-id={shift?._id || shift?.id || ''}
        style={{ background: "#fff", padding: 20, width: 720, maxHeight: "80vh", overflow: "auto" }}
      >
        <h3>Close Shift</h3>
        <div style={{ marginTop: 8 }}>
          <CashCountForm values={values} onChange={handleChange} />
        </div>

        <div style={{ marginTop: 12 }}>
          <label>
            Reason (required if variance ≠ 0)
            <input value={values.reason} onChange={(e)=>handleChange({ reason: e.target.value })} />
          </label>
          <label>
            Notes
            <textarea value={values.notes} onChange={(e)=>handleChange({ notes: e.target.value })} />
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn-primary"
            data-testid="confirm-close-shift"
            data-shift-id={shift?._id || shift?.id || ''}
            onClick={handleConfirm}
            disabled={submitting || !shift || !(shift._id || shift.id)}
          >
            {submitting ? "Closing…" : "Confirm Close Shift"}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel} style={{ marginLeft: 8 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
