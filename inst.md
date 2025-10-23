🧭 PROJECT BRIEF — “Seller Documentation Workflow (Server Actions Version)”
🎯 Objective

Implement a documentation verification system for sellers on the Golden Hive ecommerce platform using Next.js Server Actions and Drizzle ORM with Neon.
Some product categories require one or more documents before sellers can list products. Once a seller uploads a specific document type, it should automatically apply to all relevant categories that require it.

All documents must be uploaded to Cloudinary under
golden-hive/listings/documents/[sellerId]
and deleted automatically when the seller’s account is removed.

🧱 1. Database Schema (Drizzle ORM + Neon PostgreSQL)
documentation_type

Defines all available document types configured by admins.

export const documentationType = pgTable("documentation_type", {
id: uuid("id").defaultRandom().primaryKey(),
name: text("name").notNull(), // e.g., "Food Safety License"
description: text("description"),
exampleUrl: text("example_url"), // optional sample file for reference
});

category_documentation

Defines which document types are required for each category.

export const categoryDocumentation = pgTable("category_documentation", {
id: uuid("id").defaultRandom().primaryKey(),
categoryId: uuid("category_id")
.notNull()
.references(() => category.id, { onDelete: "cascade" }),
documentationTypeId: uuid("documentation_type_id")
.notNull()
.references(() => documentationType.id, { onDelete: "cascade" }),
});

seller_documentation

Stores uploaded documentation per seller and type.

export const sellerDocumentation = pgTable("seller_documentation", {
id: uuid("id").defaultRandom().primaryKey(),
sellerId: text("seller_id")
.notNull()
.references(() => user.id, { onDelete: "cascade" }),
documentationTypeId: uuid("documentation_type_id")
.notNull()
.references(() => documentationType.id, { onDelete: "cascade" }),
documentUrl: text("document_url").notNull(),
cloudinaryPublicId: text("cloudinary_public_id").notNull(),
status: text("status").default("pending"), // pending | approved | rejected
submittedAt: timestamp("submitted_at").defaultNow(),
reviewedAt: timestamp("reviewed_at"),
});

createUniqueIndex("unique_seller_doc").on(
sellerDocumentation.sellerId,
sellerDocumentation.documentationTypeId
);

⚙️ 2. Server Actions

All actions are defined under app/actions/documentation.ts.

getRequiredDocumentsForCategory(categoryId: string)

Fetches all required documentation types for a given category.

Joins category_documentation with documentation_type.

"use server";

export async function getRequiredDocumentsForCategory(categoryId: string) {
const requiredDocs = await db
.select()
.from(categoryDocumentation)
.where(eq(categoryDocumentation.categoryId, categoryId))
.leftJoin(
documentationType,
eq(categoryDocumentation.documentationTypeId, documentationType.id)
);

return requiredDocs.map((r) => r.documentation_type);
}

getSellerDocuments(sellerId: string)

Fetches all documents uploaded by a seller, including status and type.

"use server";

export async function getSellerDocuments(sellerId: string) {
return await db
.select({
id: sellerDocumentation.id,
typeId: sellerDocumentation.documentationTypeId,
url: sellerDocumentation.documentUrl,
status: sellerDocumentation.status,
})
.from(sellerDocumentation)
.where(eq(sellerDocumentation.sellerId, sellerId));
}

uploadSellerDocumentation(formData: FormData)

Accepts a document upload for a specific documentationTypeId.

Uploads to Cloudinary under
golden-hive/listings/documents/[sellerId]

Stores metadata in seller_documentation.

"use server";
import { v2 as cloudinary } from "cloudinary";
import { revalidatePath } from "next/cache";

cloudinary.config({
cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
api_key: process.env.CLOUDINARY_API_KEY!,
api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export async function uploadSellerDocumentation(formData: FormData) {
const sellerId = formData.get("sellerId") as string;
const documentationTypeId = formData.get("documentationTypeId") as string;
const file = formData.get("file") as File;

if (!file) throw new Error("No file provided");

const arrayBuffer = await file.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

const upload = await cloudinary.uploader.upload_stream(
{ folder: `golden-hive/listings/documents/${sellerId}` },
async (error, result) => {
if (error) throw new Error(error.message);

      await db.insert(sellerDocumentation).values({
        sellerId,
        documentationTypeId,
        documentUrl: result.secure_url,
        cloudinaryPublicId: result.public_id,
      });

      revalidatePath("/dashboard/seller/documentation");
    }

);

upload.end(buffer);

return { success: true, message: "Document uploaded successfully." };
}

reviewSellerDocumentation(docId: string, action: "approve" | "reject")

Used by admins to review documents.

"use server";

export async function reviewSellerDocumentation(docId: string, action: "approve" | "reject") {
await db
.update(sellerDocumentation)
.set({
status: action === "approve" ? "approved" : "rejected",
reviewedAt: new Date(),
})
.where(eq(sellerDocumentation.id, docId));
}

deleteSellerDocumentsOnAccountRemoval(sellerId: string)

Called when a user account is deleted.

"use server";

export async function deleteSellerDocumentsOnAccountRemoval(sellerId: string) {
const docs = await db
.select({ publicId: sellerDocumentation.cloudinaryPublicId })
.from(sellerDocumentation)
.where(eq(sellerDocumentation.sellerId, sellerId));

for (const doc of docs) {
await cloudinary.uploader.destroy(doc.publicId);
}

await cloudinary.api.delete_folder(`golden-hive/listings/documents/${sellerId}`);
}

🧮 3. Listing Creation Flow (Server Action Integration)

When the seller submits a new listing:

Fetch requiredDocs = getRequiredDocumentsForCategory(categoryId)

Fetch existingDocs = getSellerDocuments(sellerId) (where status = “approved”)

Compute missing docs:

const missingDocs = requiredDocs.filter(
(req) => !existingDocs.some((e) => e.typeId === req.id && e.status === "approved")
);

If missingDocs.length > 0, block listing submission and show a modal to upload only missing docs.

If all are approved, allow listing creation.

🧑‍💻 4. Frontend Pages (under /dashboard)
/dashboard/seller/documentation

Lists all documentation types (both required and uploaded)

Shows badges:

🟢 Approved

🟡 Pending

🔴 Rejected

Allows upload via <form action={uploadSellerDocumentation}>

/dashboard/admin/documentation

Lists all submitted documents for all sellers.

Allows admin to review with Approve/Reject buttons using
action={reviewSellerDocumentation}

☁️ 5. Cloudinary Folder Structure
golden-hive/
└── listings/
└── documents/
├── seller123/
│ ├── food_license.jpg
│ └── export_certificate.pdf
├── seller456/
│ └── herbal_auth.jpg

✅ 6. Requirements Summary
Feature Description
Document upload Via server action, stored in Cloudinary
Reusability Seller doesn’t reupload docs already approved
Multi-doc categories Ask only for missing ones
Auto-delete All seller docs deleted when their account is removed
Admin review Approve/reject via dashboard form
Storage path golden-hive/listings/documents/[sellerId]
