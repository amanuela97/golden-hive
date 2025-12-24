"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { toggleStoreFollow, isFollowingStore } from "../../actions/storefront";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface StoreCardProps {
  store: {
    id: string;
    storeName: string;
    slug: string;
    logoUrl?: string | null;
    description?: string | null;
    ratingAvg: number | string;
    ratingCount: number;
    followerCount: number;
    bannerUrl?: string;
  };
}

export function StoreCard({ store }: StoreCardProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkFollowStatus = async () => {
      const following = await isFollowingStore(store.id);
      setIsFollowing(following);
      setIsLoading(false);
    };
    checkFollowStatus();
  }, [store.id]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsToggling(true);
    try {
      const result = await toggleStoreFollow(store.id);
      if (result.success) {
        setIsFollowing(result.following);
        toast.success(
          result.following ? "Following store" : "Unfollowed store"
        );
      } else {
        toast.error(result.error || "Failed to update follow status");
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      toast.error("Failed to update follow status");
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <Link href={`/store/${store.slug}`}>
        {store.bannerUrl && (
          <div className="relative w-full h-32 bg-gray-200">
            <Image
              src={store.bannerUrl}
              alt={store.storeName}
              fill
              className="object-cover"
            />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {store.logoUrl && (
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md shrink-0">
                <Image
                  src={store.logoUrl}
                  alt={store.storeName}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">
                {store.storeName}
              </h3>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">
                    {parseFloat(store.ratingAvg.toString()).toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({store.ratingCount})
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {store.followerCount} followers
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
      <div className="px-4 pb-4">
        <Button
          variant={isFollowing ? "default" : "outline"}
          size="sm"
          onClick={handleFollow}
          disabled={isToggling || isLoading}
          className="w-full"
        >
          <Heart
            className={`w-4 h-4 mr-2 ${isFollowing ? "fill-current" : ""}`}
          />
          {isLoading ? "Loading..." : isFollowing ? "Following" : "Follow"}
        </Button>
      </div>
    </Card>
  );
}

