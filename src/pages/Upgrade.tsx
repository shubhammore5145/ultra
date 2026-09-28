import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
// Firebase removed
import { Button } from '../components/ui/button';
import { Check, Crown, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function Upgrade() {
  const { shopData } = useAuth();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const currentPlan = (shopData?.plan || '').toLowerCase();
  const isPro = currentPlan === 'pro' || currentPlan === 'ultra_pro' || currentPlan.includes('pro');

  const handleUpgrade = async (days: number, amountInPaise: number, planName: string) => {
    if (!shopData?.shopId) return;
    
    setLoading(true);
    
    const options = {
      key: 'rzp_live_TUJQRz220FyjLO',
      amount: amountInPaise,
      currency: 'INR',
      name: 'KiranaPro',
      description: `Pro Plan Subscription (${planName})`,
      handler: async function (_response: any) {
        try {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + days);

          const normalizedPlan = planName.toLowerCase().includes('ultra') ? 'ultra_pro' : 'pro';
          await api.shops.upgradePlan({
            plan: normalizedPlan,
            planExpiry: expiryDate.toISOString()
          });

          alert(`🎉 Congratulations! Your shop is now on the ${planName} plan!`);
          navigate('/');
        } catch (err) {
          console.error(err);
          alert("Failed to upgrade plan.");
        } finally {
          setLoading(false);
        }
      },
      prefill: {
        name: shopData?.shopName || shopData?.name || '',
        contact: shopData?.phone || '',
      },
      theme: {
        color: '#6366f1' // Primary color
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
      alert("Razorpay is not loaded yet. Please try again in a moment.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="text-center space-y-4 pt-8">
        <h1 className="text-4xl font-extrabold tracking-tight flex items-center justify-center gap-3">
          <Crown className="h-10 w-10 text-yellow-500" />
          KiranaPro <span className="text-primary">Premium</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Take your shop to the next level with advanced AI insights, multi-staff access, and CA-ready exports.
        </p>
      </div>

      {isPro && (
        <div className="bg-green-500/15 border border-green-500/30 text-green-700 p-6 rounded-2xl flex items-center gap-4 justify-center max-w-2xl mx-auto">
          <Check className="h-8 w-8 text-green-600" />
          <div>
            <h3 className="font-bold text-lg text-green-800">You are on the Pro Plan!</h3>
            <p className="text-sm">
              Enjoy all the premium features. 
              {shopData?.planExpiry && ` Valid until ${new Date(shopData.planExpiry).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}.`}
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mt-12">
        {/* Basic Plan */}
        <div className="border bg-card rounded-3xl p-8 shadow-sm flex flex-col relative opacity-80">
          <h2 className="text-2xl font-bold">Basic</h2>
          <div className="mt-4 flex items-baseline text-5xl font-extrabold">
            ₹0
            <span className="ml-1 text-xl font-medium text-muted-foreground">/mo</span>
          </div>
          <p className="mt-4 text-muted-foreground">Perfect for getting started.</p>
          
          <ul className="mt-8 space-y-4 flex-1">
            {['Basic POS Billing', 'Manage Products & Stock', 'Customer Udhar Book', 'Basic Dashboard (Today\'s Sales)'].map(feature => (
              <li key={feature} className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
            {['Add Cashier/Staff', 'AI Sales Prediction', 'Excel/PDF CA Export', 'Smart UPI Auto-Verification', 'Barcode Camera Scanning'].map(feature => (
              <li key={feature} className="flex items-center gap-3 text-muted-foreground/60 line-through">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>
          
          <Button variant="outline" className="mt-8 w-full" disabled>
            {isPro ? 'Downgrade' : 'Current Plan'}
          </Button>
        </div>

        {/* Pro Plan */}
        <div className="border bg-card rounded-3xl p-8 shadow-sm flex flex-col relative hover:shadow-md transition-shadow">
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            Pro <Crown className="h-5 w-5 text-yellow-500" />
          </h2>
          <div className="mt-4 flex items-baseline text-5xl font-extrabold text-foreground">
            ₹499
            <span className="ml-1 text-xl font-medium text-muted-foreground">/mo</span>
          </div>
          <p className="mt-4 text-muted-foreground">For shops that want to test premium.</p>
          
          <ul className="mt-8 space-y-4 flex-1">
            {['Everything in Basic, plus:', 'Add Cashier/Staff Roles', 'AI Sales Prediction (Trending)', 'CA-Ready Excel Exports', 'Smart UPI Auto-Verification', 'Barcode Camera Scanning'].map((feature, i) => (
              <li key={feature} className={`flex items-center gap-3 ${i===0 ? 'font-semibold text-primary mb-2' : ''}`}>
                <Check className={`h-5 w-5 flex-shrink-0 ${i===0 ? 'text-primary' : 'text-green-500'}`} />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>
          
          <Button 
            onClick={() => handleUpgrade(30, 49900, 'Pro')} 
            disabled={isPro || loading} 
            variant="outline"
            className="mt-8 w-full h-12 text-lg font-bold border-primary text-primary hover:bg-primary/10"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isPro ? 'Already a Pro' : 'Get Pro')}
          </Button>
        </div>

        {/* Ultra Pro Plan */}
        <div className="border-2 border-primary bg-primary/5 rounded-3xl p-8 shadow-xl flex flex-col relative transform hover:-translate-y-2 transition-transform">
          <div className="absolute top-0 right-8 transform -translate-y-1/2">
            <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Save 17%
            </span>
          </div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            Ultra Pro <Crown className="h-5 w-5 text-yellow-500" />
          </h2>
          <div className="mt-4 flex items-baseline text-5xl font-extrabold text-foreground">
            ₹4999
            <span className="ml-1 text-xl font-medium text-muted-foreground">/yr</span>
          </div>
          <p className="mt-4 text-muted-foreground">Best value for growing businesses.</p>
          
          <ul className="mt-8 space-y-4 flex-1">
            {['Everything in Basic, plus:', 'Add Cashier/Staff Roles', 'AI Sales Prediction (Trending)', 'CA-Ready Excel Exports', 'Smart UPI Auto-Verification', 'Barcode Camera Scanning', 'Priority VIP Support'].map((feature, i) => (
              <li key={feature} className={`flex items-center gap-3 ${i===0 ? 'font-semibold text-primary mb-2' : ''}`}>
                <Check className={`h-5 w-5 flex-shrink-0 ${i===0 ? 'text-primary' : 'text-green-500'}`} />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>
          
          <Button 
            onClick={() => handleUpgrade(365, 499900, 'Ultra Pro')} 
            disabled={isPro || loading} 
            className="mt-8 w-full h-12 text-lg font-bold shadow-lg bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isPro ? 'Already a Pro' : 'Get Ultra Pro')}
          </Button>
        </div>
      </div>
    </div>
  );
}
