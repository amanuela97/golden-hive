"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Mail,
  Send,
  Users,
  Filter,
  Plus,
  Eye,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";

interface Announcement {
  id: string;
  title: string;
  content: string;
  targetAudience: "all" | "admins" | "sellers" | "customers" | "custom";
  customEmails?: string[];
  status: "draft" | "scheduled" | "sent" | "failed";
  scheduledAt?: string;
  sentAt?: string;
  recipientCount: number;
  createdAt: string;
  createdBy: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  category: "announcement" | "notification" | "welcome" | "password_reset";
  createdAt: string;
}

export default function CommunicationTools() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      id: "1",
      title: "System Maintenance Notice",
      content:
        "We will be performing scheduled maintenance on our servers this weekend. The system will be unavailable from 2 AM to 6 AM EST on Sunday.",
      targetAudience: "all",
      status: "sent",
      sentAt: "2024-01-15T10:00:00Z",
      recipientCount: 167,
      createdAt: "2024-01-15T09:30:00Z",
      createdBy: "Jane Smith",
    },
    {
      id: "2",
      title: "New Feature Release",
      content:
        "We're excited to announce the release of our new product management features. Check out the updated dashboard for enhanced functionality.",
      targetAudience: "sellers",
      status: "scheduled",
      scheduledAt: "2024-01-22T14:00:00Z",
      recipientCount: 15,
      createdAt: "2024-01-20T11:00:00Z",
      createdBy: "John Doe",
    },
    {
      id: "3",
      title: "Welcome to Golden Market",
      content:
        "Welcome to our platform! We're glad to have you as part of our community. Explore our features and start managing your products today.",
      targetAudience: "custom",
      customEmails: ["newuser@example.com"],
      status: "draft",
      recipientCount: 1,
      createdAt: "2024-01-20T15:30:00Z",
      createdBy: "Jane Smith",
    },
  ]);

  const [templates] = useState<EmailTemplate[]>([
    {
      id: "1",
      name: "Welcome Email",
      subject: "Welcome to Golden Market!",
      content:
        "Dear {{name}},\n\nWelcome to Golden Market! We're excited to have you join our community.\n\nBest regards,\nThe Golden Market Team",
      category: "welcome",
      createdAt: "2024-01-01T00:00:00Z",
    },
    {
      id: "2",
      name: "System Maintenance",
      subject: "Scheduled System Maintenance",
      content:
        "Dear {{name}},\n\nWe will be performing scheduled maintenance on {{date}} from {{startTime}} to {{endTime}}.\n\nThank you for your understanding.\n\nThe Golden Market Team",
      category: "announcement",
      createdAt: "2024-01-01T00:00:00Z",
    },
    {
      id: "3",
      name: "Feature Update",
      subject: "New Features Available",
      content:
        "Dear {{name}},\n\nWe're excited to announce new features that will enhance your experience:\n\n{{features}}\n\nLog in to explore these updates!\n\nThe Golden Market Team",
      category: "notification",
      createdAt: "2024-01-01T00:00:00Z",
    },
  ]);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);

  const handleCreateAnnouncement = async (
    announcementData: Omit<Announcement, "id" | "createdAt" | "createdBy">
  ) => {
    try {
      const newAnnouncement: Announcement = {
        id: Date.now().toString(),
        ...announcementData,
        createdAt: new Date().toISOString(),
        createdBy: "Current Admin", // Replace with actual admin name
      };

      setAnnouncements((prev) => [newAnnouncement, ...prev]);
      toast.success("Announcement created successfully");
      setIsCreateDialogOpen(false);
    } catch (error) {
      toast.error("Failed to create announcement");
    }
  };

  const handleSendAnnouncement = async (announcementId: string) => {
    try {
      setAnnouncements((prev) =>
        prev.map((announcement) =>
          announcement.id === announcementId
            ? {
                ...announcement,
                status: "sent" as const,
                sentAt: new Date().toISOString(),
              }
            : announcement
        )
      );
      toast.success("Announcement sent successfully");
    } catch (error) {
      toast.error("Failed to send announcement");
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) {
      return;
    }

    try {
      setAnnouncements((prev) =>
        prev.filter((announcement) => announcement.id !== announcementId)
      );
      toast.success("Announcement deleted successfully");
    } catch (error) {
      toast.error("Failed to delete announcement");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "scheduled":
        return <Clock className="w-4 h-4 text-blue-600" />;
      case "draft":
        return <Edit className="w-4 h-4 text-gray-600" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Mail className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-green-100 text-green-800";
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Communication Tools</h2>
          <p className="text-gray-600">
            Send announcements and manage email communications
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog
            open={isTemplateDialogOpen}
            onOpenChange={setIsTemplateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Templates
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Email Templates</DialogTitle>
              </DialogHeader>
              <EmailTemplatesList templates={templates} />
            </DialogContent>
          </Dialog>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Announcement</DialogTitle>
              </DialogHeader>
              <CreateAnnouncementForm
                templates={templates}
                onSubmit={handleCreateAnnouncement}
                onCancel={() => setIsCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Sent</p>
                <p className="text-2xl font-bold text-gray-900">
                  {announcements.filter((a) => a.status === "sent").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recipients</p>
                <p className="text-2xl font-bold text-gray-900">
                  {announcements.reduce((sum, a) => sum + a.recipientCount, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Scheduled</p>
                <p className="text-2xl font-bold text-gray-900">
                  {announcements.filter((a) => a.status === "scheduled").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Edit className="w-6 h-6 text-gray-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Drafts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {announcements.filter((a) => a.status === "draft").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Announcements List */}
      <Card>
        <CardHeader>
          <CardTitle>Announcements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-4 p-6">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{announcement.title}</h3>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getStatusColor(announcement.status)}`}
                      >
                        {announcement.status}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                      {announcement.content}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Target: {announcement.targetAudience}</span>
                      <span>Recipients: {announcement.recipientCount}</span>
                      <span>Created: {formatDate(announcement.createdAt)}</span>
                      {announcement.sentAt && (
                        <span>Sent: {formatDate(announcement.sentAt)}</span>
                      )}
                      {announcement.scheduledAt && (
                        <span>
                          Scheduled: {formatDate(announcement.scheduledAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {announcement.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => handleSendAnnouncement(announcement.id)}
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Send
                      </Button>
                    )}
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteAnnouncement(announcement.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Create Announcement Form Component
function CreateAnnouncementForm({
  templates,
  onSubmit,
  onCancel,
}: {
  templates: EmailTemplate[];
  onSubmit: (
    data: Omit<Announcement, "id" | "createdAt" | "createdBy">
  ) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    targetAudience: "all" as
      | "all"
      | "admins"
      | "sellers"
      | "customers"
      | "custom",
    customEmails: "",
    scheduledAt: "",
    status: "draft" as const,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const announcementData: Omit<
      Announcement,
      "id" | "createdAt" | "createdBy"
    > = {
      title: formData.title,
      content: formData.content,
      targetAudience: formData.targetAudience,
      customEmails:
        formData.targetAudience === "custom"
          ? formData.customEmails.split(",").map((email) => email.trim())
          : undefined,
      status: formData.scheduledAt ? "scheduled" : "draft",
      scheduledAt: formData.scheduledAt || undefined,
      recipientCount:
        formData.targetAudience === "custom"
          ? formData.customEmails.split(",").length
          : formData.targetAudience === "all"
            ? 167
            : formData.targetAudience === "admins"
              ? 3
              : formData.targetAudience === "sellers"
                ? 15
                : 149,
    };

    onSubmit(announcementData);
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setFormData((prev) => ({
        ...prev,
        title: template.subject,
        content: template.content,
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="template">Use Template (Optional)</Label>
        <Select onValueChange={handleTemplateSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Select a template" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, title: e.target.value }))
          }
          required
        />
      </div>

      <div>
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          value={formData.content}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, content: e.target.value }))
          }
          rows={6}
          required
        />
      </div>

      <div>
        <Label htmlFor="targetAudience">Target Audience</Label>
        <Select
          value={formData.targetAudience}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              targetAudience: value as
                | "all"
                | "admins"
                | "sellers"
                | "customers"
                | "custom",
            }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="admins">Admins Only</SelectItem>
            <SelectItem value="sellers">Sellers Only</SelectItem>
            <SelectItem value="customers">Customers Only</SelectItem>
            <SelectItem value="custom">Custom Email List</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.targetAudience === "custom" && (
        <div>
          <Label htmlFor="customEmails">
            Email Addresses (comma-separated)
          </Label>
          <Textarea
            id="customEmails"
            value={formData.customEmails}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, customEmails: e.target.value }))
            }
            placeholder="user1@example.com, user2@example.com"
            rows={3}
          />
        </div>
      )}

      <div>
        <Label htmlFor="scheduledAt">Schedule (Optional)</Label>
        <Input
          id="scheduledAt"
          type="datetime-local"
          value={formData.scheduledAt}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, scheduledAt: e.target.value }))
          }
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {formData.scheduledAt ? "Schedule" : "Save Draft"}
        </Button>
      </div>
    </form>
  );
}

// Email Templates List Component
function EmailTemplatesList({ templates }: { templates: EmailTemplate[] }) {
  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <div key={template.id} className="border rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold">{template.name}</h3>
                <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                  {template.category.replace("_", " ")}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Subject:</strong> {template.subject}
              </p>
              <p className="text-sm text-gray-600 line-clamp-3">
                <strong>Content:</strong> {template.content}
              </p>
            </div>
            <div className="flex gap-2 ml-4">
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
