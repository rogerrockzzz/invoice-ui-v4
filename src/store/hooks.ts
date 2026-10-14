import { useTranslation } from "react-i18next";
import { useWorld, worldOf } from "./world";
import type { World } from "../domain/types";

/* The whole world for domain reads. The world store is replaced on every change (immer), so
   components re-render whenever anything they could read has changed — the same model as v3's render(). */
export const useW = (): World => worldOf(useWorld());

/* "Coming in …" text for entry points that belong to a later checkpoint or milestone */
export function useComingSoon() {
  const { t } = useTranslation();
  return (when: string) => t("app.comingSoon", { when });
}
