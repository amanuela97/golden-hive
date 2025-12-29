"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Heart,
  Star,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";
import {
  toggleStoreFollow,
  getStoreListings,
  getStoreReviews,
} from "../../actions/storefront";
import toast from "react-hot-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { StoreReviewDisplay } from "../../components/reviews/StoreReviewDisplay";

interface StorefrontClientProps {
  data: {
    store: {
      id: string;
      storeName: string;
      logoUrl: string | null;
      ratingAvg: string | number;
      ratingCount: number;
      followerCount: number;
    };
    banners: Array<{ id: string; url: string; alt?: string }>;
    about: {
      title?: string | null;
      description?: string | null;
      imageUrl?: string | null;
    } | null;
    policies: {
      shipping?: string | null;
      returns?: string | null;
      cancellations?: string | null;
      customOrders?: string | null;
      privacy?: string | null;
      additional?: string | null;
    } | null;
    listings: Array<{
      id: string;
      slug: string | null;
      name: string;
      imageUrl: string | null;
      price: string | number;
      currency: string;
    }>;
    reviews: Array<{
      id: string;
      rating: number;
      title: string | null;
      body: string;
      verified: boolean;
      createdAt: Date;
      reviewerName: string;
      reviewerEmail: string | null;
      isGuest: boolean;
      userId?: string | null;
    }>;
  };
  initialFollowing: boolean;
}

