"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Edit,
  Eye,
  EyeOff,
  Info,
  FileText,
  Image as ImageIcon,
  Video,
} from "lucide-react";
import {
  useAboutSection,
  useCreateAboutSection,
  useUpdateAboutSection,
} from "@/app/hooks/useHomepageContentQueries";
import { AboutForm } from "./components/AboutForm";
import {
  CreateAboutData,
  UpdateAboutData,
} from "@/app/actions/homepage-content";
import Image from "next/image";

export default function AboutManager() {
  const { data: aboutData, isLoading } = useAboutSection();
  const createAboutMutation = useCreateAboutSection();
  const updateAboutMutation = useUpdateAboutSection();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const aboutSection = aboutData?.result;

  const handleCreateAbout = (data: CreateAboutData | UpdateAboutData) => {
    createAboutMutation.mutate(data as CreateAboutData, {
      onSuccess: () => {
        setIsEditDialogOpen(false);
      },
    });
  };

  const handleUpdateAbout = (data: UpdateAboutData | CreateAboutData) => {
    updateAboutMutation.mutate(data as UpdateAboutData, {
      onSuccess: () => {
        setIsEditDialogOpen(false);
      },
    });
  };

  const handleToggleActive = () => {
    if (aboutSection) {
      updateAboutMutation.mutate({
        id: aboutSection.id,
        isActive: !aboutSection.isActive,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading about section...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isVideo =
    aboutSection?.assetUrl &&
    (aboutSection.assetUrl.includes(".mp4") ||
      aboutSection.assetUrl.includes(".webm") ||
      aboutSection.assetUrl.includes(".ogg"));

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                About Section Management
              </h1>
              <p className="text-muted-foreground">
                Manage your homepage about section content and media
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {aboutSection && (
                <Button
                  variant="outline"
                  onClick={handleToggleActive}
                  disabled={updateAboutMutation.isPending}
                  className="flex items-center space-x-2"
                >
                  {aboutSection.isActive ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      <span>Deactivate</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      <span>Activate</span>
                    </>
                  )}
                </Button>
              )}
              <Button
                onClick={() => setIsEditDialogOpen(true)}
                className="flex items-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>{aboutSection ? "Edit" : "Create"} About Section</span>
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Content Length
                    </p>
                    <p className="text-2xl font-bold">
                      {aboutSection?.content?.length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    {isVideo ? (
                      <Video className="w-6 h-6 text-green-600" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-green-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Media Type</p>
                    <p className="text-2xl font-bold">
                      {aboutSection?.assetUrl
                        ? isVideo
                          ? "Video"
                          : "Image"
                        : "None"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-2 rounded-lg ${aboutSection?.isActive ? "bg-green-100" : "bg-gray-100"}`}
                  >
                    <Eye
                      className={`w-6 h-6 ${aboutSection?.isActive ? "text-green-600" : "text-gray-600"}`}
                    />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-2xl font-bold">
                      {aboutSection?.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* About Section Content */}
          {aboutSection ? (
            <div className="space-y-6">
              {/* Section Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>About Section</span>
                    <Badge
                      variant={aboutSection.isActive ? "default" : "secondary"}
                      className={
                        aboutSection.isActive
                          ? "bg-green-100 text-green-800"
                          : ""
                      }
                    >
                      {aboutSection.isActive ? (
                        <>
                          <Eye className="w-3 h-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <h2 className="text-3xl font-bold text-foreground mb-4">
                    {aboutSection.title}
                  </h2>
                </CardContent>
              </Card>

              {/* Content and Media */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Content */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="w-5 h-5" />
                      <span>Content</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose max-w-none">
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {aboutSection.content}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Media */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      {isVideo ? (
                        <Video className="w-5 h-5" />
                      ) : (
                        <ImageIcon className="w-5 h-5" />
                      )}
                      <span>Media</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {aboutSection.assetUrl ? (
                      <div className="space-y-4">
                        {isVideo ? (
                          <video
                            src={aboutSection.assetUrl}
                            controls
                            className="w-full h-64 object-cover rounded-lg border"
                          />
                        ) : (
                          <Image
                            src={aboutSection.assetUrl}
                            alt="About section media"
                            className="w-full h-64 object-cover rounded-lg border"
                            width={500}
                            height={500}
                            quality={100}
                            priority
                          />
                        )}
                        <div className="text-sm text-muted-foreground">
                          <p>
                            <strong>Type:</strong> {isVideo ? "Video" : "Image"}
                          </p>
                          <p>
                            <strong>URL:</strong> {aboutSection.assetUrl}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <ImageIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">No media uploaded</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Eye className="w-5 h-5" />
                    <span>Preview</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="max-w-4xl mx-auto">
                      <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
                        {aboutSection.title}
                      </h2>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                        <div>
                          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {aboutSection.content}
                          </p>
                        </div>

                        {aboutSection.assetUrl && (
                          <div>
                            {isVideo ? (
                              <video
                                src={aboutSection.assetUrl}
                                controls
                                className="w-full h-64 object-cover rounded-lg"
                              />
                            ) : (
                              <Image
                                src={aboutSection.assetUrl}
                                alt="About section preview"
                                className="w-full h-64 object-cover rounded-lg"
                                width={500}
                                height={500}
                                quality={100}
                                priority
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-12">
                <div className="text-center">
                  <Info className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No about section created yet
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Create an about section to tell your story and connect with
                    customers
                  </p>
                  <Button onClick={() => setIsEditDialogOpen(true)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Create About Section
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {aboutSection ? "Edit About Section" : "Create About Section"}
                </DialogTitle>
              </DialogHeader>
              <AboutForm
                initialData={aboutSection}
                onSubmit={aboutSection ? handleUpdateAbout : handleCreateAbout}
                onCancel={() => setIsEditDialogOpen(false)}
                isLoading={
                  createAboutMutation.isPending || updateAboutMutation.isPending
                }
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
