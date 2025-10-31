import {
  Leaf,
  Truck,
  ShieldCheck,
  Sparkles,
  HeartHandshake,
  User,
  Mail,
  MapPin,
  Phone,
  EarIcon,
  Scale,
  type LucideIcon,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  Leaf,
  Truck,
  ShieldCheck,
  Sparkles,
  HeartHandshake,
  User,
  Mail,
  MapPin,
  Phone,
  EarIcon,
  Scale,
};

export type IconName = keyof typeof ICON_MAP;
