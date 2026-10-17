import { useTranslation } from "react-i18next";
import { isAppError } from "./api";

/** Turns a Rust error into the translated message for its code. */
export function useMsg() {
  const { t } = useTranslation();
  return (e: unknown) => (isAppError(e) ? `${e.code}: ${t(`msg.${e.code}`)}` : String(e));
}
