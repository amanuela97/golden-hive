"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number; // 0-5
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const ratingLabels: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent",
};

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
  showLabel = false,
}: StarRatingProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const handleClick = (rating: number) => {
    if (!readonly && onChange) {
      onChange(rating);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleClick(star)}
            disabled={readonly}
            className={cn(
              "transition-colors duration-150",
              !readonly && "hover:scale-110 cursor-pointer",
              readonly && "cursor-default"
            )}
            aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
          >
            <Star
              className={cn(
                sizeClasses[size],
                star <= value
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-transparent text-gray-300 stroke-gray-400 stroke-2",
                !readonly && star > value && "hover:fill-yellow-100 hover:text-yellow-300 hover:stroke-yellow-400",
                !readonly && star <= value && "hover:fill-yellow-300 hover:text-yellow-300"
              )}
            />
          </button>
        ))}
      </div>
      {showLabel && value > 0 && (
        <span className="ml-2 text-sm text-muted-foreground">
          {ratingLabels[value]}
        </span>
      )}
    </div>
  );
}

