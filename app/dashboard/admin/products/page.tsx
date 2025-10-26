import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAllListingsWithUsers } from "@/lib/listing";
import AdminProductsPageClient from "./AdminProductsPageClient";

export default async function AdminProductsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Get all products with user information
  const products = await getAllListingsWithUsers();

  return (
    <div className="h-screen space-y-6 py-4 px-6 ">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">All Products</h1>
          <p className="text-gray-600 mt-2">
            Manage all product listings across the platform
          </p>
        </div>
      </div>

      <AdminProductsPageClient products={products} />
    </div>
  );
}
