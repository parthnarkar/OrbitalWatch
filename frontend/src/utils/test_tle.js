import * as satellite from 'satellite.js';

function computeChecksum(line) {
  let total = 0;
  for (let i = 0; i < 68; i++) {
    const char = line[i];
    if (char >= '0' && char <= '9') {
      total += parseInt(char);
    } else if (char === '-') {
      total += 1;
    }
  }
  return total % 10;
}

function generateTleLines(altitudeKm, inclinationDeg, eccentricity, raanDeg) {
  const RE = 6378.137;
  const GM = 398600.4418;
  const a = RE + altitudeKm;
  const period_sec = 2 * Math.PI * Math.sqrt((a ** 3) / GM);
  const mean_motion = 86400.0 / period_sec;
  const nid = "99999";

  const now = new Date("2026-06-12T17:00:00Z");
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const diffMs = now.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  const fracDay = (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds() + now.getUTCMilliseconds() / 1000) / 86400.0;
  
  const year2 = String(now.getUTCFullYear() % 100).padStart(2, '0');
  const dayPart = (dayOfYear + fracDay).toFixed(8).padStart(12, '0');
  const epochStr = year2 + dayPart;

  const l1_part = `1 ${nid}U 26001A   ${epochStr}  .00000000  00000-0  00000-0 0  999`;
  const l1_chk = computeChecksum(l1_part);
  const line1 = `${l1_part}${l1_chk}`;

  const incStr = inclinationDeg.toFixed(4).padStart(8, ' ');
  const raanStr = raanDeg.toFixed(4).padStart(8, ' ');
  const eccInt = Math.floor(eccentricity * 10000000);
  const eccStr = String(eccInt).padStart(7, '0').substring(0, 7);
  const apStr = (0.0).toFixed(4).padStart(8, ' ');
  const maStr = (0.0).toFixed(4).padStart(8, ' ');
  const mmStr = mean_motion.toFixed(8).padStart(11, ' ');
  const revStr = "00001";

  const l2_part = `2 ${nid} ${incStr} ${raanStr} ${eccStr} ${apStr} ${maStr} ${mmStr}${revStr}`;
  const l2_chk = computeChecksum(l2_part);
  const line2 = `${l2_part}${l2_chk}`;

  return { line1, line2 };
}

const tle = generateTleLines(1060, 28.5383, 0.0001, 0.0);
const satrec = satellite.twoline2satrec(tle.line1, tle.line2);

const start = new Date("2026-06-12T17:00:00Z");
for (let i = 0; i <= 40; i++) {
  const checkTime = new Date(start.getTime() + i * 15 * 60 * 1000);
  const posVel = satellite.propagate(satrec, checkTime);
  if (posVel.position) {
    console.log(
      `T+${i*15}m: x=${posVel.position.x.toFixed(1)}, y=${posVel.position.y.toFixed(1)}, z=${posVel.position.z.toFixed(1)}`
    );
  }
}
