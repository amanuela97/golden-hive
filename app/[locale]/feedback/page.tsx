"use client";

import { submitFeedback } from "../actions/feedbackActions";
import { useTranslations } from "next-intl";

export default function FeedbackPage() {
  const t = useTranslations("feedback");

  return (
    <div className="min-h-screen max-w-xl mx-auto mt-12 p-6 bg-white shadow rounded-xl">
      <h1 className="text-2xl font-semibold mb-4 text-center">{t("title")}</h1>
      <p className="text-sm text-gray-500 text-center mb-6">
        {t("underDevelopment")}
      </p>

      <form action={submitFeedback} className="flex flex-col gap-4">
        <label className="flex flex-col">
          {t("rating")}
          <select name="rating" required className="border rounded p-2">
            <option value="">{t("selectRating")}</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <textarea
          name="message"
          placeholder={t("whatDoYouThink")}
          className="border rounded p-2 min-h-[80px]"
        />
        <textarea
          name="suggestions"
          placeholder={t("whatFeatures")}
          className="border rounded p-2 min-h-[80px]"
        />

        <button
          type="submit"
          className="bg-yellow-600 text-white py-2 rounded hover:bg-yellow-700"
        >
          {t("submitFeedback")}
        </button>
      </form>
    </div>
  );
}
