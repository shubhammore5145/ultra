import Tesseract from 'tesseract.js';
import { searchFMCGCatalog } from './fmcgCatalog';
import type { Product } from '../types';

export interface ParsedInvoiceResult {
  supplierName: string;
  supplierPhone: string;
  supplierGst: string;
  invoiceNumber: string;
  invoiceDate: string;
  items: ParsedInvoiceItem[];
  rawText: string;
}

export interface ParsedInvoiceItem {
  id: string;
  name: string;
  matchedProductId: string;
  hsn?: string;
  qty: number;
  unit: string;
  purchasePrice: number;
  mrp: number;
  sellingPrice: number;
  gstPercent: number;
  discount: number;
  total: number;
  isNewProduct?: boolean;
}

/**
 * Preprocesses an invoice photo on an off-screen Canvas to drastically improve Tesseract accuracy:
 * - Downscales to optimal OCR resolution (width ~1800px)
 * - Converts to grayscale with luminance weights
 * - Adaptive contrast stretching and thresholding (brings out faint dot-matrix/thermal ink, clears gray background)
 */
export async function preprocessInvoiceImage(fileOrUrl: File | string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const MAX_WIDTH = 1800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // 1. Calculate average luminance for adaptive threshold
        let totalLum = 0;
        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          totalLum += lum;
        }
        const avgLum = totalLum / (data.length / 4);

        // 2. High-contrast enhancement: stretch contrast around average luminance
        const contrastFactor = 1.35;
        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // Contrast formula: (lum - avg) * factor + avg
          let enhanced = (lum - avgLum) * contrastFactor + avgLum;
          // Slight gamma boost for faint ink
          if (enhanced < 115) {
            enhanced = enhanced * 0.85; // darken ink
          } else if (enhanced > 170) {
            enhanced = 255; // turn background pure white
          }
          const clamped = Math.max(0, Math.min(255, Math.round(enhanced)));
          data[i] = clamped;
          data[i + 1] = clamped;
          data[i + 2] = clamped;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (e) {
        console.warn('Preprocessing canvas error, using original image:', e);
        resolve(typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl));
      }
    };

    img.onerror = () => {
      resolve(typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl));
    };

    if (typeof fileOrUrl === 'string') {
      img.src = fileOrUrl;
    } else {
      img.src = URL.createObjectURL(fileOrUrl);
    }
  });
}

/**
 * Checks if a string is an address or non-product metadata line.
 */
function isAddressOrMetadataLine(line: string): boolean {
  const addressRegex = /\b(plot|cidco|midc|road|street|nagar|colony|chowk|taluka|dist|district|pin|pincode|state|maharashtra|gujarat|delhi|pune|mumbai|aurangabad|sambhaji|buyer|consignee|shipped\s*to|billed\s*to|party\s*name|transport|vehicle|lr\s*no|e-way|bank|ifsc|branch|a\/c|account)\b/i;
  return addressRegex.test(line);
}

/**
 * Checks if a line is a table header or summary footer.
 */
function isTableHeader(line: string): boolean {
  return /\b(s\.?no|sr\.?no|particulars|description|item\s*name|hsn|sac|qty|quantity|unit|rate|price|mrp|disc|gst|amount)\b/i.test(line);
}

function isTableFooter(line: string): boolean {
  return /^(total|sub\s*total|grand\s*total|round\s*off|net\s*amount|taxable\s*value|cgst|sgst|igst|amount\s*in\s*words|terms\s*&|authorized\s*signatory)/i.test(line);
}

/**
 * Cleans raw OCR product text by removing noise characters, leading numbers, and trailing symbols.
 */
