import { useNavigate } from 'react-router-dom';
import { usePlan } from '../contexts/PlanContext';
import { 
  Crown, 
  Sparkles, 
  Check, 
  Lock, 
  X, 
  ArrowRight, 
  Zap, 
  ShieldCheck 
} from 'lucide-react';
import { Button } from './ui/button';

export function UpgradeModal() {
  const { isUpgradeModalOpen, modalFeature, closeUpgradeModal, plan } = usePlan();
  const navigate = useNavigate();

  if (!isUpgradeModalOpen) return null;

  const handleGoToUpgrade = () => {
    closeUpgradeModal();
    navigate('/upgrade');
  };

  const featureTitle = modalFeature?.name || 'Unlock Premium MartGPT Features';
  const featureDesc = modalFeature?.description || 'Upgrade your plan to access automated WhatsApp billing, AI voice commands, nightly reports, and multi-counter cloud sync.';
  const requiredPlan = modalFeature?.requiredPlanLabel || 'MartGPT Plus, Pro, or Ultra Pro';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-card border-2 border-indigo-500/40 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden text-foreground animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow halo in background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeUpgradeModal}
          className="absolute top-4 right-4 p-2 rounded-2xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Feature Lock Icon Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-500 shadow-inner">
            <Lock className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
              <Crown className="w-3 h-3 text-amber-500" /> Premium Feature
            </span>
            <h3 className="text-lg sm:text-xl font-black text-foreground mt-1">
              {featureTitle}
            </h3>
          </div>
        </div>

        {/* Description */}
        <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2 text-xs sm:text-sm">
          <p className="text-muted-foreground leading-relaxed">
            {featureDesc}
          </p>
          <div className="pt-1 flex items-center gap-2 text-xs font-bold text-indigo-500">
            <Zap className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <span>Available on: <strong className="text-foreground">{requiredPlan}</strong></span>
          </div>
        </div>

        {/* Key Benefits */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            What you unlock with an upgrade:
          </div>
          <ul className="space-y-2 text-xs">
            {[
              'Instant WhatsApp bills & 1-click Udhar payment recovery',
              'AI Voice Billing in Marathi/Hindi + EOD 9:30 PM summaries',
              'Multi-counter cloud sync & customer loyalty reward points'
            ].map((b, i) => (
              <li key={i} className="flex items-center gap-2 text-muted-foreground">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pricing snippet & Action Buttons */}
        <div className="pt-2 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Plans start at just <strong>₹199/month</strong></span>
            <span className="text-emerald-500 font-bold">Use code DIWALI50 for 50% OFF!</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              onClick={handleGoToUpgrade}
              className="w-full sm:flex-1 h-12 text-xs sm:text-sm font-black shadow-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 hover:opacity-95 text-white rounded-2xl flex items-center justify-center gap-2"
            >
              <span>View Plans & Upgrade Now</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              onClick={closeUpgradeModal}
              className="w-full sm:w-auto h-12 text-xs font-bold rounded-2xl"
            >
              Maybe Later
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
