interface OrderCancellationEmailProps {
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  cancellationReason: string;
  total: string;
  currency: string;
}

export default function OrderCancellationEmail({
  orderNumber,
  customerName,
  customerEmail,
  cancellationReason,
  total,
  currency,
}: OrderCancellationEmailProps) {
  const formatCurrency = (amount: string) => {
    return `${parseFloat(amount).toFixed(2)} ${currency}`;
  };

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
          Order #{orderNumber} Cancelled
        </h1>
        <p style={{ color: "#666", margin: 0, fontSize: "14px" }}>
          We&apos;re sorry to inform you that your order has been cancelled.
        </p>
      </div>

      <div style={{ marginBottom: "30px" }}>
        <p style={{ color: "#333", margin: "0 0 10px 0" }}>
          Dear {customerName},
        </p>
        <p style={{ color: "#666", lineHeight: "1.6" }}>
          We regret to inform you that your order #{orderNumber} has been
          cancelled.
        </p>
      </div>

      {/* Cancellation Reason */}
      <div
        style={{
          background: "#fff3cd",
          padding: "15px",
          margin: "20px 0",
          borderRadius: "5px",
          border: "1px solid #ffeaa7",
        }}
      >
        <p style={{ margin: 0, fontWeight: "bold", color: "#333" }}>
          Cancellation Reason:
        </p>
        <p style={{ margin: "5px 0 0 0", color: "#666" }}>
          {cancellationReason}
        </p>
      </div>

      {/* Order Details */}
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
                Order Number:
              </td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  color: "#333",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                #{orderNumber}
              </td>
            </tr>
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
                Total Amount:
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

      {/* Refund Information */}
      <div
        style={{
          background: "#e7f3ff",
          padding: "15px",
          margin: "20px 0",
          borderRadius: "5px",
          border: "1px solid #b3d9ff",
        }}
      >
        <p style={{ margin: 0, fontWeight: "bold", color: "#333" }}>
          Refund Information
        </p>
        <p style={{ margin: "5px 0 0 0", color: "#666", fontSize: "14px" }}>
          If you were charged for this order, a refund will be processed
          according to our refund policy. Please allow 5-10 business days for
          the refund to appear in your account.
        </p>
      </div>

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
          If you have any questions about this cancellation, please contact us
          at{" "}
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
