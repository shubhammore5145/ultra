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
  settings: {
    invoicePrefix: string;
    currency: string;
    taxEnabled: boolean;
  };
}

export interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  gst: number;
  stock: number;
  minStock: number;
  sku: string;
  barcode: string;
  expiryDate?: string;
  createdAt: string;
}

export interface CartItem extends Product {
  qty: number;
}

export interface Transaction {
  id: string;
  items: CartItem[];
  subtotal: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  paymentMethod: 'cash' | 'upi' | 'udhar';
  customerId?: string;
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
  visits?: number;
  totalSpent?: number;
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
