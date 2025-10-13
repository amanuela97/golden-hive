- using the is_admin field from the user table in /Dashboard page add another dashboard for the admin
- the admin dashboard has the ability to add/manage products but also can preform the following quick actions:

1. Core User Management Features

An admin panel should give the admin full visibility and control over users. Common features include:

🔍 User Listing and Search

View all users in a table with pagination.

Columns: name, email, role, status (active/suspended), created date, last login, etc.

Search and filter users (e.g., by role, date joined).

👤 View User Details

Click on a user to open a detailed profile page.

Display:

Basic info: name, email, phone, address

Role: user/admin/seller

Account status (active, pending verification, suspended)

Activity log (last login, created listings, etc.)

Associated entities (e.g., orders, listings, reviews)

✏️ Edit User Information

Update user profile details (name, email, phone, address, etc.)

Change roles or permissions.

Reset password or send password reset link.

Mark email as verified manually if needed.

🚫 Suspend / Delete Users

Suspend users temporarily (disable login but keep data).

Delete users permanently (with confirmation dialog and audit log).

Optional: soft delete (mark as inactive but keep record for recovery).

2. Role & Permission Management

If your app has multiple roles (e.g., admin, seller, customer), you should give admins tools to manage access levels:

🎭 Role Assignment

Add or remove roles from users.

Prevent admin from removing their own admin role accidentally.

🔐 Permission Settings

Define granular permissions like:

Can manage listings

Can process payments

Can view analytics

Can manage other users

3. Monitoring & Analytics

Admins should also be able to monitor system and user activity:

📈 User Statistics Dashboard

Total users

New signups (daily, weekly, monthly)

Active vs inactive users

Users by role

Verification rate

🕵️ Activity Logs

Record and display important actions:

Login attempts

Password resets

Account updates

Role changes

Deletions

Filter logs by user, action type, or date.

💬 4. Communication Tools

Admins often need to communicate with users:

Send email announcements (to all users or filtered groups).
