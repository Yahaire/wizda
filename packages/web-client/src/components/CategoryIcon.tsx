'use client';

import {
    GiBattleAxe, GiBoots, GiBreastplate, GiBroadsword, GiCrocSword, GiFlangedMace, GiGauntlet,
    GiGavel, GiGloves, GiHatchet, GiHighShot, GiKatana, GiLeatherArmor, GiLeatherBoot, GiLightHelm,
    GiMailedFist, GiOrbWand, GiPlainDagger, GiPointyHat, GiRing, GiRobe, GiRoundShield, GiSandal,
    GiShield, GiShuriken, GiStoneSpear, GiTemplarShield, GiVisoredHelm, GiWarPick, GiWizardStaff
} from 'react-icons/gi';

import { gameIcon, IconComponent, IconComponentProps } from '@/components/icons/iconComponent';
import { EQUIPMENT_CATEGORIES, EquipmentTypeKind } from '@shared/domain/equipment';
import {
    IconBrandRedhat, IconCircle, IconHandStop, IconQuestionMark, IconShield, IconShirt, IconShoe,
    IconSword
} from '@tabler/icons-react';

/**
 * Per-category equipment icons, drawn from game-icons.net (CC BY 3.0 — see the
 * About page's credits). Keyed by `EquipmentCategoryInfo.code`.
 *
 * A few picks are approximations, because no set draws every distinction this
 * game makes: Ninjato and Odachi have no true glyph (a straight short sword and
 * an oversized katana stand in), and Two-Handed Spear borrows a generic spear.
 * The one-vs-two-handed split is real art, not a modifier, wherever it exists.
 */
const EQUIPMENT_CATEGORY_ICONS: Record<string, IconComponent> = {
  // Weapons
  DAGGER: gameIcon(GiPlainDagger),
  ONE_HANDED_SWORD: gameIcon(GiBroadsword),
  ONE_HANDED_AXE: gameIcon(GiHatchet),
  ONE_HANDED_STAFF: gameIcon(GiOrbWand),
  ONE_HANDED_BLUNT_WEAPON: gameIcon(GiFlangedMace),
  THROWING_NINJA_TOOL: gameIcon(GiShuriken),
  NINJATO: gameIcon(GiKatana),
  KATANA: gameIcon(GiKatana),
  TWO_HANDED_SWORD: gameIcon(GiCrocSword),
  TWO_HANDED_AXE: gameIcon(GiBattleAxe),
  TWO_HANDED_STAFF: gameIcon(GiWizardStaff),
  TWO_HANDED_BLUNT_WEAPON: gameIcon(GiGavel),
  TWO_HANDED_SPEAR: gameIcon(GiStoneSpear),
  BOW: gameIcon(GiHighShot),
  ODACHI: gameIcon(GiKatana),
  TOOLS: gameIcon(GiWarPick),

  // Shields
  SMALL_SHIELD: gameIcon(GiRoundShield),
  LIGHT_SHIELD: gameIcon(GiShield),
  HEAVY_SHIELD: gameIcon(GiTemplarShield),

  // Helmets
  HAT: gameIcon(GiPointyHat),
  LIGHT_HELMET: gameIcon(GiLightHelm),
  HEAVY_HELMET: gameIcon(GiVisoredHelm),

  // Gloves
  GLOVES: gameIcon(GiGloves),
  LIGHT_GAUNTLETS: gameIcon(GiGauntlet),
  HEAVY_GAUNTLETS: gameIcon(GiMailedFist),

  // Chest armor
  CLOTHES: gameIcon(GiRobe),
  LIGHT_ARMOR: gameIcon(GiLeatherArmor),
  HEAVY_ARMOR: gameIcon(GiBreastplate),

  // Boots
  SHOES: gameIcon(GiSandal),
  LIGHT_ARMOR_BOOTS: gameIcon(GiLeatherBoot),
  HEAVY_ARMOR_BOOTS: gameIcon(GiBoots),

  // Accessories
  ACCESSORIES: gameIcon(GiRing),
};

/**
 * Fallback icons, one per equipment type — Tabler line icons, kept as the
 * backstop for a category code with no entry above (a newly seeded category, say).
 * A question mark stands in whenever the category is unknown outright — a neutral
 * shape read as a failed render.
 */
const EQUIPMENT_TYPE_ICONS: Record<EquipmentTypeKind, IconComponent> = {
  [EquipmentTypeKind.WEAPON]: IconSword,
  [EquipmentTypeKind.SHIELD]: IconShield,
  [EquipmentTypeKind.HELMET]: IconBrandRedhat,
  [EquipmentTypeKind.GLOVES]: IconHandStop,
  [EquipmentTypeKind.CHEST_ARMOR]: IconShirt,
  [EquipmentTypeKind.BOOTS]: IconShoe,
  [EquipmentTypeKind.ACCESSORY]: IconCircle,
};

/** Category code → its equipment type, so a code alone is enough to pick an icon. */
const EQUIPMENT_TYPE_BY_CATEGORY = new Map(
  EQUIPMENT_CATEGORIES.map((category) => [category.code, category.equipmentType]),
);

/**
 * The icon for an equipment category: its own glyph, else its type's, else a
 * question mark.
 */
export function getCategoryIcon(categoryCode?: string | null): IconComponent {
  if (!categoryCode) {
    return IconQuestionMark;
  }
  const categoryIcon = EQUIPMENT_CATEGORY_ICONS[categoryCode];
  if (categoryIcon) {
    return categoryIcon;
  }
  const equipmentType = EQUIPMENT_TYPE_BY_CATEGORY.get(categoryCode);
  return equipmentType ? EQUIPMENT_TYPE_ICONS[equipmentType] : IconQuestionMark;
}

interface CategoryIconProps extends IconComponentProps {
  categoryCode?: string | null,
}

export function CategoryIcon({ categoryCode, className, ...iconProps }: CategoryIconProps) {
  const Icon = getCategoryIcon(categoryCode);
  // CategoryIcon is only ever a rank-tinted equipment glyph, so it always carries
  // the legibility rim (see `.wizda-icon-outline`).
  return <Icon {...iconProps} className={['wizda-icon-outline', className].filter(Boolean).join(' ')} />;
}
