import { getNavbarData } from "../actions/site-content";
import { Navbar } from "./navbar";
import { getLocale } from "next-intl/server";

export default async function NavbarServer() {
  const locale = await getLocale();
  const data = await getNavbarData(locale);
  if (!data) {
    return <Navbar />;
  }
  return (
    <Navbar
      title={data.title}
      logoUrl={data.logoUrl}
      items={data.items.map((i) => ({
        id: i.id,
        label: i.label,
        href: i.href,
        order: i.order,
        requiresAuth: i.requiresAuth,
        isVisible: i.isVisible,
      }))}
    />
  );
}
