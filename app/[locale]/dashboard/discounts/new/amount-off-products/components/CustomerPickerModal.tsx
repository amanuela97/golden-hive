"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Customer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface CustomerPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  selectedCustomerIds: string[];
  onSelect: (customerIds: string[]) => void;
}

export function CustomerPickerModal({
  open,
  onOpenChange,
  customers,
  selectedCustomerIds,
  onSelect,
}: CustomerPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [localSelectedIds, setLocalSelectedIds] =
    useState<string[]>(selectedCustomerIds);

  // Update local state when modal opens
  React.useEffect(() => {
    if (open) {
      setLocalSelectedIds(selectedCustomerIds);
    }
  }, [open, selectedCustomerIds]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) {
      return customers;
    }
    const query = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.email.toLowerCase().includes(query) ||
        (c.firstName && c.firstName.toLowerCase().includes(query)) ||
        (c.lastName && c.lastName.toLowerCase().includes(query)) ||
        c.id.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  const handleToggleCustomer = (customerId: string) => {
    setLocalSelectedIds((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSelectAll = () => {
    if (localSelectedIds.length === filteredCustomers.length) {
      setLocalSelectedIds([]);
    } else {
      setLocalSelectedIds(filteredCustomers.map((c) => c.id));
    }
  };

  const handleApply = () => {
    onSelect(localSelectedIds);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalSelectedIds(selectedCustomerIds);
    onOpenChange(false);
  };

  const getCustomerName = (customer: Customer) => {
    if (customer.firstName || customer.lastName) {
      return `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
    }
    return customer.email;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Customers</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        filteredCustomers.length > 0 &&
                        localSelectedIds.length === filteredCustomers.length
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <Checkbox
                          checked={localSelectedIds.includes(customer.id)}
                          onCheckedChange={() =>
                            handleToggleCustomer(customer.id)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {getCustomerName(customer)}
                      </TableCell>
                      <TableCell>{customer.email}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {localSelectedIds.length} customer
              {localSelectedIds.length !== 1 ? "s" : ""} selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleApply}>
                Apply ({localSelectedIds.length})
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
