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
  totalAmount: number;
  taxAmount: number;
  subtotal: number;
  items: CartItem[];
  paymentMethod: string;
  customerId?: string;
  createdAt: string;
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
