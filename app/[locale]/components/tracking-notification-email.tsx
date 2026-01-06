interface OrderItem {
  title: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  sku?: string | null;
  listingId?: string | null;
  listingSlug?: string | null;
}

interface TrackingNotificationEmailProps {
  orderNumber: string;
  customerName: string;
  trackingUrl: string;
  carrier: string;
  trackingNumber: string;
  estimatedDelivery?: string;
  items?: OrderItem[];
  currency?: string;
  subtotal?: string;
  discount?: string;
  shipping?: string;
  tax?: string;
  total?: string;
}

export default function TrackingNotificationEmail({
  orderNumber,
  customerName,
  trackingUrl,
  carrier,
  trackingNumber,
  estimatedDelivery,
  items,
  currency = "USD",
  subtotal,
  discount,
  shipping,
  tax,
  total,
}: TrackingNotificationEmailProps) {
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
          Your Order Has Shipped! 📦
        </h1>
        <p style={{ color: "#666", margin: 0, fontSize: "14px" }}>
          Order #{orderNumber}
        </p>
      </div>

      <div style={{ marginBottom: "30px" }}>
        <p style={{ color: "#333", margin: "0 0 10px 0" }}>
          Hi {customerName},
        </p>
        <p style={{ color: "#666", lineHeight: "1.6" }}>
          Great news! Your order has been shipped and is on its way to you.
        </p>
      </div>

      {/* Tracking Info */}
      <div
        style={{
          background: "#f8f9fa",
          padding: "20px",
          borderRadius: "8px",
          marginBottom: "30px",
        }}
      >
        <p
          style={{
            margin: "0 0 10px 0",
            fontWeight: "bold",
            color: "#333",
          }}
        >
          Tracking Information
        </p>
        <p style={{ margin: "0 0 5px 0", color: "#666", fontSize: "14px" }}>
          <strong>Carrier:</strong> {carrier}
        </p>
        <p style={{ margin: "0 0 15px 0", color: "#666", fontSize: "14px" }}>
          <strong>Tracking Number:</strong> {trackingNumber}
        </p>
        {estimatedDelivery && (
          <p style={{ margin: "0 0 15px 0", color: "#666", fontSize: "14px" }}>
            <strong>Estimated Delivery:</strong> {estimatedDelivery}
          </p>
        )}
        <a
          href={trackingUrl}
          style={{
            display: "inline-block",
            padding: "12px 24px",
            backgroundColor: "#007bff",
            color: "#ffffff",
            textDecoration: "none",
            borderRadius: "6px",
            fontWeight: "bold",
          }}
        >
          Track Your Package
        </a>
      </div>

      {/* Order Items */}
      {items && items.length > 0 && (
        <div style={{ marginBottom: "30px" }}>
          <h2
            style={{
              color: "#333",
              margin: "0 0 15px 0",
              fontSize: "18px",
              fontWeight: "bold",
            }}
          >
            Order Items
          </h2>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "20px",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 0",
                    color: "#666",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  Item
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "10px 0",
                    color: "#666",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  Qty
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 0",
                    color: "#666",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  Price
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 0",
                    color: "#666",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr
                  key={index}
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <td style={{ padding: "10px 0", color: "#333" }}>
                    {item.title}
                    {item.sku && (
                      <span
                        style={{
                          display: "block",
                          fontSize: "12px",
                          color: "#999",
                          marginTop: "4px",
                        }}
                      >
                        SKU: {item.sku}
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      padding: "10px 0",
                      color: "#666",
                    }}
                  >
                    {item.quantity}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "10px 0",
                      color: "#666",
                    }}
                  >
                    {currency} {parseFloat(item.unitPrice).toFixed(2)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "10px 0",
                      color: "#333",
                      fontWeight: "bold",
                    }}
                  >
                    {currency} {parseFloat(item.lineTotal).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Summary */}
      {(subtotal || discount || shipping || tax || total) && (
        <div
          style={{
            background: "#f8f9fa",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "30px",
          }}
        >
          <h3
            style={{
              color: "#333",
              margin: "0 0 15px 0",
              fontSize: "16px",
              fontWeight: "bold",
            }}
          >
            Order Summary
          </h3>
          {subtotal && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
                fontSize: "14px",
                color: "#666",
              }}
            >
              <span>Subtotal:</span>
              <span>
                {currency} {parseFloat(subtotal).toFixed(2)}
              </span>
            </div>
          )}
          {discount && parseFloat(discount) > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
                fontSize: "14px",
                color: "#666",
              }}
            >
              <span>Discount:</span>
              <span style={{ color: "#28a745" }}>
                -{currency} {parseFloat(discount).toFixed(2)}
              </span>
            </div>
          )}
          {shipping && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
                fontSize: "14px",
                color: "#666",
              }}
            >
              <span>Shipping:</span>
              <span>
                {currency} {parseFloat(shipping).toFixed(2)}
              </span>
            </div>
          )}
          {tax && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
                fontSize: "14px",
                color: "#666",
              }}
            >
              <span>Tax:</span>
              <span>
                {currency} {parseFloat(tax).toFixed(2)}
              </span>
            </div>
          )}
          {total && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "15px",
                paddingTop: "15px",
                borderTop: "2px solid #e0e0e0",
                fontSize: "16px",
                fontWeight: "bold",
                color: "#333",
              }}
            >
              <span>Total:</span>
              <span>
                {currency} {parseFloat(total).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: "20px" }}>
        <p style={{ color: "#999", fontSize: "12px", lineHeight: "1.6" }}>
          If you have any questions, please don&apos;t hesitate to contact us.
        </p>
      </div>
    </div>
  );
}
