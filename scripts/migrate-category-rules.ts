/**
 * Migration script to create category_rules table and migrate existing category rules
 *
 * This script:
 * 1. Creates the category_rules and category_rules_documentation tables
 * 2. Optionally migrates existing category rules from the old category table
 *
 * Run with: npx tsx scripts/migrate-category-rules.ts
 */

import { db } from "../db";
import {
  categoryRules,
  categoryRulesDocumentation,
  category,
  categoryDocumentation,
} from "../db/schema";
import { eq } from "drizzle-orm";

async function migrateCategoryRules() {
  try {
    console.log("Starting category rules migration...");

    // Note: The tables should already be created by Drizzle migrations
    // This script is for migrating data from the old category table to category_rules

    // Get all categories that require documentation
    const categoriesWithDocs = await db
      .select()
      .from(category)
      .where(eq(category.requiresDocumentation, true));

    console.log(
      `Found ${categoriesWithDocs.length} categories requiring documentation`
    );

    // For each category, you would need to:
    // 1. Map the category name to a taxonomy category ID
    // 2. Create a category rule with that taxonomy ID
    // 3. Migrate the documentation requirements

    // Example migration logic (you'll need to customize this based on your taxonomy mapping):
    for (const oldCategory of categoriesWithDocs) {
      // TODO: Map oldCategory.name to a taxonomy category ID
      // This requires you to know which taxonomy category corresponds to each old category
      // For example:
      // const taxonomyCategoryId = mapCategoryNameToTaxonomyId(oldCategory.name);

      // Check if rule already exists
      const existingRule = await db
        .select()
        .from(categoryRules)
        .where(eq(categoryRules.taxonomyCategoryId, "PLACEHOLDER_TAXONOMY_ID"))
        .limit(1);

      if (existingRule.length === 0) {
        // Create new rule
        const [newRule] = await db
          .insert(categoryRules)
          .values({
            taxonomyCategoryId: "PLACEHOLDER_TAXONOMY_ID", // Replace with actual taxonomy ID
            requiresDocumentation: true,
            documentationDescription: oldCategory.documentationDescription,
          })
          .returning();

        // Migrate documentation type links
        const categoryDocs = await db
          .select()
          .from(categoryDocumentation)
          .where(eq(categoryDocumentation.categoryId, oldCategory.id));

        if (categoryDocs.length > 0) {
          const ruleDocLinks = categoryDocs.map((doc) => ({
            categoryRuleId: newRule.id,
            documentationTypeId: doc.documentationTypeId,
          }));

          await db.insert(categoryRulesDocumentation).values(ruleDocLinks);
        }

        console.log(`Migrated category: ${oldCategory.name}`);
      }
    }

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Run migration if script is executed directly
if (require.main === module) {
  migrateCategoryRules()
    .then(() => {
      console.log("Migration script finished");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}

export { migrateCategoryRules };
