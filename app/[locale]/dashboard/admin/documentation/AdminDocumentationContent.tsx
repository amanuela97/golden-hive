"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  User,
  FileText,
  Calendar,
  Mail,
  Settings,
  Edit,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import {
  getAllSubmittedDocuments,
  reviewSellerDocumentation,
  adminUpdateSellerDocumentation,
  adminDeleteSellerDocumentation,
} from "../../../actions/documentation";
import DocumentationTypeManager from "./DocumentationTypeManager";
import toast from "react-hot-toast";

interface SubmittedDocument {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  documentationTypeId: string;
  documentTypeName: string;
  documentUrl: string;
  status: string;
  submittedAt: Date;
  reviewedAt: Date | null;
}

export default function AdminDocumentationContent() {
  const [documents, setDocuments] = useState<SubmittedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<SubmittedDocument | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const result = await getAllSubmittedDocuments();
      if (result.success && result.result) {
        setDocuments(result.result);
      } else {
        toast.error(result.error || "Failed to load documents");
      }
    } catch (error) {
      console.error("Error loading documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (docId: string, action: "approve" | "reject") => {
    try {
      setReviewing(docId);
      const result = await reviewSellerDocumentation(docId, action);

      if (result.success) {
        toast.success(`Document ${action}d successfully`);
        await loadDocuments(); // Refresh the list
      } else {
        toast.error(result.error || `Failed to ${action} document`);
      }
    } catch (error) {
      console.error(`Error ${action}ing document:`, error);
      toast.error(`Failed to ${action} document`);
    } finally {
      setReviewing(null);
    }
  };

  const handleDeleteDocument = async (document: SubmittedDocument) => {
    try {
      const result = await adminDeleteSellerDocumentation(document.id);
      if (result.success) {
        toast.success("Document deleted successfully");
        setDeleteDialogOpen(false);
        setDocumentToDelete(null);
        await loadDocuments(); // Refresh the list
      } else {
        toast.error(result.error || "Failed to delete document");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  const handleRejectApprovedDocument = async (docId: string) => {
    try {
      setReviewing(docId);
      const result = await adminUpdateSellerDocumentation(docId, {
        status: "rejected",
        reviewedAt: new Date(),
      });

      if (result.success) {
        toast.success("Document rejected successfully");
        await loadDocuments(); // Refresh the list
      } else {
        toast.error(result.error || "Failed to reject document");
      }
    } catch (error) {
      console.error("Error rejecting document:", error);
      toast.error("Failed to reject document");
    } finally {
      setReviewing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge
            variant="default"
            className="bg-green-100 text-green-800 border-green-200"
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="default"
            className="bg-yellow-100 text-yellow-800 border-yellow-200"
          >
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="destructive"
            className="bg-red-100 text-red-800 border-red-200"
          >
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    if (filter === "all") return true;
    return doc.status === filter;
  });

  const pendingCount = documents.filter(
    (doc) => doc.status === "pending"
  ).length;
  const approvedCount = documents.filter(
    (doc) => doc.status === "approved"
  ).length;
  const rejectedCount = documents.filter(
    (doc) => doc.status === "rejected"
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading documents...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Documentation Management
          </h1>
          <p className="text-gray-600 mt-2">
            Manage documentation types and review seller-submitted documents.
          </p>
        </div>

        <Tabs defaultValue="review" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="review" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Document Review
            </TabsTrigger>
            <TabsTrigger value="types" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Documentation Types
            </TabsTrigger>
          </TabsList>

          <TabsContent value="types" className="mt-6">
            <DocumentationTypeManager />
          </TabsContent>

          <TabsContent value="review" className="mt-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">
                        Total Documents
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {documents.length}
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
                      <p className="text-sm font-medium text-gray-600">
                        Pending Review
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {pendingCount}
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
                      <p className="text-sm font-medium text-gray-600">
                        Approved
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {approvedCount}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <XCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">
                        Rejected
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {rejectedCount}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 mb-6">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                All ({documents.length})
              </Button>
              <Button
                variant={filter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("pending")}
              >
                Pending ({pendingCount})
              </Button>
              <Button
                variant={filter === "approved" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("approved")}
              >
                Approved ({approvedCount})
              </Button>
              <Button
                variant={filter === "rejected" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("rejected")}
              >
                Rejected ({rejectedCount})
              </Button>
            </div>

            {/* Documents List */}
            <div className="space-y-4">
              {filteredDocuments.map((doc) => (
                <Card key={doc.id} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {doc.documentTypeName}
                          </h3>
                          {getStatusBadge(doc.status)}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              Seller:
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {doc.sellerName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              Email:
                            </span>
                            <span className="text-sm text-gray-900">
                              {doc.sellerEmail}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              Submitted:
                            </span>
                            <span className="text-sm text-gray-900">
                              {new Date(doc.submittedAt).toLocaleDateString()}
                            </span>
                          </div>
                          {doc.reviewedAt && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-500" />
                              <span className="text-sm text-gray-600">
                                Reviewed:
                              </span>
                              <span className="text-sm text-gray-900">
                                {new Date(doc.reviewedAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 ml-6">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(doc.documentUrl, "_blank")}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Document
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {doc.status === "pending" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleReview(doc.id, "approve")}
                                  disabled={reviewing === doc.id}
                                  className="text-green-600"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleReview(doc.id, "reject")}
                                  disabled={reviewing === doc.id}
                                  className="text-red-600"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            
                            {doc.status === "approved" && (
                              <DropdownMenuItem
                                onClick={() => handleRejectApprovedDocument(doc.id)}
                                disabled={reviewing === doc.id}
                                className="text-red-600"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject (Override)
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem
                              onClick={() => {
                                setDocumentToDelete(doc);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Empty State */}
            {filteredDocuments.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Documents Found
                  </h3>
                  <p className="text-gray-600">
                    {filter === "all"
                      ? "No documents have been submitted yet."
                      : `No documents with status "${filter}" found.`}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone and will remove the document from both the database and Cloudinary.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDocumentToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => documentToDelete && handleDeleteDocument(documentToDelete)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
