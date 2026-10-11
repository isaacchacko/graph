import { useCallback, useRef, useState } from "react";

const LIMIT = 200;
/** Changes sharing a merge key this close together become one undo step. */
const MERGE_WINDOW_MS = 1200;
/** Merge keys with this prefix merge for as long as they repeat, whatever the gap (one rename = one step). */
export const SESSION_PREFIX = "session:";

interface Timeline<T> {
  past: T[];
  present: T;
  future: T[];
}

/**
 * State with undo/redo. Pass a `merge` key to fold rapid related changes
 * (typing, dragging a slider) into a single step.
 */
export function useHistory<T>(initial: () => T) {
  const [timeline, setTimeline] = useState<Timeline<T>>(() => ({ past: [], present: initial(), future: [] }));
  const lastChange = useRef<{ key?: string; time: number }>({ time: 0 });

  const set = useCallback((next: T | ((present: T) => T), merge?: string) => {
    const now = Date.now();
    const merging =
      merge !== undefined &&
      lastChange.current.key === merge &&
      (merge.startsWith(SESSION_PREFIX) || now - lastChange.current.time < MERGE_WINDOW_MS);
    lastChange.current = { key: merge, time: now };
    setTimeline((t) => {
      const value = typeof next === "function" ? (next as (p: T) => T)(t.present) : next;
      if (Object.is(value, t.present)) return t;
      const past = merging ? t.past : [...t.past, t.present].slice(-LIMIT);
      return { past, present: value, future: [] };
    });
  }, []);

  /** Replaces the present without recording a step (initial load). */
  const reset = useCallback((value: T) => setTimeline({ past: [], present: value, future: [] }), []);

  const undo = useCallback(() => {
    lastChange.current = { time: 0 };
    setTimeline((t) => (t.past.length ? { past: t.past.slice(0, -1), present: t.past[t.past.length - 1], future: [t.present, ...t.future] } : t));
  }, []);

  const redo = useCallback(() => {
    lastChange.current = { time: 0 };
    setTimeline((t) => (t.future.length ? { past: [...t.past, t.present], present: t.future[0], future: t.future.slice(1) } : t));
  }, []);

  /** Drops the latest step without making it redoable (an abandoned edit). */
  const discard = useCallback(() => {
    lastChange.current = { time: 0 };
    setTimeline((t) => (t.past.length ? { past: t.past.slice(0, -1), present: t.past[t.past.length - 1], future: t.future } : t));
  }, []);

  return { value: timeline.present, set, reset, undo, redo, discard, canUndo: timeline.past.length > 0, canRedo: timeline.future.length > 0 };
}
