import { twoline2satrec, propagate, eciToGeodetic, gstime } from '../utils/satellite-pure.js';

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
  const RE = 6378.137;   // Earth radius km
  const GM = 398600.4418;  // km^3/s^2
  const a = RE + altitudeKm;
  const period_sec = 2 * Math.PI * Math.sqrt((a ** 3) / GM);
  const mean_motion = 86400.0 / period_sec;
  const nid = "99999"; // simulated norad id

  // Build epoch string from current UTC
  const now = new Date();
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const diffMs = now.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  const fracDay = (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds() + now.getUTCMilliseconds() / 1000) / 86400.0;
  
  const year2 = String(now.getUTCFullYear() % 100).padStart(2, '0');
  const dayPart = (dayOfYear + fracDay).toFixed(8).padStart(12, '0');
  const epochStr = year2 + dayPart;

  // Line 1
  const l1_part = `1 ${nid}U 26001A   ${epochStr}  .00000000  00000-0  00000-0 0  999`;
  const l1_chk = computeChecksum(l1_part);
  const line1 = `${l1_part}${l1_chk}`;

  // Line 2
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

function getTleAgeDays(line1) {
  try {
    const epochYearStr = line1.substring(18, 20).trim();
    const epochDaysStr = line1.substring(20, 32).trim();
    if (!epochYearStr || !epochDaysStr) return 0;
    
    const epochYear = parseInt(epochYearStr);
    const epochDays = parseFloat(epochDaysStr);
    const fullYear = epochYear >= 57 ? 1900 + epochYear : 2000 + epochYear;
    
    const epochDate = new Date(Date.UTC(fullYear, 0, 1));
    epochDate.setUTCDate(epochDate.getUTCDate() + (epochDays - 1));
    
    const diffMs = Date.now() - epochDate.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
  } catch (e) {
    return 0;
  }
}

function calculateFosterPc(missDistanceKm, relativeVelocityKms, ageDays) {
  // Foster probability of collision approximation:
  // Combined hard body radius = 10 meters = 0.01 km
  const r_HBR = 0.01; 
  // Covariance increases with TLE age. Let's say baseline sigma is 0.05 km, + 0.02 km per day of TLE age
  const sigma = 0.05 + 0.02 * Math.max(0, ageDays); 
  
  const exponent = -(missDistanceKm * missDistanceKm) / (2 * sigma * sigma);
  const factor = 1 - Math.exp(-(r_HBR * r_HBR) / (2 * sigma * sigma));
  return Math.exp(exponent) * factor;
}

