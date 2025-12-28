import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import { getCurrentAdmin } from "@/app/[locale]/actions/admin";
import StoresPageClient from "./StoresPageClient";
import { getAllStores } from "@/app/[locale]/actions/admin-stores";

export default async function AdminStoresPage() {
  await getCurrentAdmin(); // Ensures user is admin

  const stores = await getAllStores();

  return (
    <DashboardWrapper userRole="admin">
      <StoresPageClient initialStores={stores} />
    </DashboardWrapper>
  );
}
