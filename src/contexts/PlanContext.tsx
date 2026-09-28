import { createContext, useContext, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

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
    requiredPlan: 'plus',
    requiredPlanLabel: 'Plus, Pro, or Ultra Pro',
    badge: '🌟 Plus'
  },
  whatsapp_reminders: {
    key: 'whatsapp_reminders',
    name: '1-Click WhatsApp Udhar Reminders with UPI Link',
    description: 'Automated khata collection messages with direct UPI payment links to recover customer credit 3x faster.',
    requiredPlan: 'plus',
    requiredPlanLabel: 'Plus, Pro, or Ultra Pro',
    badge: '🌟 Plus'
  },
  barcode_print: {
    key: 'barcode_print',
    name: 'Custom Barcode Sticker Label Generator',
    description: 'Design and print 1D/2D thermal barcode labels for loose grains, pulses, and unbranded items.',
    requiredPlan: 'plus',
    requiredPlanLabel: 'Plus, Pro, or Ultra Pro',
    badge: '🌟 Plus'
  },
  gstr1_reports: {
    key: 'gstr1_reports',
    name: 'CA-Ready GSTR-1 Tax & Excel Reports',
    description: '1-click export of sales, tax slabs, and expenses ready for your Chartered Accountant or GST audit.',
    requiredPlan: 'plus',
    requiredPlanLabel: 'Plus, Pro, or Ultra Pro',
    badge: '🌟 Plus'
  },
  voice_billing: {
    key: 'voice_billing',
    name: 'MartGPT AI Voice Billing Engine',
    description: 'Speak items naturally in Marathi, Hindi, or English to create lightning-fast bills without manual typing.',
    requiredPlan: 'pro',
    requiredPlanLabel: 'Pro or Ultra Pro',
    badge: '⚡ Pro'
  },
  nightly_summary: {
    key: 'nightly_summary',
    name: 'Automated Daily Nightly WhatsApp Business Summary',
    description: 'Automated 9:30 PM report with daily sales, cash, UPI, profit, and udhar sent directly to your WhatsApp.',
    requiredPlan: 'pro',
    requiredPlanLabel: 'Pro or Ultra Pro',
    badge: '⚡ Pro'
  },
  audio_soundbox: {
    key: 'audio_soundbox',
    name: 'Voice Audio Payment Soundbox',
    description: 'Spoken Marathi/Hindi audio announcements the exact second a cash or UPI payment is completed.',
    requiredPlan: 'pro',
    requiredPlanLabel: 'Pro or Ultra Pro',
    badge: '⚡ Pro'
  },
  demand_forecast: {
    key: 'demand_forecast',
    name: 'AI Smart Demand Forecast & Fast-Moving Alerts',
    description: 'Intelligent inventory predictions to prevent stockouts of high-demand kirana items.',
    requiredPlan: 'pro',
    requiredPlanLabel: 'Pro or Ultra Pro',
    badge: '⚡ Pro'
  },
  multi_counter: {
    key: 'multi_counter',
    name: 'Multi-Counter & Multi-Store Cloud Sync',
    description: 'Run multiple billing counters simultaneously or synchronize multiple supermarket branches in real time.',
    requiredPlan: 'ultra_pro',
    requiredPlanLabel: 'Ultra Pro 👑',
    badge: '👑 Ultra Pro'
  },
  custom_branding: {
    key: 'custom_branding',
    name: 'Custom Logo & Personalized Store Branding',
    description: 'Display your own supermarket logo, address, and personalized footer on all customer WhatsApp invoices.',
    requiredPlan: 'ultra_pro',
    requiredPlanLabel: 'Ultra Pro 👑',
    badge: '👑 Ultra Pro'
  },
  ai_profit_engine: {
    key: 'ai_profit_engine',
    name: 'MartGPT AI Profit & Dead-Stock Intelligence Engine',
    description: 'Deep product profitability analytics and stagnant capital clearance to boost store margins.',
    requiredPlan: 'ultra_pro',
    requiredPlanLabel: 'Ultra Pro 👑',
    badge: '👑 Ultra Pro'
  },
  loyalty_points: {
    key: 'loyalty_points',
    name: 'Customer Loyalty Points & Festive WhatsApp Broadcast',
    description: 'Reward repeat shoppers with loyalty cashback points and broadcast festive promotional campaigns.',
    requiredPlan: 'ultra_pro',
    requiredPlanLabel: 'Ultra Pro 👑',
    badge: '👑 Ultra Pro'
  },
  multi_staff: {
    key: 'multi_staff',
    name: 'Multi-Staff Cashier Accounts & Margin Lock',
    description: 'Cashier accounts with profit margin lock so staff cannot view wholesale purchase costs.',
    requiredPlan: 'plus',
    requiredPlanLabel: 'Plus, Pro, or Ultra Pro',
    badge: '🌟 Plus'
  }
};

const PLAN_LEVELS: Record<PlanType, number> = {
  free: 0,
  plus: 1,
  pro: 2,
  ultra_pro: 3
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
  plan: 'free',
  isExpired: false,
  isPaid: false,
  canAccess: () => false,
  requireFeature: () => false,
  isUpgradeModalOpen: false,
  modalFeature: null,
  openUpgradeModal: () => {},
  closeUpgradeModal: () => {},
  maxStaffAllowed: 1
});

export const usePlan = () => useContext(PlanContext);

export const PlanProvider = ({ children }: { children: ReactNode }) => {
  const { shopData } = useAuth();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [modalFeature, setModalFeature] = useState<FeatureMeta | null>(null);

  // Compute effective plan
  const rawPlan = (shopData?.plan || 'free').toLowerCase();
  let normalizedPlan: PlanType = 'free';
  if (rawPlan.includes('ultra')) normalizedPlan = 'ultra_pro';
  else if (rawPlan.includes('pro')) normalizedPlan = 'pro';
  else if (rawPlan.includes('plus') || rawPlan.includes('growth')) normalizedPlan = 'plus';
  else normalizedPlan = 'free';

  // Expiry check
  let isExpired = false;
  if (normalizedPlan !== 'free' && shopData?.planExpiry) {
    const expiry = new Date(shopData.planExpiry);
    if (!isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
      isExpired = true;
    }
  }

  const effectivePlan: PlanType = isExpired ? 'free' : normalizedPlan;
  const isPaid = effectivePlan !== 'free';

  // Staff limits
  const maxStaffAllowed = effectivePlan === 'ultra_pro' ? 999 : effectivePlan === 'pro' ? 5 : effectivePlan === 'plus' ? 2 : 1;

  const canAccess = (featureKey: FeatureKey): boolean => {
    const meta = FEATURE_METAS[featureKey];
    if (!meta) return true;
    const requiredLevel = PLAN_LEVELS[meta.requiredPlan] || 0;
    const userLevel = PLAN_LEVELS[effectivePlan] || 0;
    return userLevel >= requiredLevel;
  };

  const openUpgradeModal = (featureKey?: FeatureKey) => {
    if (featureKey && FEATURE_METAS[featureKey]) {
      setModalFeature(FEATURE_METAS[featureKey]);
    } else {
      setModalFeature(null);
    }
    setIsUpgradeModalOpen(true);
  };

  const closeUpgradeModal = () => {
    setIsUpgradeModalOpen(false);
    setModalFeature(null);
  };

  const requireFeature = (featureKey: FeatureKey, onAllowed?: () => void): boolean => {
    if (canAccess(featureKey)) {
      if (onAllowed) onAllowed();
      return true;
    } else {
      openUpgradeModal(featureKey);
      return false;
    }
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
