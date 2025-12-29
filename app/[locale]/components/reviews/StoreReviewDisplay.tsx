"use client";

import { StarRating } from "./StarRating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteStoreReview } from "@/app/[locale]/actions/reviews";
import toast from "react-hot-toast";
import { useRouter } from "@/i18n/navigation";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

interface StoreReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  verified: boolean;
  createdAt: Date;
  reviewerName: string;
  reviewerEmail: string | null;
  isGuest: boolean;
  userId?: string | null; // Add userId to check ownership
}

interface StoreReviewDisplayProps {
  reviews: StoreReview[];
}

export function StoreReviewDisplay({ reviews }: StoreReviewDisplayProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (reviewId: string) => {
    if (!window.confirm("Are you sure you want to delete this review?")) {
      return;
    }

    setDeletingId(reviewId);
    try {
      const result = await deleteStoreReview(reviewId);
      if (result.success) {
        toast.success("Review deleted");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete review");
      }
    } catch (error) {
      console.error("Error deleting review:", error);
      toast.error("An error occurred");
    } finally {
      setDeletingId(null);
    }
  };

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No reviews yet. Be the first to review this store!
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reviews.map((review) => (
        <div key={review.id} className="border-b pb-6 last:border-b-0 group">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">{review.reviewerName}</span>
                {review.verified && (
                  <Badge variant="secondary" className="text-xs">
                    ✓ Verified purchase
                  </Badge>
                )}
                {review.isGuest && (
                  <Badge variant="outline" className="text-xs">
                    Guest
                  </Badge>
                )}
              </div>
              <div className="mb-2">
                <StarRating value={review.rating} readonly size="sm" />
              </div>
              {review.title && (
                <h4 className="font-semibold mb-1">{review.title}</h4>
              )}
              <p className="text-muted-foreground mb-2">{review.body}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(review.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
            {/* Delete button - visibility controlled by server action */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(review.id)}
              disabled={deletingId === review.id}
              className="text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
