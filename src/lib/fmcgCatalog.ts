export interface FMCGTemplate {
  name: string;
  category: string;
  brand: string;
  unit: string;
  mrp: number;
  purchasePrice: number;
  sellingPrice: number;
  gst: number;
  barcode?: string;
  isLoose?: boolean;
}

export const INDIAN_FMCG_CATALOG: FMCGTemplate[] = [
  // Dairy & Staples
  { name: 'Amul Taaza Milk 500ml', category: 'Dairy', brand: 'Amul', unit: 'pkt', mrp: 27, purchasePrice: 25.5, sellingPrice: 27, gst: 0, barcode: '8901262010054' },
  { name: 'Amul Gold Milk 500ml', category: 'Dairy', brand: 'Amul', unit: 'pkt', mrp: 33, purchasePrice: 31.5, sellingPrice: 33, gst: 0, barcode: '8901262010061' },
  { name: 'Amul Butter 100g', category: 'Dairy', brand: 'Amul', unit: 'pcs', mrp: 58, purchasePrice: 53, sellingPrice: 56, gst: 12, barcode: '8901262010504' },
  { name: 'Amul Cow Ghee 500ml', category: 'Dairy', brand: 'Amul', unit: 'pcs', mrp: 325, purchasePrice: 295, sellingPrice: 315, gst: 12, barcode: '8901262012010' },
  { name: 'Gokul Special Milk 500ml', category: 'Dairy', brand: 'Gokul', unit: 'pkt', mrp: 34, purchasePrice: 32.5, sellingPrice: 34, gst: 0 },
  
  // Grains & Pulses (Loose & Packaged)
  { name: 'Tata Salt 1kg', category: 'Grains & Pulses', brand: 'Tata', unit: 'pkt', mrp: 28, purchasePrice: 23.5, sellingPrice: 27, gst: 0, barcode: '8901030000000' },
  { name: 'Aashirvaad Shudh Chakki Atta 5kg', category: 'Grains & Pulses', brand: 'Aashirvaad', unit: 'pkt', mrp: 265, purchasePrice: 232, sellingPrice: 255, gst: 5, barcode: '8901030383707' },
  { name: 'Aashirvaad Shudh Chakki Atta 10kg', category: 'Grains & Pulses', brand: 'Aashirvaad', unit: 'pkt', mrp: 495, purchasePrice: 440, sellingPrice: 480, gst: 5, barcode: '8901030383714' },
  { name: 'Fortune Sunlite Refined Sunflower Oil 1L', category: 'Grains & Pulses', brand: 'Fortune', unit: 'pkt', mrp: 145, purchasePrice: 125, sellingPrice: 138, gst: 5, barcode: '8906007280014' },
  { name: 'Gemini Sunflower Oil 1L', category: 'Grains & Pulses', brand: 'Gemini', unit: 'pkt', mrp: 140, purchasePrice: 122, sellingPrice: 135, gst: 5, barcode: '8906007281000' },
  { name: 'Loose Sugar', category: 'Grains & Pulses', brand: 'Kirana', unit: 'kg', mrp: 44, purchasePrice: 38, sellingPrice: 42, gst: 0, isLoose: true },
  { name: 'Loose Kolam Rice', category: 'Grains & Pulses', brand: 'Kirana', unit: 'kg', mrp: 65, purchasePrice: 54, sellingPrice: 60, gst: 0, isLoose: true },
  { name: 'Loose Basmati Rice', category: 'Grains & Pulses', brand: 'Kirana', unit: 'kg', mrp: 110, purchasePrice: 90, sellingPrice: 105, gst: 0, isLoose: true },
  { name: 'Loose Toor Dal', category: 'Grains & Pulses', brand: 'Kirana', unit: 'kg', mrp: 175, purchasePrice: 152, sellingPrice: 168, gst: 0, isLoose: true },
  { name: 'Loose Chana Dal', category: 'Grains & Pulses', brand: 'Kirana', unit: 'kg', mrp: 95, purchasePrice: 80, sellingPrice: 90, gst: 0, isLoose: true },
  { name: 'Loose Moong Dal', category: 'Grains & Pulses', brand: 'Kirana', unit: 'kg', mrp: 130, purchasePrice: 112, sellingPrice: 125, gst: 0, isLoose: true },
  { name: 'Loose Poha', category: 'Grains & Pulses', brand: 'Kirana', unit: 'kg', mrp: 55, purchasePrice: 44, sellingPrice: 50, gst: 0, isLoose: true },
  { name: 'Loose Groundnut / Peanuts', category: 'Grains & Pulses', brand: 'Kirana', unit: 'kg', mrp: 135, purchasePrice: 115, sellingPrice: 128, gst: 0, isLoose: true },

  // Snacks & Biscuits
  { name: 'Parle-G Glucose Biscuits 100g', category: 'Snacks', brand: 'Parle', unit: 'pkt', mrp: 10, purchasePrice: 8.6, sellingPrice: 10, gst: 18, barcode: '8901719101013' },
  { name: 'Parle-G Glucose Biscuits 250g', category: 'Snacks', brand: 'Parle', unit: 'pkt', mrp: 25, purchasePrice: 21.5, sellingPrice: 24, gst: 18, barcode: '8901719101037' },
  { name: 'Britannia Good Day Butter 100g', category: 'Snacks', brand: 'Britannia', unit: 'pkt', mrp: 20, purchasePrice: 16.8, sellingPrice: 19, gst: 18, barcode: '8901063013210' },
  { name: 'Britannia Marie Gold 250g', category: 'Snacks', brand: 'Britannia', unit: 'pkt', mrp: 35, purchasePrice: 29.5, sellingPrice: 33, gst: 18, barcode: '8901063012213' },
  { name: 'Sunfeast Dark Fantasy Choco Fills 75g', category: 'Snacks', brand: 'Sunfeast', unit: 'pkt', mrp: 40, purchasePrice: 33, sellingPrice: 38, gst: 18, barcode: '8901030424011' },
  { name: 'Maggi 2-Minute Masala Noodles 70g', category: 'Snacks', brand: 'Nestle', unit: 'pkt', mrp: 14, purchasePrice: 12.1, sellingPrice: 14, gst: 12, barcode: '8901058852331' },
  { name: 'Maggi Noodles 4-Pack 280g', category: 'Snacks', brand: 'Nestle', unit: 'pkt', mrp: 56, purchasePrice: 47.5, sellingPrice: 53, gst: 12, barcode: '8901058852348' },
  { name: 'Lay\'s India\'s Magic Masala 50g', category: 'Snacks', brand: 'Lays', unit: 'pkt', mrp: 20, purchasePrice: 16.8, sellingPrice: 20, gst: 12, barcode: '8901491101838' },
  { name: 'Kurkure Masala Munch 45g', category: 'Snacks', brand: 'Kurkure', unit: 'pkt', mrp: 20, purchasePrice: 16.8, sellingPrice: 20, gst: 12, barcode: '8901491102835' },
  { name: 'Haldiram\'s Bhujia Sev 200g', category: 'Snacks', brand: 'Haldiram', unit: 'pkt', mrp: 55, purchasePrice: 46, sellingPrice: 52, gst: 12, barcode: '8904004400115' },

  // Beverages & Breakfast
  { name: 'Red Label Tea 250g', category: 'Beverages', brand: 'Brooke Bond', unit: 'pkt', mrp: 140, purchasePrice: 121, sellingPrice: 135, gst: 5, barcode: '8901030013210' },
  { name: 'Wagh Bakri Leaf Tea 500g', category: 'Beverages', brand: 'Wagh Bakri', unit: 'pkt', mrp: 290, purchasePrice: 255, sellingPrice: 280, gst: 5, barcode: '8901764010114' },
  { name: 'Bru Instant Coffee 50g', category: 'Beverages', brand: 'Bru', unit: 'pcs', mrp: 95, purchasePrice: 82, sellingPrice: 90, gst: 18, barcode: '8901030022212' },
  { name: 'Bournvita Health Drink 500g', category: 'Beverages', brand: 'Cadbury', unit: 'pcs', mrp: 245, purchasePrice: 215, sellingPrice: 238, gst: 18, barcode: '8901233010112' },

  // Spices & Condiments
  { name: 'Everest Garam Masala 100g', category: 'Spices', brand: 'Everest', unit: 'pkt', mrp: 88, purchasePrice: 74, sellingPrice: 84, gst: 5, barcode: '8901786101112' },
  { name: 'Everest Turmeric / Haldi Powder 100g', category: 'Spices', brand: 'Everest', unit: 'pkt', mrp: 38, purchasePrice: 31, sellingPrice: 36, gst: 5, barcode: '8901786101211' },
  { name: 'Everest Tikhalal Chilli Powder 100g', category: 'Spices', brand: 'Everest', unit: 'pkt', mrp: 56, purchasePrice: 47, sellingPrice: 53, gst: 5, barcode: '8901786101310' },
  { name: 'Kissan Fresh Tomato Ketchup 500g', category: 'Spices', brand: 'Kissan', unit: 'pcs', mrp: 125, purchasePrice: 104, sellingPrice: 118, gst: 12, barcode: '8901030381017' },

  // Personal Care & Soaps
  { name: 'Dettol Original Soap 75g', category: 'Personal Care', brand: 'Dettol', unit: 'pcs', mrp: 40, purchasePrice: 33.5, sellingPrice: 38, gst: 18, barcode: '8901396111115' },
  { name: 'Lifebuoy Total Soap 100g', category: 'Personal Care', brand: 'Lifebuoy', unit: 'pcs', mrp: 36, purchasePrice: 30, sellingPrice: 34, gst: 18, barcode: '8901030033317' },
  { name: 'Dove Cream Beauty Bathing Bar 100g', category: 'Personal Care', brand: 'Dove', unit: 'pcs', mrp: 72, purchasePrice: 61, sellingPrice: 68, gst: 18, barcode: '8901030044412' },
  { name: 'Colgate Strong Teeth Toothpaste 100g', category: 'Personal Care', brand: 'Colgate', unit: 'pcs', mrp: 62, purchasePrice: 52, sellingPrice: 58, gst: 18, barcode: '8901314010118' },
  { name: 'Colgate MaxFresh Red Gel 150g', category: 'Personal Care', brand: 'Colgate', unit: 'pcs', mrp: 115, purchasePrice: 96, sellingPrice: 108, gst: 18, barcode: '8901314010217' },
  { name: 'Head & Shoulders Shampoo 180ml', category: 'Personal Care', brand: 'Head & Shoulders', unit: 'pcs', mrp: 180, purchasePrice: 150, sellingPrice: 170, gst: 18, barcode: '8901030055517' },
  { name: 'Clinic Plus Strong & Long Shampoo 175ml', category: 'Personal Care', brand: 'Clinic Plus', unit: 'pcs', mrp: 125, purchasePrice: 105, sellingPrice: 118, gst: 18, barcode: '8901030066612' },

  // Home Care & Cleaning
  { name: 'Surf Excel Quick Wash Detergent Powder 1kg', category: 'Home Care', brand: 'Surf Excel', unit: 'pkt', mrp: 155, purchasePrice: 133, sellingPrice: 148, gst: 18, barcode: '8901030077717' },
  { name: 'Rin Detergent Bar 250g', category: 'Home Care', brand: 'Rin', unit: 'pcs', mrp: 22, purchasePrice: 18.5, sellingPrice: 21, gst: 18, barcode: '8901030088812' },
  { name: 'Vim Dishwash Bar 300g', category: 'Home Care', brand: 'Vim', unit: 'pcs', mrp: 25, purchasePrice: 20.8, sellingPrice: 24, gst: 18, barcode: '8901030099917' },
  { name: 'Vim Dishwash Gel 500ml', category: 'Home Care', brand: 'Vim', unit: 'pcs', mrp: 130, purchasePrice: 108, sellingPrice: 122, gst: 18, barcode: '8901030101016' },
  { name: 'Harpic Toilet Cleaner 500ml', category: 'Home Care', brand: 'Harpic', unit: 'pcs', mrp: 99, purchasePrice: 83, sellingPrice: 94, gst: 18, barcode: '8901396201014' },
  { name: 'Lizol Floor Cleaner Citrus 500ml', category: 'Home Care', brand: 'Lizol', unit: 'pcs', mrp: 110, purchasePrice: 92, sellingPrice: 104, gst: 18, barcode: '8901396202011' }
];

export function searchFMCGCatalog(query: string): FMCGTemplate[] {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();
  return INDIAN_FMCG_CATALOG.filter(item => 
    item.name.toLowerCase().includes(q) ||
    item.brand.toLowerCase().includes(q) ||
    item.category.toLowerCase().includes(q) ||
    (item.barcode && item.barcode.includes(q))
  );
}

export function findFMCGByBarcode(barcode: string): FMCGTemplate | undefined {
  if (!barcode) return undefined;
  const clean = barcode.trim();
  return INDIAN_FMCG_CATALOG.find(item => item.barcode === clean);
}
