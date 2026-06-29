import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import EmojiPicker, { type EmojiType } from "rn-emoji-keyboard";
import { useTheme } from "../theme/theme";

type Props = {
  value: string;
  onChange: (emoji: string) => void;
};

export function EmojiPickerField({ value, onChange }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

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
