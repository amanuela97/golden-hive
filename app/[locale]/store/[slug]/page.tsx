import { getStorefrontData, isFollowingStore } from "../../actions/storefront";
import { notFound, redirect } from "next/navigation";
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
    redirect(`/store/${data.redirect}`, 301);
  }

  const initialFollowing = await isFollowingStore(data.store.id);

  return (
    <>
      <link
        rel="canonical"
        href={`${process.env.NEXT_PUBLIC_APP_URL}/store/${data.store.slug}`}
      />
      <StorefrontClient data={data} initialFollowing={initialFollowing} />
    </>
  );
}

