import { getDraftOrderByToken } from "@/app/[locale]/actions/invoice-payment";
import InvoicePaymentPageClient from "./InvoicePaymentPageClient";

interface InvoicePaymentPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ canceled?: string }>;
}

export default async function InvoicePaymentPage({
  params,
  searchParams,
}: InvoicePaymentPageProps) {
  const { token } = await params;
  const { canceled } = await searchParams;

  // Get draft order by token
  const draftResult = await getDraftOrderByToken(token);

  if (!draftResult.success || !draftResult.data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invoice Not Found</h1>
          <p className="text-muted-foreground">
            {draftResult.error || "This invoice link is invalid or has expired."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <InvoicePaymentPageClient
      draftData={draftResult.data}
      token={token}
      canceled={canceled === "true"}
    />
  );
}

