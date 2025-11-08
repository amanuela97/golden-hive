- i am using next-intl in my project but currently i am importing the translations from my static /locales folder
- i want to fetch the translation from my neon db instead
- here is how you can achieve this;

- Create a database schema in schema.ts to store the translation locale jsons in

- You could store translations as nested JSON for each language, or key/value pairs.
  Example (with nested JSON):

CREATE TABLE translations (
lang TEXT PRIMARY KEY,
data JSONB NOT NULL
);

- Then you can store the whole translation JSON for en, fi, ne.

- From my Admin dashboard there should be a translation page where the user can modify the translation json files. The page should have a dropdown to switch json editors between 'en' | 'fi' | 'ne' using library "json-edit-react" (already installed)

Load from DB the JSON for the chosen language. if there is no data it should show an empty json editor.

Show it in the JSON editor UI.

the user will mainly modify the en json so there should be an option to tanslate the en json to fi and ne using the translation function in lib/translation.ts. Then the user can edit all three json before saving.

When user edits and saves, call a server action that writes to Neon (UPSERT data JSONB for that language).

Caching: To improve performance, cache translations, or use revalidate/cache headers. This way we do not have to make db calls to neon when there is no changes or translate texts that have not changes.

Permissions: Ensure only admin users can preform these actions.

In your Next.js layout, instead of static JSON import, fetch from your DB via a server action (or getServerSideProps) the translations for the requested locale.

Pass that JSON into your translation provider (next-intl or your translation hook).

Because you’re fetching at runtime, changes your client made will reflect live.
