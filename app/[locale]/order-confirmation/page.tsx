"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function OrderConfirmationPage() {
  const t = useTranslations("orderConfirmation");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8 flex justify-center">
            <CheckCircle className="w-20 h-20 text-green-600" />
          </div>

          <h1 className="text-4xl font-bold mb-4 text-foreground">
            {t("title")}
          </h1>

          <p className="text-xl text-muted-foreground mb-8">{t("message")}</p>

          <div className="bg-card rounded-lg border border-border p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("whatHappensNext")}
            </h2>
            <div className="text-left space-y-3 text-muted-foreground">
              <p>{t("emailConfirmation")}</p>
              <p>{t("prepareOrder")}</p>
              <p>{t("trackingNumber")}</p>
              <p>{t("arrival")}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/products">{t("continueShopping")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/">{t("returnToHome")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
