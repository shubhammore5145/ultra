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
  Bot, 
  Zap, 
  Mic, 
  TrendingUp, 
  Printer, 
  Users, 
  FileSpreadsheet, 
  Volume2, 
  Cloud, 
  ShieldCheck, 
  PhoneCall, 
  HelpCircle, 
  Star,
  ChevronDown,
  ChevronUp,
  Receipt,
  Store,
  Layers
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

export default function Upgrade() {
  const { shopData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const navigate = useNavigate();

  const currentPlan = (shopData?.plan || '').toLowerCase();
  const isUltraPro = currentPlan === 'ultra_pro';
  const isPro = currentPlan === 'pro' || isUltraPro;

  const handleUpgrade = async (days: number, amountInPaise: number, planName: string) => {
    if (!shopData?.shopId) return;
    
    setLoading(true);
    
    const options = {
      key: 'rzp_live_TUJQRz220FyjLO',
      amount: amountInPaise,
      currency: 'INR',
      name: 'MartGPT',
      description: `${planName} Subscription (${days === 365 ? '1 Year' : '1 Month'})`,
      handler: async function (_response: any) {
        try {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + days);

          const normalizedPlan = planName.toLowerCase().includes('ultra') ? 'ultra_pro' : 'pro';
          await api.shops.upgradePlan({
            plan: normalizedPlan,
            planExpiry: expiryDate.toISOString()
          });

          alert(`🎉 अभिनंदन! आपले दुकान आता ${planName} प्लॅनवर यशस्वीरित्या अपग्रेड झाले आहे!`);
          navigate('/');
        } catch (err) {
          console.error(err);
          alert("Failed to upgrade plan. Please contact support.");
        } finally {
          setLoading(false);
        }
      },
      prefill: {
        name: shopData?.shopName || shopData?.name || '',
        contact: shopData?.phone || '',
      },
      theme: {
        color: '#6366f1'
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
      alert("Razorpay payment gateway loading... कृपया पुन्हा प्रयत्न करा.");
      setLoading(false);
    }
  };

  // Pricing configuration
  const prices = {
    pro: {
      monthly: { price: 499, paise: 49900, days: 30, period: '/महिना' },
      yearly: { price: 4999, paise: 499900, days: 365, period: '/वर्ष', save: '₹989 वाचवा (17% OFF)' }
    },
    ultra: {
      monthly: { price: 899, paise: 89900, days: 30, period: '/महिना' },
      yearly: { price: 7999, paise: 799900, days: 365, period: '/वर्ष', save: '₹2,789 वाचवा (25% OFF)' }
    }
  };

  const proFeatures: PlanFeature[] = [
    { title: '⚡ WhatsApp Instant Bills & Invoices', subtitle: 'ग्राहकांना 1-क्लिकमध्ये WhatsApp वर बिल व PDF पाठवा', isNew: true },
    { title: '🌙 Nightly Business WhatsApp Summary', subtitle: 'दररोज रात्री दुकानाचा एकूण नफा, विक्री व स्टॉक रिपोर्ट थेट WhatsApp वर', isNew: true },
    { title: '📲 1-Click WhatsApp Udhar Reminders', subtitle: 'UPI Payment Link सह उधारी वसुली मेसेज (3x जलद वसुली)', isNew: true },
    { title: '🎙️ MartGPT AI Voice Billing', subtitle: 'मराठी, हिंदी किंवा इंग्रजीत बोलून सुपरफास्ट बिल बनवा', isNew: true },
    { title: '📊 AI Demand Forecast & Stock Alerts', subtitle: 'कमी स्टॉक आणि वेगाने विकल्या जाणाऱ्या वस्तूंचे स्मार्ट अंदाज', isNew: true },
    { title: '🏷️ Custom Barcode Sticker Generator', subtitle: 'सुट्या किराणा मालासाठी 1D/2D बारकोड लेबल डिझाइन व प्रिंट' },
    { title: '👥 Multi-Staff / Cashier Accounts', subtitle: 'कॅशियर व कर्मचाऱ्यांसाठी स्वतंत्र लॉगिन व प्रॉफिट मार्जिन लॉक' },
    { title: '📑 CA-Ready GSTR-1 Tax & Excel Reports', subtitle: 'GST व इन्कम टॅक्स ऑडिटसाठी 1-क्लिक फायनान्शिअल एक्सेल एक्सपोर्ट' },
    { title: '🔊 Voice Audio Payment Soundbox', subtitle: 'UPI / रोख पेमेंट मिळाल्यावर थेट मराठीत ऑडिओ आवाज' },
    { title: '☁️ Realtime Cloud Sync & Multi-Device', subtitle: 'मोबाईल, टॅबलेट किंवा कॉम्प्युटरवरून कधीही दुकानाचे काम करा' },
    { title: '🚀 Priority Phone & WhatsApp Support', subtitle: 'कोणत्याही मदतीसाठी थेट व्हॉट्सअॅप व फोन सहाय्य' }
  ];

  const ultraFeatures: PlanFeature[] = [
    { title: '👑 Everything in Pro Plan included', subtitle: 'सर्व Pro फीचर्सचा अमर्याद वापर' },
    { title: '🏢 Multi-Counter & Multi-Store Sync', subtitle: 'एकाच दुकानातील अनेक बिलिंग काउंटर्स किंवा मल्टिपल शाखांचे व्यवस्थापन', isNew: true },
    { title: '🏷️ Custom Shop Branding on WhatsApp Bills', subtitle: 'आपला स्वतःचा लोगो, दुकानाचे नाव, पत्ता व सानुकूल मेसेज', isNew: true },
    { title: '🧠 MartGPT AI Profit & Dead-Stock Engine', subtitle: 'कोणत्या वस्तूंवर जास्त नफा मिळतो व कोणते सामान पडून आहे याचे सखोल AI विश्लेषण', isNew: true },
    { title: '🎯 Customer Loyalty Points & Offers', subtitle: 'ग्राहकांना रिवॉर्ड पॉईंट्स व सणासुदीचे व्हॉट्सअॅप ब्रॉडकास्ट मेसेज', isNew: true },
    { title: '📦 Free Old Data Migration Support', subtitle: 'जुन्या सॉफ्टवेअर किंवा एक्सेलवरून उत्पादने मोफत ट्रान्सफर करून मिळतील' },
    { title: '🛡️ Dedicated 24/7 VIP Account Manager', subtitle: 'वैयक्तिक सहाय्यक व सर्वोच्च प्राधान्य सपोर्ट' }
  ];

  const faqs = [
    {
      q: 'WhatsApp बिलिंग आणि नाईटली समरी कशी काम करते?',
      a: 'MartGPT मध्ये तुमचे WhatsApp सुरक्षितपणे कनेक्ट होते. जेव्हा जेव्हा तुम्ही बिल बनवता, तेव्हा एका क्लिकमध्ये ग्राहकाच्या WhatsApp वर सुंदर आयटमाइज्ड बिल व PDF जाते. तसेच रोज रात्री तुमच्या ठरलेल्या वेळेवर (उदा. रात्री ९:३०) संपूर्ण दिवसाचा विक्री, कॅश, UPI, उधारी आणि कमी स्टॉकचा अहवाल तुमच्या WhatsApp वर आपोआप येतो!'
    },
    {
      q: 'मी माझा प्लॅन कधीही अपग्रेड किंवा बदलू शकतो का?',
      a: 'होय! तुम्ही कधीही Pro किंवा Ultra Pro प्लॅनमध्ये अपग्रेड करू शकता. Razorpay द्वारे पेमेंट पूर्ण होताच तुमचा नवीन प्लॅन त्वरित सक्रिय (Instant Active) होतो.'
    },
    {
      q: 'माझ्या दुकानातील डेटा सुरक्षित आहे का?',
      a: 'होय, १००% सुरक्षित! तुमचा संपूर्ण डेटा एन्क्रिप्टेड TiDB सर्व्हरलेस क्लाउडवर ऑटोमॅटिक बॅकअप होतो. मोबाईल खराब झाला किंवा कॉम्प्युटर बंद पडला तरीही तुमचा कोणताही डेटा नष्ट होत नाही.'
    },
    {
      q: 'माझ्याकडे कॉम्प्युटर किंवा थर्मल प्रिंटर नसेल तरी चालेल का?',
      a: 'नक्कीच! MartGPT संपूर्णपणे मोबाईल आणि टॅब्लेटवर चालते. तुमच्याकडे थर्मल प्रिंटर असल्यास ब्लूटूथ किंवा USB द्वारे प्रिंट करू शकता, किंवा प्रिंटर नसताना डिजिटल WhatsApp बिल देऊ शकता.'
    },
    {
      q: 'पेमेंट सुरक्षित कसे आहे आणि कोणते पर्याय उपलब्ध आहेत?',
      a: 'पेमेंट Razorpay द्वारे पूर्णपणे एन्क्रिप्टेड व सुरक्षित आहे. तुम्ही Google Pay, PhonePe, Paytm, सर्व UPI ॲप्स, डेबिट/क्रेडिट कार्ड किंवा नेट बँकिंग वापरून पेमेंट करू शकता.'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-16 px-4 sm:px-6">
      {/* Hero Header */}
      <div className="text-center space-y-4 pt-6 animate-fadeInUp">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold text-xs uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5" />
          Next-Gen AI Retail & Kirana Operating System
        </div>
        
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight flex items-center justify-center gap-3 text-foreground">
          <Crown className="h-10 w-10 text-yellow-500 animate-pulse" />
          MartGPT <span className="bg-gradient-to-r from-primary via-indigo-500 to-purple-600 bg-clip-text text-transparent">Premium</span>
        </h1>
        
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          स्मार्ट AI व्हॉट्सअॅप बिलिंग, नाईटली बिझनेस समरी, उधारी वसुली आणि मल्टी-स्टाफ काउंटर्ससह तुमच्या दुकानाची कमाई आणि वेग वाढवा.
        </p>

        {/* Current Active Plan Alert */}
        {isPro && (
          <div className="bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 border border-green-500/30 text-green-700 dark:text-green-300 p-5 rounded-2xl flex flex-col sm:flex-row items-center gap-4 justify-between max-w-2xl mx-auto shadow-sm">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2.5 bg-green-500/20 rounded-xl text-green-600">
                <Check className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-base">
                  आपण {isUltraPro ? 'MartGPT Ultra Pro 👑' : 'MartGPT Pro ⚡'} प्लॅनवर सक्रिय आहात!
                </h3>
                <p className="text-xs text-muted-foreground">
                  सर्व प्रिमियम फीचर्स अनलॉक आहेत. 
                  {shopData?.planExpiry && ` वैधता: ${new Date(shopData.planExpiry).toLocaleDateString('mr-IN', { year: 'numeric', month: 'long', day: 'numeric' })} पर्यंत.`}
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full uppercase tracking-wider">
              सक्रिय प्लॅन
            </span>
          </div>
        )}

        {/* Billing Cycle Switcher */}
        <div className="pt-4 flex items-center justify-center">
          <div className="bg-muted p-1.5 rounded-2xl flex items-center border border-border shadow-inner">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              मासिक (Monthly)
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                billingCycle === 'yearly'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              वार्षिक (Yearly)
              <span className="bg-yellow-400 text-yellow-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
                17% बचत
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto items-stretch">
        
        {/* Basic Plan */}
        <div className="border border-border/80 bg-card rounded-3xl p-7 shadow-sm flex flex-col relative opacity-90 hover:opacity-100 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-muted rounded-full text-muted-foreground">
              सुरवात (Starter)
            </span>
            <Store className="h-5 w-5 text-muted-foreground" />
          </div>
          
          <h2 className="text-2xl font-black mt-4">Basic मोफत</h2>
          
          <div className="mt-3 flex items-baseline text-4xl sm:text-5xl font-black text-foreground">
            ₹0
            <span className="ml-1 text-base font-semibold text-muted-foreground">/कायमस्वरूपी</span>
          </div>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
            लहान किराणा दुकानांसाठी आवश्यक बेसिक बिलिंग सुविधा.
          </p>

          <hr className="my-6 border-border" />
          
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
            समाविष्ट बेसिक फीचर्स:
          </div>

          <ul className="space-y-3.5 flex-1">
            {[
              'काउंटर POS बिलिंग (रोख व मॅन्युअल UPI)',
              'उत्पादने व अमर्याद स्टॉक मॅनेजमेंट',
              'ग्राहकांचे खाते व उधारी वही (Khata Book)',
              'थर्मल पावती प्रिंटिंग (2" व 3" पावती)',
              'दैनिक विक्री डॅशबोर्ड सारांश',
              'सिंगल काउंटर डिव्हाइस वापर'
            ].map(feature => (
              <li key={feature} className="flex items-start gap-2.5 text-xs sm:text-sm">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}

            <div className="pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
              बेसिक प्लॅनमध्ये उपलब्ध नाही:
            </div>
            
            {[
              'WhatsApp थेट डिजिटल बिल व PDF',
              'नाईटली बिझनेस समरी WhatsApp वर',
              '1-Click WhatsApp उधारी वसुली मेसेज',
              'MartGPT AI व्हॉईस बिलिंग',
              'कॅशियर व मल्टिपल स्टाफ खाती',
              'CA-Ready GSTR-1 टॅक्स रिपोर्ट'
            ].map(feature => (
              <li key={feature} className="flex items-start gap-2.5 text-xs text-muted-foreground/60 line-through">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          
          <Button variant="outline" className="mt-8 w-full h-11 text-sm font-bold" disabled>
            {isPro ? 'बेसिक प्लॅन' : 'सध्याचा प्लॅन (Active)'}
          </Button>
        </div>

        {/* Pro Plan (Most Popular) */}
        <div className="border-2 border-primary bg-card rounded-3xl p-7 shadow-xl flex flex-col relative transform lg:-translate-y-2 hover:shadow-2xl transition-all">
          <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2">
            <span className="bg-gradient-to-r from-primary to-indigo-600 text-white text-[11px] font-black px-4 py-1.5 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> सर्वात लोकप्रिय (Most Popular)
            </span>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-primary/10 text-primary rounded-full">
              स्मार्ट AI ऑटोमेशन
            </span>
            <Crown className="h-6 w-6 text-yellow-500" />
          </div>

          <h2 className="text-2xl font-black mt-4 flex items-center gap-2 text-foreground">
            MartGPT Pro
          </h2>
          
          <div className="mt-3 flex items-baseline text-4xl sm:text-5xl font-black text-foreground">
            ₹{billingCycle === 'yearly' ? prices.pro.yearly.price : prices.pro.monthly.price}
            <span className="ml-1 text-base font-semibold text-muted-foreground">
              {billingCycle === 'yearly' ? prices.pro.yearly.period : prices.pro.monthly.period}
            </span>
          </div>

          {billingCycle === 'yearly' ? (
            <p className="mt-1 text-xs font-bold text-green-600 dark:text-green-400">
              {prices.pro.yearly.save}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              कोणतीही बांधिलकी नाही, हवे तेव्हा रद्द करा
            </p>
          )}

          <hr className="my-6 border-border" />
          
          <div className="text-xs font-bold uppercase tracking-wider text-primary mb-4 flex items-center gap-1.5">
            <Zap className="h-4 w-4" /> सर्व Basic + हे नवीन शक्तिशाली फीचर्स:
          </div>

          <ul className="space-y-3 flex-1">
            {proFeatures.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <div className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                    {f.title}
                    {f.isNew && (
                      <span className="text-[10px] font-black px-1.5 py-0.2 bg-indigo-500/10 text-indigo-600 rounded">
                        NEW
                      </span>
                    )}
                  </div>
                  {f.subtitle && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {f.subtitle}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          
          <Button 
            onClick={() => {
              const cfg = billingCycle === 'yearly' ? prices.pro.yearly : prices.pro.monthly;
              handleUpgrade(cfg.days, cfg.paise, 'MartGPT Pro');
            }} 
            disabled={isPro || loading} 
            className="mt-8 w-full h-12 text-sm sm:text-base font-black shadow-lg bg-primary hover:bg-primary/90 text-white rounded-2xl"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPro ? (
              'सध्या Pro सक्रिय आहे ✓'
            ) : (
              `MartGPT Pro सुरू करा (₹${billingCycle === 'yearly' ? prices.pro.yearly.price : prices.pro.monthly.price})`
            )}
          </Button>
        </div>

        {/* Ultra Pro Plan */}
        <div className="border border-purple-500/30 bg-gradient-to-b from-card via-card to-purple-500/5 rounded-3xl p-7 shadow-lg flex flex-col relative hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-purple-500/10 text-purple-600 rounded-full">
              मोठ्या मार्ट्ससाठी (Enterprise)
            </span>
            <Sparkles className="h-6 w-6 text-purple-500" />
          </div>

          <h2 className="text-2xl font-black mt-4 flex items-center gap-2 text-foreground">
            Ultra Pro <Crown className="h-5 w-5 text-yellow-500" />
          </h2>
          
          <div className="mt-3 flex items-baseline text-4xl sm:text-5xl font-black text-foreground">
            ₹{billingCycle === 'yearly' ? prices.ultra.yearly.price : prices.ultra.monthly.price}
            <span className="ml-1 text-base font-semibold text-muted-foreground">
              {billingCycle === 'yearly' ? prices.ultra.yearly.period : prices.ultra.monthly.period}
            </span>
          </div>

          {billingCycle === 'yearly' ? (
            <p className="mt-1 text-xs font-bold text-green-600 dark:text-green-400">
              {prices.ultra.yearly.save}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              मल्टिपल काऊंटर्स व सुपरमार्टसाठी सर्वोत्तम
            </p>
          )}

          <hr className="my-6 border-border" />
          
          <div className="text-xs font-bold uppercase tracking-wider text-purple-600 mb-4 flex items-center gap-1.5">
            <Layers className="h-4 w-4" /> Pro मधील सर्व + प्रिमियम एंटरप्राइज:
          </div>

          <ul className="space-y-3.5 flex-1">
            {ultraFeatures.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-purple-600 mt-1 flex-shrink-0" />
                <div>
                  <div className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                    {f.title}
                    {f.isNew && (
                      <span className="text-[10px] font-black px-1.5 py-0.2 bg-purple-500/10 text-purple-600 rounded">
                        VIP
                      </span>
                    )}
                  </div>
                  {f.subtitle && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {f.subtitle}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          
          <Button 
            onClick={() => {
              const cfg = billingCycle === 'yearly' ? prices.ultra.yearly : prices.ultra.monthly;
              handleUpgrade(cfg.days, cfg.paise, 'MartGPT Ultra Pro');
            }} 
            disabled={isUltraPro || loading} 
            className="mt-8 w-full h-12 text-sm sm:text-base font-black shadow-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-primary hover:opacity-95 text-white rounded-2xl"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isUltraPro ? (
              'Ultra Pro सक्रिय आहे ✓'
            ) : (
              `Ultra Pro वर अपग्रेड करा`
            )}
          </Button>
        </div>

      </div>

      {/* Trust & Guarantee Strip */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-2">
            <div className="w-10 h-10 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm">100% सुरक्षित पेमेंट</h4>
            <p className="text-[11px] text-muted-foreground">Razorpay द्वारे UPI व कार्ड्स</p>
          </div>

          <div className="space-y-2">
            <div className="w-10 h-10 mx-auto rounded-2xl bg-green-500/10 text-green-600 flex items-center justify-center">
              <Zap className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm">त्वरित सुरू (Instant)</h4>
            <p className="text-[11px] text-muted-foreground">पेमेंट होताच फीचर्स अनलॉक</p>
          </div>

          <div className="space-y-2">
            <div className="w-10 h-10 mx-auto rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Cloud className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm">क्लाउड बॅकअप</h4>
            <p className="text-[11px] text-muted-foreground">डेटा कधीही सुरक्षित राहतो</p>
          </div>

          <div className="space-y-2">
            <div className="w-10 h-10 mx-auto rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <PhoneCall className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm">थेट ग्राहक सहाय्य</h4>
            <p className="text-[11px] text-muted-foreground">WhatsApp व कॉल सपोर्ट</p>
          </div>
        </div>
      </div>

      {/* Comprehensive Feature Comparison Matrix */}
      <div className="max-w-5xl mx-auto space-y-6 pt-4">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-foreground">
            सर्व प्लॅन्सची सविस्तर तुलना (Feature Comparison)
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            कोणता प्लॅन आपल्या व्यवसायासाठी योग्य आहे ते तपासा
          </p>
        </div>

        <div className="border border-border rounded-3xl bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-4 font-bold text-foreground">वैशिष्ट्ये (Features)</th>
                  <th className="p-4 font-bold text-center text-muted-foreground w-28 sm:w-36">Basic</th>
                  <th className="p-4 font-bold text-center text-primary w-28 sm:w-36 bg-primary/5">Pro</th>
                  <th className="p-4 font-bold text-center text-purple-600 w-28 sm:w-36">Ultra Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Billing */}
                <tr className="bg-muted/30">
                  <td colSpan={4} className="p-3 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                    🧾 बिलिंग आणि POS (Billing & POS)
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">सुपरफास्ट POS काउंटर बिलिंग</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center bg-primary/5"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">थर्मल पावती प्रिंटिंग (2", 3" Roll & A4)</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center bg-primary/5"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">WhatsApp डिजिटल इन्व्हॉइस व PDF बिल</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center bg-primary/5 font-bold text-primary">अमर्याद (Unlimited)</td>
                  <td className="p-4 text-center font-bold text-purple-600">अमर्याद + Logo Branding</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">MartGPT AI व्हॉईस बिलिंग (Marathi/Hindi/English)</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center bg-primary/5"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>

                {/* Automation */}
                <tr className="bg-muted/30">
                  <td colSpan={4} className="p-3 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                    🤖 व्हॉट्सअॅप व AI ऑटोमेशन (WhatsApp & AI)
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">नाईटली बिझनेस समरी WhatsApp वर (Daily EOD Report)</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center bg-primary/5"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">उधारी वसुली WhatsApp मेसेज (UPI Pay Link सह)</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center bg-primary/5"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">AI स्टॉक प्रेडिक्शन व लो-स्टॉक अलर्ट्स</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center bg-primary/5"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center font-bold text-purple-600">Advanced AI Engine</td>
                </tr>

                {/* Staff & Reports */}
                <tr className="bg-muted/30">
                  <td colSpan={4} className="p-3 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                    👥 मॅनेजमेंट आणि टॅक्स रिपोर्टिंग (Team & Tax)
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">कॅशियर व कर्मचारी खाती (Multi-Staff)</td>
                  <td className="p-4 text-center text-muted-foreground">फक्त Admin</td>
                  <td className="p-4 text-center bg-primary/5 font-semibold">५ कर्मचाऱ्यांपर्यंत</td>
                  <td className="p-4 text-center font-bold text-purple-600">अमर्याद (Unlimited)</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">CA-Ready GSTR-1 & P&L एक्सेल एक्सपोर्ट</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center bg-primary/5"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">सुट्या किराणा मालासाठी बारकोड जनरेटर</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center bg-primary/5"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">मल्टी-काऊंटर / मल्टिपल शाखा सिंक्रोनायझेशन</td>
                  <td className="p-4 text-center text-muted-foreground">-</td>
                  <td className="p-4 text-center bg-primary/5 text-muted-foreground">-</td>
                  <td className="p-4 text-center font-bold text-purple-600"><Check className="h-4 w-4 text-purple-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">ग्राहक सपोर्ट</td>
                  <td className="p-4 text-center text-muted-foreground">कम्युनिटी</td>
                  <td className="p-4 text-center bg-primary/5 font-semibold text-primary">प्राधान्य WhatsApp</td>
                  <td className="p-4 text-center font-bold text-purple-600">24/7 VIP फोन व मॅनेजर</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Customer Testimonials / Social Proof */}
      <div className="max-w-5xl mx-auto space-y-6 pt-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-1 text-yellow-500">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-yellow-500 text-yellow-500" />
            ))}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold">हजारो किराणा आणि सुपरमार्ट मालकांचा विश्वास</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm space-y-3">
            <p className="text-sm italic text-muted-foreground">
              "MartGPT मुळे ग्राहकांना WhatsApp वर लगेच बिल मिळते आणि उधारीचे मेसेज UPI लिंकसह पाठवल्यामुळे आमची ९०% उधारी वेळेवर जमा होते. रोज रात्री येणारी बिझनेस समरी खूप उपयोगी आहे!"
            </p>
            <div className="flex items-center gap-3 pt-2">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                एस
              </div>
              <div>
                <h5 className="font-bold text-sm">सचिन पाटील</h5>
                <p className="text-xs text-muted-foreground">पाटील सुपरमार्ट, पुणे</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm space-y-3">
            <p className="text-sm italic text-muted-foreground">
              "व्हॉईस बिलिंग आणि बारकोड प्रिंटरमुळे किराणा मालाचे बिल बनवणे खूप सोपे झाले आहे. कॅशियर ठेवल्यावर नफा लपवण्याची सोय असल्याने आमचा हिशोब एकदम चोख राहतो."
            </p>
            <div className="flex items-center gap-3 pt-2">
              <div className="w-9 h-9 rounded-full bg-purple-500/10 text-purple-600 font-bold flex items-center justify-center text-sm">
                आर
              </div>
              <div>
                <h5 className="font-bold text-sm">रमेश कदम</h5>
                <p className="text-xs text-muted-foreground">महालक्ष्मी प्रोव्हिजन स्टोअर्स, कोल्हापूर</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Frequently Asked Questions (FAQ) */}
      <div className="max-w-4xl mx-auto space-y-6 pt-6">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold flex items-center justify-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            नेहमी विचारले जाणारे प्रश्न (FAQ)
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            प्लॅन आणि पेमेंटबद्दल तुमच्या शंकांचे निरसन
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div 
                key={index}
                className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full text-left p-4 sm:p-5 font-bold text-sm sm:text-base flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-primary flex-shrink-0" />
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

      {/* Direct Contact Support Box */}
      <div className="text-center pt-8 border-t border-border max-w-xl mx-auto space-y-3">
        <h4 className="font-bold text-sm text-foreground">
          काही प्रश्न किंवा स्पेशल कस्टम प्लॅन हवा आहे?
        </h4>
        <p className="text-xs text-muted-foreground">
          आमच्या टीमशी थेट WhatsApp वर चर्चा करा. आम्ही तुम्हाला योग्य मार्गदर्शन करू.
        </p>
        <Button 
          variant="outline" 
          onClick={() => {
            const phone = "919999999999";
            const text = encodeURIComponent("नमस्कार, मला MartGPT Premium Plans बद्दल माहिती हवी आहे.");
            window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
          }}
          className="rounded-full px-6 text-xs font-bold gap-2"
        >
          <MessageSquare className="h-4 w-4 text-green-600" />
          WhatsApp वर संपर्क करा
        </Button>
      </div>

    </div>
  );
}
