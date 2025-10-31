import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

export default function OrderConfirmationPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8 flex justify-center">
            <CheckCircle className="w-20 h-20 text-green-600" />
          </div>

          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Thank you for your order!
          </h1>

          <p className="text-xl text-muted-foreground mb-8">
            Your order has been received and is being processed. You will
            receive an email confirmation shortly.
          </p>

          <div className="bg-card rounded-lg border border-border p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              What happens next?
            </h2>
            <div className="text-left space-y-3 text-muted-foreground">
              <p>✓ You&apos;ll receive an order confirmation email</p>
              <p>✓ We&apos;ll prepare your order for shipment</p>
              <p>✓ You&apos;ll get a tracking number once shipped</p>
              <p>✓ Your premium Himalayan honey will arrive at your doorstep</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/products">Continue Shopping</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/">Return to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
