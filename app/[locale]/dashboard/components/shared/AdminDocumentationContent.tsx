"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  getAllSubmittedDocuments,
  reviewSellerDocumentation,
} from "../../../actions/documentation";
import { CheckCircle, XCircle, Clock, FileText } from "lucide-react";
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

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const result = await getAllSubmittedDocuments();
      if (result.success && result.result) {
        setDocuments(result.result);
      } else {
        toast.error(result.error || "Failed to load documents");
      }
    } catch (error) {
      toast.error("Failed to load documents");
      console.error("Error loading documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (docId: string, action: "approve" | "reject") => {
    try {
      const result = await reviewSellerDocumentation(docId, action);
      if (result.success) {
        toast.success(result.message || `Document ${action}d successfully`);
        loadDocuments();
      } else {
        toast.error(result.error || `Failed to ${action} document`);
      }
    } catch (error) {
      toast.error(`Failed to ${action} document`);
      console.error(`Error ${action}ing document:`, error);
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
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
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
        <h1 className="text-3xl font-bold">Documentation Management</h1>
        <p className="text-gray-600 mt-2">
          Review and manage seller documentation submissions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Submitted Documents ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No documents submitted yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{doc.sellerName}</div>
                        <div className="text-sm text-muted-foreground">
                          {doc.sellerEmail}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{doc.documentTypeName}</TableCell>
                    <TableCell>{getStatusBadge(doc.status)}</TableCell>
                    <TableCell>
                      {new Date(doc.submittedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <a
                          href={doc.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm"
                        >
                          View
                        </a>
                        {doc.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReview(doc.id, "approve")}
                              className="text-green-600 hover:text-green-700"
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReview(doc.id, "reject")}
                              className="text-red-600 hover:text-red-700"
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
