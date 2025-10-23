import { OnboardingForm } from "./components/OnboardingForm";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            Complete Your Profile
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Choose your role to get started
          </p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  );
}
