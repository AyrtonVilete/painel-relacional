import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// clsx alone just concatenates class names — if a caller's className passes
// a conflicting utility (e.g. `w-56` against a component's own `w-full`),
// which one wins depends on Tailwind's internal generation order, not on
// the order the strings appear here. twMerge resolves that properly by
// dropping the earlier conflicting utility instead of leaving both in the
// DOM for the cascade to arbitrate.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
