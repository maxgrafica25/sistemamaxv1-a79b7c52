import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const useAuthMock = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => useAuthMock() }));

import { useSomentePreImpressao } from "@/hooks/useSomentePreImpressao";

const comPerfil = (role: string, somente: boolean | undefined) =>
  useAuthMock.mockReturnValue({ profile: { role, somente_pre_impressao: somente } });

describe("useSomentePreImpressao", () => {
  beforeEach(() => useAuthMock.mockReset());

  it("sem perfil carregado não restringe", () => {
    useAuthMock.mockReturnValue({ profile: null });
    expect(renderHook(() => useSomentePreImpressao()).result.current).toBe(false);
  });

  it("colaborador com a marca fica restrito", () => {
    comPerfil("colaborador", true);
    expect(renderHook(() => useSomentePreImpressao()).result.current).toBe(true);
  });

  it("colaborador sem a marca (ou coluna ainda ausente) não é restrito", () => {
    comPerfil("colaborador", false);
    expect(renderHook(() => useSomentePreImpressao()).result.current).toBe(false);
    comPerfil("colaborador", undefined);
    expect(renderHook(() => useSomentePreImpressao()).result.current).toBe(false);
  });

  it("administrador nunca é restrito, mesmo com a marca", () => {
    comPerfil("admin", true);
    expect(renderHook(() => useSomentePreImpressao()).result.current).toBe(false);
  });
});
