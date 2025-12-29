import { getStorefrontData, isFollowingStore } from "../../actions/storefront";
import { notFound, permanentRedirect } from "next/navigation";
import { StorefrontClient } from "./StorefrontClient";

interface StorePageProps {
  params: Promise<{ slug: string }>;
}

export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params;
  const data = await getStorefrontData(slug);

  if (!data) {
    notFound();
  }

  if (data.redirect) {
    permanentRedirect(`/store/${data.redirect}`);
  }

  // After redirect check, we know data.store exists
  // Type guard to ensure store exists
  if (!("store" in data) || !data.store) {
    notFound();
  }

  const initialFollowing = await isFollowingStore(data.store.id);

  // Map data to match StorefrontClient expected types
  const mappedData = {
    store: {
      id: data.store.id,
      storeName: data.store.storeName,
      logoUrl: data.store.logoUrl,
      ratingAvg: data.store.ratingAvg,
      ratingCount: data.store.ratingCount,
      followerCount: data.store.followerCount,
    },
    banners: data.banners.map((banner) => ({
      id: banner.id,
      url: banner.url,
      alt: banner.alt ?? undefined,
    })),
    about: data.about
      ? {
          title: data.about.title ?? undefined,
          description: data.about.description ?? undefined,
          imageUrl: data.about.imageUrl ?? undefined,
        }
      : null,
    policies: data.policies
      ? {
          shipping: data.policies.shipping ?? undefined,
          returns: data.policies.returns ?? undefined,
          cancellations: data.policies.cancellations ?? undefined,
          customOrders: data.policies.customOrders ?? undefined,
          privacy: data.policies.privacy ?? undefined,
          additional: data.policies.additional ?? undefined,
        }
      : null,
    listings: data.listings.map((listing) => ({
      id: listing.id,
      slug: listing.slug,
      name: listing.name,
      imageUrl: listing.imageUrl,
      price: listing.price,
      currency: listing.currency,
    })),
    reviews: data.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      verified: false, // Store reviews don't have verified field in the query
      createdAt: review.createdAt,
      reviewerName: review.userName ?? "Anonymous",
      reviewerEmail: null, // Store reviews don't have email in the query
      isGuest: false, // Store reviews are always from users (innerJoin with user)
      userId: null, // Not available in the query
    })),
  };

  return (
    <>
      <link
        rel="canonical"
        href={`${process.env.NEXT_PUBLIC_APP_URL}/store/${data.store.slug}`}
      />
      <StorefrontClient data={mappedData} initialFollowing={initialFollowing} />
    </>
  );
}
