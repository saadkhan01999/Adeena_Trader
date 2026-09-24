/**
 * ============================================
 * Icon Registry
 * ============================================
 * A curated map of every icon referenced by NAME rather than by import —
 * navigation items, category icons, role badges.
 *
 * Why a registry instead of `import * as Icons from 'lucide-react'`
 * ----------------------------------------------------------------
 * The wildcard import defeats tree-shaking and pulls the entire Lucide set into
 * the bundle: roughly 500 kB for the handful of icons actually used. Naming
 * them explicitly here brings that down to only what is rendered, which matters
 * on a shop's mobile connection.
 *
 * Adding an icon is a one-line change: import it, add it to ICONS.
 */

import {
  // Navigation
  LayoutDashboard, ShoppingCart, Users, Package, Tags, ShoppingBag, Truck,
  CalendarClock, WalletCards, ReceiptText, RotateCcw, UsersRound,
  BriefcaseBusiness, FileSignature, ChartNoAxesCombined, HandCoins,
  Calculator, UserCog, Settings,

  // Categories
  Smartphone, Sun, Bike, Refrigerator, Sofa, HardHat, Building2,
  Laptop, Tv, WashingMachine, AirVent, Watch, Headphones, Wrench, Zap, Car,

  // Roles and general
  ShieldCheck, ClipboardList, User, Circle, Check, FileText, Receipt,
  Handshake, Banknote, Landmark, CreditCard, Wallet,
  Boxes, ScrollText, Plug, BatteryCharging, Fan, Microwave, Lamp, CookingPot,
} from 'lucide-react';

/**
 * Every icon addressable by name.
 * Keys match the `icon` strings stored in the database and in constants.
 */
export const ICONS = {
  // ---- Navigation ----
  LayoutDashboard, ShoppingCart, Users, Package, Tags, ShoppingBag, Truck,
  CalendarClock, WalletCards, ReceiptText, RotateCcw, UsersRound,
  BriefcaseBusiness, FileSignature, ChartNoAxesCombined, HandCoins,
  Calculator, UserCog, Settings, Boxes,

  // ---- Product categories ----
  Smartphone, Sun, Bike, Refrigerator, Sofa, HardHat, Building2,
  Laptop, Tv, WashingMachine, AirVent, Watch, Headphones, Wrench, Zap, Car,
  Plug, BatteryCharging, Fan, Microwave, Lamp, CookingPot,

  // ---- Roles ----
  ShieldCheck, ClipboardList, User,

  // ---- Documents & payment ----
  FileText, Receipt, Handshake, Banknote, Landmark, CreditCard, Wallet, ScrollText,

  // Fallback for an unknown name
  Circle, Check,
};

/** Names offered in the category icon picker. */
export const CATEGORY_ICON_NAMES = [
  'Smartphone', 'Sun', 'Bike', 'Refrigerator', 'Sofa', 'HardHat', 'Building2',
  'Package', 'Laptop', 'Tv', 'WashingMachine', 'AirVent', 'Watch', 'Headphones',
  'Wrench', 'Zap', 'Car', 'ShoppingBag', 'Plug', 'BatteryCharging', 'Fan', 'Microwave',
  'Lamp', 'CookingPot', 'Boxes',
];

/**
 * Look up an icon component by name.
 * Falls back to a neutral circle so an unrecognised name never crashes a render.
 *
 * @param {string} name
 * @returns {React.ElementType}
 */
export const getIcon = (name) => ICONS[name] || Circle;

/**
 * Render an icon by name.
 *
 * @example <Icon name="Smartphone" size={18} className="text-gold-500" />
 */
export default function Icon({ name, ...props }) {
  const Component = getIcon(name);
  return <Component {...props} />;
}
