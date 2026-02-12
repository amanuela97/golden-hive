"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import {
  getAllStores,
  toggleStoreApproval,
  type StoreWithOwner,
} from "@/app/[locale]/actions/admin-stores";
import toast from "react-hot-toast";
import Image from "next/image";

function dedupeStoresById(list: StoreWithOwner[]): StoreWithOwner[] {
  const seen = new Set<string>();
  return list.filter((store) => {
    if (seen.has(store.id)) return false;
    seen.add(store.id);
    return true;
  });
}

export default function StoresPageClient({
  initialStores,
}: {
  initialStores: StoreWithOwner[];
}) {
  const [stores, setStores] = useState<StoreWithOwner[]>(() =>
    dedupeStoresById(initialStores)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterApproved, setFilterApproved] = useState<boolean | undefined>(
    undefined
  );
  const [loading, setLoading] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchStores = async () => {
      setLoading(true);
      try {
        const result = await getAllStores({
          search: searchQuery || undefined,
          isApproved: filterApproved,
        });
        setStores(dedupeStoresById(result));
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to fetch stores"
        );
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchStores();
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchQuery, filterApproved]);

  const handleToggleApproval = async (
    storeId: string,
    currentStatus: boolean
  ) => {
    setUpdatingIds((prev) => new Set(prev).add(storeId));
    try {
      const result = await toggleStoreApproval(storeId, !currentStatus);
      if (result.success) {
        setStores((prev) =>
          prev.map((store) =>
            store.id === storeId
              ? {
                  ...store,
                  isApproved: !currentStatus,
                  approvedAt: !currentStatus ? new Date() : null,
                }
              : store
          )
        );
        toast.success(
          `Store ${!currentStatus ? "approved" : "unapproved"} successfully`
        );
      } else {
        toast.error(result.error || "Failed to update approval");
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update approval"
      );
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(storeId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Store Management</h1>
        <p className="text-muted-foreground">
          Approve and manage stores on the marketplace
        </p>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search stores..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterApproved === undefined ? "default" : "outline"}
            onClick={() => setFilterApproved(undefined)}
          >
            All
          </Button>
          <Button
            variant={filterApproved === true ? "default" : "outline"}
            onClick={() => setFilterApproved(true)}
          >
            Approved
          </Button>
          <Button
            variant={filterApproved === false ? "default" : "outline"}
            onClick={() => setFilterApproved(false)}
          >
            Pending
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : stores.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  No stores found
                </TableCell>
              </TableRow>
            ) : (
              stores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {store.logoUrl ? (
                        <Image
                          src={store.logoUrl}
                          alt={store.storeName}
                          width={40}
                          height={40}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          {store.storeName[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{store.storeName}</div>
                        <div className="text-sm text-muted-foreground">
                          /{store.slug}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {store.owners && store.owners.length > 0 ? (
                        store.owners.map((owner, i) => (
                          <div key={owner.email ? owner.email : `owner-${i}`}>
                            <div className="font-medium">
                              {owner.name || "N/A"}
                            </div>
                            {owner.email && (
                              <div className="text-sm text-muted-foreground">
                                {owner.email}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="font-medium">
                            {store.ownerName || "N/A"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {store.ownerEmail || ""}
                          </div>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{store.productCount}</TableCell>
                  <TableCell>
                    {store.isApproved ? (
                      <Badge className="bg-green-500">Approved</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(store.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {store.isApproved ? "Approved" : "Pending"}
                        </span>
                        {updatingIds.has(store.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Switch
                            checked={store.isApproved}
                            onCheckedChange={() =>
                              handleToggleApproval(store.id, store.isApproved)
                            }
                          />
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
