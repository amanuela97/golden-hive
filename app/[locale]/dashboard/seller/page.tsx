import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { getListingsByProducer } from "@/lib/listing";
import SellerDashboardContent from "../components/SellerDashboardContent";
import { User } from "better-auth";

export default async function SellerDashboardPage(): Promise<React.ReactNode> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect({ href: "/login", locale: "en" });
  }

  // Get products for the current user (producer)
  const products = await getListingsByProducer(session?.user.id as string);

  // Check if user has credentials (email/password) or is OAuth
  const isCredential = session?.user.email && !session?.user.image;

  return (
    <SellerDashboardContent
      user={session?.user as User}
      products={products}
      isCredential={isCredential as boolean}
    />
  );
}
