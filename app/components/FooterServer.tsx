import Link from "next/link";
import { getFooterData } from "@/app/actions/site-content";
import { Footer } from "./footer";
import { ICON_MAP } from "@/lib/icons";

export default async function FooterServer() {
  const sections = await getFooterData();

  // Fallback to static footer when there is no CMS data yet
  if (!sections || sections.length === 0) {
    return <Footer />;
  }

  return (
    <footer className="bg-neutral-900 text-neutral-300 mt-24">
      <div className="container mx-auto px-4 py-12 lg:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {sections.map((section) => (
            <div key={section.id}>
              <h3 className="mb-4 text-lg font-semibold text-white">
                {section.title}
              </h3>
              <div className="space-y-3 text-sm">
                {section.items.map((item) => {
                  // List block
                  if (item.listItems && item.listItems.length > 0) {
                    return (
                      <div key={item.id} className="flex flex-wrap gap-2">
                        {item.listItems.map((t, idx) => (
                          <div
                            key={idx}
                            className="rounded bg-white px-2 py-1 text-xs font-semibold text-neutral-900"
                          >
                            {t}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  // Link or text block
                  const content = item.text ?? item.href ?? "";
                  if (!content) return null;
                  const IconComp = item.icon
                    ? ICON_MAP[item.icon as keyof typeof ICON_MAP]
                    : undefined;
                  return item.href ? (
                    <div key={item.id} className="flex items-center gap-2">
                      {IconComp ? (
                        <IconComp className="w-4 h-4 text-neutral-400" />
                      ) : null}
                      <Link
                        href={item.href}
                        className="hover:text-white transition-colors"
                      >
                        {content}
                      </Link>
                    </div>
                  ) : (
                    <div key={item.id} className="flex items-center gap-2">
                      {IconComp ? (
                        <IconComp className="w-4 h-4 text-neutral-400" />
                      ) : null}
                      <span>{content}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-neutral-800 pt-8 text-center text-sm">
          <p>© {new Date().getFullYear()} Amanuel & Nandan</p>
        </div>
      </div>
    </footer>
  );
}
