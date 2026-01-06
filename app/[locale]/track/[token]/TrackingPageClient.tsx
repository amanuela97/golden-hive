"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { getPublicTrackingInfo } from "@/app/[locale]/actions/tracking";

interface TrackingEvent {
  occurred_at: string;
  description: string;
  city_locality?: string;
  state_province?: string;
  postal_code?: string;
  country_code?: string;
}

interface Shipment {
  id: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
  estimatedDelivery?: string | null;
  actualDelivery?: string | null;
  events: TrackingEvent[];
}

interface TrackingData {
  orderNumber: string;
  customerName: string;
  status: string;
  fulfillmentStatus: string;
  shipments: Shipment[];
}

export default function TrackingPageClient({
  trackingData: initialData,
  token,
}: {
  trackingData: TrackingData;
  token: string;
}) {
  const [trackingData, setTrackingData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await getPublicTrackingInfo(token);
      if (result.success && result.data) {
        setTrackingData(result.data);
      }
    } catch (error) {
      console.error("Failed to refresh tracking:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("delivered")) {
      return "bg-green-100 text-green-800";
    }
    if (statusLower.includes("transit") || statusLower.includes("shipped")) {
      return "bg-blue-100 text-blue-800";
    }
    if (statusLower.includes("exception") || statusLower.includes("failed")) {
      return "bg-red-100 text-red-800";
    }
    return "bg-yellow-100 text-yellow-800";
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Order Tracking</h1>
            <p className="text-gray-600">Order #{trackingData.orderNumber}</p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <div className="flex gap-2">
          <Badge className={getStatusColor(trackingData.fulfillmentStatus)}>
            {trackingData.fulfillmentStatus}
          </Badge>
          <Badge variant="outline">{trackingData.status}</Badge>
        </div>
      </div>

      {/* Shipments */}
      <div className="space-y-6">
        {trackingData.shipments.map((shipment, index) => (
          <Card key={shipment.id} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-gray-600" />
                <div>
                  <h3 className="font-semibold text-lg">
                    Shipment{" "}
                    {trackingData.shipments.length > 1 ? index + 1 : ""}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {shipment.carrier || "Unknown Carrier"}
                  </p>
                </div>
              </div>
              <Badge className={getStatusColor(shipment.status)}>
                {shipment.status}
              </Badge>
            </div>

            {shipment.trackingNumber ? (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Tracking Number</p>
                <div className="flex items-center justify-between">
                  <code className="text-sm font-mono">
                    {shipment.trackingNumber}
                  </code>
                  {shipment.trackingUrl && (
                    <a
                      href={shipment.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                    >
                      Track on carrier site
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  <strong>{shipment.carrier || "Vendor"}:</strong> Not shipped
                  yet
                </p>
              </div>
            )}

            {/* Delivery Dates */}
            {(shipment.estimatedDelivery || shipment.actualDelivery) && (
              <div className="mb-4 flex gap-4">
                {shipment.estimatedDelivery && !shipment.actualDelivery && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">Estimated:</span>
                    <span className="font-medium">
                      {format(
                        new Date(shipment.estimatedDelivery),
                        "MMM dd, yyyy"
                      )}
                    </span>
                  </div>
                )}
                {shipment.actualDelivery && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span className="text-gray-600">Delivered:</span>
                    <span className="font-medium text-green-700">
                      {format(
                        new Date(shipment.actualDelivery),
                        "MMM dd, yyyy"
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Tracking Events */}
            {shipment.events && shipment.events.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-3">Tracking History</h4>
                <div className="space-y-3">
                  {shipment.events.map((event, eventIndex) => (
                    <div
                      key={eventIndex}
                      className="flex gap-3 pb-3 border-b last:border-b-0"
                    >
                      <div className="flex-shrink-0">
                        <div className="h-2 w-2 rounded-full bg-blue-600 mt-2"></div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {event.description}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                          <span>
                            {format(
                              new Date(event.occurred_at),
                              "MMM dd, yyyy 'at' h:mm a"
                            )}
                          </span>
                          {(event.city_locality || event.state_province) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {[
                                event.city_locality,
                                event.state_province,
                                event.country_code,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Help Section */}
      <Card className="mt-8 p-6 bg-gray-50">
        <h3 className="font-semibold mb-2">Need Help?</h3>
        <p className="text-sm text-gray-600">
          If you have questions about your order, please contact our support
          team with your order number: {trackingData.orderNumber}
        </p>
      </Card>
    </div>
  );
}
