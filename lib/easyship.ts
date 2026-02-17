/**
 * EasyShip API client.
 * Rates: PROD env only (EASYSHIP_API_URL_PROD, EASYSHIP_API_KEY_PROD).
 * Shipments and all other requests: TEST env only so they don't cost money.
 */

const API_VERSION = "2024-09";

// Production — used only for POST /rates (get quotes)
const EASYSHIP_API_URL_PROD =
  process.env.EASYSHIP_API_URL_PROD || "https://public-api.easyship.com";
const EASYSHIP_API_KEY_PROD = process.env.EASYSHIP_API_KEY_PROD;

// Test / sandbox — used for POST /shipments and any other request (no charge)
const EASYSHIP_API_URL_TEST =
  process.env.EASYSHIP_API_URL_TEST || "https://public-api-sandbox.easyship.com";
const EASYSHIP_API_KEY_TEST =
  process.env.EASYSHIP_API_KEY_TEST || process.env.EASYSHIP_API_KEY;

if (!EASYSHIP_API_KEY_PROD) {
  console.warn("EasyShip production API key not set (EASYSHIP_API_KEY_PROD) — rates may fail.");
}
if (!EASYSHIP_API_KEY_TEST) {
  console.warn("EasyShip test API key not set (EASYSHIP_API_KEY_TEST) — shipments may fail.");
}

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
  width: number;
  height: number;
  weight: number; // ounces
}

/** Convert oz -> kg, in -> cm for EasyShip API. Returns weight (kg) and dimensions (cm). */
function parcelToKgAndCm(p: Parcel) {
  const kg = Math.max(0.01, p.weight * 0.0283495);
  const lengthCm = Math.max(0.1, p.length * 2.54);
  const widthCm = Math.max(0.1, p.width * 2.54);
  const heightCm = Math.max(0.1, p.height * 2.54);
  return { kg, lengthCm, widthCm, heightCm };
}

/** Address format for /rates: only fields that match the working API (no line_2, contact_*, company_name). */
function addressToEasyShipRates(addr: Address) {
  const countryAlpha2 = (addr.country || "").toUpperCase().slice(0, 2) || "FI";
  const state =
    countryAlpha2 === "FI"
      ? ""
      : (addr.state ?? "").toString().trim().slice(0, 200);
  const city = (addr.city || "").trim().slice(0, 200);
  const cityNormalized = city ? city.charAt(0).toUpperCase() + city.slice(1).toLowerCase() : "";
  return {
    line_1: (addr.street1 || "Address").trim().slice(0, 35),
    city: cityNormalized || "",
    state,
    postal_code: normalizePostalCode(addr.zip, countryAlpha2),
    country_alpha2: countryAlpha2,
  };
}

/** Parcel for /rates: total_actual_weight + items only (no box). Items: hs_code, actual_weight, quantity, contains_liquids, origin_country_alpha2, declared_customs_value, declared_currency, dimensions. */
function parcelForRates(p: Parcel, originCountryAlpha2 = "FI") {
  const { kg, lengthCm, widthCm, heightCm } = parcelToKgAndCm(p);
  return {
    total_actual_weight: kg,
    items: [
      {
        hs_code: "9403607100",
        actual_weight: kg,
        quantity: 1,
        contains_liquids: false,
        origin_country_alpha2: originCountryAlpha2,
        declared_customs_value: 100,
        declared_currency: "USD",
        dimensions: {
          length: Math.round(lengthCm),
          width: Math.round(widthCm),
          height: Math.round(heightCm),
        },
      },
    ],
  };
}

/** Build parcel payload for create shipment: use items with dimensions. */
function parcelForShipment(p: Parcel, originCountryAlpha2 = "FI") {
  const { kg, lengthCm, widthCm, heightCm } = parcelToKgAndCm(p);
  return {
    total_actual_weight: kg,
    box: null as null,
    items: [
      {
        description: "Package",
        category: "fashion",
        quantity: 1,
        origin_country_alpha2: originCountryAlpha2,
        dimensions: { length: lengthCm, width: widthCm, height: heightCm },
        actual_weight: kg,
        declared_currency: "EUR",
        declared_customs_value: 1,
      },
    ],
  };
}

/**
 * Normalize postal code for EasyShip. Finland (FI) uses 5-digit codes; pad with zeros.
 */
