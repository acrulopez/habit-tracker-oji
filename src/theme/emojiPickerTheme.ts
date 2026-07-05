import type { Theme } from "./theme";

/**
 * The subset of `rn-emoji-keyboard`'s `Theme` we override. The library
 * deep-merges this over its own defaults, so a partial object is enough. Kept as
 * a plain function of the app `Theme` so the picker follows light/dark mode.
 */
export function emojiPickerTheme(theme: Theme) {
  return {
    backdrop: "#00000088",
    knob: theme.border,
    container: theme.card,
    header: theme.subtext,
    category: {
      icon: theme.subtext,
      iconActive: theme.accent,
      container: theme.card,
      containerActive: theme.accentMuted,
    },
    search: {
      background: theme.background,
      text: theme.text,
      placeholder: theme.subtext,
      icon: theme.subtext,
    },
    emoji: {
      selected: theme.accentMuted,
    },
  };
}
