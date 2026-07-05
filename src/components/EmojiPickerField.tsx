import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  EmojiKeyboard,
  type EmojiType,
  useRecentPicksPersistence,
} from "rn-emoji-keyboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getKv } from "../data/mmkv";
import { emojiPickerTheme } from "../theme/emojiPickerTheme";
import { useTheme } from "../theme/theme";
import { Icon } from "./Icon";

type Props = {
  value: string;
  onChange: (emoji: string) => void;
};

const RECENT_EMOJIS_KEY = "recentEmojis";

export function EmojiPickerField({ value, onChange }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={[
            styles.modal,
            { backgroundColor: theme.background, paddingTop: insets.top + 8 },
          ]}
        >
          <View style={styles.modalHeader}>
            <Pressable
              accessibilityLabel="Close emoji picker"
              onPress={() => setOpen(false)}
              hitSlop={12}
            >
              <Icon name="close" size={28} color={theme.subtext} />
            </Pressable>
          </View>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <EmojiKeyboard
              onEmojiSelected={(e: EmojiType) => {
                onChange(e.emoji);
                setOpen(false);
              }}
              enableSearchBar
              enableRecentlyUsed
              categoryPosition="top"
              theme={emojiPickerTheme(theme)}
            />
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: 6 },
  flex: { flex: 1 },
  modal: { flex: 1, paddingHorizontal: 8 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
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
