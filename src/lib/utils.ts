import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only dedupes classes it can classify. Our display scale
 * (`text-display-md`, …) is a custom @theme font-size, so out of the box merge
 * treats it as unknown and lets a component's built-in `text-sm` survive
 * alongside it — leaving stylesheet order to pick the winner, which is how
 * `<CardTitle className="text-display-md">` silently rendered at 12px.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: ["display-md", "display-lg", "display-xl", "display-2xl"],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
