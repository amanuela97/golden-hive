import { getNavbarData } from "@/app/actions/site-content";
import { Navbar } from "./navbar";

export default async function NavbarServer() {
  const data = await getNavbarData();
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
