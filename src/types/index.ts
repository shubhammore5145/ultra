export type Role = 'admin' | 'staff';

export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  shopId: string;
  permissions?: string[];
}

export interface Shop {
  shopId: string;
  shopName?: string;
  name: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  gstNumber: string;
  upiId?: string;
  plan?: 'free' | 'pro';
  planExpiry?: string; // ISO String date for subscription expiry
  settings: {
    invoicePrefix: string;
    currency: string;
    taxEnabled: boolean;
  };
}

export interface ProductVariant {
  id: string;
  name: string; // e.g. "150 gm", "500 gm", "1 kg", "1 Liter"
  unit?: string;
  barcode?: string;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  bulkMinQty?: number;
  bulkPrice?: number;
  mrp: number;
  gst: number;
  stock: number;
  minStock: number;
  maxStock?: number;
  reorderQty?: number;
  rackLocation?: string; // e.g. "Rack A-1", "Shelf 3"
  sku: string;
  barcode: string;
  shortCode?: string;
  isLoose?: boolean | number;
  expiryDate?: string;
  imageUrl?: string;
  variants?: ProductVariant[];
  isDeleted?: number | boolean;
  deletedAt?: string;
  createdAt: string;
}

export interface CartItem extends Product {
  qty: number;
  variantId?: string;
  variantName?: string;
  rateType?: 'retail' | 'wholesale';
  originalPrice?: number;
}

export interface Transaction {
  id: string;
  items: CartItem[];
  subtotal: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  paymentMethod: 'cash' | 'upi' | 'udhar' | 'card' | 'split';
  splitAmounts?: { cash: number; upi: number; udhar: number };
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  isDeleted?: number | boolean;
  deletedAt?: string;
  createdAt: string; // ISO string
}

export interface Expense {
  id: string;
  shopId: string;
  category: 'Salary' | 'Electricity' | 'Stock' | 'Rent' | 'Maintenance' | 'Other';
  amount: number;
  description: string;
  date: string; // ISO string
  addedBy: string; // userId
  createdAt: string; // ISO string
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  balance: number; // Positive means they owe money (Udhar)
  loyaltyPoints?: number;
  visits?: number;
  totalSpent?: number;
  aadharNumber?: string;
  photoUrl?: string;
  aadharPhotoUrl?: string;
  isDeleted?: number | boolean;
  deletedAt?: string;
  createdAt: string;
}

export interface UdharTransaction {
  id: string;
  customerId: string;
  amount: number;
  type: 'credit' | 'payment'; // credit = gave udhar, payment = received money
  notes: string;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  shopId?: string;
  name: string;
  phone?: string;
  role: 'Cashier' | 'Helper' | 'Sales' | 'Delivery' | 'Manager' | 'Cleaner' | string;
  salaryType: 'monthly' | 'daily';
  salary: number;
  joinDate?: string;
  address?: string;
  status: 'active' | 'inactive';
  permissions?: string[];
  createdAt?: string;
}

export interface StaffAttendance {
  id: string;
  shopId?: string;
  staffId: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'half_day' | 'paid_leave';
  notes?: string;
  createdAt?: string;
}

export interface StaffSalaryPayment {
  id: string;
  shopId?: string;
  staffId: string;
  amount: number;
  type: 'salary' | 'advance' | 'bonus' | 'deduction';
  monthYear: string; // YYYY-MM
  paymentDate: string; // YYYY-MM-DD
  paymentMethod: 'Cash' | 'UPI' | 'Bank';
  notes?: string;
  createdAt?: string;
}

export interface RecycleBinData {
  products: Product[];
  transactions: Transaction[];
  customers: Customer[];
}

// D-Mart Enterprise Extension Types
export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'inward_purchase' | 'outward_sale' | 'return_inward' | 'damaged_loss' | 'expired_loss' | 'audit_adjustment';
  qty: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  referenceId?: string;
  createdAt: string;
}

export interface DamagedItem {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  costPrice: number;
  totalLoss: number;
  reason: 'broken' | 'leaked' | 'expired' | 'rodent_pest' | 'packaging_torn' | 'other';
  notes?: string;
  createdAt: string;
}

export interface SalesReturn {
  id: string;
  originalBillId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  items: {
    productId: string;
    productName: string;
    qty: number;
    sellingPrice: number;
    refundAmount: number;
    condition: 'resellable' | 'damaged';
  }[];
  totalRefund: number;
  refundMethod: 'cash' | 'credit_note' | 'upi';
  reason: string;
  createdAt: string;
}

export interface CashCounterClosing {
  id: string;
  cashierName: string;
  openingCash: number;
  cashSales: number;
  cashReturns: number;
  cashExpenses: number;
  expectedCash: number;
  actualCountedCash: number;
  discrepancy: number; // actual - expected
  notes?: string;
  closedAt: string;
}
