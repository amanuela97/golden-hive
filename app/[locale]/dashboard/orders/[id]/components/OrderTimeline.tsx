"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send } from "lucide-react";
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
  orderId,
  events,
  userRole,
}: OrderTimelineProps) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isInternal = userRole === "admin" || userRole === "seller";

  // Filter events based on visibility
  const visibleEvents = isInternal
    ? events // Show all events for admin/seller
    : events.filter((event) => event.visibility === "customer"); // Only customer-visible events

  const handleSubmitComment = async () => {
    if (!comment.trim()) return;

    setSubmitting(true);
    try {
      // TODO: Implement createOrderEvent server action
      toast.info("Comment functionality coming soon");
      setComment("");
    } catch (error) {
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
            visibleEvents.map((event) => (
              <div key={event.id} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{event.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(event.createdAt), "MMM dd, yyyy HH:mm")}
                    </p>
                  </div>
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {JSON.stringify(event.metadata, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

