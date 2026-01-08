"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  FileText,
  ImageIcon,
  Menu,
  HelpCircle,
  Globe,
  Home,
  Info,
} from "lucide-react";

const contentPages = [
  {
    title: "Homepage Hero",
    description: "Manage the hero section on the homepage",
    href: "/dashboard/content/homepage-hero",
    icon: Home,
  },
  {
    title: "Homepage About",
    description: "Manage the about section on the homepage",
    href: "/dashboard/content/homepage-about",
    icon: Info,
  },
  {
    title: "About Page",
    description: "Manage the main about page content",
    href: "/dashboard/content/about",
    icon: FileText,
  },
  {
    title: "Benefits Section",
    description: "Manage the benefits section content",
    href: "/dashboard/content/benefits",
    icon: ImageIcon,
  },
  {
    title: "FAQ",
    description: "Manage frequently asked questions",
    href: "/dashboard/content/faq",
    icon: HelpCircle,
  },
  {
    title: "Navbar",
    description: "Manage navigation bar items and settings",
    href: "/dashboard/content/navbar",
    icon: Menu,
  },
  {
    title: "Footer",
    description: "Manage footer content and links",
    href: "/dashboard/content/footer",
    icon: Globe,
  },
];

export default function ContentManagementIndex() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Content Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage all site content and pages
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contentPages.map((page) => {
          const Icon = page.icon;
          return (
            <Card key={page.href} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{page.title}</CardTitle>
                  </div>
                </div>
                <CardDescription className="mt-2">
                  {page.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={page.href}>
                  <Button variant="outline" className="w-full">
                    Manage
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