export function StorefrontClient({
  data,
  initialFollowing,
}: StorefrontClientProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [activeSection, setActiveSection] = useState("items");

  // Refs for sections
  const itemsRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const policiesRef = useRef<HTMLDivElement>(null);

  // Listings state
  const [listings, setListings] = useState(data.listings);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<
    "relevance" | "newest" | "price-low" | "price-high"
  >("newest");
  const [listingsPage, setListingsPage] = useState(1);
  const [listingsTotalPages, setListingsTotalPages] = useState(1);
  const [listingsTotalCount, setListingsTotalCount] = useState(0);

  // Reviews state
  const [reviews, setReviews] = useState(data.reviews);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1);

  // Fetch listings when filters/sort/page changes
  useEffect(() => {
    const fetchListings = async () => {
      setListingsLoading(true);
      try {
        const result = await getStoreListings(data.store.id, {
          search: searchQuery || undefined,
          minPrice,
          maxPrice,
          sortBy,
          page: listingsPage,
          limit: 12,
        });
        setListings(result.listings);
        setListingsTotalPages(result.totalPages);
        setListingsTotalCount(result.totalCount);
      } catch {
        toast.error("Failed to load products");
      } finally {
        setListingsLoading(false);
      }
    };

    fetchListings();
  }, [data.store.id, searchQuery, minPrice, maxPrice, sortBy, listingsPage]);

  // Fetch reviews when page changes
  useEffect(() => {
    const fetchReviews = async () => {
      setReviewsLoading(true);
      try {
        const result = await getStoreReviews(data.store.id, {
          page: reviewsPage,
          limit: 10,
        });
        setReviews(
          result.reviews.map((r) => ({
            id: r.id,
            rating: r.rating,
            title: r.title,
            body: r.body,
            verified: false, // Store reviews don't have verified field in the query
            createdAt: r.createdAt,
            reviewerName: r.userName ?? "Anonymous",
            reviewerEmail: null, // Store reviews don't have email in the query
            isGuest: false, // Store reviews are always from users (innerJoin with user)
            userId: null, // Not available in the query
          }))
        );
        setReviewsTotalPages(result.totalPages);
      } catch {
        toast.error("Failed to load reviews");
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchReviews();
  }, [data.store.id, reviewsPage]);

  // Scroll-spy: Update active section based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        { id: "items", ref: itemsRef },
        { id: "reviews", ref: reviewsRef },
        { id: "about", ref: aboutRef },
        { id: "policies", ref: policiesRef },
      ];

      const scrollPosition = window.scrollY + 150; // Offset for sticky nav

      // Find which section is currently in view
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.ref.current) {
          const rect = section.ref.current.getBoundingClientRect();
          const sectionTop = rect.top + window.scrollY;
          if (scrollPosition >= sectionTop) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Check on mount

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Smooth scroll to section
  const scrollToSection = (sectionId: string) => {
    const sectionMap: {
      [key: string]: React.RefObject<HTMLDivElement | null>;
    } = {
      items: itemsRef,
      reviews: reviewsRef,
      about: aboutRef,
      policies: policiesRef,
    };

    const section = sectionMap[sectionId];
    if (section?.current) {
      const offset = 100; // Offset for sticky nav
      const elementPosition = section.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  const handleFollow = async () => {
    try {
      const result = await toggleStoreFollow(data.store.id);
      if (result.success) {
        setIsFollowing(result.following);
        toast.success(
          result.following ? "Following store" : "Unfollowed store"
        );
      }
    } catch {
      toast.error("Failed to update follow status");
    }
  };

  const nextBanner = () => {
    setCurrentBannerIndex((prev) => (prev + 1) % data.banners.length);
  };

  const prevBanner = () => {
    setCurrentBannerIndex(
      (prev) => (prev - 1 + data.banners.length) % data.banners.length
    );
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setListingsPage(1); // Reset to first page on search
  };

  const handlePriceFilterChange = (min: string, max: string) => {
    setMinPrice(min ? parseFloat(min) : undefined);
    setMaxPrice(max ? parseFloat(max) : undefined);
    setListingsPage(1); // Reset to first page on filter change
  };

  const handleSortChange = (value: string) => {
    setSortBy(value as typeof sortBy);
    setListingsPage(1); // Reset to first page on sort change
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Banner Carousel */}
      {data.banners.length > 0 && (
        <div className="relative w-full h-64 md:h-96 bg-gray-200">
          <Image
            src={data.banners[currentBannerIndex].url}
            alt={
              data.banners[currentBannerIndex].alt ||
              `Banner ${currentBannerIndex + 1}`
            }
            fill
            className="object-cover"
            priority
          />
          {data.banners.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                onClick={prevBanner}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                onClick={nextBanner}
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {data.banners.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentBannerIndex(idx)}
                    className={`w-2 h-2 rounded-full ${
                      idx === currentBannerIndex ? "bg-white" : "bg-white/50"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="container mx-auto px-6 md:px-8 lg:px-12 py-8">
        {/* Store Header */}
        <div className="flex items-start gap-6 mb-8">
          {data.store.logoUrl && (
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-background shadow-lg shrink-0">
              <Image
                src={data.store.logoUrl}
                alt={data.store.storeName}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{data.store.storeName}</h1>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1">
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">
                  {parseFloat(data.store.ratingAvg.toString()).toFixed(1)}
                </span>
                <span className="text-muted-foreground">
                  ({data.store.ratingCount} reviews)
                </span>
              </div>
              <span className="text-muted-foreground">
                {data.store.followerCount} followers
              </span>
            </div>
          </div>
          <Button
            variant={isFollowing ? "default" : "outline"}
            onClick={handleFollow}
          >
            <Heart
              className={`w-4 h-4 mr-2 ${isFollowing ? "fill-current" : ""}`}
            />
            {isFollowing ? "Following" : "Follow"}
          </Button>
        </div>

        {/* Sticky Tabbed Navigation */}
        <div className="sticky top-0 z-[60] left-0 right-0 bg-background border-b shadow-sm mb-8 -mx-6 md:-mx-8 lg:-mx-12">
          <div className="w-full px-6 md:px-8 lg:px-12">
            <div className="flex gap-1 overflow-x-auto">
              <button
                onClick={() => scrollToSection("items")}
                className={cn(
                  "px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  activeSection === "items"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Items
              </button>
              <button
                onClick={() => scrollToSection("reviews")}
                className={cn(
                  "px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  activeSection === "reviews"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Reviews
              </button>
              {data.about && (
                <button
                  onClick={() => scrollToSection("about")}
                  className={cn(
                    "px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                    activeSection === "about"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  About
                </button>
              )}
              {data.policies && (
                <button
                  onClick={() => scrollToSection("policies")}
                  className={cn(
                    "px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                    activeSection === "policies"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Policies
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Products Section with Search, Filters, and Sort */}
        <div id="items" ref={itemsRef} className="py-12 scroll-mt-24">
          <div className="grid grid-cols-5 gap-8">
            <div className="col-span-1">
              <h2 className="text-2xl font-bold">Items</h2>
            </div>
            <div className="col-span-4">
              <div className="flex items-center justify-between mb-6">
                <div className="text-sm text-muted-foreground">
                  {listingsTotalCount}{" "}
                  {listingsTotalCount === 1 ? "item" : "items"}
                </div>
              </div>

              {/* Search and Filters */}
              <div className="mb-6 space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => handleSearchChange("")}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Filters and Sort */}
                <div className="flex flex-wrap gap-4 items-end">
                  {/* Price Range */}
                  <div className="flex gap-2 items-center">
                    <label className="text-sm font-medium">Price:</label>
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minPrice || ""}
                      onChange={(e) =>
                        handlePriceFilterChange(
                          e.target.value,
                          maxPrice?.toString() || ""
                        )
                      }
                      className="w-24"
                      min="0"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxPrice || ""}
                      onChange={(e) =>
                        handlePriceFilterChange(
                          minPrice?.toString() || "",
                          e.target.value
                        )
                      }
                      className="w-24"
                      min="0"
                    />
                  </div>

                  {/* Sort */}
                  <Select value={sortBy} onValueChange={handleSortChange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="price-low">
                        Price: Low to High
                      </SelectItem>
                      <SelectItem value="price-high">
                        Price: High to Low
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Clear Filters */}
                  {(searchQuery || minPrice || maxPrice) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("");
                        setMinPrice(undefined);
                        setMaxPrice(undefined);
                        setListingsPage(1);
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>

              {/* Products Grid */}
              {listingsLoading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Loading products...</p>
                </div>
              ) : listings.length === 0 ? (
                <p className="text-muted-foreground">No products found.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    {listings.map((listing) => (
                      <Link
                        key={listing.id}
                        href={`/products/${listing.slug || listing.id}`}
                        className="group"
                      >
                        <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                          {listing.imageUrl && (
                            <div className="relative w-full h-48 bg-gray-200">
                              <Image
                                src={listing.imageUrl}
                                alt={listing.name}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform"
                              />
                            </div>
                          )}
                          <div className="p-4">
                            <h3 className="font-semibold mb-2 line-clamp-2">
                              {listing.name}
                            </h3>
                            <p className="text-lg font-bold">
                              {listing.currency} {listing.price}
                            </p>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>

                  {/* Pagination for Listings */}
                  {listingsTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setListingsPage((p) => Math.max(1, p - 1))
                        }
                        disabled={listingsPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from(
                          { length: Math.min(5, listingsTotalPages) },
                          (_, i) => {
                            let pageNum;
                            if (listingsTotalPages <= 5) {
                              pageNum = i + 1;
                            } else if (listingsPage <= 3) {
                              pageNum = i + 1;
                            } else if (listingsPage >= listingsTotalPages - 2) {
                              pageNum = listingsTotalPages - 4 + i;
                            } else {
                              pageNum = listingsPage - 2 + i;
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant={
                                  listingsPage === pageNum
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                onClick={() => setListingsPage(pageNum)}
                              >
                                {pageNum}
                              </Button>
                            );
                          }
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setListingsPage((p) =>
                            Math.min(listingsTotalPages, p + 1)
                          )
                        }
                        disabled={listingsPage === listingsTotalPages}
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div
          id="reviews"
          ref={reviewsRef}
          className="py-12 border-t border-border scroll-mt-24"
        >
          <div className="grid grid-cols-5 gap-8">
            <div className="col-span-1">
              <h2 className="text-2xl font-bold">Reviews</h2>
            </div>
            <div className="col-span-4">
              {reviewsLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading reviews...</p>
                </div>
              ) : reviews.length === 0 ? (
                <p className="text-muted-foreground">No reviews yet.</p>
              ) : (
                <>
                  <StoreReviewDisplay reviews={reviews} />

                  {/* Pagination for Reviews */}
                  {reviewsTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setReviewsPage((p) => Math.max(1, p - 1))
                        }
                        disabled={reviewsPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from(
                          { length: Math.min(5, reviewsTotalPages) },
                          (_, i) => {
                            let pageNum;
                            if (reviewsTotalPages <= 5) {
                              pageNum = i + 1;
                            } else if (reviewsPage <= 3) {
                              pageNum = i + 1;
                            } else if (reviewsPage >= reviewsTotalPages - 2) {
                              pageNum = reviewsTotalPages - 4 + i;
                            } else {
                              pageNum = reviewsPage - 2 + i;
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant={
                                  reviewsPage === pageNum
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                onClick={() => setReviewsPage(pageNum)}
                              >
                                {pageNum}
                              </Button>
                            );
                          }
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setReviewsPage((p) =>
                            Math.min(reviewsTotalPages, p + 1)
                          )
                        }
                        disabled={reviewsPage === reviewsTotalPages}
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* About Section */}
        {data.about && (
          <div
            id="about"
            ref={aboutRef}
            className="py-12 border-t border-border scroll-mt-24"
          >
            <div className="grid grid-cols-5 gap-8">
              <div className="col-span-1">
                <h2 className="text-2xl font-bold">About</h2>
              </div>
              <div className="col-span-4">
                {data.about.imageUrl && (
                  <div className="relative w-full h-64 mb-4 rounded-lg overflow-hidden">
                    <Image
                      src={data.about.imageUrl}
                      alt={data.about.title || "About"}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                {data.about.title && (
                  <h3 className="text-xl font-semibold mb-2">
                    {data.about.title}
                  </h3>
                )}
                {data.about.description && (
                  <p className="text-muted-foreground whitespace-pre-line">
                    {data.about.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Policies Accordion */}
        {data.policies && (
          <div
            id="policies"
            ref={policiesRef}
            className="py-12 border-t border-border scroll-mt-24"
          >
            <div className="grid grid-cols-5 gap-8">
              <div className="col-span-1">
                <h2 className="text-2xl font-bold">Policies</h2>
              </div>
              <div className="col-span-4">
                <Accordion type="single" collapsible className="w-full">
                  {data.policies.shipping && (
                    <AccordionItem value="shipping">
                      <AccordionTrigger>Shipping Policy</AccordionTrigger>
                      <AccordionContent className="whitespace-pre-line">
                        {data.policies.shipping}
                      </AccordionContent>
                    </AccordionItem>
                  )}
                  {data.policies.returns && (
                    <AccordionItem value="returns">
                      <AccordionTrigger>Returns & Refunds</AccordionTrigger>
                      <AccordionContent className="whitespace-pre-line">
                        {data.policies.returns}
                      </AccordionContent>
                    </AccordionItem>
                  )}
                  {data.policies.cancellations && (
                    <AccordionItem value="cancellations">
                      <AccordionTrigger>Cancellations</AccordionTrigger>
                      <AccordionContent className="whitespace-pre-line">
                        {data.policies.cancellations}
                      </AccordionContent>
                    </AccordionItem>
                  )}
                  {data.policies.customOrders && (
                    <AccordionItem value="custom-orders">
                      <AccordionTrigger>Custom Orders</AccordionTrigger>
                      <AccordionContent className="whitespace-pre-line">
                        {data.policies.customOrders}
                      </AccordionContent>
                    </AccordionItem>
                  )}
                  {data.policies.privacy && (
                    <AccordionItem value="privacy">
                      <AccordionTrigger>Privacy Policy</AccordionTrigger>
                      <AccordionContent className="whitespace-pre-line">
                        {data.policies.privacy}
                      </AccordionContent>
                    </AccordionItem>
                  )}
                  {data.policies.additional && (
                    <AccordionItem value="additional">
                      <AccordionTrigger>Additional Policies</AccordionTrigger>
                      <AccordionContent className="whitespace-pre-line">
                        {data.policies.additional}
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
