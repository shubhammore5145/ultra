import type { SalesReturn } from '../types';

/**
 * Resolves the shop's configured thermal paper width ('80mm' | '58mm').
 */
export function getConfiguredPaperSize(shopData?: any): '58mm' | '80mm' {
  try {
    const raw = localStorage.getItem('hardware_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.paperSize === '58mm') return '58mm';
      if (parsed?.paperSize === '80mm') return '80mm';
    }
  } catch {}
  if (shopData?.settings?.paperSize === '58mm' || shopData?.receiptPaperSize === '58mm') {
    return '58mm';
  }
  return '80mm';
}

/**
 * Prints a self-contained HTML thermal document via an invisible hidden iframe.
 * Never triggers browser popup blockers (`window.open` issues) and never suffers
 * from dark-mode or parent layout overflow clipping during `window.print()`.
 */
export function printHtmlThermal(html: string): boolean {
  if (typeof document === 'undefined') return false;

  try {
    const existing = document.getElementById('martgpt-print-frame');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'martgpt-print-frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!frameDoc || !iframe.contentWindow) {
      iframe.remove();
      return false;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Iframe print error:', err);
        try {
          window.print();
        } catch {}
      }
      // Remove iframe generously after print dialog closes
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 60000);
    };

    iframe.onload = () => setTimeout(triggerPrint, 60);
    setTimeout(triggerPrint, 180);
    return true;
  } catch (err) {
    console.error('Failed to initialize thermal print frame:', err);
    return false;
  }
}

/**
 * Prints the rendered receipt DOM node (`#receipt-template`) inside a clean isolated iframe.
 * Falls back to `window.print()` if the template element cannot be serialized.
 */
export function printReceiptElementThermal(
  element: HTMLElement | null,
  paperSpec: '58mm' | '80mm' = '80mm',
  title = 'POS Receipt'
): boolean {
  if (!element) {
    window.print();
    return false;
  }

  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.remove('hidden', 'print:block');
  clone.style.display = 'block';
  clone.style.visibility = 'visible';
  clone.style.width = '100%';
  clone.style.maxWidth = paperSpec;
  clone.style.margin = '0 auto';
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#000000';

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      @page { margin: 0mm; size: ${paperSpec} auto; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #000000;
        width: 100%;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-variant-numeric: tabular-nums;
      }
    </style>
  </head>
  <body>
    ${clone.outerHTML}
  </body>
</html>`;

  const ok = printHtmlThermal(html);
  if (!ok) {
    window.print();
  }
  return ok;
}

/**
 * Builds and prints an 80mm / 58mm calibrated Sales Return & Refund Voucher.
 */
export function printReturnVoucherThermal(record: SalesReturn, shopData?: any): boolean {
  const paperSpec = getConfiguredPaperSize(shopData);
  const shopName = String(shopData?.shopName || shopData?.name || 'KIRANA STORE').toUpperCase();
  const shopPhone = shopData?.phone || '';
  const dateStr = new Date(record.createdAt || Date.now()).toLocaleDateString('en-IN');
  const timeStr = new Date(record.createdAt || Date.now()).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const itemsRows = (record.items || [])
    .map(
      (it, idx) => `
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px;padding:3px 0;border-bottom:1px dotted #000;font-size:11.5px;">
        <span style="flex:1;min-width:0;font-weight:700;word-break:break-word;">${idx + 1}. ${it.productName} (x${it.qty}) [${it.condition === 'resellable' ? 'Good' : 'Damaged'}]</span>
        <span style="flex-shrink:0;white-space:nowrap;font-weight:900;font-variant-numeric:tabular-nums;">₹${Number(it.refundAmount || 0).toFixed(2)}</span>
      </div>
    `
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Sales Return Voucher #${record.id}</title>
    <style>
      @page { margin: 0mm; size: ${paperSpec} auto; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        width: 100%;
        max-width: ${paperSpec};
        margin: 0 auto;
        padding: 1.5mm 2mm;
        color: #000;
        background: #fff;
        font-size: 11.5px;
        line-height: 1.3;
        font-variant-numeric: tabular-nums;
      }
      .center { text-align: center; }
      .dashed { border-bottom: 1.5px dashed #000; margin: 5px 0; }
    </style>
  </head>
  <body>
    <div class="center">
      <h2 style="margin:0 0 2px;font-size:17px;font-weight:900;">${shopName}</h2>
      ${shopPhone ? `<p style="margin:2px 0;font-weight:700;">Ph: ${shopPhone}</p>` : ''}
      <div style="border-top:1.5px dashed #000;border-bottom:1.5px dashed #000;padding:3px 0;margin:5px 0;font-weight:900;font-size:11.5px;">
        *** SALES RETURN &amp; REFUND VOUCHER ***
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;gap:4px;font-size:11px;font-weight:600;">
      <span><b>Voucher:</b> #${record.id}</span>
      <span style="white-space:nowrap;"><b>Date:</b> ${dateStr}</span>
    </div>
    <div style="display:flex;justify-content:space-between;gap:4px;font-size:11px;font-weight:600;">
      <span><b>Orig Bill:</b> #${String(record.originalBillId || '').slice(-8).toUpperCase()}</span>
      <span style="white-space:nowrap;"><b>Time:</b> ${timeStr}</span>
    </div>
    ${record.customerName ? `<div style="font-size:11px;margin-top:2px;font-weight:600;"><b>Customer:</b> ${record.customerName} ${record.customerPhone ? `(${record.customerPhone})` : ''}</div>` : ''}
    <div class="dashed"></div>
    <div style="font-weight:900;font-size:11.5px;margin-bottom:4px;">RETURNED ITEMS:</div>
    ${itemsRows}
    <div class="dashed"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:900;margin:4px 0;">
      <span>TOTAL REFUND:</span>
      <span style="white-space:nowrap;">₹${Number(record.totalRefund || 0).toFixed(2)}</span>
    </div>
    <div style="font-size:11px;font-weight:700;">Refund Mode: ${String(record.refundMethod || 'CASH').toUpperCase()}</div>
    <div style="font-size:10.5px;font-weight:600;margin-top:2px;">Reason: ${record.reason || 'Customer Return'}</div>
    <div class="dashed"></div>
    <p class="center" style="margin:6px 0 2px;font-weight:900;font-size:11.5px;">Inventory Updated Successfully</p>
    <p class="center" style="margin:4px 0 2mm;font-size:12.5px;font-weight:900;">Software by Varuag Labs</p>
  </body>
</html>`;

  return printHtmlThermal(html);
}
