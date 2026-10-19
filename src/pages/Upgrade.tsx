import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { 
  Check, 
  Crown, 
  Loader2, 
  Sparkles, 
  AlertCircle, 
  MessageSquare, 
  Zap, 
  Mic, 
  Receipt, 
  Store, 
  Layers, 
  Tag, 
  X, 
  HelpCircle, 
  Star, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Cloud, 
  PhoneCall 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PlanFeature {
  title: string;
  subtitle?: string;
  badge?: string;
  isNew?: boolean;
}

interface AppliedCoupon {
  code: string;
  discountPercent: number;
  flatDiscount: number;
  discountAmount: number;
  finalPrice: number;
  originalPrice: number;
  message: string;
}

export type BillingCycle = '3months' | '6months' | 'yearly' | 'lifetime';

export default function Upgrade() {
  const { shopData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  
  // Coupon code states
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  const navigate = useNavigate();

  const currentPlan = (shopData?.plan || '').toLowerCase();
  const isUltraPro = currentPlan === 'ultra_pro';
  const isPro = currentPlan === 'pro';
  const isPlus = currentPlan === 'plus';

  // Base pricing configuration for 3 Months, 6 Months, 1 Year, and Lifetime
  const prices: Record<string, Record<BillingCycle, { price: number; paise: number; days: number; period: string; save?: string }>> = {
    plus: {
      '3months': { price: 499, paise: 49900, days: 90, period: '/3 months', save: 'Save ₹98 (16% OFF)' },
      '6months': { price: 899, paise: 89900, days: 180, period: '/6 months', save: 'Save ₹295 (25% OFF)' },
      'yearly': { price: 1599, paise: 159900, days: 365, period: '/year', save: 'Save ₹797 (33% OFF)' },
      'lifetime': { price: 3999, paise: 399900, days: 36500, period: 'One-time', save: 'Lifetime Access • Best Value' }
    },
    pro: {
      '3months': { price: 999, paise: 99900, days: 90, period: '/3 months', save: 'Save ₹198 (16% OFF)' },
      '6months': { price: 1799, paise: 179900, days: 180, period: '/6 months', save: 'Save ₹595 (25% OFF)' },
      'yearly': { price: 2999, paise: 299900, days: 365, period: '/year', save: 'Save ₹1,795 (37% OFF)' },
      'lifetime': { price: 6999, paise: 699900, days: 36500, period: 'One-time', save: 'Lifetime VIP Access • Never Pay Again' }
    },
    ultra: {
      '3months': { price: 1399, paise: 139900, days: 90, period: '/3 months', save: 'Save ₹298 (18% OFF)' },
      '6months': { price: 2499, paise: 249900, days: 180, period: '/6 months', save: 'Save ₹895 (26% OFF)' },
      'yearly': { price: 4499, paise: 449900, days: 365, period: '/year', save: 'Save ₹2,695 (37% OFF)' },
      'lifetime': { price: 9999, paise: 999900, days: 36500, period: 'One-time', save: 'Lifetime Enterprise VIP • All Unlocked' }
    }
  };

  // Helper to calculate price with coupon applied
  const getCalculatedPrice = (basePrice: number) => {
    if (!appliedCoupon) return { final: basePrice, discount: 0 };
    let discount = 0;
    if (appliedCoupon.discountPercent > 0) {
      discount = Math.round((basePrice * appliedCoupon.discountPercent) / 100);
    } else if (appliedCoupon.flatDiscount > 0) {
      discount = Math.min(appliedCoupon.flatDiscount, basePrice);
    }
    const final = Math.max(1, basePrice - discount);
    return { final, discount };
  };

  // Handle coupon validation
  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponInput).trim().toUpperCase();
    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }

    setCouponLoading(true);
    setCouponError(null);

    try {
      const benchmarkPrice = prices.ultra[billingCycle].price;
      const res = await api.coupons.validate({
        code,
        planName: 'ultra_pro',
        price: benchmarkPrice
      });

      if (res.success) {
        setAppliedCoupon({
          code: res.code,
          discountPercent: res.discountPercent,
          flatDiscount: res.flatDiscount,
          discountAmount: res.discountAmount,
          finalPrice: res.finalPrice,
          originalPrice: res.originalPrice,
          message: res.message
        });
        setCouponInput('');
      } else {
        setCouponError(res.error || 'Invalid coupon code');
        setAppliedCoupon(null);
      }
    } catch (err: any) {
      setCouponError(err.message || 'Unable to apply coupon. Please try again.');
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  // Razorpay Upgrade Trigger
  const handleUpgrade = async (days: number, basePrice: number, planName: string) => {
    if (!shopData?.shopId) return;
    
    setLoading(true);

    const { final: finalPayable } = getCalculatedPrice(basePrice);
    const amountInPaise = finalPayable * 100;
    
    const cycleLabel = 
      days >= 30000 ? 'Lifetime Access' :
      days === 365 ? '1 Year' :
      days === 180 ? '6 Months' :
      days === 90 ? '3 Months' : `${days} Days`;

    const options = {
      key: 'rzp_live_TUJQRz220FyjLO',
      amount: amountInPaise,
      currency: 'INR',
      name: 'MartGPT',
      description: `${planName} Subscription (${cycleLabel})${appliedCoupon ? ` - Promo: ${appliedCoupon.code}` : ''}`,
      handler: async function (_response: any) {
        try {
          let expiryDate: string | null = null;
          if (days >= 30000) {
            // Lifetime plan: 100 years future expiry
            const d = new Date();
            d.setFullYear(d.getFullYear() + 100);
            expiryDate = d.toISOString();
          } else {
            const d = new Date();
            d.setDate(d.getDate() + days);
            expiryDate = d.toISOString();
          }

          let normalizedPlan = 'pro';
          const p = planName.toLowerCase();
          if (p.includes('ultra')) normalizedPlan = 'ultra_pro';
          else if (p.includes('pro')) normalizedPlan = 'pro';
          else if (p.includes('plus')) normalizedPlan = 'plus';

          await api.shops.upgradePlan({
            plan: normalizedPlan,
            planExpiry: expiryDate,
            couponCode: appliedCoupon?.code
          });

          alert(`🎉 Congratulations! Your store has been upgraded to ${planName} successfully!`);
          navigate('/');
        } catch (err) {
          console.error(err);
          alert("Failed to upgrade plan. Please contact our support team.");
        } finally {
          setLoading(false);
        }
      },
      prefill: {
        name: shopData?.shopName || shopData?.name || '',
        contact: shopData?.phone || '',
      },
      theme: {
        color: '#4f46e5'
      }
    };
    
    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        alert(`Payment Failed: ${response.error.description}`);
        setLoading(false);
      });
      rzp.open();
    } catch (e) {
      alert("Razorpay payment gateway is loading... please check your connection and try again.");
      setLoading(false);
    }
  };

  // Features by plan
  const plusFeatures: PlanFeature[] = [
    { title: '⚡ Instant WhatsApp Digital Bills & PDFs', subtitle: 'Send itemized bills and downloadable PDF receipts with 1 click', isNew: true },
    { title: '📲 1-Click WhatsApp Udhar Reminders', subtitle: 'Automated khata collection messages with instant UPI Pay Link', isNew: true },
    { title: '🏷️ Custom Barcode Sticker Generator', subtitle: 'Generate and print 1D/2D barcode labels for loose items' },
    { title: '📑 CA-Ready GSTR-1 & Financial Reports', subtitle: '1-click export of sales, tax, and expenses for CA tax filing' },
    { title: '👥 Multi-Staff (Up to 2 Cashiers)', subtitle: 'Independent cashier logins with restricted admin rights' },
    { title: '☁️ Realtime Cloud Sync & Multi-Device', subtitle: 'Seamlessly access POS from phone, tablet, and PC simultaneously' }
  ];

  const proFeatures: PlanFeature[] = [
    { title: '👑 Everything in Plus Plan included', subtitle: 'All WhatsApp billing and tax tools unlocked' },
    { title: '🎙️ MartGPT AI Voice Billing Engine', subtitle: 'Speak items in Marathi, Hindi, or English to create lightning-fast bills', isNew: true },
    { title: '🌙 Daily Nightly Business WhatsApp Summary', subtitle: 'Automated 9:30 PM report with daily sales, cash, UPI, profit & udhar', isNew: true },
    { title: '🔊 Voice Audio Payment Soundbox', subtitle: 'Spoken audio alert in Marathi/Hindi the second a payment is received', isNew: true },
    { title: '📊 AI Smart Demand Forecast & Stock Alerts', subtitle: 'Intelligent predictions on fast-moving goods and low stock warnings', isNew: true },
    { title: '👥 Multi-Staff (Up to 5 Cashiers)', subtitle: 'Cashier accounts with profit margin lock so staff cannot view profit' },
    { title: '🚀 Priority Phone & WhatsApp Support', subtitle: 'Fast-track technical and billing assistance from our team' }
  ];

  const ultraFeatures: PlanFeature[] = [
    { title: '👑 Everything in Pro Plan included', subtitle: 'Uncapped access to all AI and automation tools' },
    { title: '🏢 Multi-Counter & Multi-Store Cloud Sync', subtitle: 'Run multiple billing counters or manage multiple store branches in 1 app', isNew: true },
    { title: '🏷️ Custom Logo & Shop Branding on WhatsApp', subtitle: 'Your store logo, business name, address & personalized footer on all bills', isNew: true },
    { title: '🧠 MartGPT AI Profit & Dead-Stock Engine', subtitle: 'Deep AI analytics on highest-margin products & stagnant capital clearance', isNew: true },
    { title: '🎯 Customer Loyalty Points & Festival Campaigns', subtitle: 'Reward repeat customers with points and send festive WhatsApp broadcast offers', isNew: true },
    { title: '📦 Free 1-on-1 Old Data Migration', subtitle: 'Our technical team transfers all products & customers from Excel/old software' },
    { title: '👥 Unlimited Cashier & Staff Accounts', subtitle: 'No user limits with granular role permissions and cashier lockdown' },
    { title: '🛡️ Dedicated 24/7 VIP Personal Account Manager', subtitle: 'Direct personal WhatsApp hotline with top-priority resolution' }
  ];

  const faqs = [
    {
      q: 'How does WhatsApp Digital Billing and the Nightly Summary work?',
      a: 'MartGPT connects securely with WhatsApp. Each time you finalize a bill, a single click delivers an itemized digital bill and PDF invoice directly to your customer. Every night at your scheduled time (e.g., 9:30 PM), a comprehensive End-of-Day summary detailing total sales, cash, UPI, khata udhar, and low stock is delivered automatically to your phone!'
    },
    {
      q: 'Why is Ultra Pro recommended as the best value for supermarkets?',
      a: 'Ultra Pro is built specifically for growth-oriented retail stores and multi-counter supermarkets. It includes unlimited multi-counter sync, your custom store logo on WhatsApp bills, our AI Dead-Stock & Profit Engine to boost net profit by 15-20%, customer loyalty points, and a dedicated 24/7 VIP Account Manager.'
    },
    {
      q: 'What subscription durations are available (3 Months, 6 Months, 1 Year, Lifetime)?',
      a: 'You can choose between 3 Months, 6 Months, 1 Year, or Lifetime. With the Lifetime plan, you make a single one-time payment and never have to pay renewal fees again, with permanent access to all corresponding features and upcoming updates!'
    },
    {
      q: 'How do Promo Codes work on MartGPT?',
      a: 'Simply enter your coupon code (e.g. DIWALI50 or WELCOME100) into the Promo Code box and click Apply. The discount will instantly recalculate across all plans, showing you exact savings before Razorpay checkout.'
    },
    {
      q: 'Can I switch or upgrade my plan at any time?',
      a: 'Yes, anytime! Your new plan takes effect immediately upon completing the payment through Razorpay.'
    },
    {
      q: 'Is my retail store data safe and backed up?',
      a: 'Absolutely 100% secure. Your catalog, transactions, customers, and khata records are encrypted and continuously backed up to TiDB Serverless Cloud. Even if your phone or computer crashes, you will never lose a single transaction.'
    },
    {
      q: 'Do I need a computer or a thermal printer to use MartGPT?',
      a: 'Not at all! MartGPT runs smoothly on mobile phones, tablets, laptops, and desktop computers. You can print physical thermal receipts via Bluetooth/USB or issue digital WhatsApp bills directly with zero paper cost.'
    },
    {
      q: 'What payment options are supported?',
      a: 'We accept Google Pay, PhonePe, Paytm, all UPI apps, Visa/Mastercard/RuPay Credit & Debit Cards, and Net Banking via Razorpay.'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 px-4 sm:px-6">
      
      {/* ── 1. Hero Header ── */}
      <div className="text-center space-y-4 pt-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 font-bold text-xs uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
          Next-Gen AI Retail & Supermarket Operating System
        </div>
        
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground flex items-center justify-center gap-3">
          <Crown className="h-9 w-9 text-amber-400 animate-bounce" />
          MartGPT <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 bg-clip-text text-transparent">Premium Plans</span>
        </h1>
        
        <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
          Scale your store with Smart AI Voice Billing, Automated WhatsApp Receipts, Nightly EOD Summaries, Khata Recovery, and Multi-Counter Cloud Sync.
        </p>

        {/* Current Active Plan Notice */}
        {(isPro || isUltraPro || isPlus) && (
          <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-4 justify-between max-w-2xl mx-auto shadow-sm">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-600">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base">
                  Your store is currently active on {isUltraPro ? 'MartGPT Ultra Pro 👑' : isPro ? 'MartGPT Pro ⚡' : 'MartGPT Plus 🌟'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Premium features unlocked. 
                  {shopData?.planExpiry && (
                    new Date(shopData.planExpiry).getFullYear() > 2090
                      ? ' Lifetime VIP Access (No Expiry).'
                      : ` Valid until ${new Date(shopData.planExpiry).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}.`
                  )}
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full uppercase tracking-wider whitespace-nowrap">
              Active Plan
            </span>
          </div>
        )}

        {/* ── Billing Cycle Toggle (4 Durations: 3M, 6M, 1Y, Lifetime) ── */}
        <div className="pt-4 flex items-center justify-center">
          <div className="bg-muted/90 p-1.5 rounded-2xl flex flex-wrap sm:flex-nowrap items-center justify-center gap-1.5 border border-border shadow-inner max-w-full">
            <button
              onClick={() => setBillingCycle('3months')}
              className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                billingCycle === '3months'
                  ? 'bg-card text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              3 Months
            </button>

            <button
              onClick={() => setBillingCycle('6months')}
              className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                billingCycle === '6months'
                  ? 'bg-card text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              6 Months
              <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                Save 25%
              </span>
            </button>

            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                billingCycle === 'yearly'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              1 Year
              <span className={`${billingCycle === 'yearly' ? 'bg-amber-400 text-slate-950' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'} text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide`}>
                Popular
              </span>
            </button>

            <button
              onClick={() => setBillingCycle('lifetime')}
              className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                billingCycle === 'lifetime'
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-300" />
              Lifetime
              <span className={`${billingCycle === 'lifetime' ? 'bg-white text-purple-900' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'} text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide`}>
                One-Time
              </span>
            </button>
          </div>
        </div>

        {/* ── 2. Promo Code / Coupon Engine Bar ── */}
        <div className="max-w-xl mx-auto pt-2">
          <div className="p-4 rounded-3xl border border-indigo-500/20 bg-card/60 backdrop-blur-sm shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5 text-foreground">
                <Tag className="w-3.5 h-3.5 text-indigo-500" /> Have a Promo / Coupon Code?
              </span>
              <span className="text-[11px] text-muted-foreground">Instant Plan Discount</span>
            </div>

            {appliedCoupon ? (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-600 font-black">
                    {appliedCoupon.code}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {appliedCoupon.message}
                  </span>
                </div>
                <button 
                  onClick={handleRemoveCoupon} 
                  className="p-1 hover:bg-emerald-500/20 rounded-lg text-muted-foreground hover:text-foreground"
                  title="Remove coupon"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter code (e.g. DIWALI50, WELCOME100, ULTRAVIP)"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                  className="flex-1 px-4 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:border-indigo-500 outline-none uppercase font-mono tracking-wider"
                />
                <Button
                  onClick={() => handleApplyCoupon()}
                  disabled={couponLoading || !couponInput.trim()}
                  className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl"
                >
                  {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
                </Button>
              </div>
            )}

            {couponError && (
              <p className="text-[11px] font-semibold text-rose-500 text-left flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {couponError}
              </p>
            )}

            {/* Quick Coupon Chips */}
            {!appliedCoupon && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground mr-1">Trending Codes:</span>
                {[
                  { code: 'DIWALI50', desc: '50% OFF' },
                  { code: 'WELCOME100', desc: '₹100 OFF' },
                  { code: 'ULTRAVIP', desc: '30% OFF' }
                ].map(c => (
                  <button
                    key={c.code}
                    onClick={() => handleApplyCoupon(c.code)}
                    className="px-2.5 py-1 rounded-lg bg-muted hover:bg-indigo-500/10 hover:text-indigo-600 border border-border text-[11px] font-mono font-bold transition-colors flex items-center gap-1"
                  >
                    <span>{c.code}</span>
                    <span className="text-[9px] text-emerald-500 font-sans font-bold">({c.desc})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── 3. Plan Cards Grid (4 Tiers) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto items-stretch">
        
        {/* ── CARD 1: STARTER (FREE) ── */}
        <div className="border border-border bg-card rounded-3xl p-6 shadow-sm flex flex-col relative opacity-90 hover:opacity-100 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-muted rounded-full text-muted-foreground">
              Micro Retail
            </span>
            <Store className="h-5 w-5 text-muted-foreground" />
          </div>
          
          <h2 className="text-xl font-black mt-4 text-foreground">Starter Free</h2>
          
          <div className="mt-2 flex items-baseline text-4xl font-black text-foreground">
            ₹0
            <span className="ml-1 text-xs font-semibold text-muted-foreground">/lifetime</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground min-h-[34px]">
            Essential POS billing tools for tiny single-counter kirana stores.
          </p>

          <hr className="my-5 border-border" />
          
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Included in Starter:
          </div>

          <ul className="space-y-3 flex-1 text-xs">
            {[
              'Fast Counter POS (Cash & Manual UPI)',
              'Customer Khata Book & Udhar Ledger',
              'Unlimited Products & Stock Catalog',
              'Thermal Receipt Printing (2", 3" & A4)',
              'Daily Sales & Shift Summaries',
              'Single device counter access'
            ].map(feature => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}

            <div className="pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              Not in Starter:
            </div>
            
            {[
              'WhatsApp Digital Bills & PDFs',
              'Nightly WhatsApp EOD Summary',
              '1-Click WhatsApp Udhar Reminders',
              'AI Voice Billing Engine',
              'Barcode Sticker Generator',
              'Multi-Staff Cashier Accounts'
            ].map(feature => (
              <li key={feature} className="flex items-start gap-2 text-muted-foreground/50 line-through">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          
          <Button variant="outline" className="mt-8 w-full h-11 text-xs font-bold rounded-2xl" disabled>
            {isPro || isUltraPro || isPlus ? 'Basic Tier' : 'Current Active Plan'}
          </Button>
        </div>

        {/* ── CARD 2: PLUS (SMART GROWTH) ── */}
        <div className="border border-indigo-500/20 bg-card rounded-3xl p-6 shadow-sm flex flex-col relative hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-indigo-500/10 text-indigo-500 rounded-full">
              Growth Stores
            </span>
            <Receipt className="h-5 w-5 text-indigo-500" />
          </div>

          <h2 className="text-xl font-black mt-4 text-foreground">MartGPT Plus</h2>
          
          {(() => {
            const cfg = prices.plus[billingCycle];
            const base = cfg.price;
            const period = cfg.period;
            const { final, discount } = getCalculatedPrice(base);
            return (
              <div>
                <div className="mt-2 flex items-baseline gap-2">
                  {discount > 0 && (
                    <span className="text-sm line-through text-muted-foreground font-semibold">₹{base}</span>
                  )}
                  <span className="text-4xl font-black text-foreground">₹{final}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{period}</span>
                </div>
                {discount > 0 ? (
                  <p className="mt-1 text-[11px] font-bold text-emerald-500">
                    Promo Saved: ₹{discount} OFF
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] font-bold text-emerald-500">
                    {cfg.save}
                  </p>
                )}
              </div>
            );
          })()}

          <p className="mt-2 text-xs text-muted-foreground min-h-[34px]">
            Instant WhatsApp digital invoices and automated 1-click udhar recovery.
          </p>

          <hr className="my-5 border-border" />
          
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-500 mb-3 flex items-center gap-1">
            <Zap className="h-3.5 w-3.5" /> All Starter Features PLUS:
          </div>

          <ul className="space-y-3 flex-1 text-xs">
            {plusFeatures.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-foreground">{f.title}</div>
                  {f.subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{f.subtitle}</div>}
                </div>
              </li>
            ))}
          </ul>
          
          <Button 
            onClick={() => {
              const cfg = prices.plus[billingCycle];
              handleUpgrade(cfg.days, cfg.price, 'MartGPT Plus');
            }} 
            disabled={isPlus || loading} 
            variant="outline"
            className="mt-8 w-full h-11 text-xs font-bold border-indigo-500/40 text-indigo-500 hover:bg-indigo-500/10 rounded-2xl"
          >
            {isPlus ? 'Currently Active ✓' : 'Get MartGPT Plus'}
          </Button>
        </div>

        {/* ── CARD 3: PRO (AI AUTOMATION) ── */}
        <div className="border border-indigo-600 bg-card rounded-3xl p-6 shadow-md flex flex-col relative hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-indigo-600 text-white rounded-full">
              🔥 Most Popular
            </span>
            <Mic className="h-5 w-5 text-indigo-500" />
          </div>

          <h2 className="text-xl font-black mt-4 text-foreground">MartGPT Pro</h2>
          
          {(() => {
            const cfg = prices.pro[billingCycle];
            const base = cfg.price;
            const period = cfg.period;
            const { final, discount } = getCalculatedPrice(base);
            return (
              <div>
                <div className="mt-2 flex items-baseline gap-2">
                  {discount > 0 && (
                    <span className="text-sm line-through text-muted-foreground font-semibold">₹{base}</span>
                  )}
                  <span className="text-4xl font-black text-foreground">₹{final}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{period}</span>
                </div>
                {discount > 0 ? (
                  <p className="mt-1 text-[11px] font-bold text-emerald-500">
                    Promo Saved: ₹{discount} OFF
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] font-bold text-emerald-500">
                    {cfg.save}
                  </p>
                )}
              </div>
            );
          })()}

          <p className="mt-2 text-xs text-muted-foreground min-h-[34px]">
            AI Voice Billing, Marathi Payment Audio Soundbox & Daily Nightly WhatsApp Summaries.
          </p>

          <hr className="my-5 border-border" />
          
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-500 mb-3 flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> All Plus Features PLUS:
          </div>

          <ul className="space-y-3 flex-1 text-xs">
            {proFeatures.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-foreground flex items-center gap-1">
                    {f.title}
                    {f.isNew && <span className="text-[9px] px-1 bg-indigo-500/10 text-indigo-600 rounded font-black">AI</span>}
                  </div>
                  {f.subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{f.subtitle}</div>}
                </div>
              </li>
            ))}
          </ul>
          
          <Button 
            onClick={() => {
              const cfg = prices.pro[billingCycle];
              handleUpgrade(cfg.days, cfg.price, 'MartGPT Pro');
            }} 
            disabled={isPro || loading} 
            className="mt-8 w-full h-11 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-md"
          >
            {isPro ? 'Pro Active ✓' : 'Upgrade to Pro'}
          </Button>
        </div>

        {/* ── CARD 4: ULTRA PRO (VIP ENTERPRISE) - THE SHOWSTOPPER! ── */}
        <div className="border-2 border-purple-500/80 bg-gradient-to-b from-purple-950/20 via-card to-card rounded-3xl p-6 shadow-xl flex flex-col relative transform lg:-translate-y-2 hover:shadow-2xl transition-all ring-2 ring-purple-500/30">
          
          {/* VIP Badge Header */}
          <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
            <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 text-amber-300" /> RECOMMENDED • 74% BUY THIS
            </span>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-full flex items-center gap-1">
              👑 Enterprise VIP
            </span>
            <Sparkles className="h-5 w-5 text-amber-400 animate-pulse" />
          </div>

          <h2 className="text-2xl font-black mt-4 text-foreground flex items-center gap-2">
            Ultra Pro <Crown className="h-5 w-5 text-amber-400" />
          </h2>
          
          {(() => {
            const cfg = prices.ultra[billingCycle];
            const base = cfg.price;
            const period = cfg.period;
            const { final, discount } = getCalculatedPrice(base);
            return (
              <div>
                <div className="mt-2 flex items-baseline gap-2">
                  {discount > 0 && (
                    <span className="text-sm line-through text-muted-foreground font-semibold">₹{base}</span>
                  )}
                  <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300">
                    ₹{final}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">{period}</span>
                </div>
                {discount > 0 ? (
                  <p className="mt-1 text-[11px] font-bold text-emerald-400">
                    🎉 Promo Discount: ₹{discount} OFF applied!
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] font-bold text-amber-400">
                    {cfg.save}
                  </p>
                )}
              </div>
            );
          })()}

          <p className="mt-2 text-xs text-muted-foreground min-h-[34px]">
            Multi-counter sync, your custom store logo on WhatsApp, AI Profit Engine & 24/7 VIP Manager.
          </p>

          <hr className="my-5 border-purple-500/20" />
          
          <div className="text-[11px] font-black uppercase tracking-wider text-purple-400 mb-3 flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" /> All Pro Features + VIP Exclusives:
          </div>

          <ul className="space-y-3 flex-1 text-xs">
            {ultraFeatures.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    {f.title}
                    {f.isNew && (
                      <span className="text-[9px] font-black px-1.5 py-0.2 bg-gradient-to-r from-purple-500 to-amber-500 text-white rounded">
                        VIP
                      </span>
                    )}
                  </div>
                  {f.subtitle && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                      {f.subtitle}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          
          <Button 
            onClick={() => {
              const cfg = prices.ultra[billingCycle];
              handleUpgrade(cfg.days, cfg.price, 'MartGPT Ultra Pro');
            }} 
            disabled={isUltraPro || loading} 
            className="mt-8 w-full h-12 text-sm font-black shadow-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 hover:opacity-95 text-white rounded-2xl"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isUltraPro ? (
              'Ultra Pro Active ✓'
            ) : (
              'Get Ultra Pro (Recommended) 👑'
            )}
          </Button>
        </div>

      </div>

      {/* ── 4. Trust & Security Strip ── */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-2">
            <div className="w-10 h-10 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-foreground">100% Secure Checkout</h4>
            <p className="text-[11px] text-muted-foreground">Encrypted Razorpay UPI & Cards</p>
          </div>

          <div className="space-y-2">
            <div className="w-10 h-10 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Zap className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-foreground">Instant Activation</h4>
            <p className="text-[11px] text-muted-foreground">Features unlocked in 5 seconds</p>
          </div>

          <div className="space-y-2">
            <div className="w-10 h-10 mx-auto rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Cloud className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-foreground">Realtime Cloud Backup</h4>
            <p className="text-[11px] text-muted-foreground">Zero data loss on TiDB Cloud</p>
          </div>

          <div className="space-y-2">
            <div className="w-10 h-10 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <PhoneCall className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-foreground">Dedicated Merchant Support</h4>
            <p className="text-[11px] text-muted-foreground">Direct phone & WhatsApp team</p>
          </div>
        </div>
      </div>

      {/* ── 5. Feature Comparison Matrix (Comprehensive Table) ── */}
      <div className="max-w-5xl mx-auto space-y-6 pt-4">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-foreground">
            Complete Feature Comparison Matrix
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Clear feature-by-feature progression across all 4 plans.
          </p>
        </div>

        <div className="border border-border rounded-3xl bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="p-4 font-bold text-foreground">Features</th>
                  <th className="p-4 font-bold text-center text-muted-foreground w-24 sm:w-28">Starter</th>
                  <th className="p-4 font-bold text-center text-indigo-500 w-24 sm:w-28">Plus</th>
                  <th className="p-4 font-bold text-center text-indigo-600 w-24 sm:w-28">Pro</th>
                  <th className="p-4 font-bold text-center text-purple-500 bg-purple-500/10 w-28 sm:w-36">Ultra Pro 👑</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* POS & Billing */}
                <tr className="bg-muted/30">
                  <td colSpan={5} className="p-3 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                    🧾 POS & Billing Capabilities
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Fast POS Counter Billing (Barcode & SKU)</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center bg-purple-500/5"><Check className="h-4 w-4 text-purple-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Thermal Receipt Printing (2", 3" & A4)</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center bg-purple-500/5"><Check className="h-4 w-4 text-purple-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Instant WhatsApp Digital Bills & PDFs</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center font-bold text-indigo-500">Unlimited</td>
                  <td className="p-4 text-center font-bold text-indigo-600">Unlimited</td>
                  <td className="p-4 text-center bg-purple-500/5 font-black text-purple-400">Unlimited + Logo Branding</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">MartGPT AI Voice Billing (Marathi, Hindi, English)</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center bg-purple-500/5"><Check className="h-4 w-4 text-purple-500 mx-auto" /></td>
                </tr>

                {/* WhatsApp & Automation */}
                <tr className="bg-muted/30">
                  <td colSpan={5} className="p-3 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                    🤖 WhatsApp & AI Automation
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Daily Nightly Business WhatsApp Summary (9:30 PM EOD)</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center bg-purple-500/5"><Check className="h-4 w-4 text-purple-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">1-Click WhatsApp Udhar Reminders with UPI Pay Link</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center bg-purple-500/5"><Check className="h-4 w-4 text-purple-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Audio Payment Soundbox (Instant Spoken Announcements)</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center bg-purple-500/5"><Check className="h-4 w-4 text-purple-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">AI Demand Forecast & Fast-Moving Stock Engine</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  <td className="p-4 text-center bg-purple-500/5 font-black text-purple-400">Deep AI Analytics</td>
                </tr>

                {/* Enterprise & Multi-Store */}
                <tr className="bg-muted/30">
                  <td colSpan={5} className="p-3 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                    🏢 Enterprise Architecture & Multi-Store
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Multi-Counter & Multi-Store Synchronization</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center bg-purple-500/5 font-black text-purple-400">Unlimited Counters</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Custom Logo & Shop Branding on Invoices</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center bg-purple-500/5"><Check className="h-4 w-4 text-purple-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Multi-Staff Cashier Logins with Profit Margin Lock</td>
                  <td className="p-4 text-center text-muted-foreground">Admin only</td>
                  <td className="p-4 text-center font-semibold">2 Staff</td>
                  <td className="p-4 text-center font-semibold">5 Staff</td>
                  <td className="p-4 text-center bg-purple-500/5 font-black text-purple-400">Unlimited Staff</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Customer Loyalty Reward Points & Festive Broadcasts</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center bg-purple-500/5"><Check className="h-4 w-4 text-purple-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Customer Support Level</td>
                  <td className="p-4 text-center text-muted-foreground">Community</td>
                  <td className="p-4 text-center font-semibold text-indigo-500">Standard Email/Chat</td>
                  <td className="p-4 text-center font-semibold text-indigo-600">Priority WhatsApp</td>
                  <td className="p-4 text-center bg-purple-500/5 font-black text-purple-400">24/7 VIP Phone Manager</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── 6. Verified Customer Testimonials ── */}
      <div className="max-w-5xl mx-auto space-y-6 pt-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-1 text-amber-400">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <h3 className="text-2xl font-black text-foreground">
            Trusted by 10,000+ Supermarket & Kirana Owners
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            See how MartGPT transformed local retail businesses into automated profit centers.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm space-y-3">
            <p className="text-sm italic text-muted-foreground leading-relaxed">
              "MartGPT Ultra Pro has completely transformed our supermarket. The automatic WhatsApp bills with our store logo look so professional, and sending udhar payment links directly recovered 90% of our outstanding customer credit. The nightly business summary is indispensable!"
            </p>
            <div className="flex items-center gap-3 pt-2">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-500 font-bold flex items-center justify-center text-sm">
                SP
              </div>
              <div>
                <h5 className="font-bold text-sm text-foreground">Sachin Patil</h5>
                <p className="text-xs text-muted-foreground">Patil Supermart, Pune • Ultra Pro Member</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm space-y-3">
            <p className="text-sm italic text-muted-foreground leading-relaxed">
              "AI Voice Billing is pure magic during evening peak rush hours. My cashiers don't even have to search for products manually. The profit margin lock feature ensures staff can bill smoothly without seeing our supplier purchase costs."
            </p>
            <div className="flex items-center gap-3 pt-2">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-500 font-bold flex items-center justify-center text-sm">
                RK
              </div>
              <div>
                <h5 className="font-bold text-sm text-foreground">Ramesh Kadam</h5>
                <p className="text-xs text-muted-foreground">Mahalaxmi Provision Store, Kolhapur • Pro Member</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 7. Frequently Asked Questions (FAQ) ── */}
      <div className="max-w-4xl mx-auto space-y-6 pt-6">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-black flex items-center justify-center gap-2 text-foreground">
            <HelpCircle className="h-6 w-6 text-indigo-500" />
            Frequently Asked Questions
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Everything you need to know about plans, discounts, and payment methods.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div 
                key={index}
                className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm transition-all"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full text-left p-4 sm:p-5 font-bold text-sm sm:text-base flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors"
                >
                  <span className="text-foreground">{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="p-4 sm:p-5 pt-0 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/50 bg-muted/10">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 8. Direct WhatsApp Support Hotline CTA ── */}
      <div className="text-center pt-8 border-t border-border max-w-xl mx-auto space-y-3">
        <h4 className="font-bold text-base text-foreground">
          Need a custom enterprise setup or hardware guidance?
        </h4>
        <p className="text-xs text-muted-foreground">
          Our retail tech specialists are available 24/7 on WhatsApp to assist you.
        </p>
        <Button 
          variant="outline" 
          onClick={() => {
            const phone = "919999999999";
            const text = encodeURIComponent("Hello, I have a question regarding MartGPT Premium Plans and hardware integration.");
            window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
          }}
          className="rounded-full px-6 py-2.5 text-xs font-bold gap-2 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
        >
          <MessageSquare className="h-4 w-4 text-emerald-500" />
          Chat with an Expert on WhatsApp
        </Button>
      </div>

    </div>
  );
}
