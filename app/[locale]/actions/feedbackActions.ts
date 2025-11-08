"use server";

import { db } from "@/db";
import { feedbacks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function submitFeedback(formData: FormData) {
  const rating = Number(formData.get("rating"));
  const message = formData.get("message") as string;
  const suggestions = formData.get("suggestions") as string;

  if (!rating) return;

  await db.insert(feedbacks).values({
    rating,
    message,
    suggestions,
  });

  revalidatePath("/feedback");
}

export async function getAllFeedbacks() {
  const result = await db
    .select()
    .from(feedbacks)
    .orderBy(desc(feedbacks.createdAt));
  return result;
}

export async function deleteFeedback(id: string) {
  await db.delete(feedbacks).where(eq(feedbacks.id, id));
  revalidatePath("/dashboard/admin/feedback");
}
