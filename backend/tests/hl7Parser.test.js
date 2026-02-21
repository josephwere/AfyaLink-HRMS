import { parseHL7Patient, parseHL7ToSegments, getHL7Field } from '../services/hl7Parser.js';

test('parse simple PID HL7', ()=>{
  const raw = 'MSH|^~\\&|HIS|HOSP|...\rPID|1||12345^^^Hospital^MR||Doe^John||19800101|M|||123 Main St^^City^ST^12345||+254700000000\r';
  const p = parseHL7Patient(raw);
  expect(p.firstName).toBe('John');
  expect(p.lastName).toBe('Doe');
  expect(p.externalId).toBe('12345^^^Hospital^MR');
});

test('getHL7Field', ()=>{
  const raw = 'MSH|...\rPID|1||999||Smith^Jane||19900101|F\r';
  const segs = parseHL7ToSegments(raw);
  const v = getHL7Field(segs, 'PID-5.1');
  expect(v).toBe('Jane');
});
