"use client";

import type React from "react";
import Image from "next/image";
import { useState, useMemo, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  GripVertical,
  Package2,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  MoreHorizontal,
} from "lucide-react";
import toast from "react-hot-toast";
import colorOptions from "@/data/color-options.json";
import sizeOptions from "@/data/size-options.json";
import ageGroupOptions from "@/data/age-group-options.json";
import fabricOptions from "@/data/fabric-options.json";
import type { TaxonomyAttribute } from "@/lib/taxonomy";
import type { ListingVariant } from "@/db/schema";
import {
  gramsToOunces,
  kilogramsToOunces,
  centimetersToInches,
  metersToInches,
} from "@/lib/shipping-utils";

type OptionValue = {
  value: string;
  label: string;
  hex?: string;
};

type VariantOption = {
  id: string;
  name: string;
  values: OptionValue[];
};

// UI Variant type - based on ListingVariant from schema with UI-specific modifications

// Extend ListingVariant for UI form handling (price as string, add quantity and other UI fields)
type Variant = Omit<
  ListingVariant,
  | "listingId"
  | "createdAt"
  | "updatedAt"
  | "title"
  | "compareAtPrice"
  | "imageUrl"
  | "price"
> & {
  price: string; // String for input handling (overrides numeric price from schema)
  quantity: string; // Inventory quantity for UI (not in schema)
  barcode?: string; // UI-only field
  package?: string; // UI-only field
  weight?: string; // UI-only field (deprecated, use weightOz)
  origin?: string; // UI-only field
  images?: string[]; // Array of image URLs for UI (not in schema)
  options: Record<string, string>; // Ensure options is Record type (from schema but typed explicitly)
  // Shipping fields (stored in inventoryItems)
  weightOz?: string | null; // Weight in ounces (stored in DB)
  lengthIn?: string | null; // Length in inches (stored in DB)
  widthIn?: string | null; // Width in inches (stored in DB)
  heightIn?: string | null; // Height in inches (stored in DB)
};

const optionTypeData: Record<string, OptionValue[]> = {
  color: colorOptions,
  size: sizeOptions,
  "age-group": ageGroupOptions,
  fabric: fabricOptions,
};

const availableOptions = [
  { value: "color", label: "Color" },
  { value: "size", label: "Size" },
  { value: "age-group", label: "Age group" },
  { value: "fabric", label: "Fabric" },
];

interface ProductVariantsProps {
  initialVariants?: Variant[];
  onVariantsChange?: (variants: Variant[]) => void;
  onVariantImageChange?: (variantId: string, files: File[] | null) => void;
  variantImagePreviews?: Record<string, string[]>;
  onRemoveVariantImage?: (variantId: string, index: number) => void;
  recommendedAttributes?: TaxonomyAttribute[];
  storeCurrency?: string;
}

// Helper to dynamically load option file by handle
async function loadOptionFile(handle: string): Promise<OptionValue[]> {
  try {
    // Try to dynamically import the option file
    const optionData = await import(`@/data/${handle}.json`);
    return optionData.default || optionData;
  } catch {
    // File doesn't exist, return empty array
    return [];
  }
}

