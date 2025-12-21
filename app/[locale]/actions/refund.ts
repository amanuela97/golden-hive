"use server";

import { db } from "@/db";
import { orders, orderItems, store } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Generate refund receipt (credit note) PDF
 */
export async function generateRefundReceipt(input: {
  orderId: string;
  refundAmount: string;
  currency: string;
  reason?: string;
}): Promise<{ success: boolean; receiptPdfUrl?: string; error?: string }> {
  try {
    // Get order data
    const orderData = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        invoiceNumber: orders.invoiceNumber,
        storeId: orders.storeId,
        customerEmail: orders.customerEmail,
        customerFirstName: orders.customerFirstName,
        customerLastName: orders.customerLastName,
        currency: orders.currency,
        totalAmount: orders.totalAmount,
        refundedAmount: orders.refundedAmount,
        placedAt: orders.placedAt,
      })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderData[0];

    // Get order items
    const items = await db
      .select({
        title: orderItems.title,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        lineTotal: orderItems.lineTotal,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, input.orderId));

    // Get store info
    let storeName = "Store";
    if (order.storeId) {
      const storeData = await db
        .select({ storeName: store.storeName })
        .from(store)
        .where(eq(store.id, order.storeId))
        .limit(1);

      if (storeData.length > 0) {
        storeName = storeData[0].storeName;
      }
    }

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();

    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(
      StandardFonts.HelveticaBold
    );

    const margin = 50;
    let yPosition = height - margin;
    const fontSize = 12;
    const lineHeight = 15;

    const addText = (
      text: string,
      x: number,
      y: number,
      size: number = fontSize,
      font = helveticaFont,
      color = rgb(0, 0, 0)
    ) => {
      page.drawText(text, {
        x,
        y,
        size,
        font,
        color,
      });
    };

    // Header
    addText("REFUND RECEIPT", width / 2 - 40, yPosition, 20, helveticaBoldFont);
    yPosition -= 30;

    // Refund details
    addText(
      `Refund Amount: ${parseFloat(input.refundAmount).toFixed(2)} ${input.currency}`,
      margin,
      yPosition
    );
    yPosition -= lineHeight;
    addText(`Order Number: #${order.orderNumber}`, margin, yPosition);
    yPosition -= lineHeight;
    if (order.invoiceNumber) {
      addText(`Original Invoice: ${order.invoiceNumber}`, margin, yPosition);
      yPosition -= lineHeight;
    }
    addText(`Date: ${new Date().toLocaleDateString()}`, margin, yPosition);
    yPosition -= 30;

    // Store info
    addText("From:", margin, yPosition, 14, helveticaBoldFont);
    yPosition -= lineHeight;
    addText(storeName, margin, yPosition);
    yPosition -= 30;

    // Customer info
    addText("Refunded To:", margin, yPosition, 14, helveticaBoldFont);
    yPosition -= lineHeight;
    if (order.customerFirstName || order.customerLastName) {
      addText(
        `${order.customerFirstName || ""} ${order.customerLastName || ""}`.trim(),
        margin,
        yPosition
      );
      yPosition -= lineHeight;
    }
    if (order.customerEmail) {
      addText(order.customerEmail, margin, yPosition);
      yPosition -= lineHeight;
    }
    yPosition -= 30;

    // Refunded items
    addText("Refunded Items:", margin, yPosition, 14, helveticaBoldFont);
    yPosition -= lineHeight;

    const tableTop = yPosition;
    const startX = margin;
    const colWidths = {
      description: 300,
      quantity: 80,
      price: 100,
      total: 100,
    };
    const itemHeight = 20;

    // Table header
    addText("Item", startX, tableTop, 10, helveticaBoldFont);
    addText(
      "Qty",
      startX + colWidths.description,
      tableTop,
      10,
      helveticaBoldFont
    );
    addText(
      "Price",
      startX + colWidths.description + colWidths.quantity,
      tableTop,
      10,
      helveticaBoldFont
    );
    addText(
      "Total",
      startX + colWidths.description + colWidths.quantity + colWidths.price,
      tableTop,
      10,
      helveticaBoldFont
    );

    page.drawLine({
      start: { x: startX, y: tableTop - 5 },
      end: {
        x:
          startX +
          colWidths.description +
          colWidths.quantity +
          colWidths.price +
          colWidths.total,
        y: tableTop - 5,
      },
      thickness: 1,
      color: rgb(0, 0, 0),
    });

    // Table rows
    let currentY = tableTop - 25;
    for (const item of items) {
      const title =
        item.title.length > 40
          ? item.title.substring(0, 37) + "..."
          : item.title;
      addText(title, startX, currentY, 10);
      addText(
        item.quantity.toString(),
        startX + colWidths.description,
        currentY,
        10
      );
      addText(
        `${parseFloat(item.unitPrice).toFixed(2)} ${order.currency}`,
        startX + colWidths.description + colWidths.quantity,
        currentY,
        10
      );
      addText(
        `${parseFloat(item.lineTotal).toFixed(2)} ${order.currency}`,
        startX + colWidths.description + colWidths.quantity + colWidths.price,
        currentY,
        10
      );
      currentY -= itemHeight;
    }

    // Refund summary
    currentY -= 10;
    const totalsX = startX + colWidths.description + colWidths.quantity;
    const totalsWidth = colWidths.price + colWidths.total;

    addText("Refund Amount:", totalsX, currentY, 12, helveticaBoldFont);
    const refundText = `${parseFloat(input.refundAmount).toFixed(2)} ${input.currency}`;
    addText(
      refundText,
      totalsX + totalsWidth - 80,
      currentY,
      12,
      helveticaBoldFont
    );

    // Reason if provided
    if (input.reason) {
      currentY -= 30;
      addText("Reason:", margin, currentY, 10, helveticaBoldFont);
      currentY -= lineHeight;
      addText(input.reason, margin, currentY, 10);
    }

    // Footer
    currentY -= 40;
    const footerText = `Refund receipt generated on ${new Date().toLocaleString()}`;
    const footerWidth = helveticaFont.widthOfTextAtSize(footerText, 8);
    addText(footerText, (width - footerWidth) / 2, 30, 8);

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Upload to Cloudinary
    const base64 = Buffer.from(pdfBytes).toString("base64");
    const dataURI = `data:application/pdf;base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataURI, {
      folder: `golden-hive/refunds/${order.id}`,
      resource_type: "raw",
      format: "pdf",
      public_id: `refund-${order.orderNumber}-${Date.now()}`,
      overwrite: true,
    });

    console.log(`[Refund Receipt] PDF uploaded: ${result.secure_url}`);

    return {
      success: true,
      receiptPdfUrl: result.secure_url,
    };
  } catch (error) {
    console.error("Error generating refund receipt:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate refund receipt",
    };
  }
}
