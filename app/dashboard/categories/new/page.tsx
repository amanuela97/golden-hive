import { getAllCategories } from "@/app/actions/categories";
import NewCategoryForm from "./NewCategoryForm";

export default async function NewCategoryPage() {
  const categoriesResult = await getAllCategories();
  const initialCategories = categoriesResult.success
    ? categoriesResult.result || null
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Create New Category
          </h1>
          <p className="text-gray-600 mt-2">
            Add a new product category to organize your listings
          </p>
        </div>
        <NewCategoryForm initialCategories={initialCategories} />
      </div>
    </div>
  );
}
