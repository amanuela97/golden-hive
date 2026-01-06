import EasyPost from "@easypost/api";

// Use sandbox key in development, production key in production
const EASYPOST_API_KEY = process.env.EASYPOST_API_KEY_TEST;

if (!EASYPOST_API_KEY) {
  console.warn("EasyPost API key not configured");
}

// Initialize EasyPost client
const api = new EasyPost(EASYPOST_API_KEY || "");

export interface Address {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface Parcel {
  length: number; // inches
  width: number; // inches
  height: number; // inches
  weight: number; // ounces
}

export interface TrackingInfo {
  tracking_code: string;
  carrier: string;
  status: string;
  status_detail?: string;
  est_delivery_date?: string;
  carrier_detail?: {
    service?: string;
    container_type?: string;
  };
  tracking_details: Array<{
    datetime: string;
    message: string;
    status?: string;
    status_detail?: string;
    location?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  }>;
  public_url?: string;
}

export interface ShipmentInfo {
  id: string;
  tracking_code: string;
  carrier: string;
  service: string;
  rate: number;
  label_url: string;
  tracking_url?: string;
  public_url?: string;
}

export interface ShippingRate {
  id: string;
  carrier: string;
  service: string;
  rate: string; // Price as string
  currency: string;
  estimated_days?: number;
}

/**
 * Get shipping rates for a shipment (without purchasing)
 */
export async function getShippingRates(
  toAddress: Address,
  fromAddress: Address,
  parcel: Parcel
): Promise<ShippingRate[] | null> {
  try {
    // Validate parcel dimensions
    if (
      parcel.weight <= 0 ||
      parcel.length <= 0 ||
      parcel.width <= 0 ||
      parcel.height <= 0
    ) {
      console.error("Invalid parcel dimensions:", parcel);
      return [];
    }

    // Prepare addresses - EasyPost format
    // For US: state is required and should be uppercase 2-letter code
    // For non-US: state should be omitted or empty string
    interface PreparedAddress {
      name: string;
      street1: string;
      street2?: string;
      city: string;
      zip: string;
      country: string;
      state?: string;
      phone?: string;
    }

    const preparedFromAddress: PreparedAddress = {
      name: fromAddress.name,
      street1: fromAddress.street1,
      city: fromAddress.city,
      zip: fromAddress.zip,
      country: fromAddress.country,
    };

    // Only include state for US addresses
    if (fromAddress.country === "US") {
      preparedFromAddress.state = fromAddress.state.toUpperCase();
    } else if (fromAddress.state && fromAddress.state.trim() !== "") {
      // For non-US, include state only if provided (some countries use it)
      preparedFromAddress.state = fromAddress.state;
    }

    if (fromAddress.street2) {
      preparedFromAddress.street2 = fromAddress.street2;
    }

    // Add phone number if provided (required by some carriers like FedEx)
    if (fromAddress.phone && fromAddress.phone.trim() !== "") {
      preparedFromAddress.phone = fromAddress.phone.trim();
    }

    const preparedToAddress: PreparedAddress = {
      name: toAddress.name,
      street1: toAddress.street1,
      city: toAddress.city,
      zip: toAddress.zip,
      country: toAddress.country,
    };

    // Only include state for US addresses
    if (toAddress.country === "US") {
      preparedToAddress.state = toAddress.state.toUpperCase();
    } else if (toAddress.state && toAddress.state.trim() !== "") {
      // For non-US, include state only if provided
      preparedToAddress.state = toAddress.state;
    }

    if (toAddress.street2) {
      preparedToAddress.street2 = toAddress.street2;
    }

    // Add phone number if provided (required by some carriers like FedEx)
    if (toAddress.phone && toAddress.phone.trim() !== "") {
      preparedToAddress.phone = toAddress.phone.trim();
    }

    console.log("Creating EasyPost shipment with:", {
      from: preparedFromAddress,
      to: preparedToAddress,
      parcel,
    });

    const shipment = await api.Shipment.create({
      to_address: preparedToAddress,
      from_address: preparedFromAddress,
      parcel: {
        length: parcel.length,
        width: parcel.width,
        height: parcel.height,
        weight: parcel.weight,
      },
    });

    // Check for errors in shipment
    const errorMessages = shipment.messages || [];
    const hasRateErrors = errorMessages.some(
      (msg) => msg.type === "rate_error"
    );

    console.log("EasyPost shipment created:", {
      id: shipment.id,
      ratesCount: shipment.rates?.length || 0,
      rates: shipment.rates?.map((r) => ({
        carrier: r.carrier,
        service: r.service,
        rate: r.rate,
      })),
      messages: errorMessages,
      hasRateErrors,
    });

    if (errorMessages.length > 0) {
      console.warn("EasyPost shipment messages:", errorMessages);

      // Log specific carrier errors for debugging (filter out expected errors)
      errorMessages.forEach((msg) => {
        if (msg.type === "rate_error") {
          const carrier = "carrier" in msg ? String(msg.carrier) : "unknown";
          const message =
            "message" in msg ? String(msg.message) : "Unknown error";

          // Filter out expected errors
          const isExpectedError =
            (carrier === "CanadaPost" &&
              message.includes("originating outside of Canada")) ||
            (carrier === "DhlEcs" &&
              message.includes("merchant_id is required")); // DHL requires special EasyPost account configuration

          if (!isExpectedError) {
            console.warn(`Carrier ${carrier} error: ${message}`);
          } else if (carrier === "DhlEcs") {
            // Log DHL error as info (requires EasyPost account configuration)
            console.info(
              `DHL rates unavailable: merchant_id configuration required in EasyPost account. This is expected if DHL is not fully configured.`
            );
          }
        }
      });
    }

    // If no rates and we have rate errors, it's likely a carrier configuration issue
    if ((!shipment.rates || shipment.rates.length === 0) && hasRateErrors) {
      const isInternational =
        fromAddress.country !== toAddress.country ||
        (fromAddress.country !== "US" && toAddress.country !== "US");

      if (isInternational) {
        console.warn(
          `No shipping rates available for international shipment from ${fromAddress.country} to ${toAddress.country}. This may require international carriers to be configured in your EasyPost account.`
        );
      }
    }

    // Return all available rates
    return (shipment.rates || []).map((rate) => ({
      id: rate.id,
      carrier: rate.carrier || "",
      service: rate.service || "",
      rate: rate.rate || "0",
      currency: rate.currency || "USD",
      estimated_days: rate.delivery_days,
    }));
  } catch (error) {
    console.error("EasyPost shipping rates error:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }
    return null;
  }
}

/**
 * Purchase a shipment using a specific rate ID
 */
export async function purchaseShipmentWithRate(
  shipmentId: string,
  rateId: string
): Promise<ShipmentInfo | null> {
  try {
    const shipment = await api.Shipment.retrieve(shipmentId);
    const rate = shipment.rates.find((r) => r.id === rateId);

    if (!rate) {
      console.error("Rate not found:", rateId);
      return null;
    }

    const boughtShipment = await api.Shipment.buy(shipmentId, rate);

    return {
      id: boughtShipment.id,
      tracking_code: boughtShipment.tracking_code || "",
      carrier: boughtShipment.selected_rate?.carrier || "",
      service: boughtShipment.selected_rate?.service || "",
      rate: boughtShipment.selected_rate?.rate
        ? parseFloat(boughtShipment.selected_rate.rate)
        : 0,
      label_url: boughtShipment.postage_label?.label_url || "",
      tracking_url: boughtShipment.tracker?.public_url,
      public_url: boughtShipment.tracker?.public_url,
    };
  } catch (error) {
    console.error("EasyPost shipment purchase error:", error);
    return null;
  }
}

/**
 * Create a shipment in EasyPost
 */
export async function createShipment(
  toAddress: Address,
  fromAddress: Address,
  parcel: Parcel
): Promise<ShipmentInfo | null> {
  try {
    const shipment = await api.Shipment.create({
      to_address: toAddress,
      from_address: fromAddress,
      parcel: parcel,
    });

    // Purchase label using lowest rate (sandbox test)
    const boughtShipment = await api.Shipment.buy(
      shipment.id,
      shipment.lowestRate()
    );

    return {
      id: boughtShipment.id,
      tracking_code: boughtShipment.tracking_code || "",
      carrier: boughtShipment.selected_rate?.carrier || "",
      service: boughtShipment.selected_rate?.service || "",
      rate: boughtShipment.selected_rate?.rate
        ? parseFloat(boughtShipment.selected_rate.rate)
        : 0,
      label_url: boughtShipment.postage_label?.label_url || "",
      tracking_url: boughtShipment.tracker?.public_url,
      public_url: boughtShipment.tracker?.public_url,
    };
  } catch (error) {
    console.error("EasyPost shipment creation error:", error);
    return null;
  }
}

/**
 * Track a shipment using EasyPost
 * In test mode, only test tracking numbers (EZ1000000001, etc.) are valid.
 * For real tracking numbers in test mode, we return basic info with carrier tracking URL.
 */
export async function trackShipment(
  trackingCode: string,
  carrier?: string
): Promise<TrackingInfo | null> {
  try {
    const isTestMode = process.env.NODE_ENV !== "production";
    const isTestTrackingNumber = /^EZ\d+$/.test(trackingCode);

    // In test mode, if tracking number is not a test number, skip EasyPost tracking
    if (isTestMode && !isTestTrackingNumber) {
      console.log(
        `[EasyPost] Test mode: Skipping EasyPost tracking for real tracking number ${trackingCode}. Use carrier's tracking URL instead.`
      );

      // Return basic tracking info with carrier tracking URL
      return {
        tracking_code: trackingCode,
        carrier: carrier || "",
        status: "in_transit", // Default status
        status_detail: undefined,
        est_delivery_date: undefined,
        carrier_detail: undefined,
        tracking_details: [],
        public_url: carrier
          ? generateTrackingUrl(carrier, trackingCode)
          : undefined,
      };
    }

    const tracker = await api.Tracker.create({
      tracking_code: trackingCode,
      carrier: carrier, // optional, can auto-detect
    });

    return {
      tracking_code: tracker.tracking_code || trackingCode,
      carrier: tracker.carrier || carrier || "",
      status: tracker.status || "unknown",
      status_detail: tracker.status_detail,
      est_delivery_date: tracker.est_delivery_date,
      carrier_detail: tracker.carrier_detail,
      tracking_details: (tracker.tracking_details || []).map((detail) => {
        // Handle tracking_location - EasyPost returns ITrackingLocation object
        const trackingLocation = detail.tracking_location as
          | { city?: string; state?: string; zip?: string; country?: string }
          | undefined;

        const locationString = trackingLocation
          ? [
              trackingLocation.city,
              trackingLocation.state,
              trackingLocation.zip,
            ]
              .filter(Boolean)
              .join(", ") || undefined
          : undefined;

        return {
          datetime: detail.datetime || "",
          message: detail.message || "",
          status: detail.status ? String(detail.status) : undefined,
          status_detail: detail.status_detail,
          location: locationString,
          city: trackingLocation?.city,
          state: trackingLocation?.state,
          zip: trackingLocation?.zip,
          country: trackingLocation?.country,
        };
      }),
      public_url: tracker.public_url,
    };
  } catch (error) {
    // Check if it's the test mode error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("test mode") ||
      errorMessage.includes("test tracking numbers")
    ) {
      console.log(
        `[EasyPost] Test mode error for tracking ${trackingCode}: ${errorMessage}. Falling back to carrier tracking URL.`
      );

      // Return basic tracking info with carrier tracking URL
      return {
        tracking_code: trackingCode,
        carrier: carrier || "",
        status: "in_transit", // Default status
        status_detail: undefined,
        est_delivery_date: undefined,
        carrier_detail: undefined,
        tracking_details: [],
        public_url: carrier
          ? generateTrackingUrl(carrier, trackingCode)
          : undefined,
      };
    }

    console.error("EasyPost tracking error:", error);
    return null;
  }
}

/**
 * Map EasyPost status to your internal fulfillment status
 */
export function mapEasyPostStatus(
  status: string
): "pending" | "shipped" | "in_transit" | "delivered" | "exception" {
  const statusLower = status.toLowerCase();

  if (statusLower.includes("delivered")) {
    return "delivered";
  }
  if (statusLower.includes("in_transit") || statusLower.includes("transit")) {
    return "in_transit";
  }
  if (statusLower.includes("shipped") || statusLower.includes("pre_transit")) {
    return "shipped";
  }
  if (
    statusLower.includes("exception") ||
    statusLower.includes("error") ||
    statusLower.includes("failure")
  ) {
    return "exception";
  }
  return "pending";
}

/**
 * Generate tracking URL for common carriers (fallback if EasyPost doesn't provide)
 */
export function generateTrackingUrl(
  carrier: string,
  trackingNumber: string
): string {
  const carrierLower = carrier.toLowerCase();

  const trackingUrls: Record<string, string> = {
    usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
    fedex: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    ups: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    dhl: `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
    "canada-post": `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${trackingNumber}`,
    "royal-mail": `https://www.royalmail.com/track-your-item#/tracking-results/${trackingNumber}`,
  };

  return (
    trackingUrls[carrierLower] ||
    `https://www.google.com/search?q=track+${carrier}+${trackingNumber}`
  );
}

/**
 * Create a webhook for tracking updates
 */
export async function createTrackingWebhook(
  webhookUrl: string
): Promise<{ id: string } | null> {
  try {
    const webhook = await api.Webhook.create({
      url: webhookUrl,
    });

    return { id: webhook.id };
  } catch (error) {
    console.error("Failed to create EasyPost webhook:", error);
    return null;
  }
}
