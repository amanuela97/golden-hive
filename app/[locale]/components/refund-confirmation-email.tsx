interface RefundConfirmationEmailProps {
  orderNumber: number;
  invoiceNumber: string | null;
  customerName: string;
  refundAmount: string;
  currency: string;
  refundedItems: Array<{
    title: string;
    quantity: number;
  }>;
  refundMethod: string;
}

export default function RefundConfirmationEmail({
  orderNumber,
  invoiceNumber,
  customerName,
  refundAmount,
  currency,
  refundedItems,
  refundMethod,
}: RefundConfirmationEmailProps) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ color: '#333' }}>Refund Processed - Order #{orderNumber}</h1>
      
      <p>Dear {customerName},</p>
      
      <p>We have processed a refund for your order.</p>
      
      <div style={{ background: '#f9f9f9', padding: '20px', margin: '20px 0', borderRadius: '5px' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
          <strong>Refund Amount:</strong> {parseFloat(refundAmount).toFixed(2)} {currency}
        </p>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
          <strong>Order Number:</strong> #{orderNumber}
        </p>
        {invoiceNumber && (
          <p style={{ margin: 0, fontSize: '14px' }}>
            <strong>Original Invoice:</strong> {invoiceNumber}
          </p>
        )}
      </div>

      {refundedItems.length > 0 && (
        <div style={{ margin: '20px 0' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '10px' }}>Refunded Items:</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Item</th>
                <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {refundedItems.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{item.title}</td>
                  <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ background: '#e8f5e9', padding: '15px', margin: '20px 0', borderRadius: '5px' }}>
        <p style={{ margin: 0, fontSize: '14px' }}>
          <strong>Refund Method:</strong> {refundMethod}
        </p>
        <p style={{ margin: '10px 0 0 0', fontSize: '14px' }}>
          The refund will be processed to your original payment method. Please allow 5-10 business days for the refund to appear in your account.
        </p>
      </div>
      
      <p style={{ color: '#666', fontSize: '12px', marginTop: '30px' }}>
        If you have any questions about this refund, please contact us.
      </p>
    </div>
  );
}

