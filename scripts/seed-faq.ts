import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  faqSections,
  faqItems,
  faqSectionTranslations,
  faqItemTranslations,
} from "../db/schema";
import { translateText } from "../lib/translate";
import * as schema from "../db/schema";

// Load environment variables
config({ path: "./.env.local" });

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, {
  schema,
  casing: "snake_case",
});

// Helper to translate text to all locales
async function translateToAllLocales(
  text: string
): Promise<Record<string, string>> {
  const translations: Record<string, string> = {
    en: text,
  };

  try {
    translations.fi = await translateText(text, "fi");
  } catch (error) {
    console.error("Error translating to Finnish:", error);
    translations.fi = text;
  }

  try {
    translations.ne = await translateText(text, "ne");
  } catch (error) {
    console.error("Error translating to Nepali:", error);
    translations.ne = text;
  }

  return translations;
}

// Parse FAQ markdown structure
interface FaqSection {
  title: string;
  slug: string;
  items: Array<{ question: string; answer: string }>;
}

function parseFaqMarkdown(content: string): FaqSection[] {
  const sections: FaqSection[] = [];
  const lines = content.split("\n");

  let currentSection: FaqSection | null = null;
  let currentQuestion: string | null = null;
  let currentAnswer: string[] = [];
  let inAnswer = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for section header (##)
    if (line.startsWith("## ") && !line.startsWith("###")) {
      // Save previous section if exists
      if (currentSection && currentQuestion) {
        currentSection.items.push({
          question: currentQuestion,
          answer: currentAnswer.join("\n").trim(),
        });
        currentQuestion = null;
        currentAnswer = [];
      }

      // Start new section
      const sectionTitle = line.replace("## ", "").trim();
      const slug = sectionTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      if (currentSection) {
        sections.push(currentSection);
      }

      currentSection = {
        title: sectionTitle,
        slug,
        items: [],
      };
      inAnswer = false;
      continue;
    }

    // Check for question (###)
    if (line.startsWith("### ")) {
      // Save previous question if exists
      if (currentSection && currentQuestion) {
        currentSection.items.push({
          question: currentQuestion,
          answer: currentAnswer.join("\n").trim(),
        });
      }

      // Start new question
      currentQuestion = line.replace("### ", "").trim();
      currentAnswer = [];
      inAnswer = true;
      continue;
    }

    // Skip table of contents and separators
    if (
      line.startsWith("- [") ||
      line === "---" ||
      line.startsWith("# ") ||
      line === ""
    ) {
      continue;
    }

    // Add to current answer
    if (inAnswer && currentQuestion && line) {
      currentAnswer.push(line);
    }
  }

  // Save last question and section
  if (currentSection) {
    if (currentQuestion) {
      currentSection.items.push({
        question: currentQuestion,
        answer: currentAnswer.join("\n").trim(),
      });
    }
    sections.push(currentSection);
  }

  return sections;
}

async function seedFaq() {
  try {
    console.log("Reading FAQ markdown file...");
    const fs = await import("fs/promises");
    const path = await import("path");
    const faqPath = path.join(process.cwd(), "faq.md");
    const content = await fs.readFile(faqPath, "utf-8");

    console.log("Parsing FAQ content...");
    const sections = parseFaqMarkdown(content);

    console.log(`Found ${sections.length} sections`);

    // Clear existing FAQ data
    console.log("Clearing existing FAQ data...");
    await db.delete(faqItemTranslations);
    await db.delete(faqItems);
    await db.delete(faqSectionTranslations);
    await db.delete(faqSections);

    // Insert sections and items
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      console.log(
        `Processing section: ${section.title} (${section.items.length} items)`
      );

      // Translate section title
      const titleTranslations = await translateToAllLocales(section.title);

      // Insert section
      const [newSection] = await db
        .insert(faqSections)
        .values({
          slug: section.slug,
          order: i,
          isVisible: true,
        })
        .returning();

      // Insert section translations
      await Promise.all(
        ["en", "fi", "ne"].map((locale) =>
          db.insert(faqSectionTranslations).values({
            sectionId: newSection.id,
            locale,
            title: titleTranslations[locale],
          })
        )
      );

      // Insert items
      for (let j = 0; j < section.items.length; j++) {
        const item = section.items[j];
        console.log(
          `  - Processing item: ${item.question.substring(0, 50)}...`
        );

        // Translate question and answer
        const questionTranslations = await translateToAllLocales(item.question);
        const answerTranslations = await translateToAllLocales(item.answer);

        // Insert item
        const [newItem] = await db
          .insert(faqItems)
          .values({
            sectionId: newSection.id,
            order: j,
            isVisible: true,
          })
          .returning();

        // Insert item translations
        await Promise.all(
          ["en", "fi", "ne"].map((locale) =>
            db.insert(faqItemTranslations).values({
              itemId: newItem.id,
              locale,
              question: questionTranslations[locale],
              answer: answerTranslations[locale],
            })
          )
        );
      }
    }

    console.log("✅ FAQ seeding completed successfully!");
    console.log(`   - ${sections.length} sections created`);
    console.log(
      `   - ${sections.reduce((sum, s) => sum + s.items.length, 0)} items created`
    );
  } catch (error) {
    console.error("❌ Error seeding FAQ:", error);
    throw error;
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  seedFaq()
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedFaq };
