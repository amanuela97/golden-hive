"use server";

import { db } from "@/db";
import { orders, orderItems, store, listing, listingVariants } from "@/db/schema";
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
 * Generate invoice number in format INV-YYYY-NNNNNN
 */
async function generateInvoiceNumber(storeId: string): Promise<string> {
  const year = new Date().getFullYear();
  
  // Get the highest invoice number for this year
  const existingInvoices = await db
    .select({ invoiceNumber: orders.invoiceNumber })
    .from(orders)
    .where(eq(orders.storeId, storeId));

  // Find the highest sequence number for this year
  let maxSequence = 0;
  const yearPrefix = `INV-${year}-`;
  for (const invoice of existingInvoices) {
    if (invoice.invoiceNumber && invoice.invoiceNumber.startsWith(yearPrefix)) {
      const match = invoice.invoiceNumber.match(/INV-\d{4}-(\d+)/);
      if (match) {
        const sequence = parseInt(match[1], 10);
        if (sequence > maxSequence) {
          maxSequence = sequence;
        }
      }
    }
  }

  // Generate next sequence number (padded to 6 digits)
  const nextSequence = maxSequence + 1;
  return `INV-${year}-${nextSequence.toString().padStart(6, "0")}`;
}

/**
 * Generate invoice PDF and upload to Cloudinary using pdf-lib
 */
