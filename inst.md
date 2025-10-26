AI Instruction Prompt

Instruction:
Build a visitor feedback system for my ecommerce marketplace (focused on honey and other natural products) using Next.js App Router, TypeScript, Tailwind CSS, Drizzle ORM, and Neon PostgreSQL.
The system should let visitors anonymously submit feedback about the website and allow admins to view and delete feedback from the admin dashboard.
Use Next.js Server Actions — do not use /api routes.

🎯 Requirements

1. Public Feedback Page

Route: /feedback

Purpose: Collect anonymous visitor feedback.

Display a clear message at the top:

“This website is still under development — some features may not work yet.”

Form fields:

rating (1–5)

message (textarea)

suggestions (textarea)

Submission:

Uses a Server Action to store data in the database.

Displays a thank-you confirmation after submission.

🗄️ 2. Database Schema (Drizzle)

Create a new schema file: db/schema/feedback.ts

import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const feedbacks = pgTable("feedbacks", {
id: uuid("id").defaultRandom().primaryKey(),
rating: integer("rating").check(sql => sql`rating BETWEEN 1 AND 5`),
message: text("message"),
suggestions: text("suggestions"),
createdAt: timestamp("created_at").defaultNow(),
});

Run your Drizzle migration after adding this table:

pnpm drizzle-kit generate && pnpm drizzle-kit push

⚙️ 3. Server Actions

Create a new file at actions/feedbackActions.ts:

'use server';

import { db } from '@/db';
import { feedbacks } from '@/db/schema/feedback';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function submitFeedback(formData: FormData) {
const rating = Number(formData.get('rating'));
const message = formData.get('message') as string;
const suggestions = formData.get('suggestions') as string;

if (!rating) return;

await db.insert(feedbacks).values({
rating,
message,
suggestions,
});

revalidatePath('/feedback');
}

export async function getAllFeedbacks() {
const result = await db.select().from(feedbacks).orderBy(desc(feedbacks.createdAt));
return result;
}

export async function deleteFeedback(id: string) {
await db.delete(feedbacks).where(eq(feedbacks.id, id));
revalidatePath('/dashboard/admin/feedback');
}

💬 4. Feedback Page (/app/feedback/page.tsx)
import { submitFeedback } from '@/actions/feedbackActions';

export default function FeedbackPage() {
return (

<div className="max-w-xl mx-auto mt-12 p-6 bg-white shadow rounded-xl">
<h1 className="text-2xl font-semibold mb-4 text-center">
We’d love your feedback
</h1>
<p className="text-sm text-gray-500 text-center mb-6">
This website is still under development — some features may not work yet.
</p>

      <form action={submitFeedback} className="flex flex-col gap-4">
        <label className="flex flex-col">
          Rating:
          <select name="rating" required className="border rounded p-2">
            <option value="">Select rating</option>
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <textarea
          name="message"
          placeholder="What do you think about the website?"
          className="border rounded p-2 min-h-[80px]"
        />
        <textarea
          name="suggestions"
          placeholder="What features would you like to see?"
          className="border rounded p-2 min-h-[80px]"
        />

        <button
          type="submit"
          className="bg-yellow-600 text-white py-2 rounded hover:bg-yellow-700"
        >
          Submit Feedback
        </button>
      </form>
    </div>

);
}

🧑‍💼 5. Admin Dashboard Integration

Add a new admin route: /dashboard/admin/feedback/page.tsx

import { getAllFeedbacks, deleteFeedback } from '@/actions/feedbackActions';

export default async function AdminFeedbackPage() {
const feedbacks = await getAllFeedbacks();

return (

<div className="p-6">
<h2 className="text-xl font-semibold mb-4">Visitor Feedback</h2>
{feedbacks.length === 0 && <p>No feedback yet.</p>}

      <ul className="space-y-4">
        {feedbacks.map(f => (
          <li
            key={f.id}
            className="border p-4 rounded-lg bg-white shadow-sm"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">
                Rating: {f.rating}/5
              </span>
              <form action={async () => deleteFeedback(f.id)}>
                <button className="text-red-500 text-sm hover:underline">
                  Delete
                </button>
              </form>
            </div>
            <p className="text-gray-800">{f.message}</p>
            {f.suggestions && (
              <p className="text-gray-600 text-sm mt-2">
                <strong>Suggestion:</strong> {f.suggestions}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              {new Date(f.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>

);
}

🔒 6. Access Control

Restrict /dashboard/admin/feedback to users with role = 'admin'.

If you already have middleware or a ProtectedRoute component:

Apply it to /dashboard/admin/feedback.

Redirect non-admins back to /.

💡 7. Optional Enhancements

Add pagination or search on admin page.

Include “feedback count” in your dashboard summary.

Add toast confirmation (react-hot-toast or custom) on submission.

✅ Deliverables Summary
Component Description
/feedback Public page with anonymous feedback form
/dashboard/admin/feedback Admin-only page showing and deleting feedback
db/schema/feedback.ts Drizzle schema for feedbacks table
actions/feedbackActions.ts Server Actions for CRUD operations
feedbacks table Stored in Neon PostgreSQL
Access Control Only admins can view/delete feedback
