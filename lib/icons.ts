import {
  Leaf,
  Truck,
  ShieldCheck,
  Sparkles,
  HeartHandshake,
  User,
  type LucideIcon,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  Leaf,
  Truck,
  ShieldCheck,
  Sparkles,
  HeartHandshake,
  User,
};

export type IconName = keyof typeof ICON_MAP;
