import { useContext } from "react";
import { ThemeContext } from "./ThemeProvider";

/** Safe theme access — returns null outside ThemeProvider */
export function useThemeOptional() {
  return useContext(ThemeContext);
}
