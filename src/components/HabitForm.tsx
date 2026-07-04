import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/theme";
import { EmojiPickerField } from "./EmojiPickerField";
import { Icon } from "./Icon";

type Props = {
  title: string;
  submitLabel: string;
  initialName?: string;
  initialEmoji?: string;
  onSubmit: (values: { name: string; emoji: string }) => void;
  onCancel: () => void;
};

export function HabitForm({
  title,
  submitLabel,
  initialName = "",
  initialEmoji = "✅",
  onSubmit,
  onCancel,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState(initialEmoji);

  const canSubmit = name.trim().length > 0;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingTop: insets.top + 8 },
      ]}
    >
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Icon name="close" size={28} color={theme.subtext} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.body}>
        <EmojiPickerField value={emoji} onChange={setEmoji} />

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.subtext }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Drink water"
            placeholderTextColor={theme.subtext}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() =>
              canSubmit && onSubmit({ name: name.trim(), emoji })
            }
            style={[
              styles.input,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />
        </View>
      </View>

      <Pressable
        disabled={!canSubmit}
        onPress={() => onSubmit({ name: name.trim(), emoji })}
        style={({ pressed }) => [
          styles.submit,
          {
            backgroundColor: canSubmit ? theme.accent : theme.border,
            opacity: pressed ? 0.85 : 1,
            marginBottom: insets.bottom + 12,
          },
        ]}
      >
        <Text style={styles.submitText}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: "700" },
  body: { gap: 28, marginTop: 24, flex: 1 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600", marginLeft: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
  },
  submit: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
