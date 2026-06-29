import { useColorScheme } from "react-native";

export type Theme = {
  dark: boolean;
  background: string;
  card: string;
  cardPressed: string;
  text: string;
  subtext: string;
  border: string;
  accent: string;
  accentMuted: string;
  danger: string;
};

const light: Theme = {
  dark: false,
  background: "#F4F4F6",
  card: "#FFFFFF",
  cardPressed: "#ECECEF",
  text: "#111114",
  subtext: "#6B7280",
  border: "#E4E4E8",
  accent: "#22C55E",
  accentMuted: "#DCFCE7",
  danger: "#EF4444",
};

const dark: Theme = {
  dark: true,
  background: "#0E0E10",
  card: "#1A1A1E",
  cardPressed: "#26262C",
  text: "#F5F5F7",
  subtext: "#9CA3AF",
  border: "#2A2A30",
  accent: "#22C55E",
  accentMuted: "#143321",
  danger: "#F87171",
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}
