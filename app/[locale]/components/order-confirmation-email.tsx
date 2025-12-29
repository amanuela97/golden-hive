interface OrderConfirmationEmailProps {
  orderNumber: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
    sku?: string | null;
    listingId?: string | null;
    listingSlug?: string | null;
    storeId?: string | null;
    storeSlug?: string | null;
    orderId?: string | null; // Order ID for this specific item (for multi-store orders)
  }>;
  subtotal: string;
  discount: string;
  shipping: string;
  tax: string;
  total: string;
  currency: string;
  paymentStatus: "pending" | "paid";
  orderStatus: "open" | "fulfilled" | "cancelled";
  shippingAddress?: {
    name?: string | null;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  orderUrl?: string;
}

export default function OrderConfirmationEmail({
  orderNumber,
  orderId,
  customerName,
  customerEmail,
  items,
  subtotal,
  discount,
  shipping,
  tax,
  total,
  currency,
  paymentStatus,
  orderStatus,
  shippingAddress,
  orderUrl,
}: OrderConfirmationEmailProps) {
  const formatCurrency = (amount: string) => {
    return `${parseFloat(amount).toFixed(2)} ${currency}`;
  };

  const hasShippingAddress =
    shippingAddress &&
    (shippingAddress.line1 || shippingAddress.city || shippingAddress.country);

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
        backgroundColor: "#ffffff",
      }}
    >
      <div style={{ marginBottom: "30px" }}>
        <h1 style={{ color: "#333", margin: "0 0 10px 0" }}>
          Order Confirmation #{orderNumber}
        </h1>
        <p style={{ color: "#666", margin: 0, fontSize: "14px" }}>
          Thank you for your order!
        </p>
      </div>

      <div style={{ marginBottom: "30px" }}>
        <p style={{ color: "#333", margin: "0 0 10px 0" }}>
          Dear {customerName},
        </p>
        <p style={{ color: "#666", lineHeight: "1.6" }}>
          We&apos;ve received your order and are processing it now. You&apos;ll
          receive another email when your order ships.
        </p>
      </div>

      {/* Order Status */}
      <div
        style={{
          background: paymentStatus === "paid" ? "#d4edda" : "#fff3cd",
          padding: "15px",
          margin: "20px 0",
          borderRadius: "5px",
          border: `1px solid ${
            paymentStatus === "paid" ? "#c3e6cb" : "#ffeaa7"
          }`,
        }}
      >
        <p style={{ margin: 0, fontWeight: "bold", color: "#333" }}>
          Order Status:{" "}
          <span style={{ textTransform: "capitalize" }}>{orderStatus}</span>
        </p>
        <p style={{ margin: "5px 0 0 0", color: "#666" }}>
          Payment Status:{" "}
          <span style={{ textTransform: "capitalize", fontWeight: "bold" }}>
            {paymentStatus}
          </span>
        </p>
      </div>

      {/* Order Items */}
      <div style={{ marginBottom: "30px" }}>
        <h2 style={{ color: "#333", fontSize: "18px", marginBottom: "15px" }}>
          Order Items
        </h2>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            margin: "20px 0",
            backgroundColor: "#ffffff",
          }}
        >
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                Item
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "center",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                Qty
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "right",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                Price
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "right",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                Total
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "center",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                Review
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const baseUrl =
                process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
              // Use item's orderId if available (for multi-store orders), otherwise fall back to main orderId
              const itemOrderId = item.orderId || orderId;
              const reviewUrl = item.listingId
                ? `${baseUrl}/review?order=${itemOrderId}&product=${item.listingId}`
                : null;

              return (
                <tr key={idx}>
                  <td
                    style={{
                      padding: "12px",
                      border: "1px solid #ddd",
                      fontSize: "14px",
                    }}
                  >
                    <div>{item.title}</div>
                    {item.sku && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#666",
                          marginTop: "4px",
                        }}
                      >
                        SKU: {item.sku}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      textAlign: "center",
                      border: "1px solid #ddd",
                      fontSize: "14px",
                    }}
                  >
                    {item.quantity}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      textAlign: "right",
                      border: "1px solid #ddd",
                      fontSize: "14px",
                    }}
                  >
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      textAlign: "right",
                      border: "1px solid #ddd",
                      fontSize: "14px",
                      fontWeight: "bold",
                    }}
                  >
                    {formatCurrency(item.lineTotal)}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      textAlign: "center",
                      border: "1px solid #ddd",
                      fontSize: "14px",
                    }}
                  >
                    {reviewUrl && paymentStatus === "paid" ? (
                      <a
                        href={reviewUrl}
                        style={{
                          color: "#007bff",
                          textDecoration: "none",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      >
                        ⭐ Review
                      </a>
                    ) : (
                      <span style={{ color: "#999", fontSize: "12px" }}>
                        {paymentStatus === "paid" ? "—" : "After payment"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Order Summary */}
      <div
        style={{
          background: "#f9f9f9",
          padding: "20px",
          borderRadius: "5px",
          marginBottom: "30px",
        }}
      >
        <h2 style={{ color: "#333", fontSize: "18px", marginBottom: "15px" }}>
          Order Summary
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td
                style={{
                  padding: "8px 0",
                  color: "#666",
                  fontSize: "14px",
                }}
              >
                Subtotal:
              </td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  color: "#333",
                  fontSize: "14px",
                }}
              >
                {formatCurrency(subtotal)}
              </td>
            </tr>
            {parseFloat(discount) > 0 && (
              <tr>
                <td
                  style={{
                    padding: "8px 0",
                    color: "#666",
                    fontSize: "14px",
                  }}
                >
                  Discount:
                </td>
                <td
                  style={{
                    padding: "8px 0",
                    textAlign: "right",
                    color: "#28a745",
                    fontSize: "14px",
                  }}
                >
                  -{formatCurrency(discount)}
                </td>
              </tr>
            )}
            {parseFloat(shipping) > 0 && (
              <tr>
                <td
                  style={{
                    padding: "8px 0",
                    color: "#666",
                    fontSize: "14px",
                  }}
                >
                  Shipping:
                </td>
                <td
                  style={{
                    padding: "8px 0",
                    textAlign: "right",
                    color: "#333",
                    fontSize: "14px",
                  }}
                >
                  {formatCurrency(shipping)}
                </td>
              </tr>
            )}
            {parseFloat(tax) > 0 && (
              <tr>
                <td
                  style={{
                    padding: "8px 0",
                    color: "#666",
                    fontSize: "14px",
                  }}
                >
                  Tax:
                </td>
                <td
                  style={{
                    padding: "8px 0",
                    textAlign: "right",
                    color: "#333",
                    fontSize: "14px",
                  }}
                >
                  {formatCurrency(tax)}
                </td>
              </tr>
            )}
            <tr
              style={{
                borderTop: "2px solid #333",
                marginTop: "10px",
              }}
            >
              <td
                style={{
                  padding: "12px 0",
                  fontWeight: "bold",
                  color: "#333",
                  fontSize: "16px",
                }}
              >
                Total:
              </td>
              <td
                style={{
                  padding: "12px 0",
                  textAlign: "right",
                  fontWeight: "bold",
                  color: "#333",
                  fontSize: "16px",
                }}
              >
                {formatCurrency(total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Shipping Address */}
      {hasShippingAddress && (
        <div style={{ marginBottom: "30px" }}>
          <h2 style={{ color: "#333", fontSize: "18px", marginBottom: "15px" }}>
            Shipping Address
          </h2>
          <div
            style={{
              background: "#f9f9f9",
              padding: "15px",
              borderRadius: "5px",
              fontSize: "14px",
              lineHeight: "1.6",
              color: "#333",
            }}
          >
            {shippingAddress.name && (
              <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                {shippingAddress.name}
              </div>
            )}
            {shippingAddress.line1 && <div>{shippingAddress.line1}</div>}
            {shippingAddress.line2 && <div>{shippingAddress.line2}</div>}
            <div>
              {shippingAddress.city && `${shippingAddress.city}, `}
              {shippingAddress.region && `${shippingAddress.region} `}
              {shippingAddress.postalCode && `${shippingAddress.postalCode}`}
            </div>
            {shippingAddress.country && <div>{shippingAddress.country}</div>}
          </div>
        </div>
      )}

      {/* Review CTA Section */}
      {paymentStatus === "paid" && items.some((item) => item.listingId) && (
        <div
          style={{
            background: "#f8f9fa",
            padding: "20px",
            borderRadius: "5px",
            margin: "30px 0",
            textAlign: "center",
          }}
        >
          <h2 style={{ color: "#333", fontSize: "18px", marginBottom: "10px" }}>
            ⭐ How was your experience?
          </h2>
          <p style={{ color: "#666", marginBottom: "15px", fontSize: "14px" }}>
            We&apos;d love to hear your feedback! Leave a review for your
            purchase.
          </p>
          {items
            .filter((item) => item.listingId)
            .slice(0, 3)
            .map((item, idx) => {
              const baseUrl =
                process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
              // Use item's orderId if available (for multi-store orders), otherwise fall back to main orderId
              const itemOrderId = item.orderId || orderId;
              const reviewUrl = `${baseUrl}/review?order=${itemOrderId}&product=${item.listingId}`;
              return (
                <a
                  key={idx}
                  href={reviewUrl}
                  style={{
                    display: "inline-block",
                    margin: "5px",
                    padding: "10px 20px",
                    background: "#ffc107",
                    color: "#333",
                    textDecoration: "none",
                    borderRadius: "5px",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  Review{" "}
                  {item.title.length > 20
                    ? `${item.title.substring(0, 20)}...`
                    : item.title}
                </a>
              );
            })}
        </div>
      )}

      {/* Order URL */}
      {orderUrl && (
        <div style={{ textAlign: "center", margin: "30px 0" }}>
          <a
            href={orderUrl}
            style={{
              display: "inline-block",
              padding: "15px 30px",
              background: "#007bff",
              color: "white",
              textDecoration: "none",
              borderRadius: "5px",
              fontWeight: "bold",
              fontSize: "16px",
            }}
          >
            View Order Details
          </a>
        </div>
      )}

      <div
        style={{
          marginTop: "30px",
          paddingTop: "20px",
          borderTop: "1px solid #ddd",
          color: "#666",
          fontSize: "12px",
        }}
      >
        <p style={{ margin: "0 0 10px 0" }}>
          If you have any questions about your order, please contact us at{" "}
          <a
            href="mailto:support@goldenhive.com"
            style={{ color: "#007bff", textDecoration: "none" }}
          >
            support@goldenhive.com
          </a>
          .
        </p>
        <p style={{ margin: 0 }}>
          Order #{orderNumber} • {customerEmail}
        </p>
      </div>
    </div>
  );
}
