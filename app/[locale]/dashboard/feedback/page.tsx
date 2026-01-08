import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { getAllFeedbacks, deleteFeedback } from "../../actions/feedbackActions";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import DashboardNotFound from "../not-found";

export default async function FeedbackPage() {
  // Automatically checks route access based on navigation config
  // Feedback is admin-only (not in nav but should be protected)
  const result = await protectDashboardRoute({
    allowedRoles: ["admin"],
    showNotFound: true,
  });

  // Render 404 content directly instead of calling notFound()
  // This ensures proper layout inheritance
  if (result.shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  const { role: roleName } = result;

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
