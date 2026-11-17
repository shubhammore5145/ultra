import { 
  ShoppingCart, Receipt, Package, Barcode, ClipboardList, 
  Users, CreditCard, ArrowLeftRight, Wallet, FileText, 
  TrendingUp, UserCheck, Trash2, Settings, Shield
} from 'lucide-react';
import type { UserData } from '../types';

export interface PermissionDef {
  id: string;
  name: string;
  marathiName: string;
  description: string;
  category: 'Billing' | 'Inventory' | 'Khata & Finance' | 'Management';
  icon: any;
  defaultCashier: boolean;
}

export const APP_PERMISSIONS: PermissionDef[] = [
  // 1. Billing
  {
    id: 'pos',
    name: 'POS Billing',
    marathiName: 'Checkout & Fast Billing',
    description: 'Create bills, scan product barcodes & take payments',
    category: 'Billing',
    icon: ShoppingCart,
    defaultCashier: true,
  },
  {
    id: 'bill_store',
    name: 'Bill Store & Receipts',
    marathiName: 'Invoices & Thermal Print',
    description: 'View past bills, reprint receipts and WhatsApp bills',
    category: 'Billing',
    icon: Receipt,
    defaultCashier: true,
  },
  {
    id: 'customers',
    name: 'Customer Directory',
    marathiName: 'Customer Accounts & Loyalty',
    description: 'Add and view customer contact and loyalty info',
    category: 'Billing',
    icon: Users,
    defaultCashier: true,
  },

  // 2. Inventory
  {
    id: 'products',
    name: 'Products & Pricing',
    marathiName: 'Item Master & Pricing',
    description: 'View products, edit selling prices and add stock',
    category: 'Inventory',
    icon: Package,
    defaultCashier: true,
  },
  {
    id: 'barcode_print',
    name: 'Barcode Sticker Print',
    marathiName: 'Barcode Label Printing',
    description: 'Generate and print custom barcode stickers',
    category: 'Inventory',
    icon: Barcode,
    defaultCashier: true,
  },
  {
    id: 'inventory_ai',
    name: 'Smart Stock & AI Insights',
    marathiName: 'Stock Audits & Alerts',
    description: 'View low-stock alerts, expiry tracking and restocking',
    category: 'Inventory',
    icon: ClipboardList,
    defaultCashier: false,
  },
  {
    id: 'purchases',
    name: 'Suppliers & Purchases',
    marathiName: 'Wholesaler Purchases & Stock-In',
    description: 'Enter purchase bills from wholesale distributors',
    category: 'Inventory',
    icon: ArrowLeftRight,
    defaultCashier: false,
  },

  // 3. Khata & Finance
  {
    id: 'udhar',
    name: 'Udhar / Khata Book',
    marathiName: 'Customer Credit Ledger',
    description: 'Track customer udhar, send WhatsApp reminders & record repayments',
    category: 'Khata & Finance',
    icon: CreditCard,
    defaultCashier: false,
  },
  {
    id: 'expenses',
    name: 'Shop Expenses',
    marathiName: 'Daily Operating Expenses',
    description: 'Record daily shop operational expenses (chai, light bill, rent)',
    category: 'Khata & Finance',
    icon: Wallet,
    defaultCashier: false,
  },
  {
    id: 'reports',
    name: 'Reports & Day-Close',
    marathiName: 'Sales & Profit Reports',
    description: 'View daily profit, gross sales, GST reports and Z-close',
    category: 'Khata & Finance',
    icon: FileText,
    defaultCashier: false,
  },
  {
    id: 'analytics',
    name: 'Digital Sales Analytics',
    marathiName: 'Traffic & Sales Velocity',
    description: 'Hourly customer footfall and product sales velocity trends',
    category: 'Khata & Finance',
    icon: TrendingUp,
    defaultCashier: false,
  },

  // 4. Management & Admin
  {
    id: 'staff',
    name: 'Staff & Attendance',
    marathiName: 'Employee Shifts & Payroll',
    description: 'Track staff daily attendance, advances and monthly salary slips',
    category: 'Management',
    icon: UserCheck,
    defaultCashier: false,
  },
  {
    id: 'recycle_bin',
    name: 'Recycle Bin',
    marathiName: 'Recovery & Trash',
    description: 'Restore accidentally deleted bills, products or customers',
    category: 'Management',
    icon: Trash2,
    defaultCashier: false,
  },
  {
    id: 'settings',
    name: 'Store & Hardware Settings',
    marathiName: 'Hardware & Shop Config',
    description: 'Configure thermal printers, WhatsApp automation and store details',
    category: 'Management',
    icon: Settings,
    defaultCashier: false,
  },
];

export interface RolePreset {
  id: string;
  name: string;
  marathiName: string;
  description: string;
  color: string;
  permissions: string[];
}

export const STAFF_ROLE_PRESETS: RolePreset[] = [
  {
    id: 'cashier',
    name: 'Cashier (Billing Only)',
    marathiName: 'Cashier (Billing Only)',
    description: 'Can only scan barcodes, make bills and add customers. Cannot see profit, expenses or reports.',
    color: 'emerald',
    permissions: ['pos', 'bill_store', 'customers'],
  },
  {
    id: 'sales_clerk',
    name: 'Sales & Inventory Clerk',
    marathiName: 'Sales & Stock Assistant',
    description: 'Can bill items, view products and print barcode labels.',
    color: 'blue',
    permissions: ['pos', 'bill_store', 'products', 'barcode_print', 'customers'],
  },
  {
    id: 'store_manager',
    name: 'Store Manager',
    marathiName: 'Store General Manager',
    description: 'Full access to billing, products, udhar, purchases, expenses and daily reports.',
    color: 'indigo',
    permissions: [
      'pos', 'bill_store', 'products', 'barcode_print', 'inventory_ai', 
      'customers', 'udhar', 'purchases', 'expenses', 'reports'
    ],
  },
  {
    id: 'all_access',
    name: 'All Access (Everything)',
    marathiName: 'Owner / Full Access',
    description: 'Access to all 14 store modules and features.',
    color: 'amber',
    permissions: APP_PERMISSIONS.map(p => p.id),
  },
];

/**
 * Check whether a user has permission to access a specific module
 */
export function hasPermission(userData: UserData | null | undefined, permissionKey: string): boolean {
  if (!userData) return false;

  // 1. Admin always has access to everything
  if (userData.role === 'admin') return true;

  // 2. Notifications and Support are accessible to all logged in users
  if (permissionKey === 'notifications' || permissionKey === 'support') return true;

  // 3. Custom assigned permissions
  if (Array.isArray(userData.permissions) && userData.permissions.length > 0) {
    return userData.permissions.includes(permissionKey);
  }

  // 4. Fallback for unconfigured cashier / staff accounts
  const def = APP_PERMISSIONS.find(p => p.id === permissionKey);
  return def ? def.defaultCashier : false;
}
