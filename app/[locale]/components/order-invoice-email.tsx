interface OrderInvoiceEmailProps {
  invoiceNumber: string;
  orderNumber: number;
  customerName: string;
  totalAmount: string;
  currency: string;
  paymentUrl: string;
  customMessage?: string | null;
  invoicePdfUrl?: string | null;
  expiresAt?: Date;
}

export default function OrderInvoiceEmail({
  invoiceNumber,
  orderNumber,
  customerName,
  totalAmount,
  currency,
  paymentUrl,
  customMessage,
  invoicePdfUrl,
  expiresAt,
}: OrderInvoiceEmailProps) {
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

      <p>Please find attached the invoice for Order #{orderNumber}.</p>

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
        <div style={{ margin: "20px 0" }}>
          <p style={{ marginBottom: "10px" }}>Download your invoice:</p>
          <a
            href={invoicePdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "10px 20px",
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

      <div style={{ textAlign: "center", margin: "30px 0" }}>
        <a
          href={paymentUrl}
          style={{
            display: "inline-block",
            padding: "15px 30px",
            background: "#007bff",
            color: "white",
            textDecoration: "none",
            borderRadius: "5px",
            fontWeight: "bold",
          }}
        >
          Pay Now
        </a>
      </div>

      {expiresAt && (
        <p style={{ color: "#666", fontSize: "12px", marginTop: "20px" }}>
          This invoice expires on {expiresAt.toLocaleDateString()}.
        </p>
      )}

      <p style={{ color: "#666", fontSize: "12px", marginTop: "30px" }}>
        This is an invoice for order #{orderNumber}. Please click the button
        above to complete your payment securely.
      </p>
    </div>
  );
}