export function ProductVariants({
  initialVariants = [],
  onVariantsChange,
  onVariantImageChange,
  variantImagePreviews = {},
  onRemoveVariantImage,
  recommendedAttributes = [],
  storeCurrency = "NPR",
}: ProductVariantsProps) {
  const [options, setOptions] = useState<VariantOption[]>([]);
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>(initialVariants);
  const [groupBy, setGroupBy] = useState<string>("");
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(
    new Set()
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );
  const [editModal, setEditModal] = useState<EditModalType>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Update variant currencies when storeCurrency changes (only for new variants without currency)
  useEffect(() => {
    if (storeCurrency && variants.length > 0) {
      setVariants((prev) =>
        prev.map((v) => ({
          ...v,
          currency: (v.currency || storeCurrency) as "EUR" | "USD" | "NPR",
        }))
      );
    }
  }, [storeCurrency]);

  // Create recommended options from attributes
  const recommendedOptions = useMemo(() => {
    return recommendedAttributes.map((attr) => ({
      value: attr.handle,
      label: attr.name,
      isRecommended: true,
    }));
  }, [recommendedAttributes]);

  // Combine all available options (standard + recommended)
  const allAvailableOptions = useMemo(() => {
    const standard = availableOptions.map((opt) => ({
      ...opt,
      isRecommended: false,
    }));
    const recommended = recommendedOptions;
    // Remove duplicates (if a recommended option matches a standard one)
    const recommendedUnique = recommended.filter(
      (rec) => !standard.some((std) => std.value === rec.value)
    );
    return [...recommendedUnique, ...standard];
  }, [recommendedOptions]);

  // Extract options from initialVariants when editing
  useEffect(() => {
    if (initialVariants.length > 0 && !hasInitialized) {
      // Extract unique option types and values from existing variants
      const optionMap = new Map<string, Set<string>>();

      initialVariants.forEach((variant) => {
        if (variant.options && typeof variant.options === "object") {
          Object.entries(variant.options).forEach(([key, value]) => {
            // Normalize key to lowercase for consistent matching
            const normalizedKey = key.toLowerCase();
            if (!optionMap.has(normalizedKey)) {
              optionMap.set(normalizedKey, new Set());
            }
            optionMap.get(normalizedKey)?.add(String(value));
          });
        }
      });

      // Convert to VariantOption format
      const extractedOptions: VariantOption[] = Array.from(
        optionMap.entries()
      ).map(([optionKey, valuesSet], index) => {
        // Try to find matching option label from available options
        // Match by lowercase comparison
        const matchingOption = allAvailableOptions.find(
          (opt) =>
            opt.value.toLowerCase() === optionKey ||
            opt.label.toLowerCase() === optionKey ||
            opt.value === optionKey.replace(/\s+/g, "-")
        );

        // Use the original key from the first variant to preserve casing if needed
        const firstVariant = initialVariants.find(
          (v) =>
            v.options &&
            Object.keys(v.options).some((k) => k.toLowerCase() === optionKey)
        );
        const originalKey =
          firstVariant && firstVariant.options
            ? Object.keys(firstVariant.options).find(
                (k) => k.toLowerCase() === optionKey
              ) || optionKey
            : optionKey;

        const optionLabel = matchingOption?.label || originalKey;

        // Convert Set to OptionValue array
        const values: OptionValue[] = Array.from(valuesSet).map((val) => {
          // Try to find matching value from option data
          const optionType = matchingOption?.value;
          const optionData =
            optionType && optionTypeData[optionType]
              ? optionTypeData[optionType]
              : [];
          const matchingValue = optionData?.find(
            (v) =>
              v.value === val.toLowerCase() ||
              v.value === val.toLowerCase().replace(/\s+/g, "-") ||
              v.label.toLowerCase() === val.toLowerCase()
          );

          return (
            matchingValue || {
              value: val.toLowerCase().replace(/\s+/g, "-"),
              label: val,
            }
          );
        });

        return {
          id: `option-${index}-${optionLabel}`,
          name: optionLabel,
          values,
        };
      });

      if (extractedOptions.length > 0) {
        setOptions(extractedOptions);
        setGroupBy(extractedOptions[0].name);
        setHasInitialized(true);
        // Preserve existing variants - they're already set from initialVariants
        // Don't regenerate variants as that would lose the existing IDs and data
      } else if (initialVariants.length > 0) {
        // Even if we can't extract options, mark as initialized to prevent re-running
        setHasInitialized(true);
      }
    }
  }, [initialVariants, hasInitialized, allAvailableOptions]);

  // Sync variants state with initialVariants when they change (for edit mode)
  // Only sync when initialVariants changes from parent, not when local variants change
  useEffect(() => {
    if (initialVariants.length > 0 && hasInitialized) {
      // Use a ref-like comparison to avoid infinite loops
      // Only update if the initialVariants have actually changed (different IDs or count)
      setVariants((currentVariants) => {
        const currentVariantIds = new Set(currentVariants.map((v) => v.id));
        const initialVariantIds = new Set(initialVariants.map((v) => v.id));
        const idsMatch =
          currentVariantIds.size === initialVariantIds.size &&
          Array.from(currentVariantIds).every((id) =>
            initialVariantIds.has(id)
          );

        // Only update if IDs don't match (meaning initialVariants changed from parent)
        if (!idsMatch) {
          return initialVariants;
        }
        // Return current variants to prevent unnecessary re-renders
        return currentVariants;
      });
    }
  }, [initialVariants, hasInitialized]);

  // Sync variants with parent when they change
  // Only sync variants, don't include onVariantsChange in deps to avoid unnecessary re-renders
  useEffect(() => {
    if (onVariantsChange) {
      onVariantsChange(variants);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants]);

  // Generate a stable ID from variant options
  const generateVariantId = (options: Record<string, string>): string => {
    // Create a stable hash from sorted option keys and values
    const sortedEntries = Object.entries(options)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join("|");
    // Use a simple hash function to create a stable ID
    let hash = 0;
    for (let i = 0; i < sortedEntries.length; i++) {
      const char = sortedEntries.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `variant-${Math.abs(hash).toString(36)}`;
  };

  // Generate all possible variants from options
  const generateVariants = (opts: VariantOption[]) => {
    if (opts.length === 0) return [];

    const combinations: Record<string, string>[] = [{}];

    for (const option of opts) {
      const newCombinations: Record<string, string>[] = [];
      for (const combo of combinations) {
        for (const value of option.values) {
          newCombinations.push({
            ...combo,
            [option.name.toLowerCase()]: value.value,
          });
        }
      }
      combinations.length = 0;
      combinations.push(...newCombinations);
    }

    // Validate max 100 variants (Shopify limit)
    if (combinations.length > 100) {
      toast.error(
        `Maximum 100 variants allowed. Current combination would create ${combinations.length} variants. Please reduce the number of option values.`
      );
      return variants; // Return existing variants instead of creating new ones
    }

    return combinations.map((combo) => {
      // Use stable ID generation based on options
      const stableId = generateVariantId(combo);
      const existingVariant = variants.find(
        (v) => JSON.stringify(v.options) === JSON.stringify(combo)
      );
      return {
        id: existingVariant?.id || stableId,
        options: combo,
        price: existingVariant?.price || "0.00",
        currency: existingVariant?.currency || storeCurrency,
        quantity: existingVariant?.quantity || "0",
        sku: existingVariant?.sku || null,
        barcode: existingVariant?.barcode,
        package: existingVariant?.package,
        weight: existingVariant?.weight,
        origin: existingVariant?.origin,
        images: existingVariant?.images,
      } as Variant;
    });
  };

  const handleAddOption = (optionType: string) => {
    // Validate max 3 options (Shopify limit)
    if (options.length >= 3) {
      toast.error("Maximum 3 option types allowed per product");
      return;
    }

    // Find option label from allAvailableOptions
    const optionLabel =
      allAvailableOptions.find((o) => o.value === optionType)?.label ||
      optionType;
    // Generate a stable ID using the option label and current options count
    const newOption: VariantOption = {
      id: `option-${options.length}-${optionLabel}`,
      name: optionLabel,
      values: [],
    };
    const updatedOptions = [...options, newOption];
    setOptions(updatedOptions);
    setEditingOption(newOption.id);
    if (updatedOptions.length === 1) {
      setGroupBy(newOption.name);
    }
  };

  const handleRemoveOption = (optionId: string) => {
    const updatedOptions = options.filter((opt) => opt.id !== optionId);
    setOptions(updatedOptions);
    const newVariants = generateVariants(updatedOptions);
    setVariants(newVariants);
    // Clear selection when variants are regenerated
    setSelectedVariants(new Set());
    if (groupBy === options.find((o) => o.id === optionId)?.name) {
      setGroupBy(updatedOptions[0]?.name || "");
    }
  };

  const handleAddValue = (optionId: string, value: OptionValue) => {
    const updatedOptions = options.map((opt) =>
      opt.id === optionId ? { ...opt, values: [...opt.values, value] } : opt
    );
    setOptions(updatedOptions);
    const newVariants = generateVariants(updatedOptions);
    // Only update if variants were generated (not blocked by validation)
    if (
      newVariants.length > 0 ||
      updatedOptions.every((opt) => opt.values.length === 0)
    ) {
      setVariants(newVariants);
      // Clear selection when variants are regenerated to prevent stale IDs
      setSelectedVariants(new Set());
    }
  };

  const handleRemoveValue = (optionId: string, valueToRemove: string) => {
    const updatedOptions = options.map((opt) =>
      opt.id === optionId
        ? {
            ...opt,
            values: opt.values.filter((v) => v.value !== valueToRemove),
          }
        : opt
    );
    setOptions(updatedOptions);
    const newVariants = generateVariants(updatedOptions);
    setVariants(newVariants);
    // Clear selection when variants are regenerated
    setSelectedVariants(new Set());
  };

  const handleDoneEditing = () => {
    setEditingOption(null);
  };

  const handleVariantChange = (
    variantId: string,
    field:
      | "price"
      | "currency"
      | "quantity"
      | "sku"
      | "barcode"
      | "package"
      | "weight"
      | "origin"
      | "images",
    value: string | string[]
  ) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, [field]: value } : v))
    );
  };

  const handleGroupPriceChange = (groupValue: string, price: string) => {
    const groupKey = groupBy.toLowerCase();
    setVariants((prev) =>
      prev.map((v) =>
        v.options[groupKey] === groupValue ? { ...v, price } : v
      )
    );
  };

  // Currency is now auto-set from store, no manual change handler needed
  // Removed handleGroupCurrencyChange

  const toggleVariantSelection = (variantId: string) => {
    const newSelected = new Set(selectedVariants);
    if (newSelected.has(variantId)) {
      newSelected.delete(variantId);
    } else {
      newSelected.add(variantId);
    }
    setSelectedVariants(newSelected);
  };

  const toggleGroupCollapse = (groupValue: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(groupValue)) {
      newCollapsed.delete(groupValue);
    } else {
      newCollapsed.add(groupValue);
    }
    setCollapsedGroups(newCollapsed);
  };

  const toggleSelectAll = () => {
    if (variants.length === 0) return;
    if (selectedVariants.size === variants.length) {
      setSelectedVariants(new Set());
    } else {
      setSelectedVariants(new Set(variants.map((v) => v.id)));
    }
  };

  // Group variants by selected option
  const groupedVariants = useMemo(() => {
    if (!groupBy || variants.length === 0) return [];

    const groups = new Map<string, Variant[]>();
    const groupKey = groupBy.toLowerCase();

    for (const variant of variants) {
      const groupValue = variant.options[groupKey] || "ungrouped";
      if (!groups.has(groupValue)) {
        groups.set(groupValue, []);
      }
      groups.get(groupValue)?.push(variant);
    }

    return Array.from(groups.entries()).map(([value, items]) => ({
      value,
      label: items[0].options[groupKey],
      variants: items,
    }));
  }, [variants, groupBy]);

  const totalInventory = variants.reduce(
    (sum, v) => sum + Number.parseInt(v.quantity || "0"),
    0
  );

  const usedOptionTypes = options
    .map(
      (opt) =>
        allAvailableOptions.find((ao) => ao.label === opt.name)?.value ||
        availableOptions.find((ao) => ao.label === opt.name)?.value
    )
    .filter(Boolean);

  const availableOptionTypes = allAvailableOptions.filter(
    (opt) => !usedOptionTypes.includes(opt.value)
  );

  const getSelectedVariantObjects = () => {
    return variants.filter((v) => selectedVariants.has(v.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Variants</h2>
      </div>

      {/* Options Section */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        {options.map((option) => (
          <div key={option.id}>
            {editingOption === option.id ? (
              <OptionEditor
                option={option}
                onAddValue={(value) => handleAddValue(option.id, value)}
                onRemoveValue={(value) => handleRemoveValue(option.id, value)}
                onDone={handleDoneEditing}
                onDelete={() => handleRemoveOption(option.id)}
                recommendedAttributes={recommendedAttributes}
              />
            ) : (
              <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{option.name}</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingOption(option.id)}
                    >
                      <Package2 className="h-4 w-4 text-blue-600" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {option.values.map((value) => (
                      <div
                        key={value.value}
                        className="flex items-center gap-2"
                      >
                        {value.hex && (
                          <div
                            className="h-5 w-5 rounded-full border border-border"
                            style={{ backgroundColor: value.hex }}
                          />
                        )}
                        <span className="text-sm">{value.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add Another Option */}
        {options.length > 0 && availableOptionTypes.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add another option
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <div className="p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search" className="pl-9" />
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto border-t border-border">
                {availableOptionTypes.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent flex items-center justify-between"
                    onClick={() => {
                      handleAddOption(opt.value);
                    }}
                  >
                    <div>
                      <div className="font-medium">{opt.label}</div>
                    </div>
                    {opt.isRecommended && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Recommended
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Variants Table */}
      {variants.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Group by</span>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.id} value={opt.name}>
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[40px_minmax(180px,1fr)_minmax(200px,1.2fr)_minmax(120px,0.8fr)] gap-4 border-b border-border bg-muted/50 px-4 py-3 text-sm font-medium">
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={
                    selectedVariants.size === variants.length &&
                    variants.length > 0
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </div>
              <div>Variant</div>
              <div>Price</div>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                Available
              </div>
            </div>

            {/* Table Body */}
            <div>
              {groupedVariants.map((group) => {
                const isCollapsed = collapsedGroups.has(group.value);
                const option = options.find((o) => o.name === groupBy);
                const colorData = option?.values.find(
                  (v) => v.value === group.value
                );

                return (
                  <div key={group.value}>
                    {/* Group Header */}
                    <div className="grid grid-cols-[40px_minmax(180px,1fr)_minmax(200px,1.2fr)_minmax(120px,0.8fr)] gap-4 border-b border-border bg-background px-4 py-3">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={group.variants.every((v) =>
                            selectedVariants.has(v.id)
                          )}
                          onCheckedChange={() => {
                            const allSelected = group.variants.every((v) =>
                              selectedVariants.has(v.id)
                            );
                            const newSelected = new Set(selectedVariants);
                            group.variants.forEach((v) => {
                              if (allSelected) {
                                newSelected.delete(v.id);
                              } else {
                                newSelected.add(v.id);
                              }
                            });
                            setSelectedVariants(newSelected);
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="flex items-center gap-2 text-left overflow-hidden"
                        onClick={() => toggleGroupCollapse(group.value)}
                      >
                        <Package2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <div className="flex items-center gap-2">
                          {colorData?.hex && (
                            <div
                              className="h-4 w-4 rounded-full border border-border flex-shrink-0"
                              style={{ backgroundColor: colorData.hex }}
                            />
                          )}
                          <span className="font-medium capitalize truncate">
                            {group.value}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
                          <span>{group.variants.length} variants</span>
                          {isCollapsed ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                        </div>
                      </button>
                      <div className="flex gap-2">
                        <Input
                          placeholder="0.00"
                          value={group.variants[0]?.price || ""}
                          onChange={(e) =>
                            handleGroupPriceChange(group.value, e.target.value)
                          }
                          className="h-9 flex-1"
                        />
                        <div className="h-9 w-20 flex-shrink-0 flex items-center justify-center bg-muted rounded-md text-sm text-muted-foreground">
                          {storeCurrency}
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                        {group.variants.reduce(
                          (sum, v) => sum + Number.parseInt(v.quantity || "0"),
                          0
                        )}
                      </div>
                    </div>

                    {/* Group Items */}
                    {!isCollapsed &&
                      group.variants.map((variant, index) => (
                        <div key={`${group.value}-${variant.id}-${index}`}>
                          <div className="grid grid-cols-[40px_minmax(180px,1fr)_minmax(200px,1.2fr)_minmax(120px,0.8fr)] gap-4 border-b border-border bg-background px-4 py-3">
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedVariants.has(variant.id)}
                                onCheckedChange={() =>
                                  toggleVariantSelection(variant.id)
                                }
                              />
                            </div>
                            <div className="flex items-center gap-2 text-sm overflow-hidden">
                              <Package2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              <span className="truncate">
                                {Object.entries(variant.options)
                                  .filter(
                                    ([key]) => key !== groupBy.toLowerCase()
                                  )
                                  .map(([, value]) => value)
                                  .join(" / ") ||
                                  variant.options[groupBy.toLowerCase()]}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <Input
                                placeholder="0.00"
                                value={variant.price}
                                onChange={(e) =>
                                  handleVariantChange(
                                    variant.id,
                                    "price",
                                    e.target.value
                                  )
                                }
                                className="h-9 flex-1"
                              />
                              <div className="h-9 w-20 flex-shrink-0 flex items-center justify-center bg-muted rounded-md text-sm text-muted-foreground">
                                {storeCurrency}
                              </div>
                            </div>
                            <div className="overflow-hidden">
                              <Input
                                placeholder="0"
                                type="number"
                                value={variant.quantity}
                                onChange={(e) =>
                                  handleVariantChange(
                                    variant.id,
                                    "quantity",
                                    e.target.value
                                  )
                                }
                                className="h-9 w-full min-w-0"
                              />
                            </div>
                          </div>
                          {(() => {
                            const variantImages =
                              variant.images ||
                              variantImagePreviews[variant.id] ||
                              [];
                            return variantImages.length > 0 ? (
                              <div className="grid grid-cols-[40px_minmax(180px,1fr)_minmax(200px,1.2fr)_minmax(120px,0.8fr)] gap-4 border-b border-border bg-background px-4 py-2">
                                <div></div>
                                <div className="flex gap-2 flex-wrap items-center overflow-hidden">
                                  {variantImages.map((img, idx) => (
                                    <div
                                      key={idx}
                                      className="relative group w-12 h-12 flex-shrink-0"
                                    >
                                      <Image
                                        src={img || "/placeholder.svg"}
                                        alt={`Variant ${idx + 1}`}
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-cover rounded border"
                                      />
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (onRemoveVariantImage) {
                                            onRemoveVariantImage(
                                              variant.id,
                                              idx
                                            );
                                          } else {
                                            const newImages =
                                              variantImages.filter(
                                                (_, i) => i !== idx
                                              );
                                            handleVariantChange(
                                              variant.id,
                                              "images",
                                              newImages
                                            );
                                          }
                                        }}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <div></div>
                                <div></div>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>

          {selectedVariants.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
              <Checkbox checked />
              <span className="text-sm font-medium">
                {selectedVariants.size} selected
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-auto">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditModal("prices")}>
                    Edit prices
                  </DropdownMenuItem>
                  {/* Currency is auto-set from store, removed from bulk edit */}
                  <DropdownMenuItem onClick={() => setEditModal("quantities")}>
                    Edit quantities
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditModal("skus")}>
                    Edit SKUs
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditModal("barcodes")}>
                    Edit barcodes
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditModal("package")}>
                    Edit package
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setEditModal("weight-dimensions")}
                  >
                    Edit weight & dimensions
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditModal("origin")}>
                    Edit country/region of origin
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditModal("images")}>
                    Add images
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground">
            Total inventory at Shop location: {totalInventory} available
          </div>
        </div>
      )}

      {/* Empty State */}
      {options.length === 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-transparent"
            >
              <Plus className="h-4 w-4" />
              Add options like size or color
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search" className="pl-9" />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto border-t border-border">
              {allAvailableOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent flex items-center justify-between"
                  onClick={() => {
                    handleAddOption(opt.value);
                  }}
                >
                  <div>
                    <div className="font-medium">{opt.label}</div>
                  </div>
                  {opt.isRecommended && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Recommended
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {editModal && (
        <EditVariantsModal
          type={editModal}
          variants={getSelectedVariantObjects()}
          onClose={() => setEditModal(null)}
          onSave={(updatedVariants) => {
            setVariants((prev) =>
              prev.map((v) => {
                const updated = updatedVariants.find((uv) => uv.id === v.id);
                return updated || v;
              })
            );
            setEditModal(null);
          }}
        />
      )}
    </div>
  );
}

type EditModalType =
  | "prices"
  | "quantities"
  | "skus"
  | "barcodes"
  | "package"
  | "weight-dimensions"
  | "origin"
  | "images"
  | null;

function WeightDimensionsEditor({
  variants,
  onVariantsChange,
}: {
  variants: Variant[];
  onVariantsChange: (variants: Variant[]) => void;
}) {
  const [weightUnit, setWeightUnit] = useState<"kg" | "g" | "oz">("kg");
  const [dimensionUnit, setDimensionUnit] = useState<"cm" | "m" | "in">("cm");

  // Helper to convert weight from metric to ounces
  const convertWeightToOz = (
    value: string,
    unit: "kg" | "g" | "oz"
  ): string => {
    if (!value || value.trim() === "") return "";
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return "";
    if (unit === "oz") return num.toFixed(1);
    if (unit === "kg") return kilogramsToOunces(num).toFixed(1);
    if (unit === "g") return gramsToOunces(num).toFixed(1);
    return "";
  };

  // Helper to convert dimensions from metric to inches
  const convertDimensionToIn = (
    value: string,
    unit: "cm" | "m" | "in"
  ): string => {
    if (!value || value.trim() === "") return "";
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return "";
    if (unit === "in") return num.toFixed(1);
    if (unit === "cm") return centimetersToInches(num).toFixed(1);
    if (unit === "m") return metersToInches(num).toFixed(1);
    return "";
  };

  // Helper to convert weight from ounces to metric
  const convertWeightFromOz = (
    value: string | null | undefined,
    unit: "kg" | "g" | "oz"
  ): string => {
    if (!value || value.trim() === "") return "";
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return "";
    if (unit === "oz") return num.toFixed(1);
    if (unit === "kg") return (num / 35.274).toFixed(2);
    if (unit === "g") return Math.round(num / 0.035274).toString();
    return "";
  };

  // Helper to convert dimensions from inches to metric
  const convertDimensionFromIn = (
    value: string | null | undefined,
    unit: "cm" | "m" | "in"
  ): string => {
    if (!value || value.trim() === "") return "";
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return "";
    if (unit === "in") return num.toFixed(1);
    if (unit === "cm") return Math.round(num / 0.393701).toString();
    if (unit === "m") return (num / 39.3701).toFixed(2);
    return "";
  };

  const handleWeightChange = (variantId: string, value: string) => {
    const weightOz = convertWeightToOz(value, weightUnit);
    onVariantsChange(
      variants.map((v) =>
        v.id === variantId ? { ...v, weightOz: weightOz || null } : v
      )
    );
  };

  const handleDimensionChange = (
    variantId: string,
    field: "lengthIn" | "widthIn" | "heightIn",
    value: string
  ) => {
    const dimensionIn = convertDimensionToIn(value, dimensionUnit);
    onVariantsChange(
      variants.map((v) =>
        v.id === variantId ? { ...v, [field]: dimensionIn || null } : v
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <Label>Weight Unit</Label>
          <Select
            value={weightUnit}
            onValueChange={(v: "kg" | "g" | "oz") => setWeightUnit(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">Kilograms (kg)</SelectItem>
              <SelectItem value="g">Grams (g)</SelectItem>
              <SelectItem value="oz">Ounces (oz)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label>Dimension Unit</Label>
          <Select
            value={dimensionUnit}
            onValueChange={(v: "cm" | "m" | "in") => setDimensionUnit(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cm">Centimeters (cm)</SelectItem>
              <SelectItem value="m">Meters (m)</SelectItem>
              <SelectItem value="in">Inches (in)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {variants.map((variant) => {
          const weightValue = convertWeightFromOz(variant.weightOz, weightUnit);
          const lengthValue = convertDimensionFromIn(
            variant.lengthIn,
            dimensionUnit
          );
          const widthValue = convertDimensionFromIn(
            variant.widthIn,
            dimensionUnit
          );
          const heightValue = convertDimensionFromIn(
            variant.heightIn,
            dimensionUnit
          );

          return (
            <div key={variant.id} className="border rounded-lg p-4 space-y-4">
              <div className="font-medium text-sm">
                {Object.values(variant.options).join(" / ") || "Default"}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Weight ({weightUnit})</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={weightValue}
                    onChange={(e) =>
                      handleWeightChange(variant.id, e.target.value)
                    }
                    placeholder={`0 ${weightUnit}`}
                  />
                  {variant.weightOz && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Stored: {variant.weightOz} oz
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Length ({dimensionUnit})</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={lengthValue}
                    onChange={(e) =>
                      handleDimensionChange(
                        variant.id,
                        "lengthIn",
                        e.target.value
                      )
                    }
                    placeholder={`0 ${dimensionUnit}`}
                  />
                  {variant.lengthIn && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Stored: {variant.lengthIn} in
                    </p>
                  )}
                </div>
                <div>
                  <Label>Width ({dimensionUnit})</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={widthValue}
                    onChange={(e) =>
                      handleDimensionChange(
                        variant.id,
                        "widthIn",
                        e.target.value
                      )
                    }
                    placeholder={`0 ${dimensionUnit}`}
                  />
                  {variant.widthIn && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Stored: {variant.widthIn} in
                    </p>
                  )}
                </div>
                <div>
                  <Label>Height ({dimensionUnit})</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={heightValue}
                    onChange={(e) =>
                      handleDimensionChange(
                        variant.id,
                        "heightIn",
                        e.target.value
                      )
                    }
                    placeholder={`0 ${dimensionUnit}`}
                  />
                  {variant.heightIn && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Stored: {variant.heightIn} in
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EditVariantsModal({
  type,
  variants,
  onClose,
  onSave,
}: {
  type: Exclude<EditModalType, null>;
  variants: Variant[];
  onClose: () => void;
  onSave: (variants: Variant[]) => void;
}) {
  const [editedVariants, setEditedVariants] = useState<Variant[]>(variants);
  const [bulkValue, setBulkValue] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([""]);

  const modalConfig = {
    prices: {
      title: "Edit prices",
      description: "Update prices for selected variants",
      field: "price",
      placeholder: "0.00",
      type: "text",
    },
    // Currency is auto-set from store, removed from bulk edit
    quantities: {
      title: "Edit quantities",
      description: "Update quantities for selected variants",
      field: "quantity",
      placeholder: "0",
      type: "number",
    },
    skus: {
      title: "Edit SKUs",
      description: "Update SKUs for selected variants",
      field: "sku",
      placeholder: "Enter SKU",
      type: "text",
    },
    barcodes: {
      title: "Edit barcodes",
      description: "Update barcodes for selected variants",
      field: "barcode",
      placeholder: "Enter barcode",
      type: "text",
    },
    package: {
      title: "Edit package",
      description: "Update package information for selected variants",
      field: "package",
      placeholder: "Enter package info",
      type: "text",
    },
    "weight-dimensions": {
      title: "Edit weight & dimensions",
      description: "Update weight and dimensions for selected variants",
      field: "weight-dimensions",
      placeholder: "",
      type: "text",
    },
    origin: {
      title: "Edit country/region of origin",
      description: "Update origin for selected variants",
      field: "origin",
      placeholder: "Enter country/region",
      type: "text",
    },
    images: {
      title: "Add images",
      description: "Add images to selected variants",
      field: "images",
      placeholder: "Image URL",
      type: "text",
    },
  };

  const config = modalConfig[type];

  const handleVariantChange = (variantId: string, value: string) => {
    setEditedVariants((prev) =>
      prev.map((v) =>
        v.id === variantId ? { ...v, [config.field]: value } : v
      )
    );
  };

  const handleApplyToAll = () => {
    if (bulkValue) {
      setEditedVariants((prev) =>
        prev.map((v) => ({ ...v, [config.field]: bulkValue }))
      );
    }
  };

  // Currency is now auto-set from store, no manual change handler needed
  // Removed handleCurrencyChange

  const handleAddImages = () => {
    const validUrls = imageUrls.filter((url) => url.trim() !== "");
    if (validUrls.length > 0) {
      setEditedVariants((prev) =>
        prev.map((v) => ({
          ...v,
          images: [...(v.images || []), ...validUrls],
        }))
      );
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    variantId?: string
  ) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageUrl = reader.result as string;
        if (variantId) {
          // Add to specific variant
          setEditedVariants((prev) =>
            prev.map((v) =>
              v.id === variantId
                ? { ...v, images: [...(v.images || []), imageUrl] }
                : v
            )
          );
        } else {
          // Add to all variants
          setEditedVariants((prev) =>
            prev.map((v) => ({ ...v, images: [...(v.images || []), imageUrl] }))
          );
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (variantId: string, imageIndex: number) => {
    setEditedVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? { ...v, images: v.images?.filter((_, idx) => idx !== imageIndex) }
          : v
      )
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {type === "weight-dimensions" ? (
            <WeightDimensionsEditor
              variants={editedVariants}
              onVariantsChange={setEditedVariants}
            />
          ) : type === "images" ? (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload images for all selected variants</Label>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleFileUpload(e)}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Or enter image URLs:
                  </p>
                  {imageUrls.map((url, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        type="text"
                        value={url}
                        onChange={(e) => {
                          const newUrls = [...imageUrls];
                          newUrls[idx] = e.target.value;
                          setImageUrls(newUrls);
                        }}
                        placeholder="https://example.com/image.jpg"
                        className="flex-1"
                      />
                      {imageUrls.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setImageUrls(imageUrls.filter((_, i) => i !== idx))
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setImageUrls([...imageUrls, ""])}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add another URL
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAddImages}
                    className="w-full"
                  >
                    Add to all variants
                  </Button>
                </div>

                <div className="border-t pt-4">
                  <Label className="mb-4 block">
                    Individual variant images
                  </Label>
                  <div className="space-y-4">
                    {editedVariants.map((variant) => (
                      <div
                        key={variant.id}
                        className="border rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">
                            {Object.values(variant.options).join(" / ")}
                          </p>
                          <Input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => handleFileUpload(e, variant.id)}
                            className="w-40 h-8 text-xs"
                          />
                        </div>
                        {variant.images && variant.images.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {variant.images.map((img, idx) => (
                              <div
                                key={idx}
                                className="relative group w-16 h-16"
                              >
                                <Image
                                  src={img || "/placeholder.svg"}
                                  alt={`Variant ${idx + 1}`}
                                  className="w-full h-full object-cover rounded border"
                                  width={48}
                                  height={48}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRemoveImage(variant.id, idx);
                                  }}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  type={config.type}
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  placeholder={`Apply to all: ${config.placeholder}`}
                />
                <Button type="button" onClick={handleApplyToAll}>
                  Apply to all
                </Button>
              </div>

              <div className="space-y-2">
                {editedVariants.map((variant) => (
                  <div key={variant.id} className="flex items-center gap-2">
                    <Label className="flex-1 text-sm">
                      {Object.values(variant.options).join(" / ")}
                    </Label>
                    <Input
                      type={config.type}
                      value={
                        (variant[config.field as keyof Variant] as string) || ""
                      }
                      onChange={(e) =>
                        handleVariantChange(variant.id, e.target.value)
                      }
                      placeholder={config.placeholder}
                      className="w-48"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSave(editedVariants)}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OptionEditor({
  option,
  onAddValue,
  onRemoveValue,
  onDone,
  onDelete,
  recommendedAttributes = [],
}: {
  option: VariantOption;
  onAddValue: (value: OptionValue) => void;
  onRemoveValue: (value: string) => void;
  onDone: () => void;
  onDelete: () => void;
  recommendedAttributes?: TaxonomyAttribute[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [manualInputError, setManualInputError] = useState("");
  const [handleBasedValues, setHandleBasedValues] = useState<OptionValue[]>([]);

  // Find the attribute handle for this option
  const attributeHandle = useMemo(() => {
    // Try to find matching attribute by name
    const matchingAttr = recommendedAttributes.find(
      (attr) =>
        attr.name === option.name ||
        attr.handle === option.name.toLowerCase().replace(/\s+/g, "-")
    );
    return matchingAttr?.handle;
  }, [option.name, recommendedAttributes]);

  // Get standard option type values
  const optionType = useMemo(() => {
    return availableOptions.find((o) => o.label === option.name)?.value;
  }, [option.name]);

  const availableValues = useMemo(() => {
    return optionType ? optionTypeData[optionType] || [] : [];
  }, [optionType]);

  // Load option file based on handle
  useEffect(() => {
    if (attributeHandle) {
      loadOptionFile(attributeHandle)
        .then((values) => {
          setHandleBasedValues(values);
        })
        .catch(() => {
          setHandleBasedValues([]);
        });
    } else {
      setHandleBasedValues([]);
    }
  }, [attributeHandle]);

  // Combine all available values: handle-based, optionType-based, or empty
  const allAvailableValues = useMemo(() => {
    if (handleBasedValues.length > 0) {
      return handleBasedValues;
    }
    if (availableValues.length > 0) {
      return availableValues;
    }
    return [];
  }, [handleBasedValues, availableValues]);

  // Check if this option has predefined values (hasValueList)
  const hasValueList = allAvailableValues.length > 0;

  const filteredValues = allAvailableValues.filter(
    (v) =>
      !option.values.find((ov) => ov.value === v.value) &&
      v.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Option name</Label>
          <div className="flex items-center gap-2 text-sm">
            <Package2 className="h-4 w-4 text-blue-600" />
            <span className="font-medium">{option.name}</span>
          </div>
        </div>

        <div className="relative">
          <div className="flex items-center gap-2">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <Input value={option.name} disabled className="mb-2" />
              <div className="relative">
                <Input
                  placeholder={`Add ${option.name.toLowerCase()}`}
                  value={searchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchQuery(value);
                    setManualInputError(""); // Clear error on input change
                    if (hasValueList) {
                      setShowDropdown(true);
                    }
                  }}
                  onFocus={() => {
                    if (hasValueList) {
                      setShowDropdown(true);
                    }
                  }}
                  onKeyDown={(e) => {
                    // Allow Enter key to add value for manual input options
                    if (
                      !hasValueList &&
                      e.key === "Enter" &&
                      searchQuery.trim()
                    ) {
                      e.preventDefault();
                      const trimmedQuery = searchQuery.trim();
                      if (!trimmedQuery) {
                        setManualInputError("Value cannot be empty");
                        return;
                      }
                      setManualInputError("");
                      onAddValue({
                        value: trimmedQuery.toLowerCase().replace(/\s+/g, "-"),
                        label: trimmedQuery,
                      });
                      setSearchQuery("");
                    }
                  }}
                />

                {/* Selected Values */}
                {option.values.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {option.values.map((value) => (
                      <Badge
                        key={value.value}
                        variant="secondary"
                        className="gap-2 pr-1"
                      >
                        {value.hex && (
                          <div
                            className="h-4 w-4 rounded-full border border-border"
                            style={{ backgroundColor: value.hex }}
                          />
                        )}
                        {value.label}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 rounded-full p-0 hover:bg-transparent"
                          onClick={() => onRemoveValue(value.value)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Dropdown - only show if has predefined values */}
                {showDropdown && hasValueList && filteredValues.length > 0 && (
                  <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
                    {searchQuery && (
                      <div className="border-b border-border px-3 py-2">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 text-sm hover:bg-accent"
                          onClick={() => {
                            const trimmedQuery = searchQuery.trim();
                            if (!trimmedQuery) {
                              setManualInputError("Value cannot be empty");
                              return;
                            }
                            setManualInputError("");
                            onAddValue({
                              value: trimmedQuery
                                .toLowerCase()
                                .replace(/\s+/g, "-"),
                              label: trimmedQuery,
                            });
                            setSearchQuery("");
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          Add new entry
                        </button>
                      </div>
                    )}
                    <div className="py-1">
                      {!searchQuery && (
                        <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                          Default entries
                        </div>
                      )}
                      {filteredValues.map((value) => (
                        <button
                          type="button"
                          key={value.value}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            onAddValue(value);
                            setSearchQuery("");
                            setShowDropdown(false);
                          }}
                        >
                          <div className="h-4 w-4 rounded border border-border flex items-center justify-center">
                            {/* Empty checkbox visual indicator */}
                          </div>
                          {value.hex && (
                            <div
                              className="h-5 w-5 rounded-full border border-border"
                              style={{ backgroundColor: value.hex }}
                            />
                          )}
                          {value.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual input for options without predefined values */}
                {!hasValueList && searchQuery && (
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const trimmedQuery = searchQuery.trim();
                        if (!trimmedQuery) {
                          setManualInputError("Value cannot be empty");
                          return;
                        }
                        // Validate it's a valid string
                        if (
                          typeof trimmedQuery !== "string" ||
                          trimmedQuery.length === 0
                        ) {
                          setManualInputError("Please enter a valid value");
                          return;
                        }
                        setManualInputError("");
                        onAddValue({
                          value: trimmedQuery
                            .toLowerCase()
                            .replace(/\s+/g, "-"),
                          label: trimmedQuery,
                        });
                        setSearchQuery("");
                      }}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add &quot;{searchQuery.trim()}&quot;
                    </Button>
                    {manualInputError && (
                      <p className="mt-1 text-sm text-red-500">
                        {manualInputError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
          >
            Delete
          </Button>
          <Button type="button" size="sm" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
