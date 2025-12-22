import hl7 from "hl7";

/**
 * parseHL7Patient:
 * Extracts basic patient info from an HL7 v2 message (PID segment)
 */
export function parseHL7Patient(rawHL7) {
  const msg = hl7.parseString(rawHL7);
  if (!msg || !Array.isArray(msg)) {
    throw new Error("Invalid HL7 message");
  }

  // Find PID segment
  const pid = msg.find((seg) => seg[0] === "PID");
  if (!pid) throw new Error("PID segment not found");

  // Helper to get field: HL7 is array-based
  const getField = (segment, index) => segment[index] || null;

  // Helper to extract component
  const getComponent = (field, compIndex = 0) => {
    if (!field) return null;
    if (Array.isArray(field) && field[compIndex]) return field[compIndex];
    if (typeof field === "string") return field;
    return null;
  };

  const patientId = getComponent(getField(pid, 3));
  const nameField = getField(pid, 5);

  const lastName = getComponent(nameField, 0);
  const firstName = getComponent(nameField, 1);

  const gender = getField(pid, 8);
  const dobRaw = getField(pid, 7);

  const dob =
    dobRaw && dobRaw.length >= 8
      ? `${dobRaw.slice(0, 4)}-${dobRaw.slice(4, 6)}-${dobRaw.slice(6, 8)}`
      : null;

  const phone = getField(pid, 13);

  return {
    externalSource: "HL7",
    externalId: patientId,
    firstName,
    lastName,
    gender:
      gender === "M" ? "Male" : gender === "F" ? "Female" : gender || "Other",
    dateOfBirth: dob,
    phone,
  };
}

/**
 * parseHL7ToSegments:
 * Returns normalized parsed segments
 */
export function parseHL7ToSegments(rawHL7) {
  const msg = hl7.parseString(rawHL7);

  return msg.map((seg) => {
    return {
      name: seg[0],
      fields: seg.slice(1).map((f) => ({
        value: Array.isArray(f) ? f.join("^") : f,
        components: Array.isArray(f)
          ? f.map((c) => ({ value: c }))
          : [{ value: f }],
      })),
    };
  });
}

/**
 * getHL7Field:
 * Example: getHL7Field(segments, "PID-5.1")
 */
export function getHL7Field(segments, path) {
  const m = path.match(/^([A-Z0-9]+)-(\d+)(?:\.(\d+))?$/);
  if (!m) return null;

  const segName = m[1];
  const fieldIdx = parseInt(m[2], 10);
  const compIdx = m[3] ? parseInt(m[3], 10) : null;

  const seg = segments.find((s) => s.name === segName);
  if (!seg) return null;

  const field = seg.fields[fieldIdx - 1];
  if (!field) return null;

  if (compIdx !== null) {
    const comp = field.components[compIdx - 1];
    return comp ? comp.value : null;
  }

  return field.value;
}

export default { parseHL7Patient, parseHL7ToSegments, getHL7Field };
