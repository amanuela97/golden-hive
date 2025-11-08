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
import { Plus, Edit, Eye, EyeOff, Star, CheckCircle } from "lucide-react";
import {
  useBenefitsSection,
  useCreateBenefitsSection,
  useUpdateBenefitsSection,
} from "../../../hooks/useHomepageContentQueries";
import { BenefitForm } from "./components/BenefitForm";
import {
  CreateBenefitsData,
  UpdateBenefitsData,
} from "../../../actions/homepage-content";
import { ICON_MAP, IconName } from "@/lib/icons";

export default function BenefitsSectionManager() {
  const { data: benefitsData, isLoading } = useBenefitsSection();
  const createBenefitsMutation = useCreateBenefitsSection();
  const updateBenefitsMutation = useUpdateBenefitsSection();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const benefitsSection = benefitsData?.result;

  const handleCreateBenefits = (
    data: CreateBenefitsData | UpdateBenefitsData
  ) => {
    createBenefitsMutation.mutate(data as CreateBenefitsData, {
      onSuccess: () => {
        setIsEditDialogOpen(false);
      },
    });
  };

  const handleUpdateBenefits = (
    data: UpdateBenefitsData | CreateBenefitsData
  ) => {
    updateBenefitsMutation.mutate(data as UpdateBenefitsData, {
      onSuccess: () => {
        setIsEditDialogOpen(false);
      },
    });
  };

  const handleToggleActive = () => {
    if (benefitsSection) {
      updateBenefitsMutation.mutate({
        id: benefitsSection.id,
        isActive: !benefitsSection.isActive,
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
              <p className="text-muted-foreground">
                Loading benefits section...
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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Benefits Section Management
              </h1>
              <p className="text-muted-foreground">
                Manage your homepage benefits section (max 3 benefit cards)
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {benefitsSection && (
                <Button
                  variant="outline"
                  onClick={handleToggleActive}
                  disabled={updateBenefitsMutation.isPending}
                  className="flex items-center space-x-2"
                >
                  {benefitsSection.isActive ? (
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
                <span>{benefitsSection ? "Edit" : "Create"} Benefits</span>
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Star className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Benefits Count
                    </p>
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
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Max Benefits
                    </p>
                    <p className="text-2xl font-bold">3</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-2 rounded-lg ${benefitsSection?.isActive ? "bg-green-100" : "bg-gray-100"}`}
                  >
                    <Eye
                      className={`w-6 h-6 ${benefitsSection?.isActive ? "text-green-600" : "text-gray-600"}`}
                    />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-2xl font-bold">
                      {benefitsSection?.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Benefits Section Content */}
          {benefitsSection ? (
            <div className="space-y-6">
              {/* Section Title */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Section Title</span>
                    <Badge
                      variant={
                        benefitsSection.isActive ? "default" : "secondary"
                      }
                      className={
                        benefitsSection.isActive
                          ? "bg-green-100 text-green-800"
                          : ""
                      }
                    >
                      {benefitsSection.isActive ? (
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
                  <h2 className="text-2xl font-semibold text-foreground">
                    {benefitsSection.title}
                  </h2>
                </CardContent>
              </Card>

              {/* Benefits Grid */}
              <Card>
                <CardHeader>
                  <CardTitle>Benefit Cards</CardTitle>
                </CardHeader>
                <CardContent>
                  {benefitsSection.items && benefitsSection.items.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {benefitsSection.items.map((benefit, index) => {
                        const IconComponent =
                          ICON_MAP[benefit.icon as IconName];
                        return (
                          <Card key={index} className="p-6 text-center">
                            <div className="flex justify-center mb-4">
                              <div className="p-3 bg-primary/10 rounded-full">
                                {IconComponent && (
                                  <IconComponent className="w-8 h-8 text-primary" />
                                )}
                              </div>
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                              {benefit.title}
                            </h3>
                            <p className="text-muted-foreground text-sm">
                              {benefit.description}
                            </p>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Star className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No benefits added yet
                      </h3>
                      <p className="text-gray-500 mb-4">
                        Add benefit cards to showcase your key features
                      </p>
                      <Button onClick={() => setIsEditDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Benefits
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-12">
                <div className="text-center">
                  <Star className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No benefits section created yet
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Create a benefits section to highlight your key features and
                    advantages
                  </p>
                  <Button onClick={() => setIsEditDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Benefits Section
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
                  {benefitsSection
                    ? "Edit Benefits Section"
                    : "Create Benefits Section"}
                </DialogTitle>
              </DialogHeader>
              <BenefitForm
                initialData={benefitsSection}
                onSubmit={
                  benefitsSection ? handleUpdateBenefits : handleCreateBenefits
                }
                onCancel={() => setIsEditDialogOpen(false)}
                isLoading={
                  createBenefitsMutation.isPending ||
                  updateBenefitsMutation.isPending
                }
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
