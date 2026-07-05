import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import EmojiPicker, {
  type EmojiType,
  useRecentPicksPersistence,
} from "rn-emoji-keyboard";
import { getKv } from "../data/mmkv";
import { emojiPickerTheme } from "../theme/emojiPickerTheme";
import { useTheme } from "../theme/theme";

type Props = {
  value: string;
  onChange: (emoji: string) => void;
};

const RECENT_EMOJIS_KEY = "recentEmojis";

export function EmojiPickerField({ value, onChange }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  useRecentPicksPersistence({
    initialization: () => {
      const raw = getKv().getString(RECENT_EMOJIS_KEY);
      try {
        return Promise.resolve(raw ? JSON.parse(raw) : []);
      } catch {
        return Promise.resolve([]);
      }
    },
    onStateChange: (next) => {
      getKv().set(RECENT_EMOJIS_KEY, JSON.stringify(next));
    },
  });

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityLabel="Choose emoji"
        onPress={() => setOpen(true)}
        style={[
          styles.box,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={styles.emoji}>{value || "🙂"}</Text>
      </Pressable>
      <Text style={[styles.hint, { color: theme.subtext }]}>Tap to change</Text>

      <EmojiPicker
        open={open}
        onClose={() => setOpen(false)}
        onEmojiSelected={(e: EmojiType) => {
          onChange(e.emoji);
          setOpen(false);
        }}
        enableSearchBar
        enableRecentlyUsed
        categoryPosition="top"
        defaultHeight="85%"
        theme={emojiPickerTheme(theme)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: 6 },
  box: {
    width: 84,
    height: 84,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 44 },
  hint: { fontSize: 13 },
});
