import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatTimeSignature, parseTimeSignature } from "@/lib/convert-files";
import { cn } from "@/lib/utils";

export function TimeSignatureInput({
  id,
  numerator,
  denominator,
  placeholder = "4/4",
  className,
  onChange,
}: {
  id?: string;
  numerator: string;
  denominator: string;
  placeholder?: string;
  className?: string;
  onChange: (values: { numerator: string; denominator: string }) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const formatted = formatTimeSignature(Number(numerator), Number(denominator));

  return (
    <Input
      id={id}
      className={cn("max-w-md font-mono tabular-nums", className)}
      value={draft ?? formatted}
      placeholder={placeholder}
      inputMode="text"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const parsed = parseTimeSignature(draft ?? formatted);
        if (parsed) {
          onChange({
            numerator: String(parsed.numerator),
            denominator: String(parsed.denominator),
          });
        }
        setDraft(null);
      }}
    />
  );
}
