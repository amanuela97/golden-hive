- In RegisterForm.tsx add a dropdown select UI for selecting the role of the user from options "Seller" or "Customer" but create an enum with "Seller" | "Admin" | "Customer".
- Then in registerAction create the selected role if it does not exist, otherwise fetch it from the db and link it to the user (check schema.ts for how the schemas are structured if needed). if the regestering user's email matches process.env.ADMIN_LIST then link the "Admin" role despite what the user has selected.
- For google sign-in check if the user exists in your database (Neon):
- If user exists: fetch their role and redirect to the correct dashboard.
- If user doesn’t exist: redirect them to an onboarding page with options to "Continue as a Customer" or "Continue as a Seller". Once the user picks a role, save it to the database you can re-use the logic from registerAction to check if the role exists before creating it.
- when user logs in email/pass or google then get the role and redirect to /dashboard/{role} accordingly, and Create a Middleware to ensure only users with the right role can access the right dashboard (aka route protection).
- Make sure to refactor the dashboard structure according to the diagram below, do not recreate the dashboard logic or components only refactor the rendering structure.
  app/
  ├── dashboard/
  │ ├── admin/
  │ │ └── Page.tsx
  │ ├── seller/
  │ │ └── Page.tsx
  │ ├── customer/
  │ │ └── Page.tsx
