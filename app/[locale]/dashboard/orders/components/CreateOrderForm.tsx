"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountrySelect } from "@/components/ui/country-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Minus,
  Mail,
  CreditCard,
} from "lucide-react";
import {
  searchProductsForOrder,
  getOrCreateCustomerForUser,
  getCustomerShippingBillingInfo,
  type LineItemInput,
} from "@/app/[locale]/actions/orders";
import {
  createDraftOrder,
  updateDraftOrder,
  completeDraftOrder,
  getDraftOrder,
} from "@/app/[locale]/actions/draft-orders";
import {
  getStoreOwnerEmail,
  getStoreOwnerEmailFromListing,
} from "@/app/[locale]/actions/orders";
import { searchCustomers } from "@/app/[locale]/actions/customers";
import { getAllStores } from "@/app/[locale]/actions/store-members";
import { getMarketsForUser, getMarket } from "@/app/[locale]/actions/markets";
import toast from "react-hot-toast";
import Image from "next/image";
import countriesData from "@/data/countries.json";
import { SetupBannerWrapper } from "../../components/shared/SetupBannerWrapper";
import { SendDraftInvoiceDialog } from "./SendDraftInvoiceDialog";

type Country = {
  value: string;
  label: string;
};

// Helper function to convert country name to country code
function getCountryCode(countryName: string | null | undefined): string {
  if (!countryName) return "";
  const countries = countriesData as Country[];
  const country = countries.find(
    (c) => c.label.toLowerCase() === countryName.toLowerCase()
  );
  return country?.value || countryName; // Return code if found, otherwise return original (might already be a code)
}

type LineItem = LineItemInput & {
  id: string;
  listingName: string;
  variantTitle: string;
  imageUrl?: string | null;
  variantImageUrl?: string | null;
  currency: string;
  originalCurrency: string; // Store original currency for conversion
  originalUnitPrice: string; // Store original price for conversion
  available: number; // Track available stock
};

type ProductVariant = {
  listingId: string;
  listingName: string;
  listingImageUrl: string | null;
  variantId: string;
  variantTitle: string;
  variantImageUrl: string | null;
  sku: string | null;
  price: string | null;
  currency: string;
  available: number;
};

type GroupedProduct = {
  listingId: string;
  listingName: string;
  listingImageUrl: string | null;
  variants: ProductVariant[];
  // Computed: first variant image as fallback
  displayImageUrl: string | null;
};

export interface CreateOrderFormRef {
  triggerSave: () => void;
  triggerCancel: () => void;
}

interface CreateOrderFormProps {
  userRole?: "admin" | "seller" | "customer";
  cancelRedirectPath?: string;
  draftId?: string; // If provided, form is in edit mode
  onFormModified?: (isModified: boolean) => void;
  onLoadingChange?: (loading: boolean) => void;
  onActionLoadingChange?: (loading: boolean) => void; // For send invoice/mark as paid actions
  showTopButtons?: boolean; // If true, don't show buttons at bottom
  readOnly?: boolean; // If true, form is read-only (for completed drafts)
  initialData?: {
    customerId?: string | null;
    customerEmail: string;
    customerFirstName: string | null;
    customerLastName: string | null;
    customerPhone: string | null;
    lineItems: Array<{
      id: string;
      listingId: string;
      variantId: string | null;
      quantity: number;
      unitPrice: string;
      title: string;
      sku: string | null;
      listingName: string;
      variantTitle: string;
      imageUrl?: string | null;
      variantImageUrl?: string | null;
      currency: string;
      originalCurrency: string;
      originalUnitPrice: string;
      available: number;
    }>;
    currency: string;
    shippingName: string | null;
    shippingPhone: string | null;
    shippingAddressLine1: string | null;
    shippingAddressLine2: string | null;
    shippingCity: string | null;
    shippingRegion: string | null;
    shippingPostalCode: string | null;
    shippingCountry: string | null;
    billingName: string | null;
    billingPhone: string | null;
    billingAddressLine1: string | null;
    billingAddressLine2: string | null;
    billingCity: string | null;
    billingRegion: string | null;
    billingPostalCode: string | null;
    billingCountry: string | null;
    paymentStatus: "pending" | "paid";
    marketId: string | null;
  };
}

