"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  createShippingPackage,
  getShippingPackages,
  updateShippingPackage,
  deleteShippingPackage,
} from "@/app/[locale]/actions/shipping-packages";
import { kilogramsToOunces, centimetersToInches } from "@/lib/shipping-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ShippingPackage {
  id: string;
  name: string;
  description: string | null;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightOz: number;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function CustomPackagesTab() {
  const [packages, setPackages] = useState<ShippingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState<ShippingPackage | null>(
    null
  );

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitSystem, setUnitSystem] = useState<"imperial" | "metric">(
    "imperial"
  );
  const [lengthIn, setLengthIn] = useState("");
  const [widthIn, setWidthIn] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weightOz, setWeightOz] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const result = await getShippingPackages();
      if (result.success && result.data) {
        setPackages(result.data);
      } else {
        toast.error(result.error || "Failed to load packages");
      }
    } catch (error) {
      console.error("Error loading packages:", error);
      toast.error("Failed to load packages");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPackage(null);
    setName("");
    setDescription("");
    setUnitSystem("imperial");
    setLengthIn("");
    setWidthIn("");
    setHeightIn("");
    setWeightOz("");
    setIsDefault(false);
    setShowCreateDialog(true);
  };

  const handleEdit = (pkg: ShippingPackage) => {
    setEditingPackage(pkg);
    setName(pkg.name);
    setDescription(pkg.description || "");
    setLengthIn(pkg.lengthIn.toString());
    setWidthIn(pkg.widthIn.toString());
    setHeightIn(pkg.heightIn.toString());
    setWeightOz(pkg.weightOz.toString());
    setIsDefault(pkg.isDefault);
    setShowCreateDialog(true);
  };

  const handleDelete = async (packageId: string) => {
    if (!confirm("Are you sure you want to delete this package?")) {
      return;
    }

    try {
      const result = await deleteShippingPackage(packageId);
      if (result.success) {
        toast.success("Package deleted");
        loadPackages();
      } else {
        toast.error(result.error || "Failed to delete package");
      }
    } catch (error) {
      console.error("Error deleting package:", error);
      toast.error("Failed to delete package");
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Package name is required");
      return;
    }

    if (
      !lengthIn ||
      !widthIn ||
      !heightIn ||
      !weightOz ||
      parseFloat(lengthIn) <= 0 ||
      parseFloat(widthIn) <= 0 ||
      parseFloat(heightIn) <= 0 ||
      parseFloat(weightOz) <= 0
    ) {
      toast.error("All dimensions and weight must be greater than 0");
      return;
    }

    setIsSaving(true);

    try {
      // Convert to imperial units (inches and ounces) for storage
      let finalLengthIn: number;
      let finalWidthIn: number;
      let finalHeightIn: number;
      let finalWeightOz: number;

      if (unitSystem === "metric") {
        // Convert from cm to inches
        finalLengthIn = centimetersToInches(parseFloat(lengthIn));
        finalWidthIn = centimetersToInches(parseFloat(widthIn));
        finalHeightIn = centimetersToInches(parseFloat(heightIn));
        // Convert from kg to ounces
        finalWeightOz = kilogramsToOunces(parseFloat(weightOz));
      } else {
        // Already in imperial
        finalLengthIn = parseFloat(lengthIn);
        finalWidthIn = parseFloat(widthIn);
        finalHeightIn = parseFloat(heightIn);
        finalWeightOz = parseFloat(weightOz);
      }

      if (editingPackage) {
        const result = await updateShippingPackage(editingPackage.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          lengthIn: finalLengthIn,
          widthIn: finalWidthIn,
          heightIn: finalHeightIn,
          weightOz: finalWeightOz,
          isDefault,
        });

        if (result.success) {
          toast.success("Package updated");
          setShowCreateDialog(false);
          loadPackages();
        } else {
          toast.error(result.error || "Failed to update package");
        }
      } else {
        const result = await createShippingPackage({
          name: name.trim(),
          description: description.trim() || undefined,
          lengthIn: finalLengthIn,
          widthIn: finalWidthIn,
          heightIn: finalHeightIn,
          weightOz: finalWeightOz,
          isDefault,
        });

        if (result.success) {
          toast.success("Package created");
          setShowCreateDialog(false);
          loadPackages();
        } else {
          toast.error(result.error || "Failed to create package");
        }
      }
    } catch (error) {
      console.error("Error saving package:", error);
      toast.error("Failed to save package");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Custom Packages</h3>
          <p className="text-sm text-muted-foreground">
            Create reusable package templates for shipping labels
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Package
        </Button>
      </div>

      {packages.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No packages created yet</p>
          <Button onClick={handleCreate} className="mt-4" variant="outline">
            Create Your First Package
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Dimensions</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Default</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.map((pkg) => (
              <TableRow key={pkg.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{pkg.name}</p>
                    {pkg.description && (
                      <p className="text-sm text-muted-foreground">
                        {pkg.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {pkg.lengthIn}&quot; × {pkg.widthIn}&quot; × {pkg.heightIn}
                  &quot;
                </TableCell>
                <TableCell>{pkg.weightOz} oz</TableCell>
                <TableCell>{pkg.isDefault ? "Yes" : "No"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(pkg)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(pkg.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPackage ? "Edit Package" : "Create Package"}
            </DialogTitle>
            <DialogDescription>
              Define package dimensions and weight for shipping labels
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Package Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Small Box, Medium Envelope"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the package"
              />
            </div>

            <div>
              <Label htmlFor="unitSystem">Unit System</Label>
              <Select
                value={unitSystem}
                onValueChange={(value: "imperial" | "metric") => {
                  setUnitSystem(value);
                  // Clear values when switching systems
                  setLengthIn("");
                  setWidthIn("");
                  setHeightIn("");
                  setWeightOz("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imperial">
                    Imperial (inches, oz)
                  </SelectItem>
                  <SelectItem value="metric">Metric (cm, kg)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="length">
                  Length ({unitSystem === "metric" ? "cm" : "inches"}) *
                </Label>
                <Input
                  id="length"
                  type="number"
                  step="0.1"
                  value={lengthIn}
                  onChange={(e) => setLengthIn(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="width">
                  Width ({unitSystem === "metric" ? "cm" : "inches"}) *
                </Label>
                <Input
                  id="width"
                  type="number"
                  step="0.1"
                  value={widthIn}
                  onChange={(e) => setWidthIn(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="height">
                  Height ({unitSystem === "metric" ? "cm" : "inches"}) *
                </Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  value={heightIn}
                  onChange={(e) => setHeightIn(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="weight">
                  Weight ({unitSystem === "metric" ? "kg" : "oz"}) *
                </Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  value={weightOz}
                  onChange={(e) => setWeightOz(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isDefault" className="font-normal">
                Set as default package
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingPackage ? (
                "Update Package"
              ) : (
                "Create Package"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