function normalizePostalCode(zip: string | undefined, countryAlpha2: string): string {
  const raw = (zip ?? "").toString().trim();
  if (!raw) return "00100"; // fallback for Finland
  if (countryAlpha2 === "FI") {
    const digits = raw.replace(/\D/g, "");
    if (digits.length <= 5) return digits.padStart(5, "0");
    return digits.slice(0, 5);
  }
  if (countryAlpha2 === "NP") {
    return raw.replace(/\D/g, "").slice(0, 10) || "44600";
  }
  return raw.slice(0, 20);
}

function addressToEasyShip(addr: Address) {
  const countryAlpha2 = (addr.country || "").toUpperCase().slice(0, 2) || "FI";
  // EasyShip Address schema does not allow null for state - use empty string when not applicable (e.g. Finland)
  const state =
    countryAlpha2 === "FI"
      ? ""
      : (addr.state ?? "").toString().trim().slice(0, 200);
  const city = (addr.city || "").trim().slice(0, 200);
  const cityNormalized = city ? city.charAt(0).toUpperCase() + city.slice(1).toLowerCase() : "";
  return {
    line_1: (addr.street1 || "Address").trim().slice(0, 35),
    line_2: addr.street2 ? addr.street2.trim().slice(0, 35) : null,
    city: cityNormalized || "",
    state,
    postal_code: normalizePostalCode(addr.zip, countryAlpha2),
    country_alpha2: countryAlpha2,
    contact_name: (addr.name || "Contact").slice(0, 50),
    contact_phone: addr.phone?.slice(0, 20) ?? null,
    contact_email: addr.email?.slice(0, 50) ?? "contact@example.com",
    company_name: null,
  };
}

export interface EasyShipRate {
  id: string; // courier_service.id
  carrier: string; // umbrella_name
  service: string; // name
  rate: string;
  currency: string;
  estimated_days?: number;
}

export type GetEasyshipRatesResult =
  | { success: true; rates: EasyShipRate[] }
  | { success: false; rates: null; error: string };

/**
 * Get shipping rates from EasyShip (POST /rates).
 */
export async function getEasyshipRates(
  fromAddress: Address,
  toAddress: Address,
  parcel: Parcel
): Promise<GetEasyshipRatesResult> {
  if (!EASYSHIP_API_KEY_PROD) {
    console.error("EasyShip production API key not set (EASYSHIP_API_KEY_PROD)");
    return { success: false, rates: null, error: "EasyShip API key not configured." };
  }

  const originCountry = (fromAddress.country || "FI").toUpperCase().slice(0, 2);
  const parcelPayload = parcelForRates(parcel, originCountry);
  const body = {
    origin_address: addressToEasyShipRates(fromAddress),
    destination_address: addressToEasyShipRates(toAddress),
    parcels: [parcelPayload],
  };

  try {
    const res = await fetch(`${EASYSHIP_API_URL_PROD}/${API_VERSION}/rates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EASYSHIP_API_KEY_PROD}`,
      },
      body: JSON.stringify(body),
    });

    const errText = await res.text();
    if (!res.ok) {
      console.error("EasyShip rates error:", res.status, errText);
      let userMessage = "No shipping rates available for this route.";
      try {
        const errJson = JSON.parse(errText) as {
          error?: { details?: string[]; message?: string };
        };
        const details = errJson?.error?.details;
        if (Array.isArray(details) && details.some((d) => String(d).includes("No shipping solutions"))) {
          userMessage =
            "No shipping solutions available for this address or parcel. Check that origin and destination are in Finland (or Nepal), and that postal codes (e.g. 00100, 00740) and addresses are correct. In sandbox, only limited routes may return rates.";
        }
      } catch {
        // use default userMessage
      }
      return { success: false, rates: null, error: userMessage };
    }

    const data = JSON.parse(errText) as {
      rates?: Array<{
        courier_service?: {
          id: string;
          name: string;
          umbrella_name?: string;
        };
        total_charge?: number;
        shipment_charge_total?: number;
        currency?: string;
        min_delivery_time?: number;
        max_delivery_time?: number;
      }>;
    };

    const rawRates = data.rates ?? [];
    const rates: EasyShipRate[] = rawRates.map((r) => {
      const svc = r.courier_service;
      const charge = r.total_charge ?? r.shipment_charge_total ?? 0;
      const currency = r.currency ?? "EUR";
      // total_charge may be in minor units (cents) for some currencies; use as-is and let UI show
      const rateStr =
        charge >= 1000 && currency !== "JPY" ? (charge / 100).toFixed(2) : String(charge);
      return {
        id: svc?.id ?? "",
        carrier: svc?.umbrella_name ?? svc?.name ?? "",
        service: svc?.name ?? "",
        rate: rateStr,
        currency,
        estimated_days:
          r.min_delivery_time != null && r.max_delivery_time != null
            ? Math.ceil((r.min_delivery_time + r.max_delivery_time) / 2)
            : undefined,
      };
    });
    return { success: true, rates };
  } catch (error) {
    console.error("EasyShip getRates error:", error);
    return {
      success: false,
      rates: null,
      error: error instanceof Error ? error.message : "Failed to get shipping rates.",
    };
  }
}

