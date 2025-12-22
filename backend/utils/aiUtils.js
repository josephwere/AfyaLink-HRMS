/**
 * Basic AI utilities: predictive appointment suggestion, risk scoring, lab anomaly detection.
 * These are simple, explainable heuristics and placeholders where ML models can be integrated.
 */

export const predictNextAvailableSlot = (appointments, preferredDate = new Date()) => {
  // appointments: array of {scheduledAt, durationMins}
  // find gaps on preferredDate
  const day = new Date(preferredDate);
  day.setHours(0,0,0,0);
  const nextDay = new Date(day); nextDay.setDate(day.getDate()+1);
  const sameDay = appointments.filter(a => new Date(a.scheduledAt) >= day && new Date(a.scheduledAt) < nextDay)
    .map(a => ({start: new Date(a.scheduledAt), end: new Date(new Date(a.scheduledAt).getTime() + ((a.durationMins||30)*60000))}))
    .sort((x,y)=>x.start-y.start);
  // naive: suggest first gap after 8am
  let cursor = new Date(day); cursor.setHours(8,0,0,0);
  for (const s of sameDay) {
    if (s.start - cursor >= 30*60000) return cursor;
    cursor = new Date(s.end);
  }
  return cursor;
};

export const simpleRiskScore = (patient) => {
  // patient: age, comorbidities in metadata
  const age = patient.dob ? Math.floor((Date.now() - new Date(patient.dob))/31557600000) : 0;
  let score = 0;
  if (age >= 65) score += 40;
  const com = (patient.metadata && patient.metadata.comorbidities) || [];
  score += Math.min(50, com.length * 10);
  return Math.min(100, score);
};

export const detectLabAnomaly = (labTest) => {
  // labTest.result: { values: { 'Hb': 12, 'WBC': 5 } }
  if (!labTest.result || !labTest.result.values) return {anomaly:false, details:[]};
  const details = [];
  for (const [k,v] of Object.entries(labTest.result.values)) {
    if (typeof v === 'number') {
      // crude threshold example
      if (k.toLowerCase().includes('wbc') && v > 11) details.push(`${k} high`);
      if (k.toLowerCase().includes('hb') && v < 11) details.push(`${k} low`);
    }
  }
  return { anomaly: details.length>0, details };
};
