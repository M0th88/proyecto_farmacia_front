"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useState } from "react";
import type { Pharmacy } from "@/lib/auth/pharmacies";
import { makeQueryClient } from "@/lib/query-client";

const PharmacyContext = createContext<Pharmacy | null>(null);

export function PharmacyProvider({
  pharmacy,
  children,
}: {
  pharmacy: Pharmacy;
  children: ReactNode;
}) {
  const [client] = useState(makeQueryClient);
  return (
    <PharmacyContext.Provider value={pharmacy}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </PharmacyContext.Provider>
  );
}

export function usePharmacy() {
  const pharmacy = useContext(PharmacyContext);
  if (!pharmacy) throw new Error("Falta el contexto de farmacia.");
  return pharmacy;
}
