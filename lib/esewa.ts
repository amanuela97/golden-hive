import crypto from "crypto";

const ESEWA_TEST_BASE = "https://rc-epay.esewa.com.np";
const ESEWA_PROD_BASE = "https://epay.esewa.com.np";

export function getEsewaBaseUrl(): string {
  const env = process.env.ESEWA_ENV || "test";
  return env === "production" ? ESEWA_PROD_BASE : ESEWA_TEST_BASE;
}

/**
 * Build signature for eSewa ePay v2.
 * Message format: "total_amount={amount},transaction_uuid={uuid},product_code={code}"
 * Sign with HMAC-SHA256(secret), then Base64 encode.
 */
export function buildEsewaSignature(
  totalAmount: string,
  transactionUuid: string,
  productCode: string,
  secretKey: string
): string {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest("base64");
  return signature;
}

/**
 * Build form payload for eSewa ePay v2.
 * Amounts are in NPR (smallest unit might be rupees; check eSewa docs - often total_amount is in rupees with 2 decimals as string).
 */
export function buildEsewaPaymentPayload(params: {
  totalAmount: string; // e.g. "100.00" (NPR)
  transactionUuid: string;
  productCode: string;
  productName: string;
  successUrl: string;
  failureUrl: string;
  amount?: string; // optional breakdown
  taxAmount?: string;
  productServiceCharge?: string;
  productDeliveryCharge?: string;
}): Record<string, string> {
  const secretKey = process.env.ESEWA_SECRET_KEY;
  if (!secretKey) {
    throw new Error("ESEWA_SECRET_KEY is not set");
  }
  const productCode = process.env.ESEWA_PRODUCT_CODE || params.productCode || "EPAYTEST";
  const signature = buildEsewaSignature(
    params.totalAmount,
    params.transactionUuid,
    productCode,
    secretKey
  );
  const baseUrl = getEsewaBaseUrl();
  const formUrl = `${baseUrl}/api/epay/main/v2/form`;

  return {
    amount: params.amount ?? params.totalAmount,
    tax_amount: params.taxAmount ?? "0",
    total_amount: params.totalAmount,
    transaction_uuid: params.transactionUuid,
    product_code: productCode,
    product_service_charge: params.productServiceCharge ?? "0",
    product_delivery_charge: params.productDeliveryCharge ?? "0",
    success_url: params.successUrl,
    failure_url: params.failureUrl,
    signed_field_names: "total_amount,transaction_uuid,product_code",
    signature,
    form_action_url: formUrl,
  };
}

/**
 * Verify callback data from eSewa (success redirect).
 * eSewa may send base64-encoded query params (e.g. data, signature).
 * Verify signature if they provide it; decode data to get transaction details.
 */
export function verifyEsewaCallback(data: string, signature?: string): {
  valid: boolean;
  transactionUuid?: string;
  totalAmount?: string;
  status?: string;
  refId?: string;
} {
  try {
    const decoded = Buffer.from(data, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded) as Record<string, string>;
    const secretKey = process.env.ESEWA_SECRET_KEY;
    if (signature && secretKey && parsed.transaction_uuid && parsed.total_amount) {
      const productCode = process.env.ESEWA_PRODUCT_CODE || "EPAYTEST";
      const expectedSig = buildEsewaSignature(
        parsed.total_amount,
        parsed.transaction_uuid,
        productCode,
        secretKey
      );
      if (expectedSig !== signature) {
        return { valid: false };
      }
    }
    return {
      valid: true,
      transactionUuid: parsed.transaction_uuid,
      totalAmount: parsed.total_amount,
      status: parsed.status,
      refId: parsed.ref_id ?? parsed.reference_id,
    };
  } catch {
    return { valid: false };
  }
}

export function getEsewaFormSubmitUrl(): string {
  return `${getEsewaBaseUrl()}/api/epay/main/v2/form`;
}
