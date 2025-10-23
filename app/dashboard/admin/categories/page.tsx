import { getAllCategories } from "@/app/actions/categories";
import CategoryManagement from "../../components/admin/CategoryManagement";

export default async function AdminCategoriesPage() {
  const categoriesResult = await getAllCategories();
  const initialCategories = categoriesResult.success
    ? categoriesResult.result || null
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CategoryManagement initialCategories={initialCategories} />
      </div>
    </div>
  );
}
