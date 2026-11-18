import { type } from "arktype";

// Adapted from APPCONSTANCIAS/src/lib/types/users.ts.
export const passwordRequirements = [
  { check: (value: string) => value.length >= 8, label: "Mínimo 8 caracteres" },
  {
    check: (value: string) => /[a-z]/.test(value),
    label: "Al menos una letra minúscula",
  },
  {
    check: (value: string) => /[A-Z]/.test(value),
    label: "Al menos una letra mayúscula",
  },
  { check: (value: string) => /\d/.test(value), label: "Al menos un número" },
  {
    check: (value: string) => /[\W_]/.test(value),
    label: "Al menos un carácter especial (!@#...)",
  },
];
export function rutCheckDigit(body: string) {
  let sum = 0;
  let factor = 2;
  for (let index = body.length - 1; index >= 0; index--) {
    sum += Number(body[index]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const digit = 11 - (sum % 11);
  return digit === 11 ? "0" : digit === 10 ? "K" : String(digit);
}
export const rutValidation = type("string").narrow((value, context) => {
  if (!/^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/.test(value))
    return context.reject({
      code: "predicate",
      message: "El RUT debe tener puntos y guion",
    });
  const [formatted, digit] = value.split("-");
  const body = formatted.replaceAll(".", "");
  if (/^0+$/.test(body) || rutCheckDigit(body) !== digit.toUpperCase())
    return context.reject({
      code: "predicate",
      message: "El dígito verificador del RUT no es válido",
    });
  return true;
});
export const emailValidation = type("string.email").configure({
  message: "Debe ingresar un email válido",
});
export const normalizePhone = (value: string) => value.replace(/[\s()-]/g, "");
export const phoneValidation = type("string").narrow((value, context) => {
  if (!value || /^(?:\+?56)?[2-9]\d{8}$/.test(normalizePhone(value)))
    return true;
  return context.reject({
    code: "predicate",
    message: "Ingresa un teléfono chileno válido, por ejemplo +56 9 1234 5678",
  });
});
export const passwordValidation = type("string").narrow((value, context) => {
  const missing = passwordRequirements
    .filter((requirement) => !requirement.check(value))
    .map((requirement) => requirement.label);
  // bcrypt only uses the first 72 bytes: reject longer values before hashing.
  if (new TextEncoder().encode(value).length > 72)
    missing.push("La contraseña es demasiado larga.");
  return missing.length
    ? context.reject({ code: "predicate", message: missing.join("\n") })
    : true;
});
export const rutError = (value: string) => {
  const result = rutValidation(value);
  return result instanceof type.errors ? result.summary : null;
};
export const emailError = (value: string) => {
  const result = emailValidation(value);
  return result instanceof type.errors ? result.summary : null;
};
export const phoneError = (value: string) => {
  const result = phoneValidation(value);
  return result instanceof type.errors ? result.summary : null;
};
export const passwordError = (value: string) => {
  const result = passwordValidation(value);
  return result instanceof type.errors ? result.summary : null;
};
