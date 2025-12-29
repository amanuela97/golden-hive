interface OrderInvoicePdfEmailProps {
  invoiceNumber: string;
  orderNumber: number;
  customerName: string;
  totalAmount: string;
  currency: string;
  customMessage?: string | null;
  invoicePdfUrl?: string | null;
}

export default function OrderInvoicePdfEmail({
  invoiceNumber,
  orderNumber,
  customerName,
  totalAmount,
  currency,
  customMessage,
  invoicePdfUrl,
}: OrderInvoicePdfEmailProps) {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ color: "#333" }}>Invoice {invoiceNumber}</h1>

      <p>Dear {customerName},</p>

      <p>Please find your invoice PDF for Order #{orderNumber} below.</p>

      {customMessage && (
        <div
          style={{
            background: "#f5f5f5",
            padding: "15px",
            margin: "20px 0",
            borderRadius: "5px",
          }}
        >
          <p style={{ margin: 0 }}>{customMessage}</p>
        </div>
      )}

      <div
        style={{
          background: "#f9f9f9",
          padding: "20px",
          margin: "20px 0",
          borderRadius: "5px",
        }}
      >
        <p style={{ margin: "0 0 10px 0", fontSize: "16px" }}>
          <strong>Total Amount:</strong> {parseFloat(totalAmount).toFixed(2)}{" "}
          {currency}
        </p>
        <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
          Order Number: #{orderNumber}
        </p>
      </div>

      {invoicePdfUrl && (
        <div style={{ margin: "20px 0", textAlign: "center" }}>
          <p style={{ marginBottom: "10px" }}>Download your invoice:</p>
          <a
            href={invoicePdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "#6b7280",
              color: "white",
              textDecoration: "none",
              borderRadius: "5px",
              fontWeight: "bold",
            }}
          >
            Download Invoice PDF
          </a>
        </div>
      )}

      <p style={{ color: "#666", fontSize: "12px", marginTop: "30px" }}>
        This invoice PDF is for your records. If you have any questions, please
        contact us.
      </p>
    </div>
  );
}
