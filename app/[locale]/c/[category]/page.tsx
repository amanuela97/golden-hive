import { getPublicProducts } from "@/app/[locale]/actions/public-products";
import { notFound } from "next/navigation";
import { CategoryProductsClient } from "./CategoryProductsClient";
import { findCategoryById, getDescendantTaxonomyIds } from "@/lib/taxonomy";
import { slugify } from "@/lib/slug-utils";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string; id?: string }>;
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { category } = await params;
  const { page, id } = await searchParams;
  const currentPage = parseInt(page || "1", 10);

  // Get category by taxonomy ID from query param
  // If no ID provided, try to find by slug (fallback for old URLs)
  let categoryId = id;
  let categoryData = null;

  if (categoryId) {
    // Decode the ID if it's URL-encoded
    categoryId = decodeURIComponent(categoryId);
    categoryData = findCategoryById(categoryId);
  } else {
    // Fallback: try to find by matching slug (for backward compatibility)
    // This is less reliable but helps with old URLs
    notFound(); // For now, require ID param
  }

  if (!categoryData) {
    notFound();
  }

  // Get all descendant taxonomy IDs (including the category itself)
  const taxonomyIds = getDescendantTaxonomyIds(categoryData.id);

  // Fetch products for these taxonomy categories
  const productsResult = await getPublicProducts({
    categoryIds: taxonomyIds,
    limit: 24,
    page: currentPage,
  });

  // Convert to CategoryNode format for the client component
  // Include ancestors for breadcrumb building
  const categoryNode = {
    id: categoryData.id,
    name: categoryData.name,
    handle: slugify(categoryData.name),
    level: categoryData.level,
    fullName: categoryData.full_name,
    children: [],
    ancestors: categoryData.ancestors || [],
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <CategoryProductsClient
        category={categoryNode}
        initialProducts={productsResult.result || []}
        initialPage={currentPage}
        totalProducts={productsResult.total || 0}
        totalPages={productsResult.totalPages || 1}
      />
    </div>
  );
}