async function generateInvoicePdf(
  order: {
    id: string;
    orderNumber: number;
    invoiceNumber: string;
    storeId: string | null;
    customerEmail: string | null;
    customerFirstName: string | null;
    customerLastName: string | null;
    currency: string;
    subtotalAmount: string;
    discountAmount: string;
    shippingAmount: string;
    taxAmount: string;
    totalAmount: string;
    placedAt: Date | null;
    shippingName: string | null;
    shippingAddressLine1: string | null;
    shippingCity: string | null;
    shippingRegion: string | null;
    shippingPostalCode: string | null;
    shippingCountry: string | null;
  },
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>,
  storeInfo: {
    storeName: string;
  }
): Promise<string> {
  try {
    console.log("Creating PDFDocument with pdf-lib...");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size in points
    const { width, height } = page.getSize();
    
    // Load standard fonts (built-in, no external files needed)
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const margin = 50;
    let yPosition = height - margin;
    const fontSize = 12;
    const lineHeight = 15;
    
    // Helper function to add text
    const addText = (text: string, x: number, y: number, size: number = fontSize, font = helveticaFont, color = rgb(0, 0, 0)) => {
      page.drawText(text, {
        x,
        y,
        size,
        font,
        color,
      });
    };
    
    // Header
    addText("INVOICE", width / 2 - 30, yPosition, 20, helveticaBoldFont, rgb(0, 0, 0));
    yPosition -= 30;
    
    // Invoice number and date
    addText(`Invoice Number: ${order.invoiceNumber}`, margin, yPosition);
    yPosition -= lineHeight;
    addText(`Order Number: #${order.orderNumber}`, margin, yPosition);
    yPosition -= lineHeight;
    addText(
      `Date: ${order.placedAt ? new Date(order.placedAt).toLocaleDateString() : new Date().toLocaleDateString()}`,
      margin,
      yPosition
    );
    yPosition -= 30;
    
    // Store info (seller)
    addText("From:", margin, yPosition, 14, helveticaBoldFont);
    yPosition -= lineHeight;
    addText(storeInfo.storeName, margin, yPosition);
    yPosition -= 30;
    
    // Customer info (buyer)
    addText("Bill To:", margin, yPosition, 14, helveticaBoldFont);
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
    if (order.shippingAddressLine1) {
      addText(order.shippingAddressLine1, margin, yPosition);
      yPosition -= lineHeight;
      if (order.shippingCity) {
        addText(
          `${order.shippingCity}${order.shippingRegion ? `, ${order.shippingRegion}` : ""} ${order.shippingPostalCode || ""}`.trim(),
          margin,
          yPosition
        );
        yPosition -= lineHeight;
      }
      if (order.shippingCountry) {
        addText(order.shippingCountry, margin, yPosition);
        yPosition -= lineHeight;
      }
    }
    yPosition -= 20;
    
    // Line items table
    const tableTop = yPosition;
    const itemHeight = 20;
    const startX = margin;
    const colWidths = {
      description: 300,
      quantity: 80,
      price: 80,
      total: 80,
    };
    
    // Table header
    addText("Description", startX, tableTop, 10, helveticaBoldFont);
    addText("Qty", startX + colWidths.description, tableTop, 10, helveticaBoldFont);
    addText("Price", startX + colWidths.description + colWidths.quantity, tableTop, 10, helveticaBoldFont);
    addText("Total", startX + colWidths.description + colWidths.quantity + colWidths.price, tableTop, 10, helveticaBoldFont);
    
    // Draw line under header
    page.drawLine({
      start: { x: startX, y: tableTop - 5 },
      end: { x: startX + colWidths.description + colWidths.quantity + colWidths.price + colWidths.total, y: tableTop - 5 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    
    // Table rows
    let currentY = tableTop - 25;
    for (const item of items) {
      // Truncate title if too long
      const title = item.title.length > 40 ? item.title.substring(0, 37) + "..." : item.title;
      addText(title, startX, currentY, 10);
      addText(item.quantity.toString(), startX + colWidths.description, currentY, 10);
      addText(`${parseFloat(item.unitPrice).toFixed(2)} ${order.currency}`, startX + colWidths.description + colWidths.quantity, currentY, 10);
      addText(`${parseFloat(item.lineTotal).toFixed(2)} ${order.currency}`, startX + colWidths.description + colWidths.quantity + colWidths.price, currentY, 10);
      currentY -= itemHeight;
    }
    
    // Totals
    currentY -= 10;
    const totalsX = startX + colWidths.description + colWidths.quantity;
    const totalsWidth = colWidths.price + colWidths.total;
    
    addText("Subtotal:", totalsX, currentY, 10);
    const subtotalText = `${parseFloat(order.subtotalAmount).toFixed(2)} ${order.currency}`;
    addText(subtotalText, totalsX + totalsWidth - 80, currentY, 10);
    currentY -= itemHeight;
    
    if (parseFloat(order.discountAmount) > 0) {
      addText("Discount:", totalsX, currentY, 10);
      const discountText = `-${parseFloat(order.discountAmount).toFixed(2)} ${order.currency}`;
      addText(discountText, totalsX + totalsWidth - 80, currentY, 10);
      currentY -= itemHeight;
    }
    
    if (parseFloat(order.shippingAmount) > 0) {
      addText("Shipping:", totalsX, currentY, 10);
      const shippingText = `${parseFloat(order.shippingAmount).toFixed(2)} ${order.currency}`;
      addText(shippingText, totalsX + totalsWidth - 80, currentY, 10);
      currentY -= itemHeight;
    }
    
    if (parseFloat(order.taxAmount) > 0) {
      addText("Tax:", totalsX, currentY, 10);
      const taxText = `${parseFloat(order.taxAmount).toFixed(2)} ${order.currency}`;
      addText(taxText, totalsX + totalsWidth - 80, currentY, 10);
      currentY -= itemHeight;
    }
    
    // Total
    currentY -= 5;
    addText("Total:", totalsX, currentY, 12, helveticaBoldFont);
    const totalText = `${parseFloat(order.totalAmount).toFixed(2)} ${order.currency}`;
    addText(totalText, totalsX + totalsWidth - 80, currentY, 12, helveticaBoldFont);
    
    // Payment terms
    currentY -= 40;
    addText("Payment Terms: Net 30 days", margin, currentY, 10);
    
    // Footer
    const footerText = `Invoice generated on ${new Date().toLocaleString()}`;
    const footerWidth = helveticaFont.widthOfTextAtSize(footerText, 8);
    addText(footerText, (width - footerWidth) / 2, 30, 8);
    
    // Generate PDF bytes
    console.log("Generating PDF bytes...");
    const pdfBytes = await pdfDoc.save();
    console.log(`PDF generated, size: ${pdfBytes.length} bytes`);
    
    if (pdfBytes.length === 0) {
      throw new Error("PDF buffer is empty");
    }
    
    // Convert to base64
    const base64 = Buffer.from(pdfBytes).toString("base64");
    const dataURI = `data:application/pdf;base64,${base64}`;
    console.log(`Data URI created, length: ${dataURI.length}`);
    
    // Upload to Cloudinary
    console.log("Uploading PDF to Cloudinary...");
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error("Cloudinary configuration is missing");
    }
    
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: "golden-hive/invoices",
      resource_type: "raw",
      format: "pdf",
      public_id: `invoice-${order.invoiceNumber}`,
    });
    
    console.log("PDF uploaded successfully:", result.secure_url);
    return result.secure_url;
  } catch (error) {
    console.error("Error generating PDF:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
    throw error;
  }
}

/**
 * Generate and store invoice for an order
 */
export async function generateInvoiceForOrder(
  orderId: string
): Promise<{ success: boolean; invoiceNumber?: string; invoicePdfUrl?: string; error?: string }> {
  try {
    // Get order with all necessary data
    const orderData = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        invoiceNumber: orders.invoiceNumber,
        invoiceIssuedAt: orders.invoiceIssuedAt,
        invoiceLockedAt: orders.invoiceLockedAt,
        invoicePdfUrl: orders.invoicePdfUrl,
        storeId: orders.storeId,
        customerEmail: orders.customerEmail,
        customerFirstName: orders.customerFirstName,
        customerLastName: orders.customerLastName,
        currency: orders.currency,
        subtotalAmount: orders.subtotalAmount,
        discountAmount: orders.discountAmount,
        shippingAmount: orders.shippingAmount,
        taxAmount: orders.taxAmount,
        totalAmount: orders.totalAmount,
        placedAt: orders.placedAt,
        shippingName: orders.shippingName,
        shippingAddressLine1: orders.shippingAddressLine1,
        shippingCity: orders.shippingCity,
        shippingRegion: orders.shippingRegion,
        shippingPostalCode: orders.shippingPostalCode,
        shippingCountry: orders.shippingCountry,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderData[0];

    // Check if invoice already exists
    if (order.invoiceNumber && order.invoicePdfUrl) {
      return {
        success: true,
        invoiceNumber: order.invoiceNumber,
        invoicePdfUrl: order.invoicePdfUrl,
      };
    }

    if (!order.storeId) {
      return { success: false, error: "Order has no store ID" };
    }

    // Get store info
    const storeData = await db
      .select({ storeName: store.storeName })
      .from(store)
      .where(eq(store.id, order.storeId))
      .limit(1);

    if (storeData.length === 0) {
      return { success: false, error: "Store not found" };
    }

    // Get order items
    const items = await db
      .select({
        title: orderItems.title,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        lineTotal: orderItems.lineTotal,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    if (items.length === 0) {
      return { success: false, error: "Order has no items" };
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(order.storeId);
    const invoiceIssuedAt = new Date();

    // Generate PDF and upload to Cloudinary
    console.log("Generating PDF for invoice:", invoiceNumber);
    let invoicePdfUrl: string;
    try {
      invoicePdfUrl = await generateInvoicePdf(
        {
          ...order,
          invoiceNumber,
        },
        items,
        storeData[0]
      );
      console.log("PDF generated and uploaded to Cloudinary:", invoicePdfUrl);
    } catch (pdfError) {
      console.error("Error generating PDF:", pdfError);
      throw new Error(
        `Failed to generate PDF: ${pdfError instanceof Error ? pdfError.message : "Unknown error"}`
      );
    }

    // Update order with invoice data and lock financials
    console.log("Updating order with invoice data:", {
      orderId,
      invoiceNumber,
      invoicePdfUrl,
      invoiceIssuedAt: invoiceIssuedAt.toISOString(),
    });
    
    try {
      const updateResult = await db
        .update(orders)
        .set({
          invoiceNumber,
          invoiceIssuedAt,
          invoiceLockedAt: invoiceIssuedAt, // Lock financials at invoice generation
          invoicePdfUrl,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning({
          id: orders.id,
          invoiceNumber: orders.invoiceNumber,
          invoicePdfUrl: orders.invoicePdfUrl,
        });
      
      console.log("Order update result:", JSON.stringify(updateResult, null, 2));
      
      if (updateResult.length === 0) {
        throw new Error("Order update failed - no rows affected");
      }
      
      if (!updateResult[0].invoiceNumber || !updateResult[0].invoicePdfUrl) {
        throw new Error(`Order update incomplete - invoiceNumber: ${updateResult[0].invoiceNumber}, invoicePdfUrl: ${updateResult[0].invoicePdfUrl}`);
      }
      
      console.log("Order updated with invoice data successfully:", {
        invoiceNumber: updateResult[0].invoiceNumber,
        invoicePdfUrl: updateResult[0].invoicePdfUrl,
      });
    } catch (dbError) {
      console.error("Database update error:", dbError);
      console.error("DB error details:", {
        message: dbError instanceof Error ? dbError.message : "Unknown error",
        stack: dbError instanceof Error ? dbError.stack : undefined,
      });
      throw dbError;
    }

    return {
      success: true,
      invoiceNumber,
      invoicePdfUrl,
    };
  } catch (error) {
    console.error("Error generating invoice:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate invoice",
    };
  }
}

