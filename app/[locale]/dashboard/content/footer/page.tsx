import FooterManager from "../FooterManager";

export const dynamic = "force-dynamic";

export default function FooterContentPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Manage Footer</h1>
          <FooterManager />
        </div>
      </div>
    </div>
  );
}
