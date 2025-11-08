import { OnboardingForm } from "./components/OnboardingForm";
import { getTranslations } from "next-intl/server";

export default async function OnboardingPage() {
  const t = await getTranslations("onboarding");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            {t("completeProfile")}
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {t("chooseRole")}
          </p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  );
}
