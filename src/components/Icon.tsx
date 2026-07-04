import {
  ArrowUpDown,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  Contrast,
  EllipsisVertical,
  GripHorizontal,
  Info,
  Plus,
  Settings,
  SquarePen,
  Trash2,
  X,
  type LucideProps,
} from "lucide-react-native";

/**
 * Lucide icon wrapper — see the parent `apps/CLAUDE.md` icon convention.
 * Screens import `Icon`, never `lucide-react-native` directly.
 */
export const icons = {
  // core vocabulary
  close: X,
  check: Check,
  add: Plus,
  settings: Settings,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  // app-specific extras
  more: EllipsisVertical,
  reorder: GripHorizontal,
  calendar: Calendar,
  edit: SquarePen,
  trash: Trash2,
  swapVertical: ArrowUpDown,
  cloud: Cloud,
  clock: Clock,
  contrast: Contrast,
  info: Info,
} as const;

export type IconName = keyof typeof icons;

export function Icon({
  name,
  size = 24,
  strokeWidth = 2,
  ...rest
}: { name: IconName; size?: number } & LucideProps) {
  const Cmp = icons[name];
  return <Cmp size={size} strokeWidth={strokeWidth} {...rest} />;
}
