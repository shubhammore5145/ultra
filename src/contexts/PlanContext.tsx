import { createContext, useContext, useState, type ReactNode } from 'react';

export type PlanType = 'free' | 'plus' | 'pro' | 'ultra_pro';

export type FeatureKey = 
  | 'whatsapp_bills'
  | 'whatsapp_reminders'
  | 'barcode_print'
  | 'gstr1_reports'
  | 'voice_billing'
  | 'nightly_summary'
  | 'audio_soundbox'
  | 'demand_forecast'
  | 'multi_counter'
  | 'custom_branding'
  | 'ai_profit_engine'
  | 'loyalty_points'
  | 'multi_staff';

export interface FeatureMeta {
  key: FeatureKey;
  name: string;
  description: string;
  requiredPlan: PlanType;
  requiredPlanLabel: string;
  badge: string;
}

export const FEATURE_METAS: Record<FeatureKey, FeatureMeta> = {
  whatsapp_bills: {
    key: 'whatsapp_bills',
    name: 'WhatsApp Instant Digital Invoices & PDFs',
    description: 'Send itemized bills and downloadable PDF receipts directly to your customer WhatsApp.',
    requiredPlan: 'free',
    requiredPlanLabel: 'All Features Included',
    badge: '✓ Included'
  },
  whatsapp_reminders: {
    key: 'whatsapp_reminders',
    name: '1-Click WhatsApp Udhar Reminders with UPI Link',
    description: 'Automated khata collection messages with direct UPI payment links to recover customer credit 3x faster.',
    requiredPlan: 'free',
    requiredPlanLabel: 'All Features Included',
    badge: '✓ Included'
  },
  barcode_print: {
    key: 'barcode_print',
    name: 'Custom Barcode Sticker Label Generator',
    description: 'Design and print 1D/2D thermal barcode labels for loose grains, pulses, and unbranded items.',
    requiredPlan: 'free',
    requiredPlanLabel: 'All Features Included',
    badge: '✓ Included'
  },
  gstr1_reports: {
    key: 'gstr1_reports',
    name: 'CA-Ready GSTR-1 Tax & Excel Reports',
    description: '1-click export of sales, tax slabs, and expenses ready for your Chartered Accountant or GST audit.',
    requiredPlan: 'free',
    requiredPlanLabel: 'All Features Included',
    badge: '✓ Included'
  },
  voice_billing: {
    key: 'voice_billing',
    name: 'MartGPT AI Voice Billing Engine',
    description: 'Speak items naturally in Marathi, Hindi, or English to create lightning-fast bills without manual typing.',
    requiredPlan: 'free',
    requiredPlanLabel: 'All Features Included',
    badge: '✓ Included'
  },
  nightly_summary: {
    key: 'nightly_summary',
    name: 'Automated Daily Nightly WhatsApp Business Summary',
    description: 'Automated 9:30 PM report with daily sales, cash, UPI, profit, and udhar sent directly to your WhatsApp.',
    requiredPlan: 'free',
    requiredPlanLabel: 'All Features Included',
    badge: '✓ Included'
  },
  audio_soundbox: {
    key: 'audio_soundbox',
    name: 'Voice Audio Payment Soundbox',
    description: 'Spoken Marathi/Hindi audio announcements the exact second a cash or UPI payment is completed.',
    requiredPlan: 'free',
    requiredPlanLabel: 'All Features Included',
    badge: '✓ Included'
  },
  demand_forecast: {
    key: 'demand_forecast',
    name: 'AI Smart Demand Forecast & Fast-Moving Alerts',
    description: 'Intelligent inventory predictions to prevent stockouts of high-demand kirana items.',
    requiredPlan: 'free',
    requiredPlanLabel: 'All Features Included',
    badge: '✓ Included'
  },
  multi_counter: {
    key: 'multi_counter',
    name: 'Multi-Counter & Multi-Store Cloud Sync',
    description: 'Run multiple billing counters simultaneously or synchronize multiple supermarket branches in real time.',
    requiredPlan: 'free',
    requiredPlanLabel: 'All Features Included',
    badge: '✓ Included'
  },
  custom_branding: {
    key: 'custom_branding',
    name: 'Custom Logo & Personalized Store Branding',
    description: 'Display your own supermarket logo, address, and personalized footer on all customer WhatsApp invoices.',
    requiredPlan: 'free',
    requiredPlanLabel: 'All Features Included',
    badge: '✓ Included'
  },
  ai_profit_engine: {
    key: 'ai_profit_engine',
    name: 'MartGPT AI Profit & Dead-Stock Intelligence Engine',
    description: 'Deep product profitability analytics and stagnant capital clearance to boost store margins.',
    requiredPlan: 'free',
    requiredPlanLabel: 'All Features Included',
    badge: '✓ Included'
  },
  loyalty_points: {
    key: 'loyalty_points',
    name: 'Customer Loyalty Points & Festive WhatsApp Broadcast',
    description: 'Reward repeat shoppers with loyalty cashback points and broadcast festive promotional campaigns.',
    requiredPlan: 'free',
    requiredPlanLabel: 'All Features Included',
    badge: '✓ Included'
  },
  multi_staff: {
    key: 'multi_staff',
    name: 'Multi-Staff Cashier Accounts & Margin Lock',
    description: 'Cashier accounts with profit margin lock so staff cannot view wholesale purchase costs.',
    requiredPlan: 'free',
    requiredPlanLabel: 'All Features Included',
    badge: '✓ Included'
  }
};

interface PlanContextType {
  plan: PlanType;
  isExpired: boolean;
  isPaid: boolean;
  canAccess: (feature: FeatureKey) => boolean;
  requireFeature: (feature: FeatureKey, onAllowed?: () => void) => boolean;
  isUpgradeModalOpen: boolean;
  modalFeature: FeatureMeta | null;
  openUpgradeModal: (feature?: FeatureKey) => void;
  closeUpgradeModal: () => void;
  maxStaffAllowed: number;
}

const PlanContext = createContext<PlanContextType>({
  plan: 'ultra_pro',
  isExpired: false,
  isPaid: true,
  canAccess: () => true,
  requireFeature: (_f, onAllowed) => { if (onAllowed) onAllowed(); return true; },
  isUpgradeModalOpen: false,
  modalFeature: null,
  openUpgradeModal: () => {},
  closeUpgradeModal: () => {},
  maxStaffAllowed: 999
});

export const usePlan = () => useContext(PlanContext);

export const PlanProvider = ({ children }: { children: ReactNode }) => {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [modalFeature, setModalFeature] = useState<FeatureMeta | null>(null);

  // All features 100% unlocked with zero restrictions
  const effectivePlan: PlanType = 'ultra_pro';
  const isPaid = true;
  const isExpired = false;
  const maxStaffAllowed = 999;

  const canAccess = (_featureKey: FeatureKey): boolean => {
    return true; // Always unlocked
  };

  const openUpgradeModal = (_featureKey?: FeatureKey) => {
    // No-op: Premium plans modal removed
  };

  const closeUpgradeModal = () => {
    setIsUpgradeModalOpen(false);
    setModalFeature(null);
  };

  const requireFeature = (_featureKey: FeatureKey, onAllowed?: () => void): boolean => {
    if (onAllowed) onAllowed();
    return true;
  };

  return (
    <PlanContext.Provider
      value={{
        plan: effectivePlan,
        isExpired,
        isPaid,
        canAccess,
        requireFeature,
        isUpgradeModalOpen,
        modalFeature,
        openUpgradeModal,
        closeUpgradeModal,
        maxStaffAllowed
      }}
    >
      {children}
    </PlanContext.Provider>
  );
};
