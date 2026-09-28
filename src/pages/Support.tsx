import { MessageCircle, Mail, Phone, Clock, ExternalLink, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useState } from 'react';

const faqs = [
  {
    q: 'How do I add a Cashier?',
    a: 'Upgrade to the Pro plan, then ask your cashier to sign up and choose "Join Shop". Give them your Shop ID from the Settings page.'
  },
  {
    q: 'How does the Smart UPI QR work?',
    a: 'Add your UPI ID in Settings. On the POS screen, a dynamic QR code generates for every bill with the exact amount. (Pro Feature)'
  },
  {
    q: 'What happens when my Pro plan expires?',
    a: 'Your account switches back to the Basic plan. You won\'t lose any data — premium features will be locked until you renew.'
  },
  {
    q: 'Can I print thermal receipts?',
    a: 'Yes! Click the "Print" button on the POS success screen. It\'s optimized for 58mm and 80mm thermal printers.'
  },
  {
    q: 'How does Udhar (credit) work?',
    a: 'On the POS, choose "Udhar" as payment method and select a customer. The amount is added to their running balance. Go to Udhar Book to collect payments.'
  },
  {
    q: 'How do I share the bill on WhatsApp?',
    a: 'After completing a bill, click the WhatsApp icon. The customer gets a digital receipt link. Set up your public URL in Settings for this to work.'
  },
];

export default function Support() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleWhatsApp = () => {
    window.open('https://wa.me/919226345875?text=Hello%20MartGPT%20Support,%20I%20need%20help!', '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeInUp">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <HelpCircle className="h-7 w-7 text-green-500" /> Help & Support
          </h1>
          <p className="page-subtitle">We are here to help you grow your business</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          {/* WhatsApp Card */}
          <div className="kirana-card overflow-visible">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">WhatsApp Support</h2>
                  <p className="text-xs text-muted-foreground">Usually replies in minutes</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Get instant help from our support team. We're available Monday-Saturday, 9 AM to 8 PM.
              </p>
              <Button
                onClick={handleWhatsApp}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold gap-2 shadow-md shadow-green-500/20"
              >
                <MessageCircle className="h-4 w-4" />
                Chat on WhatsApp
                <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-70" />
              </Button>
            </div>
          </div>

          {/* Contact Info */}
          <div className="kirana-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">Contact Information</h2>
            </div>
            <div className="p-5 space-y-4">
              {[
                { icon: Phone, label: 'Phone Support', value: '+91 92263 45875', color: 'bg-blue-500/10 text-blue-500' },
                { icon: Mail, label: 'Email Support', value: 'shubham45mgm@gmail.com', color: 'bg-purple-500/10 text-purple-500' },
                { icon: Clock, label: 'Working Hours', value: 'Mon – Sat: 9 AM to 8 PM', color: 'bg-amber-500/10 text-amber-500' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-sm text-muted-foreground">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - FAQs */}
        <div className="kirana-card h-fit">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Frequently Asked Questions</h2>
          </div>
          <div className="divide-y divide-border">
            {faqs.map((faq, i) => (
              <div key={i}>
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left gap-4 hover:bg-muted/50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-sm font-medium text-foreground">{faq.q}</span>
                  {openFaq === i
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  }
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 animate-fadeIn">
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-foreground">Need more advanced help?</p>
          <p className="text-sm text-muted-foreground mt-0.5">We offer remote setup & training sessions for your store</p>
        </div>
        <Button onClick={handleWhatsApp} className="gap-2 shrink-0">
          <MessageCircle className="h-4 w-4" /> Book a Session
        </Button>
      </div>
    </div>
  );
}
