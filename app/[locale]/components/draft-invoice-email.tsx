interface DraftInvoiceEmailProps {
  draftNumber: number;
  customerName: string;
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  subtotal: string;
  total: string;
  currency: string;
  paymentUrl: string; // Now uses token-based URL
  customMessage?: string;
  expiresAt?: Date;
}

export default function DraftInvoiceEmail({
  draftNumber,
  customerName,
  items,
  subtotal,
  total,
  currency,
  paymentUrl,
  customMessage,
  expiresAt,
}: DraftInvoiceEmailProps) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ color: '#333' }}>Invoice #{draftNumber}</h1>
      
      <p>Dear {customerName},</p>
      
      {customMessage && (
        <div style={{ background: '#f5f5f5', padding: '15px', margin: '20px 0', borderRadius: '5px' }}>
          <p style={{ margin: 0 }}>{customMessage}</p>
        </div>
      )}
      
      <h2>Order Summary</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '20px 0' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Item</th>
            <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>Qty</th>
            <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Price</th>
            <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{item.title}</td>
              <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>{item.quantity}</td>
              <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>{item.unitPrice} {currency}</td>
              <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>{item.lineTotal} {currency}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #ddd' }}>Total:</td>
            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #ddd' }}>{total} {currency}</td>
          </tr>
        </tfoot>
      </table>
      
      <div style={{ textAlign: 'center', margin: '30px 0' }}>
        <a 
          href={paymentUrl}
          style={{
            display: 'inline-block',
            padding: '15px 30px',
            background: '#007bff',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '5px',
            fontWeight: 'bold'
          }}
        >
          Pay Now
        </a>
      </div>
      
      {expiresAt && (
        <p style={{ color: '#666', fontSize: '12px', marginTop: '20px' }}>
          This invoice expires on {expiresAt.toLocaleDateString()}.
        </p>
      )}
      
      <p style={{ color: '#666', fontSize: '12px', marginTop: '30px' }}>
        This is an invoice for draft order #{draftNumber}. Please click the button above to complete your payment securely.
      </p>
    </div>
  );
}