self.onmessage = function(e) {
  const { proposedOrbit, catalogSatellites } = e.data;
  const { altitudeKm, inclination, eccentricity, raan } = proposedOrbit;

  // 1. Generate TLE for proposed satellite
  const solvedRaan = raan === '' || raan === null ? 0.0 : parseFloat(raan);
  const proposedTle = generateTleLines(parseFloat(altitudeKm), parseFloat(inclination), parseFloat(eccentricity), solvedRaan);
  let proposedSatRec;
  try {
    proposedSatRec = twoline2satrec(proposedTle.line1, proposedTle.line2);
  } catch (err) {
    self.postMessage({ error: "Failed to parse generated proposed TLE" });
    return;
  }

  // 2. Filter candidates: ±50km altitude band, ±5° inclination band, TLE age < 30 days
  const targetAlt = parseFloat(altitudeKm);
  const targetInc = parseFloat(inclination);
  
  const candidates = [];
  const now = new Date();

  for (const sat of catalogSatellites) {
    if (!sat.tle_line1 || !sat.tle_line2) continue;
    
    try {
      const satRec = twoline2satrec(sat.tle_line1, sat.tle_line2);
      
      // Inclination check from TLE Line 2 (column 9 to 16)
      let inc = 0;
      try {
        inc = parseFloat(sat.tle_line2.substring(8, 16).trim());
      } catch (err) {
        continue;
      }

      // Quick approximate altitude filter from satellites API if available, or compute ECI altitude
      const pos = propagate(satRec, now);
      if (!pos.position) continue;
      
      const gst = gstime(now);
      const gd = eciToGeodetic(pos.position, gst);
      const alt = gd.height;
      
      const ageDays = getTleAgeDays(sat.tle_line1);
      
      // Let's filter candidates to optimize performance
      if (Math.abs(alt - targetAlt) <= 50 && Math.abs(inc - targetInc) <= 5 && ageDays < 30) {
        candidates.push({
          sat,
          satRec,
          ageDays
        });
      }
    } catch (err) {
      // ignore parsing errors for bad catalog items
    }
  }

  // 3. Propagate for 30 days (daily steps) to check for conjunctions
  const numDays = 30;
  let minDistance = Infinity;
  let tcaTime = null;
  let tcaCandidate = null;
  let tcaProposedPos = null;
  let tcaCandidatePos = null;
  let tcaRelVelocity = 0;

  for (let step = 0; step < numDays; step++) {
    const checkTime = new Date(now.getTime() + step * 24 * 60 * 60 * 1000);
    
    // Propagate proposed satellite
    const pProp = propagate(proposedSatRec, checkTime);
    if (!pProp.position) continue;
    
    // Compare with all candidates
    for (const cand of candidates) {
      const pCand = propagate(cand.satRec, checkTime);
      if (!pCand.position) continue;
      
      const dx = pProp.position.x - pCand.position.x;
      const dy = pProp.position.y - pCand.position.y;
      const dz = pProp.position.z - pCand.position.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      if (dist < minDistance) {
        minDistance = dist;
        tcaTime = checkTime.toISOString();
        tcaCandidate = cand;
        tcaProposedPos = pProp.position;
        tcaCandidatePos = pCand.position;
        
        // Relative velocity
        const vx = pProp.velocity.x - pCand.velocity.x;
        const vy = pProp.velocity.y - pCand.velocity.y;
        const vz = pProp.velocity.z - pCand.velocity.z;
        tcaRelVelocity = Math.sqrt(vx*vx + vy*vy + vz*vz);
      }
    }
  }

  // 4. Formulate response
  let status = "APPROVED"; // Green trajectory
  let pc = 0.0;
  
  if (minDistance < 1.0) { // < 1km is CRITICAL
    status = "REJECTED"; // Red trajectory
  } else if (minDistance < 10.0) {
    status = "WARNING"; // Yellow trajectory/warning
  }
  
  if (tcaCandidate) {
    pc = calculateFosterPc(minDistance, tcaRelVelocity, tcaCandidate.ageDays);
  }

  // 5. Generate alternative orbit suggestions if status is not APPROVED
  const alternatives = [];
  if (status !== "APPROVED") {
    // Let's test a few nearby parameters and see if they are safe (minDistance >= 10.0)
    // We try to raise and lower altitude by 10km, 20km, 30km or adjust inclination by 1, 2 degrees
    const trials = [
      { altOffset: 15, incOffset: 0, label: "Raise altitude by 15 km" },
      { altOffset: -15, incOffset: 0, label: "Lower altitude by 15 km" },
      { altOffset: 30, incOffset: 0, label: "Raise altitude by 30 km" },
      { altOffset: -30, incOffset: 0, label: "Lower altitude by 30 km" },
      { altOffset: 0, incOffset: 2, label: "Increase inclination by 2.0°" },
      { altOffset: 0, incOffset: -2, label: "Decrease inclination by 2.0°" },
    ];

    for (const trial of trials) {
      const trialAlt = targetAlt + trial.altOffset;
      const trialInc = targetInc + trial.incOffset;
      
      // Check if within bounds
      if (trialAlt < 200 || trialAlt > 2000 || trialInc < 0 || trialInc > 98) continue;
      
      const trialTle = generateTleLines(trialAlt, trialInc, parseFloat(eccentricity), solvedRaan);
      let trialSatRec;
      try { trialSatRec = twoline2satrec(trialTle.line1, trialTle.line2); } catch (e) { continue; }
      
      let isSafe = true;
      let trialMinDist = Infinity;
      
      for (let step = 0; step < numDays; step++) {
        const checkTime = new Date(now.getTime() + step * 24 * 60 * 60 * 1000);
        const pProp = propagate(trialSatRec, checkTime);
        if (!pProp.position) continue;
        
        for (const cand of candidates) {
          const pCand = propagate(cand.satRec, checkTime);
          if (!pCand.position) continue;
          
          const dx = pProp.position.x - pCand.position.x;
          const dy = pProp.position.y - pCand.position.y;
          const dz = pProp.position.z - pCand.position.z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          
          if (dist < trialMinDist) {
            trialMinDist = dist;
          }
          if (dist < 1.0) { // If it still causes critical collision, mark unsafe
            isSafe = false;
            break;
          }
        }
        if (!isSafe) break;
      }
      
      if (isSafe && trialMinDist >= 1.0) {
        // Delta-V approximation for plane change / hohmman transfer
        // Let's compute delta-v in m/s
        let deltaV = 0;
        if (trial.altOffset !== 0) {
          // Hohmann transfer approximation: dV = v * (dH / (2 * r))
          const RE = 6378.137;
          const v = Math.sqrt(398600.4418 / (RE + targetAlt)); // km/s
          deltaV = Math.abs((v * trial.altOffset) / (2 * (RE + targetAlt))) * 1000; // m/s
        } else if (trial.incOffset !== 0) {
          // Plane change approximation: dV = 2 * v * sin(dI / 2)
          const RE = 6378.137;
          const v = Math.sqrt(398600.4418 / (RE + targetAlt)); // km/s
          const dI = (trial.incOffset * Math.PI) / 180;
          deltaV = 2 * v * Math.sin(dI / 2) * 1000; // m/s
        }

        alternatives.push({
          label: trial.label,
          altitudeKm: trialAlt,
          inclination: trialInc,
          deltaV: Math.round(deltaV),
          safetyMargin: trialMinDist === Infinity ? 999.0 : trialMinDist
        });
      }
    }
  }

  // Sort suggestions by required deltaV (lower is better/cheaper)
  alternatives.sort((a, b) => a.deltaV - b.deltaV);

  // 3.5 Generate orbit path points for one orbital period using SGP4 starting at tcaTime (or now)
  const proposedOrbitPoints = [];
  const RE = 6378.137;
  const GM = 398600.4418;
  const a = RE + parseFloat(altitudeKm);
  const period_sec = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / GM);
  const orbitStart = tcaTime ? new Date(tcaTime) : now;
  const numSteps = 180;
  for (let i = 0; i <= numSteps; i++) {
    const stepTime = new Date(orbitStart.getTime() + (i / numSteps) * period_sec * 1000);
    const pProp = propagate(proposedSatRec, stepTime);
    if (pProp.position) {
      proposedOrbitPoints.push({
        x: pProp.position.x,
        y: pProp.position.y,
        z: pProp.position.z
      });
    }
  }

  const response = {
    status,
    closestApproachKm: minDistance === Infinity ? null : minDistance,
    tca: tcaTime,
    probability: pc,
    relativeVelocity: tcaRelVelocity,
    conflictingObject: tcaCandidate ? {
      norad_id: tcaCandidate.sat.norad_id,
      name: tcaCandidate.sat.name,
      object_type: tcaCandidate.sat.object_type,
      ageDays: tcaCandidate.ageDays
    } : null,
    proposedPos: tcaProposedPos,
    conflictPos: tcaCandidatePos,
    suggestions: alternatives,
    proposedOrbitPoints,
  };

  self.postMessage(response);
};
