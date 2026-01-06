/**
 * Convert weight from grams to ounces
 * 1 gram = 0.035274 ounces
 */
export function gramsToOunces(grams: number): number {
  return parseFloat((grams * 0.035274).toFixed(1));
}

/**
 * Convert weight from kilograms to ounces
 * 1 kg = 35.274 ounces
 */
export function kilogramsToOunces(kg: number): number {
  return parseFloat((kg * 35.274).toFixed(1));
}

/**
 * Convert weight from ounces to grams
 */
export function ouncesToGrams(oz: number): number {
  return Math.round(oz / 0.035274);
}

/**
 * Convert length from centimeters to inches
 * 1 cm = 0.393701 inches
 */
export function centimetersToInches(cm: number): number {
  return parseFloat((cm * 0.393701).toFixed(1));
}

/**
 * Convert length from meters to inches
 * 1 m = 39.3701 inches
 */
export function metersToInches(m: number): number {
  return parseFloat((m * 39.3701).toFixed(1));
}

/**
 * Convert length from inches to centimeters
 */
export function inchesToCentimeters(inches: number): number {
  return Math.round(inches / 0.393701);
}
