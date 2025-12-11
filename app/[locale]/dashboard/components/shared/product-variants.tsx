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
  SlidersHorizontal,
} from "lucide-react";
import toast from "react-hot-toast";
import colorOptions from "@/data/color-options.json";
import sizeOptions from "@/data/size-options.json";
import ageGroupOptions from "@/data/age-group-options.json";
import fabricOptions from "@/data/fabric-options.json";
import type { TaxonomyAttribute } from "@/lib/taxonomy";

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

type Variant = {
  id: string;
  options: Record<string, string>;
  price: string;
  quantity: string;
  sku?: string;
  barcode?: string;
  package?: string;
  weight?: string;
  origin?: string;
  images?: string[];
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const [editModal, setEditModal] = useState<EditModalType>(null);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showFilterDialog, setShowFilterDialog] = useState(false);

  // Sync variants with parent when they change
  // Only sync variants, don't include onVariantsChange in deps to avoid unnecessary re-renders
  useEffect(() => {
    if (onVariantsChange) {
      onVariantsChange(variants);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants]);

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

    return combinations.map((combo, index) => ({
      id: `variant-${index}`,
      options: combo,
      price:
        variants.find(
          (v) => JSON.stringify(v.options) === JSON.stringify(combo)
        )?.price || "0.00",
      quantity:
        variants.find(
          (v) => JSON.stringify(v.options) === JSON.stringify(combo)
        )?.quantity || "0",
    }));
  };

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
    const newOption: VariantOption = {
      id: `option-${Date.now()}`,
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
  };

  const handleDoneEditing = () => {
    setEditingOption(null);
  };

  const handleVariantChange = (
    variantId: string,
    field:
      | "price"
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

  // Filter variants
  const filteredVariants = variants.filter((variant) => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = Object.entries(variant.options).some(([, value]) =>
        value.toLowerCase().includes(searchLower)
      );
      if (!matchesSearch) return false;
    }

    // Option filters
    for (const [filterKey, filterValue] of Object.entries(filterValues)) {
      if (filterValue && variant.options[filterKey] !== filterValue) {
        return false;
      }
    }

    return true;
  });

  const totalInventory = variants.reduce(
    (sum, v) => sum + Number.parseInt(v.quantity || "0"),
    0
  );

  const usedOptionTypes = options
    .map((opt) => availableOptions.find((ao) => ao.label === opt.name)?.value)
    .filter(Boolean);

  const availableOptionTypes = availableOptions.filter(
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
                    key={opt.value}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      handleAddOption(opt.value);
                    }}
                  >
                    {opt.label}
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

            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSearchDialog(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilterDialog(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border">
            {/* Table Header */}
            <div className="grid grid-cols-[40px_1fr_200px_200px] gap-4 border-b border-border bg-muted/50 px-4 py-3 text-sm font-medium">
              <Checkbox
                checked={selectedVariants.size === variants.length}
                onCheckedChange={toggleSelectAll}
              />
              <div>Variant</div>
              <div>Price</div>
              <div>Available</div>
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
                    <div className="grid grid-cols-[40px_1fr_200px_200px] gap-4 border-b border-border bg-background px-4 py-3">
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
                      <button
                        className="flex items-center gap-2 text-left"
                        onClick={() => toggleGroupCollapse(group.value)}
                      >
                        <Package2 className="h-4 w-4 text-blue-600" />
                        <div className="flex items-center gap-2">
                          {colorData?.hex && (
                            <div
                              className="h-4 w-4 rounded-full border border-border"
                              style={{ backgroundColor: colorData.hex }}
                            />
                          )}
                          <span className="font-medium capitalize">
                            {group.value}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <span>{group.variants.length} variants</span>
                          {isCollapsed ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                        </div>
                      </button>
                      <Input
                        placeholder="€ 0.00"
                        value={group.variants[0]?.price || ""}
                        onChange={(e) =>
                          handleGroupPriceChange(group.value, e.target.value)
                        }
                        className="h-9"
                      />
                      <div className="flex items-center text-sm text-muted-foreground">
                        {group.variants.reduce(
                          (sum, v) => sum + Number.parseInt(v.quantity || "0"),
                          0
                        )}
                      </div>
                    </div>

                    {/* Group Items */}
                    {!isCollapsed &&
                      group.variants.map((variant) => (
                        <div
                          key={variant.id}
                          className="grid grid-cols-[40px_1fr_200px_200px] gap-4 border-b border-border bg-background px-4 py-3 last:border-b-0"
                        >
                          <Checkbox
                            checked={selectedVariants.has(variant.id)}
                            onCheckedChange={() =>
                              toggleVariantSelection(variant.id)
                            }
                          />
                          <div className="flex items-center gap-2 pl-6 text-sm">
                            <Package2 className="h-4 w-4 text-blue-600" />
                            {Object.entries(variant.options)
                              .filter(([key]) => key !== groupBy.toLowerCase())
                              .map(([, value]) => value)
                              .join(" / ") ||
                              variant.options[groupBy.toLowerCase()]}
                          </div>
                          <Input
                            placeholder="€ 0.00"
                            value={variant.price}
                            onChange={(e) =>
                              handleVariantChange(
                                variant.id,
                                "price",
                                e.target.value
                              )
                            }
                            className="h-9"
                          />
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
                            className="h-9"
                          />
                          {variant.images && variant.images.length > 0 && (
                            <div className="col-span-2 col-start-2 mt-2 flex gap-2 flex-wrap">
                              {variant.images.map((img, idx) => (
                                <div
                                  key={idx}
                                  className="relative group w-12 h-12"
                                >
                                  <Image
                                    src={img || "/placeholder.svg"}
                                    alt={`Variant ${idx + 1}`}
                                    width={48}
                                    height={48}
                                    className="w-full h-full object-cover rounded border"
                                  />
                                  <button
                                    onClick={() => {
                                      const newImages =
                                        variant.images?.filter(
                                          (_, i) => i !== idx
                                        ) || [];
                                      handleVariantChange(
                                        variant.id,
                                        "images",
                                        newImages
                                      );
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
                  <DropdownMenuItem onClick={() => setEditModal("weight")}>
                    Edit weight
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

      <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Search variants</DialogTitle>
            <DialogDescription>Search by variant options</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchQuery && (
              <div className="mt-4 text-sm text-muted-foreground">
                Found {filteredVariants.length} of {variants.length} variants
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setShowSearchDialog(false);
              }}
            >
              Clear
            </Button>
            <Button onClick={() => setShowSearchDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filter variants</DialogTitle>
            <DialogDescription>Filter by option values</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {options.map((option) => (
              <div key={option.id} className="space-y-2">
                <Label>{option.name}</Label>
                <Select
                  value={filterValues[option.name] || "all"}
                  onValueChange={(value) => {
                    if (value === "all") {
                      const newFilters = { ...filterValues };
                      delete newFilters[option.name];
                      setFilterValues(newFilters);
                    } else {
                      setFilterValues((prev) => ({
                        ...prev,
                        [option.name]: value,
                      }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={`All ${option.name.toLowerCase()}s`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {option.values.map((value) => (
                      <SelectItem key={value.value} value={value.value}>
                        {value.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {Object.values(filterValues).some(Boolean) && (
              <div className="text-sm text-muted-foreground">
                Showing {filteredVariants.length} of {variants.length} variants
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFilterValues({});
              }}
            >
              Clear all
            </Button>
            <Button onClick={() => setShowFilterDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
  | "weight"
  | "origin"
  | "images"
  | null;

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
      placeholder: "€ 0.00",
      type: "text",
    },
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
    weight: {
      title: "Edit weight",
      description: "Update weight for selected variants",
      field: "weight",
      placeholder: "0 kg",
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
          {type === "images" ? (
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
                                  onClick={() =>
                                    handleRemoveImage(variant.id, idx)
                                  }
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
                <Button onClick={handleApplyToAll}>Apply to all</Button>
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(editedVariants)}>Save changes</Button>
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
                          key={value.value}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            onAddValue(value);
                            setSearchQuery("");
                            setShowDropdown(false);
                          }}
                        >
                          <Checkbox checked={false} />
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
          <Button variant="destructive" size="sm" onClick={onDelete}>
            Delete
          </Button>
          <Button size="sm" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
