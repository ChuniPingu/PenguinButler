import { describe, expect, it } from "vite-plus/test";
import { formatUnsignedIntegerString, parseCliJsonLine, quoteUnsafeIntegers } from "@/lib/cli-json";

describe("parseCliJsonLine", () => {
  it("preserves the default HCA encryption key digits", () => {
    const line = JSON.stringify({
      type: "result",
      data: { config: { hcaEncryptionKey: 32931609366120192 } },
    });
    // Native stringify already rounds — build the raw payload with exact digits.
    const raw = line.replace("32931609366120190", "32931609366120192");

    expect(Number.isSafeInteger(32931609366120192)).toBe(false);
    expect(String(32931609366120192)).toBe("32931609366120190");

    const parsed = parseCliJsonLine(raw) as {
      data: { config: { hcaEncryptionKey: string } };
    };
    expect(parsed.data.config.hcaEncryptionKey).toBe("32931609366120192");
  });

  it("leaves safe integers as numbers", () => {
    const parsed = parseCliJsonLine('{"batchSize":8,"releaseTagId":9007199254740991}') as {
      batchSize: number;
      releaseTagId: number;
    };
    expect(parsed.batchSize).toBe(8);
    expect(parsed.releaseTagId).toBe(9007199254740991);
    expect(typeof parsed.releaseTagId).toBe("number");
  });

  it("does not rewrite integers inside JSON strings", () => {
    const parsed = parseCliJsonLine('{"path":"key:32931609366120192"}') as { path: string };
    expect(parsed.path).toBe("key:32931609366120192");
  });
});

describe("quoteUnsafeIntegers", () => {
  it("quotes only integers outside the safe range", () => {
    expect(quoteUnsafeIntegers('{"a":32931609366120192,"b":42}')).toBe(
      '{"a":"32931609366120192","b":42}',
    );
  });
});

describe("formatUnsignedIntegerString", () => {
  it("keeps string values unchanged", () => {
    expect(formatUnsignedIntegerString("32931609366120192")).toBe("32931609366120192");
  });

  it("stringifies numeric values", () => {
    expect(formatUnsignedIntegerString(42)).toBe("42");
  });
});
