import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getListingsByProducer } from "@/lib/listing";
import ProductsPageClient from "../../components/shared/ProductsPageClient";

export default async function SellerProductsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Get products for the current user (producer)
  const products = await getListingsByProducer(session.user.id);

  return (
    <div className="h-screen space-y-6 py-4 px-6 ">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-gray-600 mt-2">
            Manage your product listings and inventory
          </p>
        </div>
      </div>

      <ProductsPageClient products={products} basePath="/dashboard/seller" />
    </div>
  );
}
