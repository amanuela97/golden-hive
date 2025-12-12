2. committed

What it tracks:
Units that are reserved for an order but not yet fulfilled.

These items cannot be sold to someone else because they’re already tied to an order.

When this increases:

Customer places an order

Order status may be "unfulfilled", "processing", "pending payment", etc.

When this decreases:

The order is fulfilled → items move from committed → shipped (completed)

The order is canceled → committed decreases and available increases again

Example:
Customer orders 3 units. Those 3 units become:

committed = 3
available decreases by 3

3. incoming

What it tracks:
Units that are on the way to the location, but not yet received.

Usually tied to:

Purchase orders

Vendor restock shipments

Internal transfers (moving stock from another location)

When this increases:

Vendor creates a purchase order for 100 units

Restock shipment from supplier is created

When this decreases:

Stock is actually received at the warehouse

Incoming converts into available

Example:
You ordered 100 units from a supplier. Before they arrive:

incoming = 100
available stays the same

When you receive the shipment:

incoming = incoming - 100
available = available + 100

4. Build inventory transfer page

5. order (order_id), date (formatDistance from date-fns), customer (name), total (price), payment status, fulfillment status, items.
