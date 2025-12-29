const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// Excludes O, I, 0, 1 for readability

export function generateDiscountCode(options?: {
  prefix?: string; // e.g. "SAVE", "WELCOME"
  groups?: number; // number of groups
  charsPerGroup?: number; // characters per group
}): string {
  const { prefix = "", groups = 3, charsPerGroup = 4 } = options || {};

  const randomChar = () =>
    ALPHABET[Math.floor(Math.random() * ALPHABET.length)];

  const generateGroup = () =>
    Array.from({ length: charsPerGroup }, randomChar).join("");

  const codeGroups = Array.from({ length: groups }, generateGroup);

  return [prefix, ...codeGroups].filter(Boolean).join("-").toUpperCase();
}

export async function generateUniqueDiscountCode(
  exists: (code: string) => Promise<boolean>,
  options?: Parameters<typeof generateDiscountCode>[0],
  maxAttempts = 5
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateDiscountCode(options);
    if (!(await exists(code))) return code;
  }

  throw new Error("Failed to generate a unique discount code");
}
