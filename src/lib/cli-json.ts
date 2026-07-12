const UNSAFE_INTEGER_TOKEN = /([:[,]\s*)(-?(?:0|[1-9]\d{15,}))(?=\s*[,}\]])/g;

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);

export function parseCliJsonLine(line: string): unknown {
  return JSON.parse(quoteUnsafeIntegers(line));
}

export function quoteUnsafeIntegers(json: string): string {
  return json.replace(UNSAFE_INTEGER_TOKEN, (match, prefix: string, digits: string) => {
    try {
      const value = BigInt(digits);
      if (value <= MAX_SAFE && value >= MIN_SAFE) return match;
    } catch {
      return match;
    }
    return `${prefix}"${digits}"`;
  });
}

export function formatUnsignedIntegerString(value: string | number): string {
  return typeof value === "string" ? value : String(value);
}
