export interface WhatsAppBillItem {
  name?: string;
  qty?: number;
  sellingPrice?: number;
}

export interface WhatsAppBillTextInput {
  shopName?: string | null;
  shopAddress?: string | null;
  shopPhone?: string | null;
  gstNumber?: string | null;
  isGstActive?: boolean;
  billId: string;
  createdAt?: string | Date;
  customerName?: string | null;
  customerPhone?: string | null;
  items?: WhatsAppBillItem[];
  subtotal?: number;
  discountAmount?: number;
  totalAmount: number;
  paymentMethod?: string | null;
}

/**
 * Formats an itemized Kirana bill in clean WhatsApp plain-text format without online e-bill URLs.
 */
export function formatWhatsAppBillText(input: WhatsAppBillTextInput): string {
  const shopName = (input.shopName || 'Kirana Store').trim();
  const dateObj = input.createdAt ? new Date(input.createdAt) : new Date();
  const validDate = Number.isNaN(dateObj.getTime()) ? new Date() : dateObj;
  const formattedDate = validDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const formattedTime = validDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const shortInv = String(input.billId || '').slice(-8).toUpperCase();
  const items = Array.isArray(input.items) ? input.items : [];
  const totalQty = items.reduce((sum, it) => sum + Number(it.qty || 1), 0);
  const numDiscount = Number(input.discountAmount || 0);
  const numTotal = Number(input.totalAmount || 0);
  const numSubtotal = Number(input.subtotal || (numTotal + numDiscount));

  let text = `🏪 *${shopName.toUpperCase()}*\n`;
  if (input.shopAddress) text += `📍 ${input.shopAddress}\n`;
  if (input.shopPhone) text += `📞 Ph: ${input.shopPhone}\n`;
  if (input.isGstActive && input.gstNumber) text += `🏢 GSTIN: ${input.gstNumber}\n`;
  text += `────────────────────\n`;
  text += `🧾 *RETAIL INVOICE*\n`;
  if (shortInv) text += `*Inv No:* #${shortInv}\n`;
  text += `*Date:* ${formattedDate}, ${formattedTime}\n`;

  const cleanPhone = (input.customerPhone || '').replace(/\D/g, '').slice(-10);
  if (input.customerName && cleanPhone) {
    text += `*Customer:* ${input.customerName} (+91 ${cleanPhone})\n`;
  } else if (input.customerName) {
    text += `*Customer:* ${input.customerName}\n`;
  } else if (cleanPhone) {
    text += `*Customer:* +91 ${cleanPhone}\n`;
  }

  if (input.paymentMethod) {
    text += `💳 *Payment Mode:* ${String(input.paymentMethod).toUpperCase()}\n`;
  }

  if (items.length > 0) {
    text += `────────────────────\n`;
    text += `🛒 *ITEMS (${items.length} / ${Number.isInteger(totalQty) ? totalQty : totalQty.toFixed(2)} qty):*\n`;
    text += items
      .map((it, idx) => {
        const q = Number(it.qty || 1);
        const rate = Number(it.sellingPrice || 0);
        const lineAmt = (rate * q).toFixed(2);
        return `${idx + 1}. *${it.name || 'Item'}* (${q} x ₹${rate.toFixed(2)}) = ₹${lineAmt}`;
      })
      .join('\n');
    text += `\n`;
  }

  text += `────────────────────\n`;
  if (numDiscount > 0) {
    text += `Subtotal: ₹${numSubtotal.toFixed(2)}\n`;
    text += `🏷️ *Discount:* -₹${numDiscount.toFixed(2)}\n`;
  }
  text += `💰 *TOTAL: ₹${numTotal.toFixed(2)}*\n`;
  text += `────────────────────\n`;
  text += `🙏 *Thank you for shopping with us!*\nPlease visit again! 😊`;

  return text;
}