const CreateOrderForm = forwardRef<CreateOrderFormRef, CreateOrderFormProps>(
  function CreateOrderForm(
    {
      userRole,
      cancelRedirectPath = "/dashboard/orders",
      draftId,
      onFormModified,
      onLoadingChange,
      onActionLoadingChange,
      showTopButtons = false,
      readOnly = false,
      initialData,
    },
    ref
  ) {
    const isEditMode = !!draftId;
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [loadingCustomer, setLoadingCustomer] = useState(false);
    const isAdmin = userRole === "admin";
    const formRef = useRef<HTMLFormElement>(null);

    // Track initial form state for modification detection
    const initialFormStateRef = useRef<string | null>(null);
    const isInitializedRef = useRef(false);

    // Customer source selector
    const [customerSource, setCustomerSource] = useState<
      "myInfo" | "search" | "manual"
    >("myInfo");
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
      null
    );

    // Customer search modal
    const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
    const [customerSearchQuery, setCustomerSearchQuery] = useState("");
    const [customerSearchResults, setCustomerSearchResults] = useState<
      Array<{
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        phone: string | null;
      }>
    >([]);
    const [searchingCustomers, setSearchingCustomers] = useState(false);
    const debouncedCustomerSearch = useDebounce(customerSearchQuery, 500);

    // Search customers when debounced query changes
    useEffect(() => {
      const performCustomerSearch = async () => {
        if (!customerSearchOpen) {
          setCustomerSearchResults([]);
          return;
        }

        if (!debouncedCustomerSearch.trim()) {
          setCustomerSearchResults([]);
          return;
        }

        setSearchingCustomers(true);
        try {
          const result = await searchCustomers(debouncedCustomerSearch.trim());
          if (result.success && result.data) {
            setCustomerSearchResults(result.data);
          } else {
            setCustomerSearchResults([]);
            if (result.error) {
              console.error("Customer search error:", result.error);
            }
          }
        } catch (error) {
          console.error("Failed to search customers:", error);
          setCustomerSearchResults([]);
        } finally {
          setSearchingCustomers(false);
        }
      };

      performCustomerSearch();
    }, [debouncedCustomerSearch, customerSearchOpen]);

    // Customer info
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerFirstName, setCustomerFirstName] = useState("");
    const [customerLastName, setCustomerLastName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");

    // Line items
    const [lineItems, setLineItems] = useState<LineItem[]>([]);

    // Store selection (for admins)
    const [stores, setStores] = useState<
      Array<{ id: string; storeName: string; logoUrl: string | null }>
    >([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
    const [loadingStores, setLoadingStores] = useState(false);

    // Market selection
    const [markets, setMarkets] = useState<
      Array<{ id: string; name: string; currency: string; isDefault: boolean }>
    >([]);
    const [selectedMarketId, setSelectedMarketId] = useState<string | null>(
      null
    );
    const [marketCurrency, setMarketCurrency] = useState<string>("EUR");
    const [marketExchangeRate, setMarketExchangeRate] = useState<string>("1");
    const [loadingMarkets, setLoadingMarkets] = useState(false);

    // Summary
    const [currency, setCurrency] = useState("EUR");

    // Statuses - orders are created as drafts by default
    const [paymentStatus, setPaymentStatus] = useState<"pending" | "paid">(
      "pending"
    );
    const [showSendInvoiceDialog, setShowSendInvoiceDialog] = useState(false);
    const [showMarkAsPaidDialog, setShowMarkAsPaidDialog] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(
      draftId || null
    );
    const [currentDraftNumber, setCurrentDraftNumber] = useState<number | null>(
      null
    );
    const [storeOwnerEmail, setStoreOwnerEmail] = useState<string | null>(null);

    // Addresses
    const [shippingName, setShippingName] = useState("");
    const [shippingPhone, setShippingPhone] = useState("");
    const [shippingAddressLine1, setShippingAddressLine1] = useState("");
    const [shippingAddressLine2, setShippingAddressLine2] = useState("");
    const [shippingCity, setShippingCity] = useState("");
    const [shippingRegion, setShippingRegion] = useState("");
    const [shippingPostalCode, setShippingPostalCode] = useState("");
    const [shippingCountry, setShippingCountry] = useState("");

    const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
    const [billingName, setBillingName] = useState("");
    const [billingPhone, setBillingPhone] = useState("");
    const [billingAddressLine1, setBillingAddressLine1] = useState("");
    const [billingAddressLine2, setBillingAddressLine2] = useState("");
    const [billingCity, setBillingCity] = useState("");
    const [billingRegion, setBillingRegion] = useState("");
    const [billingPostalCode, setBillingPostalCode] = useState("");
    const [billingCountry, setBillingCountry] = useState("");

    // Helper function to serialize form state for comparison
    // Using useMemo to avoid recreating on every render
    const currentFormState = useMemo(() => {
      return JSON.stringify({
        customerId: selectedCustomerId,
        customerEmail,
        customerFirstName,
        customerLastName,
        customerPhone,
        lineItems: lineItems.map((item) => ({
          id: item.id,
          listingId: item.listingId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        currency: marketCurrency,
        paymentStatus,
        shippingName,
        shippingPhone,
        shippingAddressLine1,
        shippingAddressLine2,
        shippingCity,
        shippingRegion,
        shippingPostalCode,
        shippingCountry,
        billingName,
        billingPhone,
        billingAddressLine1,
        billingAddressLine2,
        billingCity,
        billingRegion,
        billingPostalCode,
        billingCountry,
        billingSameAsShipping,
        selectedMarketId,
      });
    }, [
      selectedCustomerId,
      customerEmail,
      customerFirstName,
      customerLastName,
      customerPhone,
      lineItems,
      marketCurrency,
      paymentStatus,
      shippingName,
      shippingPhone,
      shippingAddressLine1,
      shippingAddressLine2,
      shippingCity,
      shippingRegion,
      shippingPostalCode,
      shippingCountry,
      billingName,
      billingPhone,
      billingAddressLine1,
      billingAddressLine2,
      billingCity,
      billingRegion,
      billingPostalCode,
      billingCountry,
      billingSameAsShipping,
      selectedMarketId,
    ]);

    // Initialize form data from initialData when in edit mode
    useEffect(() => {
      if (isEditMode && initialData) {
        // First, check if this draft uses the user's customer info
        const checkCustomerSource = async () => {
          if (initialData.customerId) {
            setSelectedCustomerId(initialData.customerId);
            // Check if this customer ID matches the user's customer ID
            try {
              const result = await getOrCreateCustomerForUser();
              if (
                result.success &&
                result.data &&
                result.data.id === initialData.customerId
              ) {
                // This draft uses the user's saved customer info
                setCustomerSource("myInfo");
              } else {
                // This draft uses a different customer
                setCustomerSource("manual");
              }
            } catch {
              // If we can't check, default to manual
              setCustomerSource("manual");
            }
          } else {
            // No customer ID, use manual
            setCustomerSource("manual");
          }
        };

        checkCustomerSource();

        // Set all form fields from initialData
        setCustomerEmail(initialData.customerEmail || "");
        setCustomerFirstName(initialData.customerFirstName || "");
        setCustomerLastName(initialData.customerLastName || "");
        setCustomerPhone(initialData.customerPhone || "");
        setLineItems(initialData.lineItems || []);
        setCurrency(initialData.currency || "EUR");
        setMarketCurrency(initialData.currency || "EUR");
        setPaymentStatus(initialData.paymentStatus || "pending");
        setShippingName(initialData.shippingName || "");
        setShippingPhone(initialData.shippingPhone || "");
        setShippingAddressLine1(initialData.shippingAddressLine1 || "");
        setShippingAddressLine2(initialData.shippingAddressLine2 || "");
        setShippingCity(initialData.shippingCity || "");
        setShippingRegion(initialData.shippingRegion || "");
        setShippingPostalCode(initialData.shippingPostalCode || "");
        setShippingCountry(initialData.shippingCountry || "");
        setBillingName(initialData.billingName || "");
        setBillingPhone(initialData.billingPhone || "");
        setBillingAddressLine1(initialData.billingAddressLine1 || "");
        setBillingAddressLine2(initialData.billingAddressLine2 || "");
        setBillingCity(initialData.billingCity || "");
        setBillingRegion(initialData.billingRegion || "");
        setBillingPostalCode(initialData.billingPostalCode || "");
        setBillingCountry(initialData.billingCountry || "");
        if (initialData.marketId) {
          setSelectedMarketId(initialData.marketId);
        }
        // Check if billing is same as shipping
        const billingSame =
          initialData.billingName === initialData.shippingName &&
          initialData.billingAddressLine1 ===
            initialData.shippingAddressLine1 &&
          initialData.billingCity === initialData.shippingCity;
        setBillingSameAsShipping(billingSame);

        // Mark as initialized - we'll set the initial state after all state updates
        isInitializedRef.current = false;
      }
    }, [isEditMode, initialData]);

    // Set initial form state after initialization is complete
    // Wait longer to ensure customer source check and all state updates are done
    useEffect(() => {
      if (
        isEditMode &&
        !isInitializedRef.current &&
        initialData &&
        currentFormState
      ) {
        // Use a longer delay to ensure:
        // 1. All state from initialData is set
        // 2. Customer source check is complete
        // 3. No auto-fill effects have run
        const timer = setTimeout(() => {
          // Only set initial state if we haven't already (prevent race conditions)
          if (!isInitializedRef.current) {
            initialFormStateRef.current = currentFormState;
            isInitializedRef.current = true;
            // Explicitly set to false to ensure buttons are hidden
            if (onFormModified) {
              onFormModified(false);
            }
          }
        }, 800); // Increased delay to ensure form is fully initialized, including customer source check
        return () => clearTimeout(timer);
      }
    }, [isEditMode, initialData, currentFormState, onFormModified]);

    // Track form modifications - debounced to avoid constant updates
    // Only track AFTER initialization is complete
    useEffect(() => {
      // Don't track modifications during initialization
      if (!isInitializedRef.current) {
        // Ensure buttons are hidden during initialization
        if (onFormModified && isEditMode) {
          onFormModified(false);
        }
        return;
      }

      if (
        isEditMode &&
        initialFormStateRef.current !== null &&
        currentFormState
      ) {
        const timer = setTimeout(() => {
          // Double-check initialization is still complete before checking modifications
          if (
            isInitializedRef.current &&
            initialFormStateRef.current !== null
          ) {
            const modified = currentFormState !== initialFormStateRef.current;
            if (onFormModified) {
              onFormModified(modified);
            }
          }
        }, 300); // Debounce by 300ms to avoid interfering with typing
        return () => clearTimeout(timer);
      }
    }, [isEditMode, currentFormState, onFormModified]);

    // Fetch store owner email when draft exists
    useEffect(() => {
      const fetchStoreOwnerEmail = async () => {
        if (!currentDraftId) return;

        try {
          // Get draft to find storeId
          const draftResult = await getDraftOrder(currentDraftId);
          if (draftResult.success && draftResult.data?.storeId) {
            const result = await getStoreOwnerEmail(draftResult.data.storeId);
            if (result.success && result.email) {
              setStoreOwnerEmail(result.email);
            }
          }
        } catch (error) {
          console.error("Error fetching store owner email:", error);
        }
      };

      fetchStoreOwnerEmail();
    }, [currentDraftId]);

    // Fetch store owner email from selected products when no draft exists yet
    useEffect(() => {
      const fetchStoreOwnerEmailFromProducts = async () => {
        // Only fetch if we don't have a draft and we have products selected and email not already set
        if (currentDraftId || lineItems.length === 0 || storeOwnerEmail) return;

        try {
          // Get storeId from the first product's listingId
          const firstListingId = lineItems[0]?.listingId;
          if (!firstListingId) return;

          console.log(
            "Fetching store owner email from listing:",
            firstListingId
          );
          const result = await getStoreOwnerEmailFromListing(firstListingId);
          console.log("Store owner email result:", result);
          if (result.success && result.email) {
            console.log("Setting store owner email:", result.email);
            setStoreOwnerEmail(result.email);
          } else {
            console.error("Failed to get store owner email:", result.error);
          }
        } catch (error) {
          console.error(
            "Error fetching store owner email from products:",
            error
          );
        }
      };

      fetchStoreOwnerEmailFromProducts();
    }, [lineItems, currentDraftId, storeOwnerEmail]);

    // Fetch draft number when draftId prop changes
    useEffect(() => {
      const fetchDraftInfo = async () => {
        if (draftId) {
          setCurrentDraftId(draftId);
          try {
            const draftResult = await getDraftOrder(draftId);
            if (draftResult.success && draftResult.data) {
              setCurrentDraftNumber(draftResult.data.draftNumber);
              // Also fetch store owner email
              if (draftResult.data.storeId) {
                const result = await getStoreOwnerEmail(
                  draftResult.data.storeId
                );
                if (result.success && result.email) {
                  setStoreOwnerEmail(result.email);
                }
              }
            }
          } catch (error) {
            console.error("Error fetching draft info:", error);
          }
        }
      };

      fetchDraftInfo();
    }, [draftId]);

    // Expose handlers to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        triggerSave: () => {
          if (formRef.current) {
            formRef.current.requestSubmit();
          }
        },
        triggerCancel: () => {
          router.push(cancelRedirectPath);
        },
      }),
      [router, cancelRedirectPath]
    );

    // Auto-fill customer info on mount or when source changes
    // Skip auto-fill in edit mode when we have initialData (to prevent triggering modification detection)
    useEffect(() => {
      const loadCustomerInfo = async () => {
        // Don't auto-fill in edit mode - we already have the data from initialData
        if (isEditMode && initialData) {
          return;
        }

        if (customerSource === "myInfo") {
          setLoadingCustomer(true);
          try {
            const result = await getOrCreateCustomerForUser();
            if (result.success && result.data) {
              const data = result.data;
              setCustomerEmail(data.email);
              setCustomerFirstName(data.firstName || "");
              setCustomerLastName(data.lastName || "");
              setCustomerPhone(data.phone || "");

              // Auto-fill shipping address
              if (data.shippingFirstName || data.shippingLastName) {
                setShippingName(
                  `${data.shippingFirstName || ""} ${data.shippingLastName || ""}`.trim()
                );
              }
              setShippingAddressLine1(data.shippingAddress || "");
              setShippingAddressLine2(data.shippingAddress2 || "");
              setShippingCity(data.shippingCity || "");
              setShippingRegion(data.shippingState || "");
              setShippingPostalCode(data.shippingZip || "");
              setShippingCountry(getCountryCode(data.shippingCountry));
              setShippingPhone(data.phone || "");

              // Auto-fill billing address
              if (data.billingFirstName || data.billingLastName) {
                setBillingName(
                  `${data.billingFirstName || ""} ${data.billingLastName || ""}`.trim()
                );
              }
              setBillingAddressLine1(data.billingAddress || "");
              setBillingAddressLine2(data.billingAddress2 || "");
              setBillingCity(data.billingCity || "");
              setBillingPhone(data.billingPhone || "");
              setBillingRegion(data.billingState || "");
              setBillingPostalCode(data.billingZip || "");
              setBillingCountry(getCountryCode(data.billingCountry));
            } else {
              // If no customer found, clear fields
              setCustomerEmail("");
              setCustomerFirstName("");
              setCustomerLastName("");
              setCustomerPhone("");
            }
          } catch (error) {
            console.error("Failed to load customer info:", error);
          } finally {
            setLoadingCustomer(false);
          }
        } else if (customerSource === "search") {
          // Search mode - open search modal and reset search
          setCustomerSearchOpen(true);
          setCustomerSearchQuery("");
          setCustomerSearchResults([]);
          setSelectedCustomerId(null);
          // Clear customer fields - user will select from search
          setCustomerEmail("");
          setCustomerFirstName("");
          setCustomerLastName("");
          setCustomerPhone("");
        } else {
          // Manual entry - clear all fields
          setSelectedCustomerId(null);
          setCustomerEmail("");
          setCustomerFirstName("");
          setCustomerLastName("");
          setCustomerPhone("");
          setShippingName("");
          setShippingPhone("");
          setShippingAddressLine1("");
          setShippingAddressLine2("");
          setShippingCity("");
          setShippingRegion("");
          setShippingPostalCode("");
          setShippingCountry("");
          setBillingName("");
          setBillingPhone("");
          setBillingAddressLine1("");
          setBillingAddressLine2("");
          setBillingCity("");
          setBillingRegion("");
          setBillingPostalCode("");
          setBillingCountry("");
        }
      };

      loadCustomerInfo();
    }, [customerSource]);

    // Handle customer selection from search
    const handleSelectCustomer = async (customer: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
    }) => {
      setSelectedCustomerId(customer.id);
      setCustomerEmail(customer.email);
      setCustomerFirstName(customer.firstName || "");
      setCustomerLastName(customer.lastName || "");
      setCustomerPhone(customer.phone || "");
      setCustomerSearchOpen(false);
      setCustomerSearchQuery("");
      setCustomerSearchResults([]);

      // Fetch shipping and billing info from customer's most recent order
      try {
        const addressResult = await getCustomerShippingBillingInfo(customer.id);
        if (addressResult.success && addressResult.data) {
          const addr = addressResult.data;

          // Populate shipping address
          setShippingName(addr.shippingName || "");
          setShippingPhone(addr.billingPhone || customer.phone || "");
          setShippingAddressLine1(addr.shippingAddressLine1 || "");
          setShippingAddressLine2(addr.shippingAddressLine2 || "");
          setShippingCity(addr.shippingCity || "");
          setShippingRegion(addr.shippingRegion || "");
          setShippingPostalCode(addr.shippingPostalCode || "");
          setShippingCountry(getCountryCode(addr.shippingCountry));

          // Populate billing address
          setBillingName(addr.billingName || "");
          setBillingPhone(addr.billingPhone || customer.phone || "");
          setBillingAddressLine1(addr.billingAddressLine1 || "");
          setBillingAddressLine2(addr.billingAddressLine2 || "");
          setBillingCity(addr.billingCity || "");
          setBillingRegion(addr.billingRegion || "");
          setBillingPostalCode(addr.billingPostalCode || "");
          setBillingCountry(getCountryCode(addr.billingCountry));

          // If billing address is same as shipping, set the checkbox
          if (
            addr.billingName === addr.shippingName &&
            addr.billingAddressLine1 === addr.shippingAddressLine1 &&
            addr.billingCity === addr.shippingCity
          ) {
            setBillingSameAsShipping(true);
          }
        }
      } catch (error) {
        console.error("Failed to load customer address info:", error);
        // Don't show error to user - just proceed without address data
      }

      // Keep customerSource as "search" to indicate customer was selected from search
    };

    // Handle customer search modal close
    const handleCloseCustomerSearch = () => {
      setCustomerSearchOpen(false);
      setCustomerSearchQuery("");
      setCustomerSearchResults([]);
      // If no customer was selected, don't change customerSource
      // User can still manually enter or switch to another source
    };

    // Product picker modal
    const [productPickerOpen, setProductPickerOpen] = useState(false);
    const [productSearch, setProductSearch] = useState("");
    const [searchBy, setSearchBy] = useState<
      | "all"
      | "product_title"
      | "product_id"
      | "sku"
      | "variant_title"
      | "variant_id"
    >("all");
    const [groupedProducts, setGroupedProducts] = useState<GroupedProduct[]>(
      []
    );
    const [selectedVariants, setSelectedVariants] = useState<Set<string>>(
      new Set()
    );
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
      new Set()
    );
    const [searching, setSearching] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [pageSize] = useState(20);
    const prevDebouncedSearchRef = useRef<string>("");
    const prevSearchByRef = useRef<typeof searchBy>("all");

    // Debounce search input
    const debouncedSearch = useDebounce(productSearch, 500);

    // Get already added variant IDs
    const addedVariantIds = useMemo(() => {
      return new Set(lineItems.map((item) => item.variantId || ""));
    }, [lineItems]);

    // Calculate totals
    const subtotal = useMemo(() => {
      return lineItems.reduce((sum, item) => {
        return sum + parseFloat(item.unitPrice) * item.quantity;
      }, 0);
    }, [lineItems]);

    const total = useMemo(() => {
      return subtotal;
    }, [subtotal]);

    // Search products function
    const performSearch = useCallback(
      async (
        searchTerm: string | undefined,
        searchType: typeof searchBy,
        page: number = 1
      ): Promise<void> => {
        setSearching(true);
        try {
          const result = await searchProductsForOrder(
            searchTerm?.trim() || undefined,
            searchType,
            page,
            pageSize,
            selectedStoreId || undefined
          );
          if (result.success && result.data) {
            // Group products by listing
            const grouped = result.data.reduce((acc, variant) => {
              const existing = acc.find(
                (p) => p.listingId === variant.listingId
              );
              // Ensure currency is not null
              const variantWithCurrency: ProductVariant = {
                ...variant,
                currency: variant.currency || "NPR",
              };
              if (existing) {
                existing.variants.push(variantWithCurrency);
              } else {
                // Use listing image, or first variant image as fallback
                const displayImageUrl =
                  variant.listingImageUrl || variant.variantImageUrl || null;
                acc.push({
                  listingId: variant.listingId,
                  listingName: variant.listingName,
                  listingImageUrl: variant.listingImageUrl,
                  variants: [variantWithCurrency],
                  displayImageUrl,
                });
              }
              return acc;
            }, [] as GroupedProduct[]);

            // Update displayImageUrl for existing groups if listing image is null
            grouped.forEach((product) => {
              if (!product.displayImageUrl) {
                // Find first variant with an image
                const variantWithImage = product.variants.find(
                  (v) => v.variantImageUrl
                );
                if (variantWithImage) {
                  product.displayImageUrl = variantWithImage.variantImageUrl;
                }
              }
            });

            setGroupedProducts(grouped);
            setTotalCount(result.totalCount || 0);
            setCurrentPage(result.page || 1);
            // Auto-expand all products
            setExpandedProducts(new Set(grouped.map((p) => p.listingId)));
          } else {
            if (result.error) {
              console.error("Search error:", result.error);
            }
            setGroupedProducts([]);
            setTotalCount(0);
            setCurrentPage(1);
          }
        } catch (error) {
          console.error("Failed to search products:", error);
          setGroupedProducts([]);
          setTotalCount(0);
          setCurrentPage(1);
        } finally {
          setSearching(false);
        }
      },
      [pageSize, selectedStoreId]
    );

    // Load all products on modal open
    useEffect(() => {
      if (productPickerOpen) {
        // Reset search when modal opens
        setProductSearch("");
        setCurrentPage(1);
        prevDebouncedSearchRef.current = "";
        prevSearchByRef.current = "all";
        // Load first page of products immediately when modal opens
        performSearch(undefined, "all", 1);
      } else {
        // Reset when modal closes
        setProductSearch("");
        setGroupedProducts([]);
        setSelectedVariants(new Set());
        setExpandedProducts(new Set());
        setCurrentPage(1);
        setTotalCount(0);
        prevDebouncedSearchRef.current = "";
        prevSearchByRef.current = "all";
      }
    }, [productPickerOpen, performSearch]);

    // Auto-search when debounced search or searchBy changes (only if they actually changed)
    useEffect(() => {
      if (productPickerOpen) {
        const searchTerm = debouncedSearch.trim() || undefined;
        const prevSearchTerm =
          prevDebouncedSearchRef.current.trim() || undefined;
        const searchChanged = searchTerm !== prevSearchTerm;
        const searchByChanged = searchBy !== prevSearchByRef.current;

        // Only search if something actually changed (avoid duplicate search on initial load)
        if (searchChanged || searchByChanged) {
          setCurrentPage(1); // Reset to first page when search changes
          performSearch(searchTerm, searchBy, 1);
          prevDebouncedSearchRef.current = debouncedSearch;
          prevSearchByRef.current = searchBy;
        }
      }
    }, [
      debouncedSearch,
      searchBy,
      productPickerOpen,
      performSearch,
      selectedStoreId,
    ]);

    // Fetch stores for admin on mount
    useEffect(() => {
      if (isAdmin) {
        const fetchStores = async () => {
          setLoadingStores(true);
          try {
            const result = await getAllStores();
            if (result.success && result.stores) {
              setStores(result.stores);
              // Auto-select first store if available
              if (result.stores.length > 0 && !selectedStoreId) {
                setSelectedStoreId(result.stores[0].id);
              }
            }
          } catch (error) {
            console.error("Failed to fetch stores:", error);
          } finally {
            setLoadingStores(false);
          }
        };
        fetchStores();
      }
    }, [isAdmin]);

    // Fetch markets on mount
    useEffect(() => {
      const fetchMarkets = async () => {
        setLoadingMarkets(true);
        try {
          const result = await getMarketsForUser();
          if (result.success && result.markets) {
            setMarkets(result.markets);
            // Find and select default market
            const defaultMarket = result.markets.find((m) => m.isDefault);
            if (defaultMarket) {
              setSelectedMarketId(defaultMarket.id);
              setMarketCurrency(defaultMarket.currency);
              setCurrency(defaultMarket.currency);
              // Fetch exchange rate for default market
              try {
                const marketResult = await getMarket(defaultMarket.id);
                if (marketResult.success && marketResult.data) {
                  setMarketExchangeRate(marketResult.data.exchangeRate || "1");
                }
              } catch (error) {
                console.error(
                  "Failed to fetch default market exchange rate:",
                  error
                );
              }
            } else if (result.markets.length > 0) {
              // If no default, use first market
              setSelectedMarketId(result.markets[0].id);
              setMarketCurrency(result.markets[0].currency);
              setCurrency(result.markets[0].currency);
              // Fetch exchange rate for first market
              try {
                const marketResult = await getMarket(result.markets[0].id);
                if (marketResult.success && marketResult.data) {
                  setMarketExchangeRate(marketResult.data.exchangeRate || "1");
                }
              } catch (error) {
                console.error("Failed to fetch market exchange rate:", error);
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch markets:", error);
        } finally {
          setLoadingMarkets(false);
        }
      };
      fetchMarkets();
    }, []);

    // Update currency and convert prices when market changes
    useEffect(() => {
      const updateMarketAndConvertPrices = async () => {
        if (selectedMarketId) {
          const market = markets.find((m) => m.id === selectedMarketId);
          if (market) {
            setMarketCurrency(market.currency);
            setCurrency(market.currency);

            // Fetch market details to get exchange rate
            try {
              const marketResult = await getMarket(selectedMarketId);
              if (marketResult.success && marketResult.data) {
                const exchangeRate = parseFloat(
                  marketResult.data.exchangeRate || "1"
                );
                setMarketExchangeRate(marketResult.data.exchangeRate || "1");

                // Convert all line item prices to new market currency
                setLineItems((prevItems) =>
                  prevItems.map((item) => {
                    const originalPrice = parseFloat(
                      item.originalUnitPrice || item.unitPrice
                    );
                    // Convert: originalPrice (in originalCurrency) -> EUR -> newCurrency
                    // Since exchangeRate is from EUR to market currency, we need to reverse if original is not EUR
                    // For simplicity, assuming original prices are in EUR base
                    const convertedPrice = originalPrice * exchangeRate;

                    return {
                      ...item,
                      unitPrice: convertedPrice.toFixed(2),
                      currency: market.currency,
                    };
                  })
                );
              }
            } catch (error) {
              console.error("Failed to fetch market exchange rate:", error);
            }
          }
        }
      };

      updateMarketAndConvertPrices();
    }, [selectedMarketId, markets]);

    // Toggle product expansion
    const toggleProductExpansion = (listingId: string) => {
      setExpandedProducts((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(listingId)) {
          newSet.delete(listingId);
        } else {
          newSet.add(listingId);
        }
        return newSet;
      });
    };

    // Toggle variant selection
    const toggleVariantSelection = (variantId: string) => {
      if (addedVariantIds.has(variantId)) {
        return; // Don't allow selecting already added variants
      }
      setSelectedVariants((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(variantId)) {
          newSet.delete(variantId);
        } else {
          newSet.add(variantId);
        }
        return newSet;
      });
    };

    // Add selected products to line items
    const handleAddSelectedProducts = () => {
      const variantsToAdd: ProductVariant[] = [];
      const outOfStockVariants: ProductVariant[] = [];

      groupedProducts.forEach((product) => {
        product.variants.forEach((variant) => {
          if (selectedVariants.has(variant.variantId)) {
            if (variant.available <= 0) {
              outOfStockVariants.push(variant);
            } else {
              variantsToAdd.push(variant);
            }
          }
        });
      });

      if (variantsToAdd.length === 0 && outOfStockVariants.length === 0) {
        toast.error("Please select at least one product");
        return;
      }

      if (outOfStockVariants.length > 0) {
        toast.error(
          `Cannot add ${outOfStockVariants.length} item(s) - out of stock`
        );
      }

      variantsToAdd.forEach((variant) => {
        const existingItem = lineItems.find(
          (item) => item.variantId === variant.variantId
        );

        if (!existingItem) {
          // Use variant image if available, otherwise use listing image
          const displayImageUrl =
            variant.variantImageUrl || variant.listingImageUrl || null;
          // Convert price to market currency if market is selected
          let displayPrice = variant.price || "0";
          if (selectedMarketId && marketExchangeRate) {
            const originalPrice = parseFloat(variant.price || "0");
            const exchangeRate = parseFloat(marketExchangeRate);
            displayPrice = (originalPrice * exchangeRate).toFixed(2);
          }

          const newItem: LineItem = {
            id: `item-${variant.variantId}-${lineItems.length}`,
            listingId: variant.listingId,
            variantId: variant.variantId,
            quantity: 1,
            unitPrice: displayPrice,
            title: `${variant.listingName} - ${variant.variantTitle}`,
            sku: variant.sku || null,
            listingName: variant.listingName,
            variantTitle: variant.variantTitle,
            imageUrl: displayImageUrl,
            variantImageUrl: variant.variantImageUrl,
            currency: marketCurrency, // Display currency
            originalCurrency: variant.currency, // Store original currency
            originalUnitPrice: variant.price || "0", // Store original price
            available: variant.available,
          };
          setLineItems((prev) => [...prev, newItem]);
        }
      });

      // Fetch store owner email when products are added (if not already fetched)
      if (variantsToAdd.length > 0 && !storeOwnerEmail && !currentDraftId) {
        const firstListingId = variantsToAdd[0]?.listingId;
        if (firstListingId) {
          getStoreOwnerEmailFromListing(firstListingId)
            .then((result) => {
              if (result.success && result.email) {
                setStoreOwnerEmail(result.email);
                console.log("Store owner email fetched:", result.email);
              }
            })
            .catch((error) => {
              console.error(
                "Error fetching store owner email from products:",
                error
              );
            });
        }
      }

      setProductPickerOpen(false);
      setSelectedVariants(new Set());
      if (variantsToAdd.length > 0) {
        toast.success(`Added ${variantsToAdd.length} item(s)`);
      }
    };

    // Remove line item
    const handleRemoveLineItem = (id: string) => {
      setLineItems((prev) => prev.filter((item) => item.id !== id));
    };

    // Update line item quantity
    const handleUpdateQuantity = (id: string, delta: number) => {
      setLineItems((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            const newQuantity = Math.max(1, item.quantity + delta);
            // Don't allow quantity to exceed available stock
            const maxQuantity = Math.min(newQuantity, item.available);
            if (maxQuantity < newQuantity) {
              toast.error(
                `Only ${item.available} available in stock for ${item.variantTitle}`
              );
            }
            return { ...item, quantity: maxQuantity };
          }
          return item;
        })
      );
    };

    const handleSetQuantity = (id: string, value: string) => {
      const numValue = parseInt(value) || 1;
      setLineItems((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            const requestedQuantity = Math.max(1, numValue);
            // Don't allow quantity to exceed available stock
            const maxQuantity = Math.min(requestedQuantity, item.available);
            if (maxQuantity < requestedQuantity) {
              toast.error(
                `Only ${item.available} available in stock for ${item.variantTitle}`
              );
            }
            return { ...item, quantity: maxQuantity };
          }
          return item;
        })
      );
    };

    // Handle submit
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      if (lineItems.length === 0) {
        toast.error("Please add at least one line item");
        return;
      }

      if (!customerEmail.trim()) {
        toast.error("Please enter customer email");
        return;
      }

      // Validate stock availability before submitting
      const outOfStockItems = lineItems.filter(
        (item) => item.available < item.quantity
      );
      if (outOfStockItems.length > 0) {
        const itemNames = outOfStockItems
          .map(
            (item) =>
              `${item.variantTitle}: ${item.available} available, ${item.quantity} requested`
          )
          .join(", ");
        toast.error(`Insufficient stock: ${itemNames}`);
        return;
      }

      setLoading(true);
      if (onLoadingChange) {
        onLoadingChange(true);
      }
      try {
        if (isEditMode && draftId) {
          // Update existing draft order
          const result = await updateDraftOrder(draftId, {
            customerId: selectedCustomerId || null,
            customerEmail: customerEmail.trim(),
            customerFirstName: customerFirstName.trim() || null,
            customerLastName: customerLastName.trim() || null,
            customerPhone: customerPhone.trim() || null,
            lineItems: lineItems.map((item) => ({
              id: item.id,
              listingId: item.listingId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              title: item.title,
              sku: item.sku || null,
            })),
            currency: marketCurrency,
            subtotalAmount: subtotal.toFixed(2),
            discountAmount: "0",
            shippingAmount: "0",
            taxAmount: "0",
            totalAmount: total.toFixed(2),
            paymentStatus,
            shippingName: shippingName.trim() || null,
            shippingPhone: shippingPhone.trim() || null,
            shippingAddressLine1: shippingAddressLine1.trim() || null,
            shippingAddressLine2: shippingAddressLine2.trim() || null,
            shippingCity: shippingCity.trim() || null,
            shippingRegion: shippingRegion.trim() || null,
            shippingPostalCode: shippingPostalCode.trim() || null,
            shippingCountry: shippingCountry.trim() || null,
            billingName: billingSameAsShipping
              ? shippingName.trim() || null
              : billingName.trim() || null,
            billingPhone: billingSameAsShipping
              ? shippingPhone.trim() || null
              : billingPhone.trim() || null,
            billingAddressLine1: billingSameAsShipping
              ? shippingAddressLine1.trim() || null
              : billingAddressLine1.trim() || null,
            billingAddressLine2: billingSameAsShipping
              ? shippingAddressLine2.trim() || null
              : billingAddressLine2.trim() || null,
            billingCity: billingSameAsShipping
              ? shippingCity.trim() || null
              : billingCity.trim() || null,
            billingRegion: billingSameAsShipping
              ? shippingRegion.trim() || null
              : billingRegion.trim() || null,
            billingPostalCode: billingSameAsShipping
              ? shippingPostalCode.trim() || null
              : billingPostalCode.trim() || null,
            billingCountry: billingSameAsShipping
              ? shippingCountry.trim() || null
              : billingCountry.trim() || null,
          });

          if (result.success) {
            toast.success("Draft order updated successfully");
            // Update current draft ID and number if available
            if (draftId) {
              setCurrentDraftId(draftId);
              // Fetch draft to get draft number
              const draftResult = await getDraftOrder(draftId);
              if (draftResult.success && draftResult.data) {
                setCurrentDraftNumber(draftResult.data.draftNumber);
              }
            }
            // Reset modification tracking after successful save
            initialFormStateRef.current = currentFormState;
            if (onFormModified) {
              onFormModified(false);
            }
            // Stay on the same page
          } else {
            toast.error(result.error || "Failed to update draft order");
          }
        } else {
          // Create new draft order
          const result = await createDraftOrder({
            customerId: selectedCustomerId || null,
            customerEmail: customerEmail.trim(),
            customerFirstName: customerFirstName.trim() || null,
            customerLastName: customerLastName.trim() || null,
            customerPhone: customerPhone.trim() || null,
            lineItems: lineItems.map((item) => ({
              listingId: item.listingId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              title: item.title,
              sku: item.sku || null,
            })),
            currency: marketCurrency,
            subtotalAmount: subtotal.toFixed(2),
            discountAmount: "0",
            shippingAmount: "0",
            taxAmount: "0",
            totalAmount: total.toFixed(2),
            paymentStatus,
            shippingName: shippingName.trim() || null,
            shippingPhone: shippingPhone.trim() || null,
            shippingAddressLine1: shippingAddressLine1.trim() || null,
            shippingAddressLine2: shippingAddressLine2.trim() || null,
            shippingCity: shippingCity.trim() || null,
            shippingRegion: shippingRegion.trim() || null,
            shippingPostalCode: shippingPostalCode.trim() || null,
            shippingCountry: shippingCountry.trim() || null,
            billingName: billingSameAsShipping
              ? shippingName.trim() || null
              : billingName.trim() || null,
            billingPhone: billingSameAsShipping
              ? shippingPhone.trim() || null
              : billingPhone.trim() || null,
            billingAddressLine1: billingSameAsShipping
              ? shippingAddressLine1.trim() || null
              : billingAddressLine1.trim() || null,
            billingAddressLine2: billingSameAsShipping
              ? shippingAddressLine2.trim() || null
              : billingAddressLine2.trim() || null,
            billingCity: billingSameAsShipping
              ? shippingCity.trim() || null
              : billingCity.trim() || null,
            billingRegion: billingSameAsShipping
              ? shippingRegion.trim() || null
              : billingRegion.trim() || null,
            billingPostalCode: billingSameAsShipping
              ? shippingPostalCode.trim() || null
              : billingPostalCode.trim() || null,
            billingCountry: billingSameAsShipping
              ? shippingCountry.trim() || null // CountrySelect returns country code
              : billingCountry.trim() || null, // CountrySelect returns country code
          });

          if (result.success && result.draftId) {
            toast.success("Draft order created successfully");
            // Update current draft ID and number
            setCurrentDraftId(result.draftId);
            setCurrentDraftNumber(result.draftNumber || null);
            // Redirect to draft order detail page
            router.push(`/dashboard/draft_orders/${result.draftId}`);
          } else {
            toast.error(result.error || "Failed to create draft order");
          }
        }
      } catch {
        toast.error("Failed to create order");
      } finally {
        setLoading(false);
        if (onLoadingChange) {
          onLoadingChange(false);
        }
      }
    };

    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <SetupBannerWrapper />
        {!isEditMode && (
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Create Order</h1>
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Section */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Customer</h2>

                {/* Customer Source Selector */}
                <div className="mb-6 space-y-3">
                  <Label>Customer Source</Label>
                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="customerSource"
                        value="myInfo"
                        checked={customerSource === "myInfo"}
                        onChange={(e) =>
                          setCustomerSource(
                            e.target.value as "myInfo" | "search" | "manual"
                          )
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm">
                        Use my saved customer info
                      </span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="customerSource"
                        value="search"
                        checked={customerSource === "search"}
                        onChange={(e) =>
                          setCustomerSource(
                            e.target.value as "myInfo" | "search" | "manual"
                          )
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm">
                        Search for existing customer
                      </span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="customerSource"
                        value="manual"
                        checked={customerSource === "manual"}
                        onChange={(e) =>
                          setCustomerSource(
                            e.target.value as "myInfo" | "search" | "manual"
                          )
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm">
                        Enter customer info manually
                      </span>
                    </label>
                  </div>
                  {customerSource === "search" && selectedCustomerId && (
                    <p className="text-sm text-green-600">
                      Customer selected: {customerEmail}
                    </p>
                  )}
                  {loadingCustomer && (
                    <p className="text-sm text-muted-foreground">
                      Loading customer info...
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customerEmail">Email *</Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      required
                      disabled={loadingCustomer}
                    />
                  </div>
                  <div>
                    <Label htmlFor="customerPhone">Phone</Label>
                    <Input
                      id="customerPhone"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="customerFirstName">First Name</Label>
                    <Input
                      id="customerFirstName"
                      value={customerFirstName}
                      onChange={(e) => setCustomerFirstName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="customerLastName">Last Name</Label>
                    <Input
                      id="customerLastName"
                      value={customerLastName}
                      onChange={(e) => setCustomerLastName(e.target.value)}
                    />
                  </div>
                </div>
              </Card>

              {/* Store Selection (for admins) */}
              {isAdmin && (
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Store</h2>
                  <div className="space-y-2">
                    <Label htmlFor="store">Select Store</Label>
                    <Select
                      value={selectedStoreId || ""}
                      onValueChange={setSelectedStoreId}
                      disabled={loadingStores || stores.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingStores
                              ? "Loading stores..."
                              : "Select a store"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.storeName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!selectedStoreId && stores.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Please select a store to view products
                      </p>
                    )}
                  </div>
                </Card>
              )}

              {/* Line Items Section */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Line Items</h2>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setProductPickerOpen(true)}
                    disabled={(isAdmin && !selectedStoreId) || readOnly}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                </div>

                {lineItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No items added yet. Click &quot;Add Product&quot; to get
                    started.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lineItems.map((item) => {
                      const itemTotal =
                        parseFloat(item.unitPrice) * item.quantity;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-4 p-4 border rounded-lg"
                        >
                          {/* Product Image */}
                          <div className="flex-shrink-0">
                            {item.imageUrl ? (
                              <Image
                                src={item.imageUrl}
                                alt={item.title}
                                width={60}
                                height={60}
                                className="rounded object-cover"
                              />
                            ) : (
                              <div className="w-[60px] h-[60px] bg-muted rounded flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">
                                  No image
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              {item.variantTitle}
                              {item.available < item.quantity && (
                                <span className="ml-2 text-xs text-red-600 font-normal">
                                  (Insufficient stock: {item.available}{" "}
                                  available)
                                </span>
                              )}
                              {item.available === 0 && (
                                <span className="ml-2 text-xs text-red-600 font-normal">
                                  (Out of stock)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {marketCurrency}{" "}
                              {parseFloat(item.unitPrice).toFixed(2)}
                              {item.available > 0 && (
                                <span className="ml-2">
                                  • {item.available} in stock
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quantity */}
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => !readOnly && handleUpdateQuantity(item.id, -1)}
                              disabled={readOnly}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                !readOnly && handleSetQuantity(item.id, e.target.value)
                              }
                              className="w-16 text-center"
                              disabled={readOnly}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => !readOnly && handleUpdateQuantity(item.id, 1)}
                              disabled={readOnly}
                              disabled={item.quantity >= item.available}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Total */}
                          <div className="text-sm font-medium w-24 text-right">
                            {marketCurrency} {itemTotal.toFixed(2)}
                          </div>

                          {/* Remove Button */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => !readOnly && handleRemoveLineItem(item.id)}
                            disabled={readOnly}
                            className="flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Payment Card - Only show when products have been added */}
              {lineItems.length > 0 && (
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Payment</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>
                          {marketCurrency} {subtotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold pt-2 border-t">
                        <span>Total:</span>
                        <span>
                          {marketCurrency} {total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          // If draft not saved, save it first
                          if (!currentDraftId) {
                            // Validate form first
                            if (lineItems.length === 0) {
                              toast.error("Please add at least one line item");
                              return;
                            }
                            if (!customerEmail.trim()) {
                              toast.error("Please enter customer email");
                              return;
                            }

                            setLoading(true);
                            try {
                              const result = await createDraftOrder({
                                customerId: selectedCustomerId || null,
                                customerEmail: customerEmail.trim(),
                                customerFirstName:
                                  customerFirstName.trim() || null,
                                customerLastName:
                                  customerLastName.trim() || null,
                                customerPhone: customerPhone.trim() || null,
                                lineItems: lineItems.map((item) => ({
                                  listingId: item.listingId,
                                  variantId: item.variantId,
                                  quantity: item.quantity,
                                  unitPrice: item.unitPrice,
                                  title: item.title,
                                  sku: item.sku || null,
                                })),
                                currency: marketCurrency,
                                subtotalAmount: subtotal.toFixed(2),
                                discountAmount: "0",
                                shippingAmount: "0",
                                taxAmount: "0",
                                totalAmount: total.toFixed(2),
                                paymentStatus,
                                shippingName: shippingName.trim() || null,
                                shippingPhone: shippingPhone.trim() || null,
                                shippingAddressLine1:
                                  shippingAddressLine1.trim() || null,
                                shippingAddressLine2:
                                  shippingAddressLine2.trim() || null,
                                shippingCity: shippingCity.trim() || null,
                                shippingRegion: shippingRegion.trim() || null,
                                shippingPostalCode:
                                  shippingPostalCode.trim() || null,
                                shippingCountry: shippingCountry.trim() || null,
                                billingName: billingSameAsShipping
                                  ? shippingName.trim() || null
                                  : billingName.trim() || null,
                                billingPhone: billingSameAsShipping
                                  ? shippingPhone.trim() || null
                                  : billingPhone.trim() || null,
                                billingAddressLine1: billingSameAsShipping
                                  ? shippingAddressLine1.trim() || null
                                  : billingAddressLine1.trim() || null,
                                billingAddressLine2: billingSameAsShipping
                                  ? shippingAddressLine2.trim() || null
                                  : billingAddressLine2.trim() || null,
                                billingCity: billingSameAsShipping
                                  ? shippingCity.trim() || null
                                  : billingCity.trim() || null,
                                billingRegion: billingSameAsShipping
                                  ? shippingRegion.trim() || null
                                  : billingRegion.trim() || null,
                                billingPostalCode: billingSameAsShipping
                                  ? shippingPostalCode.trim() || null
                                  : billingPostalCode.trim() || null,
                                billingCountry: billingSameAsShipping
                                  ? shippingCountry.trim() || null
                                  : billingCountry.trim() || null,
                              });

                              if (result.success && result.draftId) {
                                setCurrentDraftId(result.draftId);
                                setCurrentDraftNumber(
                                  result.draftNumber || null
                                );
                                // Fetch store owner email
                                if (result.draftId) {
                                  const draftResult = await getDraftOrder(
                                    result.draftId
                                  );
                                  if (
                                    draftResult.success &&
                                    draftResult.data?.storeId
                                  ) {
                                    const emailResult =
                                      await getStoreOwnerEmail(
                                        draftResult.data.storeId
                                      );
                                    if (
                                      emailResult.success &&
                                      emailResult.email
                                    ) {
                                      setStoreOwnerEmail(emailResult.email);
                                    }
                                  }
                                }
                                setShowSendInvoiceDialog(true);
                              } else {
                                toast.error(
                                  result.error || "Failed to create draft order"
                                );
                              }
                            } catch (error) {
                              toast.error("Failed to create draft order");
                              console.error("Create draft error:", error);
                            } finally {
                              setLoading(false);
                            }
                          } else {
                            // Draft already exists, ensure email is fetched before showing dialog
                            if (currentDraftId) {
                              try {
                                const draftResult =
                                  await getDraftOrder(currentDraftId);
                                if (
                                  draftResult.success &&
                                  draftResult.data?.storeId
                                ) {
                                  const emailResult = await getStoreOwnerEmail(
                                    draftResult.data.storeId
                                  );
                                  if (
                                    emailResult.success &&
                                    emailResult.email
                                  ) {
                                    setStoreOwnerEmail(emailResult.email);
                                    // Small delay to ensure state update completes
                                    await new Promise((resolve) =>
                                      setTimeout(resolve, 50)
                                    );
                                  }
                                }
                              } catch (error) {
                                console.error(
                                  "Error fetching store owner email:",
                                  error
                                );
                              }
                            } else if (
                              lineItems.length > 0 &&
                              !storeOwnerEmail
                            ) {
                              // No draft yet, but we have products - fetch from products
                              try {
                                const firstListingId = lineItems[0]?.listingId;
                                if (firstListingId) {
                                  const emailResult =
                                    await getStoreOwnerEmailFromListing(
                                      firstListingId
                                    );
                                  if (
                                    emailResult.success &&
                                    emailResult.email
                                  ) {
                                    setStoreOwnerEmail(emailResult.email);
                                    // Small delay to ensure state update completes
                                    await new Promise((resolve) =>
                                      setTimeout(resolve, 50)
                                    );
                                  }
                                }
                              } catch (error) {
                                console.error(
                                  "Error fetching store owner email from products:",
                                  error
                                );
                              }
                            }
                            setShowSendInvoiceDialog(true);
                          }
                        }}
                        disabled={loading || !customerEmail || readOnly}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Send invoice
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setPaymentStatus("paid");
                          setShowMarkAsPaidDialog(true);
                        }}
                        disabled={loading || paymentStatus === "paid" || readOnly}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Mark as Paid
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {/* Right Column - Markets, Status, Addresses */}
            <div className="space-y-6">
              {/* Markets */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Markets</h2>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="market">Select Market</Label>
                    <Select
                      value={selectedMarketId || ""}
                      onValueChange={(value) => {
                        setSelectedMarketId(value);
                      }}
                      disabled={loadingMarkets || markets.length === 0 || readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingMarkets
                              ? "Loading markets..."
                              : "Select a market"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {markets.map((market) => (
                          <SelectItem key={market.id} value={market.id}>
                            {market.name} {market.isDefault && "(Default)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedMarketId && (
                    <div className="text-sm text-muted-foreground">
                      Currency: {marketCurrency}
                    </div>
                  )}
                </div>
              </Card>

              {/* Shipping Address */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Shipping Address</h2>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="shippingName">Name</Label>
                    <Input
                      id="shippingName"
                      value={shippingName}
                      onChange={(e) => setShippingName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="shippingPhone">Phone</Label>
                    <Input
                      id="shippingPhone"
                      value={shippingPhone}
                      onChange={(e) => setShippingPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="shippingAddressLine1">Address Line 1</Label>
                    <Input
                      id="shippingAddressLine1"
                      value={shippingAddressLine1}
                      onChange={(e) => setShippingAddressLine1(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="shippingAddressLine2">Address Line 2</Label>
                    <Input
                      id="shippingAddressLine2"
                      value={shippingAddressLine2}
                      onChange={(e) => setShippingAddressLine2(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="shippingCity">City</Label>
                      <Input
                        id="shippingCity"
                        value={shippingCity}
                        onChange={(e) => setShippingCity(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="shippingRegion">Region</Label>
                      <Input
                        id="shippingRegion"
                        value={shippingRegion}
                        onChange={(e) => setShippingRegion(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="shippingPostalCode">Postal Code</Label>
                      <Input
                        id="shippingPostalCode"
                        value={shippingPostalCode}
                        onChange={(e) => setShippingPostalCode(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="shippingCountry">Country</Label>
                      <CountrySelect
                        id="shippingCountry"
                        value={shippingCountry}
                        onValueChange={setShippingCountry}
                        placeholder="Select a country"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Billing Address */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Billing Address</h2>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="billingSameAsShipping"
                      checked={billingSameAsShipping}
                      onChange={(e) =>
                        setBillingSameAsShipping(e.target.checked)
                      }
                      className="rounded"
                    />
                    <Label htmlFor="billingSameAsShipping" className="text-sm">
                      Same as shipping
                    </Label>
                  </div>
                </div>
                {!billingSameAsShipping && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="billingName">Name</Label>
                      <Input
                        id="billingName"
                        value={billingName}
                        onChange={(e) => setBillingName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="billingPhone">Phone</Label>
                      <Input
                        id="billingPhone"
                        value={billingPhone}
                        onChange={(e) => setBillingPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="billingAddressLine1">
                        Address Line 1
                      </Label>
                      <Input
                        id="billingAddressLine1"
                        value={billingAddressLine1}
                        onChange={(e) => setBillingAddressLine1(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="billingAddressLine2">
                        Address Line 2
                      </Label>
                      <Input
                        id="billingAddressLine2"
                        value={billingAddressLine2}
                        onChange={(e) => setBillingAddressLine2(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="billingCity">City</Label>
                        <Input
                          id="billingCity"
                          value={billingCity}
                          onChange={(e) => setBillingCity(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="billingRegion">Region</Label>
                        <Input
                          id="billingRegion"
                          value={billingRegion}
                          onChange={(e) => setBillingRegion(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="billingPostalCode">Postal Code</Label>
                        <Input
                          id="billingPostalCode"
                          value={billingPostalCode}
                          onChange={(e) => setBillingPostalCode(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="billingCountry">Country</Label>
                        <CountrySelect
                          id="billingCountry"
                          value={billingCountry}
                          onValueChange={setBillingCountry}
                          placeholder="Select a country"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* Submit Button - Only show if not using top buttons */}
          {!showTopButtons && (
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(cancelRedirectPath)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </form>

        {/* Send Invoice Dialog */}
        <SendDraftInvoiceDialog
          open={showSendInvoiceDialog}
          onOpenChange={(open) => {
            setShowSendInvoiceDialog(open);
            if (!open) {
              setActionLoading(false);
              if (onActionLoadingChange) {
                onActionLoadingChange(false);
              }
            }
          }}
          draftId={currentDraftId}
          draftNumber={currentDraftNumber}
          customerEmail={customerEmail || null}
          storeOwnerEmail={storeOwnerEmail}
          onSuccess={() => {
            setActionLoading(false);
            if (onActionLoadingChange) {
              onActionLoadingChange(false);
            }
          }}
          onLoadingChange={(loading) => {
            setActionLoading(loading);
            if (onActionLoadingChange) {
              onActionLoadingChange(loading);
            }
          }}
        />

        {/* Mark as Paid Dialog */}
        <Dialog
          open={showMarkAsPaidDialog}
          onOpenChange={setShowMarkAsPaidDialog}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Mark as Paid</DialogTitle>
              <DialogDescription>
                {draftId
                  ? "This will immediately convert this draft order into an order and mark it as paid. The draft will be removed and cannot be undone. You will be redirected to the order page."
                  : "This will immediately create an order and mark it as paid. You will be redirected to the order page."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowMarkAsPaidDialog(false);
                  setPaymentStatus("pending");
                }}
                disabled={loading || actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  setLoading(true);
                  setActionLoading(true);
                  if (onActionLoadingChange) {
                    onActionLoadingChange(true);
                  }
                  try {
                    if (draftId) {
                      // Case 1: Convert existing draft to order and mark as paid
                      const result = await completeDraftOrder(draftId, true);

                      if (result.success && result.orderId) {
                        toast.success(
                          "Draft order converted to order and marked as paid"
                        );
                        setShowMarkAsPaidDialog(false);
                        setActionLoading(false);
                        if (onActionLoadingChange) {
                          onActionLoadingChange(false);
                        }
                        router.push("/dashboard/draft_orders");
                      } else {
                        toast.error(result.error || "Failed to mark as paid");
                        setShowMarkAsPaidDialog(false);
                        setPaymentStatus("pending");
                        setActionLoading(false);
                        if (onActionLoadingChange) {
                          onActionLoadingChange(false);
                        }
                      }
                    } else {
                      // Case 2: Create draft first, then immediately convert to order
                      // Validate form data first
                      if (lineItems.length === 0) {
                        toast.error("Please add at least one line item");
                        setShowMarkAsPaidDialog(false);
                        setLoading(false);
                        return;
                      }

                      if (!customerEmail.trim()) {
                        toast.error("Please enter customer email");
                        setShowMarkAsPaidDialog(false);
                        setLoading(false);
                        return;
                      }

                      // Validate stock availability
                      const outOfStockItems = lineItems.filter(
                        (item) => item.available < item.quantity
                      );
                      if (outOfStockItems.length > 0) {
                        const itemNames = outOfStockItems
                          .map(
                            (item) =>
                              `${item.variantTitle}: ${item.available} available, ${item.quantity} requested`
                          )
                          .join(", ");
                        toast.error(`Insufficient stock: ${itemNames}`);
                        setShowMarkAsPaidDialog(false);
                        setLoading(false);
                        return;
                      }

                      // Step 1: Create draft order (customerId will be found/created in createDraftOrder)
                      // The createDraftOrder function now handles finding/creating customers automatically
                      const draftResult = await createDraftOrder({
                        customerId: selectedCustomerId || null, // Will be found/created if null
                        customerEmail: customerEmail.trim(),
                        customerFirstName: customerFirstName.trim() || null,
                        customerLastName: customerLastName.trim() || null,
                        customerPhone: customerPhone.trim() || null,
                        lineItems: lineItems.map((item) => ({
                          listingId: item.listingId,
                          variantId: item.variantId,
                          quantity: item.quantity,
                          unitPrice: item.unitPrice,
                          title: item.title,
                          sku: item.sku || null,
                        })),
                        currency: marketCurrency,
                        subtotalAmount: subtotal.toFixed(2),
                        discountAmount: "0",
                        shippingAmount: "0",
                        taxAmount: "0",
                        totalAmount: total.toFixed(2),
                        paymentStatus: "pending", // Will be marked as paid when converted
                        shippingName: shippingName.trim() || null,
                        shippingPhone: shippingPhone.trim() || null,
                        shippingAddressLine1:
                          shippingAddressLine1.trim() || null,
                        shippingAddressLine2:
                          shippingAddressLine2.trim() || null,
                        shippingCity: shippingCity.trim() || null,
                        shippingRegion: shippingRegion.trim() || null,
                        shippingPostalCode: shippingPostalCode.trim() || null,
                        shippingCountry: shippingCountry.trim() || null,
                        billingName: billingSameAsShipping
                          ? shippingName.trim() || null
                          : billingName.trim() || null,
                        billingPhone: billingSameAsShipping
                          ? shippingPhone.trim() || null
                          : billingPhone.trim() || null,
                        billingAddressLine1: billingSameAsShipping
                          ? shippingAddressLine1.trim() || null
                          : billingAddressLine1.trim() || null,
                        billingAddressLine2: billingSameAsShipping
                          ? shippingAddressLine2.trim() || null
                          : billingAddressLine2.trim() || null,
                        billingCity: billingSameAsShipping
                          ? shippingCity.trim() || null
                          : billingCity.trim() || null,
                        billingRegion: billingSameAsShipping
                          ? shippingRegion.trim() || null
                          : billingRegion.trim() || null,
                        billingPostalCode: billingSameAsShipping
                          ? shippingPostalCode.trim() || null
                          : billingPostalCode.trim() || null,
                        billingCountry: billingSameAsShipping
                          ? shippingCountry.trim() || null
                          : billingCountry.trim() || null,
                      });

                      if (!draftResult.success || !draftResult.draftId) {
                        toast.error(
                          draftResult.error || "Failed to create draft order"
                        );
                        setShowMarkAsPaidDialog(false);
                        setLoading(false);
                        return;
                      }

                      // Step 3: Immediately convert draft to order and mark as paid
                      const orderResult = await completeDraftOrder(
                        draftResult.draftId,
                        true
                      );

                      if (orderResult.success && orderResult.orderId) {
                        toast.success("Order created and marked as paid");
                        setShowMarkAsPaidDialog(false);
                        setActionLoading(false);
                        if (onActionLoadingChange) {
                          onActionLoadingChange(false);
                        }
                        router.push("/dashboard/draft_orders");
                      } else {
                        toast.error(
                          orderResult.error ||
                            "Failed to convert draft to order"
                        );
                        setShowMarkAsPaidDialog(false);
                        setPaymentStatus("pending");
                        setActionLoading(false);
                        if (onActionLoadingChange) {
                          onActionLoadingChange(false);
                        }
                      }
                    }
                  } catch (error) {
                    toast.error("Failed to mark as paid");
                    setShowMarkAsPaidDialog(false);
                    setPaymentStatus("pending");
                    setActionLoading(false);
                    if (onActionLoadingChange) {
                      onActionLoadingChange(false);
                    }
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || actionLoading}
              >
                {loading || actionLoading ? "Processing..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Product Picker Modal */}
        <Dialog open={productPickerOpen} onOpenChange={setProductPickerOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Add Product</DialogTitle>
            </DialogHeader>
            <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
              {/* Search Bar */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={searchBy}
                  onValueChange={(value: typeof searchBy) => setSearchBy(value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="product_title">Product Title</SelectItem>
                    <SelectItem value="product_id">Product ID</SelectItem>
                    <SelectItem value="sku">SKU</SelectItem>
                    <SelectItem value="variant_title">Variant Title</SelectItem>
                    <SelectItem value="variant_id">Variant ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Product Table */}
              <div className="flex-1 overflow-auto border rounded-lg">
                {searching ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Searching...
                  </div>
                ) : groupedProducts.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {productSearch.trim()
                      ? "No products found. Try a different search term."
                      : "No products found."}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedProducts.map((product) => {
                        const isExpanded = expandedProducts.has(
                          product.listingId
                        );
                        const allVariantsSelected = product.variants.every(
                          (v) =>
                            selectedVariants.has(v.variantId) ||
                            addedVariantIds.has(v.variantId)
                        );

                        return (
                          <React.Fragment key={product.listingId}>
                            {/* Product Row */}
                            <TableRow
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() =>
                                toggleProductExpansion(product.listingId)
                              }
                            >
                              <TableCell className="w-12">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <Checkbox
                                    checked={allVariantsSelected}
                                    onCheckedChange={(checked) => {
                                      product.variants.forEach((variant) => {
                                        if (
                                          !addedVariantIds.has(
                                            variant.variantId
                                          )
                                        ) {
                                          if (checked) {
                                            setSelectedVariants((prev) =>
                                              new Set(prev).add(
                                                variant.variantId
                                              )
                                            );
                                          } else {
                                            setSelectedVariants((prev) => {
                                              const newSet = new Set(prev);
                                              newSet.delete(variant.variantId);
                                              return newSet;
                                            });
                                          }
                                        }
                                      });
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="pointer-events-auto"
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {product.displayImageUrl && (
                                    <Image
                                      src={product.displayImageUrl}
                                      alt={product.listingName}
                                      width={40}
                                      height={40}
                                      className="rounded object-cover"
                                    />
                                  )}
                                  <span className="font-medium">
                                    {product.listingName}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {product.variants.reduce(
                                  (sum, v) => sum + v.available,
                                  0
                                )}
                              </TableCell>
                              <TableCell className="text-right">-</TableCell>
                            </TableRow>

                            {/* Variant Rows */}
                            {isExpanded &&
                              product.variants.map((variant) => {
                                const isSelected = selectedVariants.has(
                                  variant.variantId
                                );
                                const isAdded = addedVariantIds.has(
                                  variant.variantId
                                );
                                const isOutOfStock = variant.available <= 0;
                                const isDisabled = isAdded || isOutOfStock;

                                return (
                                  <TableRow
                                    key={variant.variantId}
                                    className={`cursor-pointer hover:bg-muted/50 ${
                                      isDisabled ? "opacity-50" : ""
                                    } ${isOutOfStock ? "bg-red-50" : ""}`}
                                    onClick={() =>
                                      !isDisabled &&
                                      toggleVariantSelection(variant.variantId)
                                    }
                                  >
                                    <TableCell className="w-12 pl-8">
                                      <Checkbox
                                        checked={isSelected || isAdded}
                                        disabled={isDisabled}
                                        onCheckedChange={() =>
                                          !isDisabled &&
                                          toggleVariantSelection(
                                            variant.variantId
                                          )
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        className="pointer-events-auto"
                                      />
                                    </TableCell>
                                    <TableCell className="pl-8">
                                      <span className="text-sm text-muted-foreground">
                                        {variant.variantTitle}
                                        {isAdded && (
                                          <span className="ml-2 text-xs text-orange-600">
                                            (Already added)
                                          </span>
                                        )}
                                        {isOutOfStock && !isAdded && (
                                          <span className="ml-2 text-xs text-red-600 font-medium">
                                            (Out of stock)
                                          </span>
                                        )}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <span
                                        className={
                                          variant.available <= 0
                                            ? "text-red-600 font-medium"
                                            : ""
                                        }
                                      >
                                        {variant.available}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {variant.currency}{" "}
                                      {parseFloat(variant.price || "0").toFixed(
                                        2
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Pagination */}
              {totalCount > 0 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing{" "}
                    {Math.min((currentPage - 1) * pageSize + 1, totalCount)} -{" "}
                    {Math.min(currentPage * pageSize, totalCount)} of{" "}
                    {totalCount} variants
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newPage = currentPage - 1;
                        setCurrentPage(newPage);
                        performSearch(
                          debouncedSearch.trim() || undefined,
                          searchBy,
                          newPage
                        );
                      }}
                      disabled={currentPage === 1 || searching}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newPage = currentPage + 1;
                        setCurrentPage(newPage);
                        performSearch(
                          debouncedSearch.trim() || undefined,
                          searchBy,
                          newPage
                        );
                      }}
                      disabled={
                        currentPage * pageSize >= totalCount || searching
                      }
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProductPickerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleAddSelectedProducts}
                disabled={selectedVariants.size === 0}
              >
                Add ({selectedVariants.size})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Customer Search Modal */}
        <Dialog
          open={customerSearchOpen}
          onOpenChange={handleCloseCustomerSearch}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Search Customer</DialogTitle>
            </DialogHeader>
            <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex-1 overflow-y-auto">
                {searchingCustomers ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Searching...
                  </div>
                ) : customerSearchResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {customerSearchQuery.trim()
                      ? "No customers found"
                      : "Enter a search term to find customers"}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerSearchResults.map((customer) => (
                        <TableRow
                          key={customer.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSelectCustomer(customer)}
                        >
                          <TableCell>
                            {customer.firstName || customer.lastName
                              ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
                              : "No name"}
                          </TableCell>
                          <TableCell>{customer.email}</TableCell>
                          <TableCell>{customer.phone || "—"}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectCustomer(customer);
                              }}
                            >
                              Select
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseCustomerSearch}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);

export default CreateOrderForm;
