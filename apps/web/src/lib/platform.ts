import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Whether shortcuts should read ⌘ rather than Ctrl. False during server render. */
export function useIsMac(): boolean {
  return useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);
}

/** Live result of a media query. False during server render. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
