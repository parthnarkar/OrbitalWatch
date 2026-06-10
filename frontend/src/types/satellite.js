/**
 * @fileoverview Satellite type constants and shape validators
 * Plain JavaScript definitions for satellite data structures used across OrbitalWatch.
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** @type {readonly string[]} */
export const RISK_LEVELS = /** @type {const} */ (['LOW', 'MEDIUM', 'HIGH'])

/** @type {readonly string[]} */
export const OBJECT_TYPES = /** @type {const} */ ([
  'payload',
  'debris',
  'rocket body',
  'unknown',
])

// ── JSDoc Type Definitions ────────────────────────────────────────────────────

/**
 * @typedef {Object} Satellite
 * @property {string} norad_id - NORAD catalog number (unique identifier)
 * @property {string} name - Human-readable satellite name
 * @property {'payload'|'debris'|'rocket body'|'unknown'} object_type - Object classification
 * @property {string} [tle_line1] - First line of Two-Line Element set
 * @property {string} [tle_line2] - Second line of Two-Line Element set
 * @property {number} [inclination] - Orbital inclination in degrees
 * @property {number} [altitude_km] - Approximate altitude in kilometers
 * @property {string} [launch_date] - ISO 8601 launch date string
 * @property {string} [country] - Country of origin code
 */

/**
 * @typedef {Object} SatellitePosition
 * @property {string} norad_id - NORAD catalog number
 * @property {number} latitude - Latitude in decimal degrees (-90 to 90)
 * @property {number} longitude - Longitude in decimal degrees (-180 to 180)
 * @property {number} altitude_km - Altitude above sea level in kilometers
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {number} [velocity_km_s] - Orbital velocity in km/s
 */

/**
 * @typedef {Object} Conjunction
 * @property {string} id - Unique conjunction event ID
 * @property {string} satellite1_id - NORAD ID of first object
 * @property {string} satellite2_id - NORAD ID of second object
 * @property {string} satellite1_name - Name of first object
 * @property {string} satellite2_name - Name of second object
 * @property {number} tca - Time of Closest Approach (Unix timestamp)
 * @property {number} miss_distance_km - Predicted miss distance in kilometers
 * @property {number} probability - Collision probability (0.0 to 1.0)
 * @property {'LOW'|'MEDIUM'|'HIGH'} risk_level - Assessed risk level
 */

/**
 * @typedef {Object} Alert
 * @property {string} id - Unique alert ID
 * @property {'LOW'|'MEDIUM'|'HIGH'} severity - Alert severity level
 * @property {string} message - Human-readable alert description
 * @property {number} timestamp - Unix timestamp when alert was created
 * @property {string} [conjunction_id] - Related conjunction event ID, if any
 */

/**
 * @typedef {Object} AppStats
 * @property {number} total_satellites - Total tracked satellites
 * @property {number} total_debris - Total tracked debris objects
 * @property {number} active_conjunctions - Number of active conjunction events
 * @property {number} high_risk_count - Number of HIGH risk conjunctions
 * @property {number} last_updated - Unix timestamp of last data update
 */

// ── Shape Validators ──────────────────────────────────────────────────────────

/**
 * Validates that an object conforms to the Satellite shape.
 *
 * @param {unknown} obj - The object to validate
 * @returns {obj is Satellite} True if the object is a valid Satellite
 */
export function isValidSatellite(obj) {
  if (!obj || typeof obj !== 'object') return false
  const s = /** @type {Record<string, unknown>} */ (obj)
  return (
    typeof s.norad_id === 'string' && s.norad_id.length > 0 &&
    typeof s.name === 'string' && s.name.length > 0 &&
    OBJECT_TYPES.includes(/** @type {string} */ (s.object_type))
  )
}

/**
 * Validates that an object conforms to the SatellitePosition shape.
 *
 * @param {unknown} obj - The object to validate
 * @returns {obj is SatellitePosition} True if the object is a valid SatellitePosition
 */
export function isValidPosition(obj) {
  if (!obj || typeof obj !== 'object') return false
  const p = /** @type {Record<string, unknown>} */ (obj)
  return (
    typeof p.norad_id === 'string' && p.norad_id.length > 0 &&
    typeof p.latitude === 'number' && p.latitude >= -90 && p.latitude <= 90 &&
    typeof p.longitude === 'number' && p.longitude >= -180 && p.longitude <= 180 &&
    typeof p.altitude_km === 'number' && p.altitude_km >= 0 &&
    typeof p.timestamp === 'number'
  )
}

/**
 * Validates that an object conforms to the Conjunction shape.
 *
 * @param {unknown} obj - The object to validate
 * @returns {obj is Conjunction} True if the object is a valid Conjunction
 */
export function isValidConjunction(obj) {
  if (!obj || typeof obj !== 'object') return false
  const c = /** @type {Record<string, unknown>} */ (obj)
  return (
    typeof c.id === 'string' && c.id.length > 0 &&
    typeof c.satellite1_id === 'string' &&
    typeof c.satellite2_id === 'string' &&
    typeof c.miss_distance_km === 'number' &&
    typeof c.probability === 'number' &&
    RISK_LEVELS.includes(/** @type {string} */ (c.risk_level))
  )
}
