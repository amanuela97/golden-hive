import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SellerDocumentationContent from "./SellerDocumentationContent";

export default async function SellerDocumentationPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return <SellerDocumentationContent sellerId={session.user.id} />;
}
