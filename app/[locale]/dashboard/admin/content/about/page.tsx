import AboutPageManager from "../AboutPageManager";

export default function AboutContentPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Manage About Page</h1>
          <AboutPageManager />
        </div>
      </div>
    </div>
  );
}
