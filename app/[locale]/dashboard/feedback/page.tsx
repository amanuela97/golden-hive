import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { getAllFeedbacks, deleteFeedback } from "../../actions/feedbackActions";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";

export default async function FeedbackPage() {
  const locale = await getLocale();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect({ href: "/login", locale });
  }

  // Get user's role
  const userRole = await db
    .select({
      roleName: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, session?.user.id ?? ""))
    .limit(1);

  if (userRole.length === 0) {
    redirect({ href: "/onboarding", locale });
  }

  const roleName = userRole[0].roleName.toLowerCase() as
    | "admin"
    | "seller"
    | "customer";

  // Only admin can access feedback
  if (roleName !== "admin") {
    redirect({ href: "/dashboard", locale });
  }

  const feedbacks = await getAllFeedbacks();

  return (
    <DashboardWrapper userRole={roleName}>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4">Visitor Feedback</h2>
        {feedbacks.length === 0 && <p>No feedback yet.</p>}

        <ul className="space-y-4">
          {feedbacks.map((f) => (
            <li key={f.id} className="border p-4 rounded-lg bg-white shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">
                  Rating: {f.rating}/5
                </span>
                <form
                  action={async () => {
                    "use server";
                    await deleteFeedback(f.id);
                  }}
                >
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
                {f.createdAt
                  ? new Date(f.createdAt).toLocaleString()
                  : "Unknown date"}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </DashboardWrapper>
  );
}
