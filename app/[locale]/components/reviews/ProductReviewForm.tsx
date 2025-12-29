"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StarRating } from "./StarRating";
import {
  submitProductReview,
  type ProductReviewInput,
} from "@/app/[locale]/actions/reviews";
import toast from "react-hot-toast";
import { useRouter } from "@/i18n/navigation";
import Image from "next/image";

interface ProductReviewFormProps {
  listingId: string;
  orderId: string;
  productName: string;
  productImage?: string;
  storeName: string;
  isAuthenticated: boolean;
  userName?: string;
  userEmail?: string;
  onSuccess?: () => void;
}

export function ProductReviewForm({
  listingId,
  orderId,
  productName,
  productImage,
  storeName,
  isAuthenticated,
  userName,
  onSuccess,
}: ProductReviewFormProps) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    if (comment.trim().length < 10) {
      toast.error("Comment must be at least 10 characters");
      return;
    }

    if (!isAuthenticated) {
      if (!guestName.trim() || !guestEmail.trim()) {
        toast.error("Name and email are required");
        return;
      }
    }

    setSubmitting(true);

    try {
      const input: ProductReviewInput = {
        listingId,
        orderId,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim(),
        ...(!isAuthenticated && {
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
        }),
      };

      const result = await submitProductReview(input);

      if (result.success) {
        toast.success("Thank you for your review!");
        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      } else {
        toast.error(result.error || "Failed to submit review");
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Info */}
      <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
        {productImage && (
          <Image
            width={64}
            height={64}
            src={productImage}
            alt={productName}
            className="w-16 h-16 object-cover rounded"
          />
        )}
        <div>
          <h3 className="font-medium">{productName}</h3>
          <p className="text-sm text-muted-foreground">Sold by {storeName}</p>
        </div>
      </div>

      {/* Rating */}
      <div>
        <Label htmlFor="rating">Rating *</Label>
        <div className="mt-2">
          <StarRating value={rating} onChange={setRating} showLabel />
        </div>
      </div>

      {/* Title (optional) */}
      <div>
        <Label htmlFor="title">Review Title (optional)</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Summarize your experience"
          maxLength={100}
          className="mt-2"
        />
      </div>

      {/* Comment */}
      <div>
        <Label htmlFor="comment">Your Review *</Label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Was the item as described? How was shipping?"
          minLength={10}
          maxLength={1000}
          rows={5}
          className="mt-2"
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          {comment.length}/1000 characters (minimum 10)
        </p>
      </div>

      {/* Guest Fields */}
      {!isAuthenticated && (
        <div className="space-y-4 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            We&apos;ll only use your email to verify this purchase.
          </p>
          <div>
            <Label htmlFor="guestName">Your Name *</Label>
            <Input
              id="guestName"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="John Doe"
              required
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="guestEmail">Your Email *</Label>
            <Input
              id="guestEmail"
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="john@example.com"
              required
              className="mt-2"
            />
          </div>
        </div>
      )}

      {/* Authenticated User Info */}
      {isAuthenticated && (
        <div className="text-sm text-muted-foreground">
          <p>Reviewed as: {userName || "You"}</p>
          <p className="text-green-600 mt-1">✓ Verified purchase</p>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={submitting || rating === 0 || comment.trim().length < 10}
        className="w-full"
      >
        {submitting ? "Submitting..." : "Submit Review"}
      </Button>
    </form>
  );
}
