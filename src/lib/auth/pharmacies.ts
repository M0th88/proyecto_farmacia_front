export const pharmacies = {
  privada: {
    name: "Farmacia Privada",
    cookie: "farmacia_privada_session",
    audience: "farmacia-privada",
  },
  asistencial: {
    name: "Farmacia Asistencial",
    cookie: "farmacia_asistencial_session",
    audience: "farmacia-asistencial",
  },
} as const;

export type Pharmacy = keyof typeof pharmacies;
export function isPharmacy(value: string): value is Pharmacy {
  return value === "privada" || value === "asistencial";
}