export interface EasyShipShipmentResult {
  shipment_id: string;
  tracking_number: string;
  courier_name: string;
  label_url: string | null;
  tracking_page_url: string | null;
  total_charge: number;
  currency: string;
}

/**
 * Create shipment and purchase label with the selected rate (POST /shipments).
 */
export async function createEasyshipShipment(
  fromAddress: Address,
  toAddress: Address,
  parcel: Parcel,
  courierServiceId: string
): Promise<EasyShipShipmentResult | null> {
  if (!EASYSHIP_API_KEY_TEST) {
    console.error("EasyShip test API key not set (EASYSHIP_API_KEY_TEST)");
    return null;
  }

  const originCountry = (fromAddress.country || "FI").toUpperCase().slice(0, 2);
  const parcelPayload = parcelForShipment(parcel, originCountry);
  const body = {
    origin_address: addressToEasyShip(fromAddress),
    destination_address: addressToEasyShip(toAddress),
    courier_service_id: courierServiceId,
    parcels: [parcelPayload],
  };

  try {
    const res = await fetch(`${EASYSHIP_API_URL_TEST}/${API_VERSION}/shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EASYSHIP_API_KEY_TEST}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("EasyShip createShipment error:", res.status, errText);
      return null;
    }

    const data = (await res.json()) as {
      shipment?: {
        easyship_shipment_id?: string;
        tracking_page_url?: string;
        courier_service?: { umbrella_name?: string; name?: string };
        trackings?: Array<{ tracking_number?: string }>;
        shipping_documents?: Array<{ url?: string; category?: string }>;
        rates?: Array<{
          total_charge?: number;
          shipment_charge_total?: number;
          currency?: string;
        }>;
      };
    };

    const s = data.shipment;
    if (!s) return null;

    const trackingNumber =
      s.trackings?.[0]?.tracking_number ?? "";
    const labelDoc = s.shipping_documents?.find(
      (d) => d.category === "label" && d.url
    );
    const labelUrl = labelDoc?.url ?? null;
    const rate = s.rates?.[0];
    const totalCharge = rate?.total_charge ?? rate?.shipment_charge_total ?? 0;
    const currency = rate?.currency ?? "EUR";
    const chargeValue =
      totalCharge >= 1000 && currency !== "JPY" ? totalCharge / 100 : totalCharge;

    return {
      shipment_id: s.easyship_shipment_id ?? "",
      tracking_number: trackingNumber,
      courier_name:
        s.courier_service?.umbrella_name ?? s.courier_service?.name ?? "",
      label_url: labelUrl,
      tracking_page_url: s.tracking_page_url ?? null,
      total_charge: chargeValue,
      currency,
    };
  } catch (error) {
    console.error("EasyShip createShipment error:", error);
    return null;
  }
}

/**
 * Generate tracking URL for common carriers (fallback when EasyShip doesn't provide one).
 */
export function generateTrackingUrl(
  carrier: string,
  trackingNumber: string
): string {
  const c = carrier.toLowerCase();
  const urls: Record<string, string> = {
    usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
    fedex: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    ups: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    dhl: `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
    posti: `https://www.posti.fi/en/tracking#/${trackingNumber}`,
    "canada-post": `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${trackingNumber}`,
    "royal-mail": `https://www.royalmail.com/track-your-item#/tracking-results/${trackingNumber}`,
  };
  return (
    urls[c] ??
    `https://www.google.com/search?q=track+${encodeURIComponent(carrier)}+${encodeURIComponent(trackingNumber)}`
  );
}
