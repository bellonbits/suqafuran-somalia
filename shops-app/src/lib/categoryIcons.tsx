import {
    Laptop, Shirt, Wheat, Dumbbell, Wrench, ShoppingBasket,
    SprayCan, Building2, Package, Sparkles, Tag, Car, PawPrint,
    Briefcase, Landmark, Smartphone, Baby, Apple, Home,
    type LucideIcon,
} from 'lucide-react';

/**
 * Canonical category slug → icon.
 * Slugs match the 17 platform categories exactly (lower-kebab-case).
 * Also handles legacy / API slugs via keyword matching.
 */
export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
    // ── The 17 canonical slugs ──────────────────────────────────────────────
    'commercial-equipment':  Wrench,
    electronics:             Laptop,
    'land-farms':            Wheat,
    'leisure-sports':        Dumbbell,
    'repair-construction':   Wrench,
    'food-groceries':        ShoppingBasket,
    'beauty-personal-care':  SprayCan,
    'clothing-shoes':        Shirt,
    'household-items':       Home,
    vehicles:                Car,
    livestock:               PawPrint,
    property:                Building2,
    services:                Briefcase,
    jobs:                    Landmark,
    'agriculture-food':      Apple,
    phones:                  Smartphone,
    'babies-kids':           Baby,
    // ── Static nav ──────────────────────────────────────────────────────────
    all:                     Sparkles,
    deals:                   Tag,
};

export function getCategoryIcon(slug: string): LucideIcon {
    const lower = slug.toLowerCase().replace(/\s+/g, '-');

    // Exact canonical match first
    if (CATEGORY_ICON_MAP[lower]) return CATEGORY_ICON_MAP[lower];

    // Keyword fallbacks for API slugs that don't match perfectly
    if (lower.includes('phone') || lower.includes('mobile')) return Smartphone;
    if (lower.includes('baby') || lower.includes('kid') || lower.includes('child') || lower.includes('infant')) return Baby;
    if (lower.includes('food') || lower.includes('grocer') || lower.includes('agri')) return ShoppingBasket;
    if (lower.includes('cloth') || lower.includes('shoe') || lower.includes('apparel') || lower.includes('fashion')) return Shirt;
    if (lower.includes('house') || lower.includes('home') || lower.includes('furniture') || lower.includes('household')) return Home;
    if (lower.includes('electron') || lower.includes('tech') || lower.includes('gadget')) return Laptop;
    if (lower.includes('vehicle') || lower.includes('car') || lower.includes('auto') || lower.includes('motor')) return Car;
    if (lower.includes('live') || lower.includes('animal') || lower.includes('livestock') || lower.includes('goat') || lower.includes('camel')) return PawPrint;
    if (lower.includes('land') || lower.includes('farm') || lower.includes('agri') || lower.includes('wheat')) return Wheat;
    if (lower.includes('service') || lower.includes('consult') || lower.includes('repair')) return Briefcase;
    if (lower.includes('beauty') || lower.includes('health') || lower.includes('skin') || lower.includes('cosmet') || lower.includes('personal')) return SprayCan;
    if (lower.includes('property') || lower.includes('estate') || lower.includes('real')) return Building2;
    if (lower.includes('job') || lower.includes('work') || lower.includes('career') || lower.includes('employ')) return Landmark;
    if (lower.includes('sport') || lower.includes('fitness') || lower.includes('gym') || lower.includes('leisure')) return Dumbbell;
    if (lower.includes('construct') || lower.includes('equipment') || lower.includes('commercial') || lower.includes('tool')) return Wrench;
    if (lower.includes('all')) return Sparkles;
    if (lower.includes('deal')) return Tag;
    return Package;
}
