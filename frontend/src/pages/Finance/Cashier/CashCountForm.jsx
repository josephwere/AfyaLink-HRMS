import React, { useMemo } from "react";

export default function CashCountForm({ values = {}, onChange }) {
  const methods = ["cash", "mpesa", "card", "bank", "insurance", "refunds"];

  const totals = useMemo(() => {
    return methods.reduce((acc, m) => ({ ...acc, [m]: Number(values[m] || 0) }), {});
  }, [values]);

  const expected = Number(values.expected || 0);
  const actualSum = methods.reduce((s, m) => s + Number(values[m] || 0), 0);
  const variance = actualSum - expected;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label>
          Opening float
          <input type="number" name="openingFloat" defaultValue={values.openingFloat || 0} onChange={(e)=>onChange({ openingFloat: Number(e.target.value) })} />
        </label>
        <label>
          Expected total
          <input type="number" name="expected" defaultValue={values.expected || 0} onChange={(e)=>onChange({ expected: Number(e.target.value) })} />
        </label>

        {methods.map((m) => (
          <label key={m}>
            {m.charAt(0).toUpperCase() + m.slice(1)}
            <input type="number" name={m} defaultValue={values[m] || 0} onChange={(e)=>onChange({ [m]: Number(e.target.value) })} />
          </label>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <div><strong>Actual sum:</strong> {actualSum.toLocaleString()}</div>
        <div><strong>Variance:</strong> {variance.toLocaleString()}</div>
      </div>
    </div>
  );
}
