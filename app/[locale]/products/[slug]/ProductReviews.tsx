"use client";

import { useEffect, useState } from "react";
import { getProductReviews } from "../../actions/reviews";
import { ProductReviewDisplay } from "../../components/reviews/ProductReviewDisplay";
import { StarRating } from "../../components/reviews/StarRating";

interface ProductReview {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  verified: boolean;
  createdAt: Date;
  reviewerName: string;
  reviewerEmail: string | null;
  isGuest: boolean;
}

interface ProductReviewsProps {
  listingId: string;
  ratingAverage: string | null;
  ratingCount: number | null;
}

export function ProductReviews({
  listingId,
  ratingAverage,
  ratingCount,
}: ProductReviewsProps) {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const reviewsData = await getProductReviews(listingId);
        if (reviewsData.success) {
          setReviews(
            (reviewsData.reviews || []).map((r) => ({
              ...r,
              comment: r.comment || "",
            }))
          );
        }
      } catch (error) {
        console.error("Error fetching reviews:", error);
      } finally {
        setLoading(false);
      }
    };

    if (listingId) {
      fetchReviews();
    }
  }, [listingId]);

  const avgRating = ratingAverage ? parseFloat(ratingAverage) : 0;
  const count = ratingCount || 0;

  if (loading) {
    return (
      <div className="mt-12">
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-4">Customer Reviews</h2>
          <p className="text-muted-foreground">Loading reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12">
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-4">Customer Reviews</h2>
        {count > 0 && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <StarRating value={Math.round(avgRating)} readonly size="lg" />
              <span className="text-2xl font-bold">{avgRating.toFixed(1)}</span>
            </div>
            <span className="text-muted-foreground">
              ({count} {count === 1 ? "review" : "reviews"})
            </span>
          </div>
        )}
      </div>
      <ProductReviewDisplay reviews={reviews} />
    </div>
  );
}
