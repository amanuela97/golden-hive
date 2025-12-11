"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
} from "lucide-react";
import {
  useHeroSlides,
  useCreateHeroSlide,
  useUpdateHeroSlide,
  useDeleteHeroSlide,
} from "../../hooks/useHomepageContentQueries";
import { HeroForm } from "./components/HeroForm";
import {
  HeroSlide,
  CreateHeroSlideData,
  UpdateHeroSlideData,
} from "../../actions/homepage-content";
import Image from "next/image";
import toast from "react-hot-toast";

export default function HomepageHeroManager() {
  const { data: heroData, isLoading } = useHeroSlides();
  const createSlideMutation = useCreateHeroSlide();
  const updateSlideMutation = useUpdateHeroSlide();
  const deleteSlideMutation = useDeleteHeroSlide();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState<HeroSlide | null>(null);

  const heroSlides = heroData?.result || [];

  const handleCreateSlide = (
    data: CreateHeroSlideData | UpdateHeroSlideData
  ) => {
    createSlideMutation.mutate(data as CreateHeroSlideData, {
      onSuccess: (result) => {
        setIsCreateDialogOpen(false);
        if (result.success) {
          toast.success(result.message || "Hero slide created successfully");
        } else {
          toast.error(result.error || "Failed to create hero slide");
        }
      },
      onError: (error) => {
        console.error("Error creating hero slide:", error);
        toast.error("Failed to create hero slide. Please try again.");
      },
    });
  };

  const handleEditSlide = (slide: HeroSlide) => {
    setSelectedSlide(slide);
    setIsEditDialogOpen(true);
  };

  const handleUpdateSlide = (
    data: UpdateHeroSlideData | CreateHeroSlideData
  ) => {
    updateSlideMutation.mutate(data as UpdateHeroSlideData, {
      onSuccess: (result) => {
        setIsEditDialogOpen(false);
        setSelectedSlide(null);
        if (result.success) {
          toast.success(result.message || "Hero slide updated successfully");
        } else {
          toast.error(result.error || "Failed to update hero slide");
        }
      },
      onError: (error) => {
        console.error("Error updating hero slide:", error);
        toast.error("Failed to update hero slide. Please try again.");
      },
    });
  };

  const handleDeleteSlide = (slideId: string) => {
    if (
      window.confirm(
        "Are you sure you want to delete this hero slide? This action cannot be undone."
      )
    ) {
      deleteSlideMutation.mutate(slideId, {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Hero slide deleted successfully");
          } else {
            toast.error(result.error || "Failed to delete hero slide");
          }
        },
        onError: (error) => {
          console.error("Error deleting hero slide:", error);
          toast.error("Failed to delete hero slide. Please try again.");
        },
      });
    }
  };

  const handleToggleActive = (slide: HeroSlide) => {
    updateSlideMutation.mutate(
      {
        id: slide.id,
        isActive: !slide.isActive,
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success(
              slide.isActive
                ? "Hero slide deactivated successfully"
                : "Hero slide activated successfully"
            );
          } else {
            toast.error(result.error || "Failed to update hero slide status");
          }
        },
        onError: (error) => {
          console.error("Error toggling hero slide status:", error);
          toast.error("Failed to update hero slide status. Please try again.");
        },
      }
    );
  };

  const moveSlide = (slideId: string, direction: "up" | "down") => {
    const currentSlide = heroSlides.find((slide) => slide.id === slideId);
    if (!currentSlide) return;

    const sortedSlides = [...heroSlides].sort((a, b) => a.order - b.order);
    const currentIndex = sortedSlides.findIndex(
      (slide) => slide.id === slideId
    );

    if (direction === "up" && currentIndex > 0) {
      const prevSlide = sortedSlides[currentIndex - 1];
      // Swap orders
      updateSlideMutation.mutate(
        { id: slideId, order: prevSlide.order },
        {
          onSuccess: () => {
            updateSlideMutation.mutate(
              {
                id: prevSlide.id,
                order: currentSlide.order,
              },
              {
                onSuccess: () => {
                  toast.success("Hero slide order updated successfully");
                },
                onError: () => {
                  toast.error("Failed to update hero slide order");
                },
              }
            );
          },
          onError: () => {
            toast.error("Failed to update hero slide order");
          },
        }
      );
    } else if (direction === "down" && currentIndex < sortedSlides.length - 1) {
      const nextSlide = sortedSlides[currentIndex + 1];
      // Swap orders
      updateSlideMutation.mutate(
        { id: slideId, order: nextSlide.order },
        {
          onSuccess: () => {
            updateSlideMutation.mutate(
              {
                id: nextSlide.id,
                order: currentSlide.order,
              },
              {
                onSuccess: () => {
                  toast.success("Hero slide order updated successfully");
                },
                onError: () => {
                  toast.error("Failed to update hero slide order");
                },
              }
            );
          },
          onError: () => {
            toast.error("Failed to update hero slide order");
          },
        }
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading hero slides...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sortedSlides = [...heroSlides].sort((a, b) => a.order - b.order);
  const activeSlides = sortedSlides.filter((slide) => slide.isActive);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Hero Section Management
              </h1>
              <p className="text-muted-foreground">
                Manage your homepage hero slides (max 5 slides)
              </p>
            </div>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              disabled={heroSlides.length >= 5}
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Slide</span>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ImageIcon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Slides
                    </p>
                    <p className="text-2xl font-bold">{heroSlides.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Eye className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Active Slides
                    </p>
                    <p className="text-2xl font-bold">{activeSlides.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <ArrowUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Max Slides</p>
                    <p className="text-2xl font-bold">5</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Slides Table */}
          <Card>
            <CardHeader>
              <CardTitle>Hero Slides</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {sortedSlides.length === 0 ? (
                <div className="text-center py-12">
                  <ImageIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No hero slides yet
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Create your first hero slide to get started
                  </p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Slide
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Image</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Subtitle</TableHead>
                      <TableHead>CTA</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSlides.map((slide, index) => (
                      <TableRow key={slide.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{slide.order}</span>
                            <div className="flex flex-col space-y-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveSlide(slide.id, "up")}
                                disabled={index === 0}
                                className="h-6 w-6 p-0"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveSlide(slide.id, "down")}
                                disabled={index === sortedSlides.length - 1}
                                className="h-6 w-6 p-0"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="w-16 h-12 relative">
                            <Image
                              src={slide.imageUrl}
                              alt={slide.title || "Hero slide"}
                              className="w-full h-full object-cover rounded"
                              width={500}
                              height={500}
                              quality={100}
                              priority
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-32">
                            <p className="font-medium truncate">
                              {slide.title || "No title"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-32">
                            <p className="text-sm text-muted-foreground truncate">
                              {slide.subtitle || "No subtitle"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-24">
                            <p className="text-sm truncate">
                              {slide.ctaLabel || "No CTA"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={slide.isActive ? "default" : "secondary"}
                            className={
                              slide.isActive
                                ? "bg-green-100 text-green-800"
                                : ""
                            }
                          >
                            {slide.isActive ? (
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
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(slide)}
                              disabled={updateSlideMutation.isPending}
                            >
                              {slide.isActive ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSlide(slide)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSlide(slide.id)}
                              disabled={deleteSlideMutation.isPending}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Create Dialog */}
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Hero Slide</DialogTitle>
              </DialogHeader>
              <HeroForm
                onSubmit={handleCreateSlide}
                onCancel={() => setIsCreateDialogOpen(false)}
                isLoading={createSlideMutation.isPending}
              />
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Hero Slide</DialogTitle>
              </DialogHeader>
              <HeroForm
                initialData={selectedSlide}
                onSubmit={handleUpdateSlide}
                onCancel={() => {
                  setIsEditDialogOpen(false);
                  setSelectedSlide(null);
                }}
                isLoading={updateSlideMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
