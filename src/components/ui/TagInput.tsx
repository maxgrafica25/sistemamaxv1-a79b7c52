import { useState, KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

export function TagInput({ value, onChange, suggestions = [], placeholder = "Adicionar marcador…" }: Props) {
  const [input, setInput] = useState("");

  const add = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (value.includes(t)) return;
    onChange([...value, t]);
    setInput("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const filteredSugs = suggestions
    .filter((s) => !value.includes(s) && s.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 6);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 min-h-[40px]">
        {value.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1 pl-2 pr-1 text-xs">
            {t}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== t))}
              className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => input && add(input)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] h-7 border-0 px-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      {input && filteredSugs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {filteredSugs.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="text-xs rounded-full border border-border px-2 py-0.5 hover:bg-accent"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
