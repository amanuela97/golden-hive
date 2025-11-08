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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  HelpCircle,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  useFaqSections,
  useFaqSection,
  useCreateFaqSection,
  useUpdateFaqSection,
  useDeleteFaqSection,
  useCreateFaqItem,
  useUpdateFaqItem,
  useDeleteFaqItem,
} from "../../../hooks/useFaqQueries";
import {
  type FaqSectionData,
  type FaqItemData,
  type CreateFaqSectionInput,
  type UpdateFaqSectionInput,
  type CreateFaqItemInput,
  type UpdateFaqItemInput,
} from "../../../actions/faq";
import { Loader2 } from "lucide-react";

export default function FaqManager() {
  const { data: sections, isLoading: sectionsLoading } = useFaqSections();
  const createSectionMutation = useCreateFaqSection();
  const updateSectionMutation = useUpdateFaqSection();
  const deleteSectionMutation = useDeleteFaqSection();
  const createItemMutation = useCreateFaqItem();
  const updateItemMutation = useUpdateFaqItem();
  const deleteItemMutation = useDeleteFaqItem();

  const [isCreateSectionDialogOpen, setIsCreateSectionDialogOpen] =
    useState(false);
  const [isEditSectionDialogOpen, setIsEditSectionDialogOpen] = useState(false);
  const [isCreateItemDialogOpen, setIsCreateItemDialogOpen] = useState(false);
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<FaqSectionData | null>(
    null
  );
  const [selectedItem, setSelectedItem] = useState<FaqItemData | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set()
  );

  const toggleSectionExpanded = (sectionId: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const handleCreateSection = (data: CreateFaqSectionInput) => {
    createSectionMutation.mutate(data, {
      onSuccess: () => {
        setIsCreateSectionDialogOpen(false);
      },
    });
  };

  const handleEditSection = (section: FaqSectionData) => {
    setSelectedSection(section);
    setIsEditSectionDialogOpen(true);
  };

  const handleUpdateSection = (data: UpdateFaqSectionInput) => {
    updateSectionMutation.mutate(data, {
      onSuccess: () => {
        setIsEditSectionDialogOpen(false);
        setSelectedSection(null);
      },
    });
  };

  const handleDeleteSection = (sectionId: number) => {
    if (
      window.confirm(
        "Are you sure you want to delete this FAQ section? All items in this section will also be deleted. This action cannot be undone."
      )
    ) {
      deleteSectionMutation.mutate(sectionId);
    }
  };

  const handleCreateItem = (data: CreateFaqItemInput) => {
    createItemMutation.mutate(data, {
      onSuccess: () => {
        setIsCreateItemDialogOpen(false);
        if (selectedSection) {
          toggleSectionExpanded(selectedSection.id);
        }
      },
    });
  };

  const handleEditItem = (item: FaqItemData) => {
    setSelectedItem(item);
    setIsEditItemDialogOpen(true);
  };

  const handleUpdateItem = (data: UpdateFaqItemInput) => {
    updateItemMutation.mutate(data, {
      onSuccess: () => {
        setIsEditItemDialogOpen(false);
        setSelectedItem(null);
      },
    });
  };

  const handleDeleteItem = (itemId: number, sectionId: number) => {
    if (
      window.confirm(
        "Are you sure you want to delete this FAQ item? This action cannot be undone."
      )
    ) {
      deleteItemMutation.mutate({ itemId, sectionId });
    }
  };

  if (sectionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                FAQ Management
              </h1>
              <p className="text-muted-foreground">
                Manage FAQ sections and questions
              </p>
            </div>
            <Button onClick={() => setIsCreateSectionDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Section
            </Button>
          </div>

          {/* Sections List */}
          <div className="space-y-4">
            {sections && sections.length > 0 ? (
              sections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  isExpanded={expandedSections.has(section.id)}
                  onToggleExpanded={() => toggleSectionExpanded(section.id)}
                  onEdit={() => handleEditSection(section)}
                  onDelete={() => handleDeleteSection(section.id)}
                  onCreateItem={() => {
                    setSelectedSection(section);
                    setIsCreateItemDialogOpen(true);
                  }}
                  onEditItem={handleEditItem}
                  onDeleteItem={handleDeleteItem}
                />
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <HelpCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No FAQ sections yet. Create your first section to get
                    started.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Create Section Dialog */}
      <CreateSectionDialog
        isOpen={isCreateSectionDialogOpen}
        onClose={() => setIsCreateSectionDialogOpen(false)}
        onSubmit={handleCreateSection}
        isLoading={createSectionMutation.isPending}
      />

      {/* Edit Section Dialog */}
      {selectedSection && (
        <EditSectionDialog
          isOpen={isEditSectionDialogOpen}
          onClose={() => {
            setIsEditSectionDialogOpen(false);
            setSelectedSection(null);
          }}
          section={selectedSection}
          onSubmit={handleUpdateSection}
          isLoading={updateSectionMutation.isPending}
        />
      )}

      {/* Create Item Dialog */}
      {selectedSection && (
        <CreateItemDialog
          isOpen={isCreateItemDialogOpen}
          onClose={() => {
            setIsCreateItemDialogOpen(false);
            setSelectedSection(null);
          }}
          sectionId={selectedSection.id}
          onSubmit={handleCreateItem}
          isLoading={createItemMutation.isPending}
        />
      )}

      {/* Edit Item Dialog */}
      {selectedItem && (
        <EditItemDialog
          isOpen={isEditItemDialogOpen}
          onClose={() => {
            setIsEditItemDialogOpen(false);
            setSelectedItem(null);
          }}
          item={selectedItem}
          onSubmit={handleUpdateItem}
          isLoading={updateItemMutation.isPending}
        />
      )}
    </div>
  );
}

// Section Card Component
function SectionCard({
  section,
  isExpanded,
  onToggleExpanded,
  onEdit,
  onDelete,
  onCreateItem,
  onEditItem,
  onDeleteItem,
}: {
  section: FaqSectionData;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreateItem: () => void;
  onEditItem: (item: FaqItemData) => void;
  onDeleteItem: (itemId: number, sectionId: number) => void;
}) {
  const { data: sectionData, isLoading } = useFaqSection(section.id);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleExpanded}
              className="h-8 w-8"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <div className="flex-1">
              <CardTitle className="text-xl">{section.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {section.itemsCount}{" "}
                {section.itemsCount === 1 ? "item" : "items"}
                {" • "}
                Slug: {section.slug}
              </p>
            </div>
            <Badge variant={section.isVisible ? "default" : "secondary"}>
              {section.isVisible ? (
                <>
                  <Eye className="w-3 h-3 mr-1" />
                  Visible
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3 mr-1" />
                  Hidden
                </>
              )}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={onCreateItem}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : sectionData && sectionData.items.length > 0 ? (
            <div className="space-y-3">
              {sectionData.items.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-4 flex items-start justify-between"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-2">
                      {item.question}
                    </h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.answer}
                    </p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        Order: {item.order}
                      </Badge>
                      {item.isVisible ? (
                        <Badge variant="default" className="text-xs">
                          <Eye className="w-3 h-3 mr-1" />
                          Visible
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <EyeOff className="w-3 h-3 mr-1" />
                          Hidden
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditItem(item)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteItem(item.id, item.sectionId)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No items in this section yet. Click "Add Item" to create one.
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Create Section Dialog
function CreateSectionDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateFaqSectionInput) => void;
  isLoading: boolean;
}) {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [order, setOrder] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ slug, title, order, isVisible });
    setSlug("");
    setTitle("");
    setOrder(0);
    setIsVisible(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create FAQ Section</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="for-sellers"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL-friendly identifier (e.g., "for-sellers", "for-customers")
            </p>
          </div>
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="For Sellers"
              required
            />
          </div>
          <div>
            <Label htmlFor="order">Order</Label>
            <Input
              id="order"
              type="number"
              value={order}
              onChange={(e) => setOrder(Number.parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isVisible"
              checked={isVisible}
              onCheckedChange={(checked) => setIsVisible(checked as boolean)}
            />
            <Label htmlFor="isVisible">Visible</Label>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Edit Section Dialog
function EditSectionDialog({
  isOpen,
  onClose,
  section,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  section: FaqSectionData;
  onSubmit: (data: UpdateFaqSectionInput) => void;
  isLoading: boolean;
}) {
  const [slug, setSlug] = useState(section.slug);
  const [title, setTitle] = useState(section.title);
  const [order, setOrder] = useState(section.order);
  const [isVisible, setIsVisible] = useState(section.isVisible);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ id: section.id, slug, title, order, isVisible });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit FAQ Section</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="order">Order</Label>
            <Input
              id="order"
              type="number"
              value={order}
              onChange={(e) => setOrder(Number.parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isVisible"
              checked={isVisible}
              onCheckedChange={(checked) => setIsVisible(checked as boolean)}
            />
            <Label htmlFor="isVisible">Visible</Label>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Create Item Dialog
function CreateItemDialog({
  isOpen,
  onClose,
  sectionId,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  sectionId: number;
  onSubmit: (data: CreateFaqItemInput) => void;
  isLoading: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [order, setOrder] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ sectionId, question, answer, order, isVisible });
    setQuestion("");
    setAnswer("");
    setOrder(0);
    setIsVisible(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create FAQ Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="question">Question *</Label>
            <Input
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="How do I become a seller?"
              required
            />
          </div>
          <div>
            <Label htmlFor="answer">Answer *</Label>
            <Textarea
              id="answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="1. Click on the Register button..."
              rows={10}
              required
            />
          </div>
          <div>
            <Label htmlFor="order">Order</Label>
            <Input
              id="order"
              type="number"
              value={order}
              onChange={(e) => setOrder(Number.parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isVisible"
              checked={isVisible}
              onCheckedChange={(checked) => setIsVisible(checked as boolean)}
            />
            <Label htmlFor="isVisible">Visible</Label>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Edit Item Dialog
function EditItemDialog({
  isOpen,
  onClose,
  item,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: FaqItemData;
  onSubmit: (data: UpdateFaqItemInput) => void;
  isLoading: boolean;
}) {
  const [question, setQuestion] = useState(item.question);
  const [answer, setAnswer] = useState(item.answer);
  const [order, setOrder] = useState(item.order);
  const [isVisible, setIsVisible] = useState(item.isVisible);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ id: item.id, question, answer, order, isVisible });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit FAQ Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="question">Question *</Label>
            <Input
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="answer">Answer *</Label>
            <Textarea
              id="answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={10}
              required
            />
          </div>
          <div>
            <Label htmlFor="order">Order</Label>
            <Input
              id="order"
              type="number"
              value={order}
              onChange={(e) => setOrder(Number.parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isVisible"
              checked={isVisible}
              onCheckedChange={(checked) => setIsVisible(checked as boolean)}
            />
            <Label htmlFor="isVisible">Visible</Label>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
