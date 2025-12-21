"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";

interface OrderEvent {
  id: string;
  type: string;
  visibility: string;
  message: string;
  metadata: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: Date;
}

interface OrderTimelineProps {
  orderId: string;
  events: OrderEvent[];
  userRole: "admin" | "seller" | "customer";
}

export function OrderTimeline({
  orderId, // Reserved for future comment functionality
  events,
  userRole,
}: OrderTimelineProps) {
  // Suppress unused variable warning - orderId will be used for comment functionality
  void orderId;
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const isInternal = userRole === "admin" || userRole === "seller";

  // List of sensitive keys to filter out from metadata
  const sensitiveKeys = [
    "stripePaymentIntentId",
    "stripeCheckoutSessionId",
    "stripeAccountId",
    "paymentIntentId",
    "checkoutSessionId",
    "apiKey",
    "secret",
    "token",
    "password",
    "creditCard",
    "cvv",
    "ssn",
    "socialSecurityNumber",
  ];

  // Filter sensitive information from metadata
  const filterSensitiveMetadata = (
    metadata: Record<string, unknown> | null
  ): Record<string, unknown> | null => {
    if (!metadata) return null;

    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      // Check if key contains any sensitive keywords (case-insensitive)
      const isSensitive = sensitiveKeys.some(
        (sensitiveKey) =>
          key.toLowerCase().includes(sensitiveKey.toLowerCase()) ||
          key.toLowerCase().includes("stripe") ||
          key.toLowerCase().includes("payment") ||
          key.toLowerCase().includes("secret")
      );

      if (!isSensitive) {
        filtered[key] = value;
      }
    }

    return Object.keys(filtered).length > 0 ? filtered : null;
  };

  const toggleEvent = (eventId: string) => {
    setExpandedEvents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  // Filter events based on visibility
  const visibleEvents = isInternal
    ? events // Show all events for admin/seller
    : events.filter((event) => event.visibility === "customer"); // Only customer-visible events

  const handleSubmitComment = async () => {
    if (!comment.trim()) return;

    setSubmitting(true);
    try {
      // TODO: Implement createOrderEvent server action
      toast("Comment functionality coming soon");
      setComment("");
    } catch (error: unknown) {
      console.error("Failed to add comment", error);
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "payment":
        return "💳";
      case "fulfillment":
        return "📦";
      case "refund":
        return "↩️";
      case "system":
        return "⚙️";
      case "comment":
        return "💬";
      case "email":
        return "📧";
      default:
        return "•";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <CardTitle>Timeline</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comment Composer (Internal only) */}
        {isInternal && (
          <div className="space-y-2 pb-4 border-b">
            <Textarea
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSubmitComment}
                disabled={!comment.trim() || submitting}
                size="sm"
              >
                <Send className="mr-2 h-4 w-4" />
                Add Comment
              </Button>
            </div>
          </div>
        )}

        {/* Events List */}
        <div className="space-y-4">
          {visibleEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No events yet
            </p>
          ) : (
            visibleEvents.map((event) => {
              const isExpanded = expandedEvents.has(event.id);
              const filteredMetadata = filterSensitiveMetadata(event.metadata);
              const hasMetadata =
                filteredMetadata && Object.keys(filteredMetadata).length > 0;

              return (
                <div
                  key={event.id}
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleEvent(event.id)}
                          className="flex-1 text-left flex items-center gap-2 group"
                          disabled={!hasMetadata}
                        >
                          <p className="text-sm font-medium group-hover:text-primary transition-colors">
                            {event.message}
                          </p>
                          {hasMetadata && (
                            <span className="text-muted-foreground">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </span>
                          )}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          {format(
                            new Date(event.createdAt),
                            "MMM dd, yyyy HH:mm"
                          )}
                        </p>
                      </div>

                      {/* Collapsible Metadata */}
                      {isExpanded && hasMetadata && (
                        <div className="pl-11 pt-2 space-y-3 border-t">
                          {Object.entries(filteredMetadata).map(
                            ([key, value], index) => (
                              <div key={index} className="space-y-1">
                                <p className="text-xs font-semibold text-foreground">
                                  {key}
                                </p>
                                <p className="text-xs text-muted-foreground break-words">
                                  {typeof value === "object" && value !== null
                                    ? JSON.stringify(value, null, 2)
                                    : String(value)}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
