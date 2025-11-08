"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
} from "lucide-react";
import {
  getDocumentationTypesWithStatus,
  uploadSellerDocumentation,
} from "../../../actions/documentation";
import toast from "react-hot-toast";

interface DocumentationTypeWithStatus {
  id: string;
  name: string;
  description: string | null;
  exampleUrl: string | null;
  status: "not_uploaded" | "pending" | "approved" | "rejected";
  documentUrl?: string;
  submittedAt?: Date;
  reviewedAt?: Date;
}

interface SellerDocumentationContentProps {
  sellerId: string;
}

export default function SellerDocumentationContent({
  sellerId,
}: SellerDocumentationContentProps) {
  const [documentationTypes, setDocumentationTypes] = useState<
    DocumentationTypeWithStatus[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const loadDocumentationTypes = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getDocumentationTypesWithStatus(sellerId);
      if (result.success && result.result) {
        setDocumentationTypes(result.result);
      } else {
        toast.error(result.error || "Failed to load documentation types");
      }
    } catch (error) {
      console.error("Error loading documentation types:", error);
      toast.error("Failed to load documentation types");
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    loadDocumentationTypes();
  }, [loadDocumentationTypes]);

  const handleFileUpload = async (documentationTypeId: string, file: File) => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PDF, JPEG, PNG, or WebP file");
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    try {
      setUploading(documentationTypeId);

      const formData = new FormData();
      formData.append("sellerId", sellerId);
      formData.append("documentationTypeId", documentationTypeId);
      formData.append("file", file);

      const result = await uploadSellerDocumentation(formData);

      if (result.success) {
        toast.success("Document uploaded successfully");
        await loadDocumentationTypes(); // Refresh the list
      } else {
        toast.error(result.error || "Failed to upload document");
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error("Failed to upload document");
    } finally {
      setUploading(null);
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
        return (
          <Badge
            variant="outline"
            className="bg-gray-100 text-gray-800 border-gray-200"
          >
            <FileText className="w-3 h-3 mr-1" />
            Not Uploaded
          </Badge>
        );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-600";
      case "pending":
        return "text-yellow-600";
      case "rejected":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading documentation...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Documentation</h1>
          <p className="text-gray-600 mt-2">
            Upload required documents to list products in specific categories
          </p>
        </div>

        {/* Documentation Types Grid */}
        <div className="grid gap-6">
          {documentationTypes.map((docType) => (
            <Card key={docType.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      {docType.name}
                    </CardTitle>
                    {docType.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {docType.description}
                      </p>
                    )}
                  </div>
                  <div className="ml-4">{getStatusBadge(docType.status)}</div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Status Information */}
                  {docType.status !== "not_uploaded" && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">
                          Status:
                        </span>
                        <span className={getStatusColor(docType.status)}>
                          {docType.status.charAt(0).toUpperCase() +
                            docType.status.slice(1)}
                        </span>
                      </div>
                      {docType.submittedAt && (
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="text-gray-600">Submitted:</span>
                          <span className="text-gray-700">
                            {new Date(docType.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {docType.reviewedAt && (
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="text-gray-600">Reviewed:</span>
                          <span className="text-gray-700">
                            {new Date(docType.reviewedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Example Link */}
                  {docType.exampleUrl && (
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <a
                        href={docType.exampleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        View Example Document
                      </a>
                    </div>
                  )}

                  {/* Upload Section */}
                  <div className="border-t pt-4">
                    {docType.status === "approved" ? (
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(docType.documentUrl, "_blank")
                          }
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Document
                        </Button>
                        <span className="text-sm text-green-600 font-medium">
                          ✓ Document approved
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="file"
                            id={`file-${docType.id}`}
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(docType.id, file);
                              }
                            }}
                            className="hidden"
                            disabled={uploading === docType.id}
                          />
                          <Button
                            variant="outline"
                            className="w-full justify-start"
                            disabled={uploading === docType.id}
                            onClick={() => {
                              const fileInput = document.getElementById(
                                `file-${docType.id}`
                              ) as HTMLInputElement;
                              if (fileInput) {
                                fileInput.click();
                              }
                            }}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            {uploading === docType.id
                              ? "Uploading..."
                              : docType.status === "not_uploaded"
                                ? "Upload Document"
                                : "Replace Document"}
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                          Accepted formats: PDF, JPEG, PNG, WebP (max 10MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {documentationTypes.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Documentation Types Available
              </h3>
              <p className="text-gray-600">
                Contact an administrator to set up required documentation types.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