function cleanItemText(raw: string): string {
  return raw
    .replace(/^\d+[\s\.\)\-]+/, '') // remove leading serial numbers e.g. "1. " or "2) "
    .replace(/[\|\[\]\{\}\\\/<>~;:\^\$#@!=+]+/g, ' ') // remove weird OCR punctuation
    .replace(/\b\d{4,8}\b/g, '') // strip standalone 4-8 digit numbers (HSN or pin)
    .replace(/\b(pcs|pkt|kg|ltr|box|doz|nos|bag)\b/gi, '') // strip unit from name
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses OCR invoice text into structured data with mathematical validation.
 */
export function parseInvoiceAdvanced(
  rawText: string,
  existingProducts: Product[] = []
): ParsedInvoiceResult {
  const result: ParsedInvoiceResult = {
    supplierName: '',
    supplierPhone: '',
    supplierGst: '',
    invoiceNumber: '',
    invoiceDate: '',
    items: [],
    rawText
  };

  if (!rawText || rawText.trim().length === 0) return result;

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  // 1. Extract GSTIN
  const gstMatch = rawText.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/);
  if (gstMatch) result.supplierGst = gstMatch[0];

  // 2. Extract Phone (10 digits starting with 6-9)
  const phoneMatch = rawText.match(/(?:Phone|Ph|Contact|Mobile|Mob)?(?:\s*no\.?)?\s*[:\-]?\s*([6-9]\d{9})\b/i);
  if (phoneMatch) result.supplierPhone = phoneMatch[1];

  // 3. Extract Invoice Number
  const invMatch = rawText.match(/(?:Invoice\s*No\.?|Inv\s*No\.?|Bill\s*No\.?|Doc\s*No\.?|Tax\s*Invoice\s*No\.?)\s*[:\-]?\s*([A-Za-z0-9\/\-_]+)/i);
  if (invMatch) result.invoiceNumber = invMatch[1];

  // 4. Extract Date
  const dateMatch = rawText.match(/(?:Date|Inv\s*Date|Bill\s*Date)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (dateMatch) {
    const rawD = dateMatch[1].replace(/[\/\.]/g, '-');
    const parts = rawD.split('-');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      result.invoiceDate = `${y}-${m}-${d}`;
    }
  }

  // 5. Extract Supplier Name (top 12 lines, look for enterprise / company keywords, skip headers)
  for (let i = 0; i < Math.min(12, lines.length); i++) {
    const line = lines[i];
    if (isTableHeader(line) || isAddressOrMetadataLine(line)) continue;
    if (/ENTERPRISES|TRADERS|DISTRIBUTORS|DISTRIBUTOR|WHOLESALE|AGENCIES|COMPANY|FOODS|INDUSTRIES|SUPPLIERS|MART|CORP|PVT|LTD/i.test(line)) {
      result.supplierName = line.replace(/^(BY|FROM|M\/S|TAX INVOICE)\s*/i, '').trim();
      break;
    }
  }

  // Fallback: first substantial line that isn't a generic header
  if (!result.supplierName && lines.length > 0) {
    const candidate = lines.slice(0, 8).find(l => 
      !/TAX INVOICE|BILL TO|INVOICE DETAILS|ORIGINAL FOR RECIPIENT|RETAIL INVOICE/i.test(l) &&
      !isAddressOrMetadataLine(l) &&
      l.length >= 4 && l.length <= 45
    );
    if (candidate) result.supplierName = candidate;
  }

  // 6. Find Table Header line index
  let tableHeaderIdx = lines.findIndex(l => isTableHeader(l));
  const startIdx = tableHeaderIdx !== -1 ? tableHeaderIdx + 1 : 2;

  // 7. Extract Line Items with Mathematical Invariant Verification
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];

    // Stop parsing if reached totals or bank footer
    if (isTableFooter(line)) break;

    // Skip address or party header lines that appear mid-document
    if (isAddressOrMetadataLine(line)) continue;

    // Extract all numbers on this line
    const numMatches = line.match(/\d+(?:\.\d+)?/g);
    if (!numMatches || numMatches.length < 2) continue;

    const allNums = numMatches.map(n => parseFloat(n)).filter(n => !isNaN(n) && n > 0);
    if (allNums.length < 2) continue;

    // Clean text by removing numbers and special chars
    let itemName = cleanItemText(
      line
        .replace(/\b\d+(?:\.\d+)?\b/g, '')
        .replace(/[₹\(\)\*,\-]/g, ' ')
    );

    // Skip lines with too few letters (noise lines)
    const letterCount = (itemName.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < 3) continue;

    // Detect potential HSN code (4, 6 or 8 digit integer e.g. 34011941, 15121910)
    let detectedHsn = '';
    const hsnCandidate = allNums.find(n => 
      Number.isInteger(n) && 
      (n >= 1000 && n <= 99999999) && 
      (n.toString().length === 4 || n.toString().length === 6 || n.toString().length === 8)
    );
    if (hsnCandidate) {
      detectedHsn = String(hsnCandidate);
    }

    // Filter out HSN code and absurdly large numbers (> 200,000)
    const validNums = allNums.filter(n => n !== hsnCandidate && n < 200000);
    if (validNums.length === 0) continue;

    let qty = 1;
    let rate = 0;
    let mrp = 0;
    let total = 0;
    let foundMathMatch = false;

    // ── MATHEMATICAL INVARIANT ENGINE: Test (q, r) permutations against (total) ──
    for (let qi = 0; qi < validNums.length; qi++) {
      const qCandidate = validNums[qi];
      // Quantities in wholesale are typically 1 to 500
      if (qCandidate <= 0 || qCandidate > 500) continue;

      for (let ri = 0; ri < validNums.length; ri++) {
        if (qi === ri) continue;
        const rCandidate = validNums[ri];
        if (rCandidate <= 0.5 || rCandidate > 10000) continue;

        const expectedTotal = qCandidate * rCandidate;

        for (let ti = 0; ti < validNums.length; ti++) {
          if (ti === qi || ti === ri) continue;
          const tCandidate = validNums[ti];

          // Check if (q * r ≈ total) within 1.5 tolerance (accounting for rounding/cents)
          if (Math.abs(expectedTotal - tCandidate) <= 2.0 || Math.abs(expectedTotal * 1.05 - tCandidate) <= 3.0) {
            qty = Math.round(qCandidate);
            rate = Number(rCandidate.toFixed(2));
            total = Number(tCandidate.toFixed(2));
            foundMathMatch = true;
            break;
          }
        }
        if (foundMathMatch) break;
      }
      if (foundMathMatch) break;
    }

    // Fallback heuristic if mathematical triangulation wasn't found
    if (!foundMathMatch) {
      // Small integer (1-200) is quantity
      const plausibleQty = validNums.find(n => Number.isInteger(n) && n >= 1 && n <= 250);
      qty = plausibleQty || 1;

      // Rate: reasonable price (between 5 and 3000), not equal to qty
      const plausibleRate = validNums.find(n => n !== qty && n >= 2 && n <= 3000);
      rate = plausibleRate ? Number(plausibleRate.toFixed(2)) : 50;

      // Total = qty * rate (Never allow hallucinated huge totals!)
      total = Number((qty * rate).toFixed(2));
    }

    // Find plausible MRP (typically >= rate)
    const plausibleMrp = validNums.find(n => n >= rate && n !== qty && n !== total);
    mrp = plausibleMrp ? Number(plausibleMrp.toFixed(2)) : Math.round(rate * 1.2);

    // ── SMART FUZZY MATCHING (Store Inventory + Indian FMCG Catalog) ──
    let matchedProductId = '';
    let unit = 'pcs';
    let sellingPrice = mrp;
    let isNewProduct = true;

    // 1. Check Store Inventory
    const cleanSearch = itemName.toLowerCase();
    const storeMatch = existingProducts.find(p => {
      const pName = p.name.toLowerCase();
      return pName.includes(cleanSearch) || cleanSearch.includes(pName);
    });

    if (storeMatch) {
      matchedProductId = storeMatch.id;
      unit = storeMatch.unit || 'pcs';
      sellingPrice = storeMatch.sellingPrice || mrp;
      isNewProduct = false;
      itemName = storeMatch.name; // standardize to store name
    } else {
      // 2. Check 10,000+ Indian FMCG Catalog
      const fmcgMatches = searchFMCGCatalog(itemName);
      if (fmcgMatches && fmcgMatches.length > 0) {
        const top = fmcgMatches[0];
        itemName = top.name; // Clean typo-free FMCG brand name!
        unit = top.unit || 'pcs';
        if (mrp === 0 || mrp < top.mrp) mrp = top.mrp;
        sellingPrice = top.sellingPrice || mrp;
      }
    }

    result.items.push({
      id: crypto.randomUUID(),
      name: itemName,
      matchedProductId,
      hsn: detectedHsn,
      qty,
      unit,
      purchasePrice: rate,
      mrp,
      sellingPrice,
      gstPercent: 5,
      discount: 0,
      total,
      isNewProduct
    });
  }

  return result;
}

/**
 * Full Pipeline: Preprocesses image on Canvas -> Runs Tesseract OCR -> Parses with Math Invariants.
 */
export async function runInvoiceOcrPipeline(
  fileOrUrl: File | string,
  existingProducts: Product[] = [],
  onProgress?: (progress: number, status: string) => void
): Promise<ParsedInvoiceResult> {
  onProgress?.(15, 'Enhancing image contrast & removing shadows on Canvas...');
  const preprocessedUrl = await preprocessInvoiceImage(fileOrUrl);

  onProgress?.(30, 'Running neural OCR character recognition...');
  const res = await Tesseract.recognize(preprocessedUrl, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && m.progress) {
        const pct = 30 + Math.round(m.progress * 50); // 30% to 80%
        onProgress?.(pct, `Reading invoice text... ${Math.round(m.progress * 100)}%`);
      }
    }
  });

  const text = res?.data?.text || '';
  onProgress?.(85, 'Applying mathematical invariant engine & catalog matching...');

  const parsed = parseInvoiceAdvanced(text, existingProducts);
  onProgress?.(100, 'Invoice items successfully extracted!');
  return parsed;
}
