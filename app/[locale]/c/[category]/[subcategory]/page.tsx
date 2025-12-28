import { getPublicProducts } from "@/app/[locale]/actions/public-products";
import { notFound } from "next/navigation";
import { SubcategoryProductsClient } from "./SubcategoryProductsClient";
import {
  findCategoryById,
  getDescendantTaxonomyIds,
} from "@/lib/taxonomy";
import { slugify } from "@/lib/slug-utils";

interface SubcategoryPageProps {
  params: Promise<{ category: string; subcategory: string }>;
  searchParams: Promise<{ page?: string; id?: string }>;
}

export default async function SubcategoryPage({
  params,
  searchParams,
}: SubcategoryPageProps) {
  const { category, subcategory } = await params;
  const { page, id } = await searchParams;
  const currentPage = parseInt(page || "1", 10);

  // Get category by taxonomy ID from query param
  let categoryId = id;
  let subcategoryData = null;

  if (categoryId) {
    // Decode the ID if it's URL-encoded
    categoryId = decodeURIComponent(categoryId);
    subcategoryData = findCategoryById(categoryId);
  } else {
    // Fallback: try to find by matching slug (for backward compatibility)
    notFound(); // For now, require ID param
  }

  if (!subcategoryData) {
    notFound();
  }

  // Find parent category from ancestors
  let parentCategory = null;
  if (subcategoryData.ancestors && subcategoryData.ancestors.length > 0) {
    const parentId = subcategoryData.ancestors[0].id;
    parentCategory = findCategoryById(parentId);
  }

  // Get all descendant taxonomy IDs (including the subcategory itself)
  const taxonomyIds = getDescendantTaxonomyIds(subcategoryData.id);

  // Fetch products for these taxonomy categories
  const productsResult = await getPublicProducts({
    categoryIds: taxonomyIds,
    limit: 24,
    page: currentPage,
  });

  // Convert to CategoryNode format for the client component
  const parentCategoryNode = parentCategory
    ? {
        id: parentCategory.id,
        name: parentCategory.name,
        handle: slugify(parentCategory.name),
        level: parentCategory.level,
        fullName: parentCategory.full_name,
        children: [],
      }
    : null;

  const subcategoryNode = {
    id: subcategoryData.id,
    name: subcategoryData.name,
    handle: slugify(subcategoryData.name),
    level: subcategoryData.level,
    fullName: subcategoryData.full_name,
    children: [],
    ancestors: subcategoryData.ancestors || [],
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <SubcategoryProductsClient
        parentCategory={parentCategoryNode}
        subcategory={subcategoryNode}
        initialProducts={productsResult.result || []}
        initialPage={currentPage}
        totalProducts={productsResult.total || 0}
        totalPages={productsResult.totalPages || 1}
      />
    </div>
  );
}

