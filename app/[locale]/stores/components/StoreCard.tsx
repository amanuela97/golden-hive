"use client";

import { Card } from "@/components/ui/card";
import { Heart, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { toggleStoreFollow, isFollowingStore } from "../../actions/storefront";
import { useSession } from "@/lib/auth-client";
import {
  addGuestFavorite,
  removeGuestFavorite,
  isGuestFavorite,
} from "@/lib/guest-favorites";
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
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const [isFollowing, setIsFollowing] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(store.followerCount);

  useEffect(() => {
    const checkFollowStatus = async () => {
      if (isAuthenticated) {
        const following = await isFollowingStore(store.id);
        setIsFollowing(following);
      } else {
        // Check localStorage for guest favorites
        const guestFavorite = isGuestFavorite("store", store.id);
        setIsFollowing(guestFavorite);
      }
      setIsLoading(false);
    };
    checkFollowStatus();
  }, [store.id, isAuthenticated]);

  // Update follower count when store prop changes
  useEffect(() => {
    setFollowerCount(store.followerCount);
  }, [store.followerCount]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const previousFollowing = isFollowing;

    setIsToggling(true);
    try {
      if (isAuthenticated) {
        // Optimistically update UI for authenticated users
        setIsFollowing(!previousFollowing);
        setFollowerCount((prev) => {
          if (!previousFollowing) {
            return prev + 1;
          } else {
            return Math.max(0, prev - 1);
          }
        });

        const result = await toggleStoreFollow(store.id);
        if (result.success) {
          setIsFollowing(result.following);
          // If the server response differs, sync the count
          if (result.following !== !previousFollowing) {
            setFollowerCount((prev) => {
              if (result.following && !previousFollowing) {
                return prev + 1;
              } else if (!result.following && previousFollowing) {
                return Math.max(0, prev - 1);
              }
              return prev;
            });
          }
          toast.success(
            result.following ? "Following store" : "Unfollowed store"
          );
        } else {
          // Revert optimistic update on error
          setIsFollowing(previousFollowing);
          setFollowerCount(store.followerCount);
          toast.error(result.error || "Failed to update follow status");
        }
      } else {
        // Use localStorage for guest users (no follower count update for guests)
        const currentlyFollowing = isGuestFavorite("store", store.id);
        if (currentlyFollowing) {
          removeGuestFavorite("store", store.id);
          setIsFollowing(false);
          toast.success("Unfollowed store");
        } else {
          addGuestFavorite("store", store.id);
          setIsFollowing(true);
          toast.success("Following store");
        }
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      // Revert optimistic update on error
      setIsFollowing(previousFollowing);
      setFollowerCount(store.followerCount);
      toast.error("Failed to update follow status");
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 relative shadow-md">
      <Link href={`/store/${store.slug}`}>
        <div className="relative w-full h-32 bg-muted overflow-hidden">
          <Image
            src={store.bannerUrl || "/store-placeholder.jpg"}
            alt={store.storeName}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-500"
          />
          {/* Heart Icon Overlay */}
          <button
            onClick={handleFollow}
            disabled={isToggling || isLoading}
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-white disabled:opacity-50"
          >
            <Heart
              className={`w-5 h-5 transition-all duration-200 ${
                isFollowing ? "fill-primary text-primary" : "text-gray-700"
              }`}
              style={{
                filter: isFollowing
                  ? "none"
                  : "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
              }}
            />
          </button>
        </div>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow-md shrink-0 -mt-8 bg-white">
              <Image
                src={store.logoUrl || "/store-placeholder.jpg"}
                alt={store.storeName}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                {store.storeName}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                  <span className="text-sm font-medium">
                    {parseFloat(store.ratingAvg.toString()).toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({store.ratingCount})
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {followerCount} followers
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </Card>
  );
}
