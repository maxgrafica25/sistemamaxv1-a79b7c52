import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

const IsAdminContext = createContext<boolean>(false);

export function IsAdminProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  return <IsAdminContext.Provider value={isAdmin}>{children}</IsAdminContext.Provider>;
}

export function useIsAdmin(): boolean {
  const { profile } = useAuth();
  return profile?.role === "admin";
}
