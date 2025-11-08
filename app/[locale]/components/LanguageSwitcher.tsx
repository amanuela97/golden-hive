"use client";

import { useParams, useRouter } from "next/navigation";
import { usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";
import { JSX } from "react";

const locales = [
  { code: "en", name: "English", native: "English" },
  { code: "fi", name: "Finnish", native: "Suomi" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
] as const;

export function LanguageSwitcher(): JSX.Element {
  const pathname = usePathname(); // This returns pathname without locale prefix {
  const params = useParams();
  const router = useRouter();
  const currentLocale = params.locale as string;

  const switchLocale = (newLocale: string) => {
    // usePathname() from next-intl already returns the path without locale
    // e.g., "/" for homepage, "/products" for products page
    const pathWithoutLocale = pathname || "/";

    // Construct the new path with the new locale prefix
    // Since localePrefix is "always", we always need to add the locale
    const newPath =
      pathWithoutLocale === "/"
        ? `/${newLocale}`
        : `/${newLocale}${pathWithoutLocale}`;

    console.log("newPath", newPath);
    router.push(newPath);
  };

  const currentLocaleData = locales.find((l) => l.code === currentLocale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">
            {currentLocaleData?.native || currentLocale.toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale.code}
            onClick={() => switchLocale(locale.code)}
            className={currentLocale === locale.code ? "bg-muted" : ""}
          >
            <span className="font-medium">{locale.native}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {locale.name}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
