import { submitFeedback } from "../actions/feedbackActions";

export default function FeedbackPage() {
  return (
    <div className="min-h-screen max-w-xl mx-auto mt-12 p-6 bg-white shadow rounded-xl">
      <h1 className="text-2xl font-semibold mb-4 text-center">
        We&apos;d love your feedback
      </h1>
      <p className="text-sm text-gray-500 text-center mb-6">
        This website is still under development — some features may not work
        yet.
      </p>

      <form action={submitFeedback} className="flex flex-col gap-4">
        <label className="flex flex-col">
          Rating:
          <select name="rating" required className="border rounded p-2">
            <option value="">Select rating</option>
            {[1, 2, 3, 4, 5].map((n) => (
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
