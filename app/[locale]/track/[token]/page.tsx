import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPublicTrackingInfo } from "@/app/[locale]/actions/tracking";
import TrackingPageClient from "./TrackingPageClient";

export const revalidate = 300; // Revalidate every 5 minutes

interface TrackingPageProps {
  params: Promise<{ token: string; locale: string }>;
}

export default async function TrackingPage({ params }: TrackingPageProps) {
  const { token } = await params;

  const result = await getPublicTrackingInfo(token);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <Suspense fallback={<TrackingPageSkeleton />}>
      <TrackingPageClient trackingData={result.data} token={token} />
    </Suspense>
  );
}

function TrackingPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-8"></div>
        <div className="space-y-4">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}
