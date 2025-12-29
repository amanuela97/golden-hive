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
  // Note: For payment events, we want to show amount, fee, stripe_checkout_session, and provider
  const sensitiveKeys = [
    "stripeAccountId",
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
  // For payment events, show specific payment details
  const filterSensitiveMetadata = (
    metadata: Record<string, unknown> | null,
    eventType?: string
  ): Record<string, unknown> | null => {
    if (!metadata) return null;

    // For payment events, show specific payment-related fields
    if (eventType === "payment") {
      const paymentFields: Record<string, unknown> = {};
      if (metadata.amount !== undefined) paymentFields.amount = metadata.amount;
      if (metadata.currency !== undefined)
        paymentFields.currency = metadata.currency;
      if (metadata.fee !== undefined) paymentFields.fee = metadata.fee;
      if (metadata.stripe_checkout_session !== undefined) {
        paymentFields.stripe_checkout_session =
          metadata.stripe_checkout_session;
      }
      if (metadata.provider !== undefined)
        paymentFields.provider = metadata.provider;
      return Object.keys(paymentFields).length > 0 ? paymentFields : null;
    }

    // For other events, filter out sensitive keys
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      // Check if key contains any sensitive keywords (case-insensitive)
      const isSensitive = sensitiveKeys.some(
        (sensitiveKey) =>
          key.toLowerCase().includes(sensitiveKey.toLowerCase()) ||
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
              const filteredMetadata = filterSensitiveMetadata(
                event.metadata,
                event.type
              );
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
                            ([key, value], index) => {
                              // Format key for display (convert snake_case to Title Case)
                              const displayKey = key
                                .split("_")
                                .map(
                                  (word) =>
                                    word.charAt(0).toUpperCase() + word.slice(1)
                                )
                                .join(" ");

                              // Format value for display
                              let displayValue: string;
                              if (
                                event.type === "payment" &&
                                key === "amount" &&
                                filteredMetadata.currency
                              ) {
                                displayValue = `${filteredMetadata.currency} ${parseFloat(String(value)).toFixed(2)}`;
                              } else if (
                                event.type === "payment" &&
                                key === "fee" &&
                                filteredMetadata.currency
                              ) {
                                displayValue = `${filteredMetadata.currency} ${parseFloat(String(value)).toFixed(2)}`;
                              } else if (
                                typeof value === "object" &&
                                value !== null
                              ) {
                                displayValue = JSON.stringify(value, null, 2);
                              } else {
                                displayValue = String(value);
                              }

                              return (
                                <div key={index} className="space-y-1">
                                  <p className="text-xs font-semibold text-foreground">
                                    {displayKey}:
                                  </p>
                                  <p className="text-xs text-muted-foreground break-words">
                                    {displayValue}
                                  </p>
                                </div>
                              );
                            }
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
