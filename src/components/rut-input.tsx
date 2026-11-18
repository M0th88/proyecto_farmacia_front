"use client";
import type { Ref } from "react";
import { formatRut } from "@/lib/user-input";

export function RutInput({
  value,
  onChange,
  inputRef,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef: Ref<HTMLInputElement>;
  id: string;
  onBlur: () => void;
  disabled: boolean;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
}) {
  return (
    <input
      {...props}
      ref={inputRef}
      value={formatRut(value)}
      placeholder="12.345.678-5"
      autoComplete="off"
      onChange={(event) => {
        const input = event.currentTarget;
        const count = input.value
          .slice(0, input.selectionStart ?? input.value.length)
          .replace(/[^\dkK]/g, "").length;
        const formatted = formatRut(input.value);
        let caret = 0;
        let characters = 0;
        while (caret < formatted.length && characters < count) {
          if (/[\dkK]/.test(formatted[caret])) characters++;
          caret++;
        }
        input.value = formatted;
        onChange(formatted);
        input.setSelectionRange(caret, caret);
      }}
    />
  );
}
