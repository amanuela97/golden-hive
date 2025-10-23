import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getListingsByProducer } from "@/lib/listing";
import SellerDashboardContent from "@/app/dashboard/components/SellerDashboardContent";

export default async function SellerDashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Get products for the current user (producer)
  const products = await getListingsByProducer(session.user.id);

  // Check if user has credentials (email/password) or is OAuth
  const isCredential = session.user.email && !session.user.image;

  return (
    <SellerDashboardContent
      user={session.user}
      products={products}
      isCredential={isCredential as boolean}
    />
  );
}
