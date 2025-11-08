import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getListingById } from "@/lib/listing";
import EditProductForm from "./EditProductForm";

interface EditProductPageProps {
  params: {
    id: string;
  };
}

export default async function SellerEditProductPage({
  params,
}: EditProductPageProps) {
  const { id } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const product = await getListingById(id);

  if (!product) {
    notFound();
  }

  // Check if the product belongs to the current user
  if (product.producerId !== session.user.id) {
    redirect("/dashboard/seller/products");
  }

  return <EditProductForm initialData={product} />;
}
