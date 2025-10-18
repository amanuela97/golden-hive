"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Image as ImageIcon,
  Star,
  Info,
  Edit,
  Plus,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import {
  useHeroSlides,
  useAboutSection,
  useBenefitsSection,
} from "@/app/hooks/useHomepageContentQueries";
import { HeroSlide } from "@/app/actions/homepage-content";

const sections = [
  {
    name: "Homepage Hero",
    path: "/dashboard/admin/content/homepage-hero",
    icon: ImageIcon,
    description: "Manage hero section slides (3-5 slides max)",
  },
  {
    name: "Benefits Section",
    path: "/dashboard/admin/content/benefits",
    icon: Star,
    description: "Manage benefit cards (3 max)",
  },
  {
    name: "About Section",
    path: "/dashboard/admin/content/about",
    icon: Info,
    description: "Manage about section content",
  },
];

export default function ContentManagementIndex() {
  const { data: heroData, isLoading: heroLoading } = useHeroSlides();
  const { data: aboutData, isLoading: aboutLoading } = useAboutSection();
  const { data: benefitsData, isLoading: benefitsLoading } =
    useBenefitsSection();

  const heroSlides = heroData?.result || [];
  const aboutSection = aboutData?.result;
  const benefitsSection = benefitsData?.result;

  const getSectionStatus = (sectionName: string) => {
    switch (sectionName) {
      case "Homepage Hero":
        const activeHeroSlides = heroSlides.filter(
          (slide: HeroSlide) => slide.isActive
        );
        return {
          count: activeHeroSlides.length,
          max: 5,
          status: activeHeroSlides.length > 0 ? "active" : "empty",
          message: `${activeHeroSlides.length}/5 slides active`,
        };
      case "Benefits Section":
        return {
          count: benefitsSection?.items?.length || 0,
          max: 3,
          status: benefitsSection ? "active" : "empty",
          message: benefitsSection
            ? `${benefitsSection.items?.length || 0}/3 benefits`
            : "No content",
        };
      case "About Section":
        return {
          count: aboutSection ? 1 : 0,
          max: 1,
          status: aboutSection ? "active" : "empty",
          message: aboutSection ? "Content available" : "No content",
        };
      default:
        return {
          count: 0,
          max: 0,
          status: "empty",
          message: "Unknown",
        };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <Eye className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case "empty":
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-600">
            <EyeOff className="w-3 h-3 mr-1" />
            Empty
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (heroLoading || aboutLoading || benefitsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">
                Loading content management...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Homepage Content Management
            </h1>
            <p className="text-muted-foreground">
              Manage all sections of your homepage content including hero
              slides, benefits, and about section.
            </p>
          </div>

          {/* Content Sections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {sections.map((section) => {
              const Icon = section.icon;
              const status = getSectionStatus(section.name);

              return (
                <Card
                  key={section.name}
                  className="hover:shadow-lg transition-shadow duration-300"
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-xl">
                            {section.name}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {section.description}
                          </CardDescription>
                        </div>
                      </div>
                      {getStatusBadge(status.status)}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {/* Status Info */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {status.message}
                        </span>
                        {status.max > 0 && (
                          <span className="text-muted-foreground">
                            Max: {status.max}
                          </span>
                        )}
                      </div>

                      {/* Progress Bar for sections with limits */}
                      {status.max > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min((status.count / status.max) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex space-x-2 pt-2">
                        <Link href={section.path} className="flex-1">
                          <Button variant="outline" className="w-full">
                            <Edit className="w-4 h-4 mr-2" />
                            {status.status === "empty" ? "Create" : "Edit"}
                          </Button>
                        </Link>
                        {status.status === "active" && (
                          <Button variant="ghost" size="sm">
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick Stats */}
          <div className="mt-12">
            <h2 className="text-2xl font-semibold text-foreground mb-6">
              Content Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <ImageIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Hero Slides
                      </p>
                      <p className="text-2xl font-bold">
                        {
                          heroSlides.filter(
                            (slide: HeroSlide) => slide.isActive
                          ).length
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Star className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Benefits</p>
                      <p className="text-2xl font-bold">
                        {benefitsSection?.items?.length || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Info className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        About Section
                      </p>
                      <p className="text-2xl font-bold">
                        {aboutSection ? 1 : 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
