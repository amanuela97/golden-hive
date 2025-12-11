"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getDocumentationTypesWithStatus,
  uploadSellerDocumentation,
} from "../../../actions/documentation";
import { CheckCircle, XCircle, Clock, Upload, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";

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

  useEffect(() => {
    loadDocumentationTypes();
  }, [sellerId]);

  const loadDocumentationTypes = async () => {
    setLoading(true);
    try {
      const result = await getDocumentationTypesWithStatus(sellerId);
      if (result.success && result.result) {
        setDocumentationTypes(result.result);
      } else {
        toast.error(result.error || "Failed to load documentation types");
      }
    } catch (error) {
      toast.error("Failed to load documentation types");
      console.error("Error loading documentation types:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (
    documentationTypeId: string,
    file: File | null
  ) => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setUploading(documentationTypeId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sellerId", sellerId);
      formData.append("documentationTypeId", documentationTypeId);

      const result = await uploadSellerDocumentation(formData);
      if (result.success) {
        toast.success(result.message || "Document uploaded successfully");
        loadDocumentationTypes();
      } else {
        toast.error(result.error || "Failed to upload document");
      }
    } catch (error) {
      toast.error("Failed to upload document");
      console.error("Error uploading document:", error);
    } finally {
      setUploading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending Review
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <FileText className="w-3 h-3 mr-1" />
            Not Uploaded
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Documentation</h1>
        <p className="text-gray-600 mt-2">
          Upload required documentation for your products
        </p>
      </div>

      <div className="grid gap-6">
        {documentationTypes.map((docType) => (
          <Card key={docType.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{docType.name}</CardTitle>
                  {docType.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {docType.description}
                    </p>
                  )}
                </div>
                {getStatusBadge(docType.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {docType.exampleUrl && (
                  <div>
                    <Label>Example</Label>
                    <a
                      href={docType.exampleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm block mt-1"
                    >
                      View example document
                    </a>
                  </div>
                )}

                {docType.documentUrl && (
                  <div>
                    <Label>Uploaded Document</Label>
                    <a
                      href={docType.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm block mt-1"
                    >
                      View uploaded document
                    </a>
                    {docType.submittedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted: {new Date(docType.submittedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <Label htmlFor={`file-${docType.id}`}>
                    {docType.status === "not_uploaded" ? "Upload" : "Replace"} Document
                  </Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      id={`file-${docType.id}`}
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) =>
                        handleFileUpload(docType.id, e.target.files?.[0] || null)
                      }
                      disabled={uploading === docType.id}
                    />
                    {uploading === docType.id && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {documentationTypes.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">No documentation types available.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

