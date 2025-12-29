import { getLocale } from "next-intl/server";
import { Suspense } from "react";
import { getPublicFaq } from "../actions/faq";
import { FaqSection } from "../components/faq-section";

async function FaqLoader() {
  try {
    const locale = await getLocale();
    const result = await getPublicFaq(locale);

    if (result.success && result.result && result.result.length > 0) {
      return <FaqSection sections={result.result} />;
    }

    // Return empty state if no FAQ data
    return (
      <div className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            No FAQ content available at the moment.
          </p>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error loading FAQ:", error);
    return null;
  }
}
export default async function FaqPage() {
  return (
    <Suspense fallback={null}>
      <FaqLoader />
    </Suspense>
  );
}
