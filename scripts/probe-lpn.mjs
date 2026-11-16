// Dev probe: how does libphonenumber-js actually behave for PK inputs?
// Run: node scripts/probe-lpn.mjs
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const inputs = [
  '03001234567', '0300-1234567', '+92 300 1234567', '00923001234567', '923001234567',
  '3001234567', '03451234567', '0421234567', '+92421234567', '111123456', '080012345',
  '03101234567', '03111234567', '03391234567', '03551234567', '03501234567', '03701234567',
  '03991234567', '0300123456', '030012345678', '12345', 'abc', '0300 123 4567',
  '+1 415 555 2671', '0345-1234567',
];

for (const raw of inputs) {
  const cleaned = raw.trim().replace(/[\s\-()._/]/g, '');
  const digits = /^\+?\d+$/.test(cleaned) ? cleaned.replace(/^\+/, '').replace(/^00/, '') : null;
  if (!digits) { console.log(`${raw.padEnd(20)} -> NONNUMERIC`); continue; }
  const candidate = digits.startsWith('92') ? `+${digits}` : digits;
  let p;
  try { p = parsePhoneNumberFromString(candidate, 'PK'); } catch (e) { console.log(`${raw.padEnd(20)} -> THROW ${e.message}`); continue; }
  if (!p) { console.log(`${raw.padEnd(20)} -> undefined`); continue; }
  console.log(
    `${raw.padEnd(20)} -> country=${p.country} valid=${p.isValid()} possible=${p.isPossible()} type=${p.getType()} nsn=${p.nationalNumber} nat=${p.formatNational()} uri=${p.getURI()}`,
  );
}
