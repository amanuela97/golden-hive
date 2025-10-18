- Build the following page/componets for home page content management according to the structure below
- Use tanstack query when fetching data and make sure the components are functional
- Check schema.ts to see the db structure for each section
- make sure when preforming deletion operation on images to also remove it from cloudinary so it doesnt occupy space.
- check for more details on what to build below;

1. Updated Folder Structure
   app/
   ├── dashboard/
   │ ├── admin/
   │ │ ├── content/
   │ │ │ ├── HomepageHeroManager.tsx
   │ │ │ ├── BenefitsSectionManager.tsx
   │ │ │ ├── AboutManager.tsx ✅ replaces TestimonialsManager
   │ │ │ ├── GalleryManager.tsx
   │ │ │ ├── index.tsx
   │ │ │ └── components/
   │ │ │ ├── HeroForm.tsx
   │ │ │ ├── BenefitForm.tsx
   │ │ │ ├── AboutForm.tsx ✅ replaces TestimonialForm.tsx
   │ │ │ └── GalleryForm.tsx

2. Suggested Page Components

Here’s what each file’s responsibility would be:

| File                         | Purpose                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `index.tsx`                  | Overview page showing all homepage sections (hero, benefits, testimonials, etc.) with “Edit” buttons |
| `HomepageHeroManager.tsx`    | CRUD form for hero section slides (3-5 sildes max) (title, subtitle, imageUrl, CTA link, order)      |
| `BenefitsSectionManager.tsx` | CRUD form for benefit cards (3 max) (title, description, icon, order)                                |
| `AboutManager.tsx`           | CRUD form for a single about section (title, content, assetUrl (image or video))                     |
| `GalleryManager.tsx`         | Upload/manage homepage gallery images                                                                |
| `/components/*.tsx`          | Step forms or reusable inputs used by each section manager (for modularity)                          |

3. Frontend (Mapping icon names to components)

Let’s say you’re using Lucide icons.

You can create a simple icons.ts utility:

```
import {
  Leaf,
  Truck,
  ShieldCheck,
  Sparkles,
  HeartHandshake,
  type Icon as LucideIcon,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  Leaf,
  Truck,
  ShieldCheck,
  Sparkles,
  HeartHandshake,
};
```

For your admin dashboard, you can show a dropdown or searchable grid of available icons.

Example:

```
<select name="icon" defaultValue={formData.icon}>
{Object.keys(ICON_MAP).map((name) => (
<option key={name} value={name}>
{name}
</option>
))}
</select>
```

1. Update Content Management Index Page

index.tsx should now reflect the new About section:

const sections = [
{ name: "Homepage Hero", path: "/dashboard/admin/content/homepage-hero" },
{ name: "Benefits Section", path: "/dashboard/admin/content/benefits" },
{ name: "About Section", path: "/dashboard/admin/content/about" }, // ✅ updated
{ name: "Gallery", path: "/dashboard/admin/content/gallery" },
];
