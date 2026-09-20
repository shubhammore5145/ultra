import { MessageCircle, Mail, Phone, Clock, ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function Support() {
  const handleWhatsApp = () => {
    window.open('https://wa.me/919226345875?text=Hello%20KiranaPro%20Support,%20I%20need%20help!', '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Help & Support</h1>
          <p className="text-muted-foreground mt-1">We are here to help you grow your business.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              WhatsApp Support
            </h2>
            <p className="text-muted-foreground mb-6">
              Get instant help from our support team via WhatsApp. We typically reply within a few minutes.
            </p>
            <Button 
              onClick={handleWhatsApp}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold h-12 text-lg shadow-lg shadow-green-500/20"
            >
              Chat on WhatsApp <ExternalLink className="ml-2 h-5 w-5" />
            </Button>
          </div>

          <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-6">
            <h2 className="text-xl font-bold mb-4">Contact Information</h2>
            
            <div className="flex items-center gap-4 text-muted-foreground">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Phone Support</p>
                <p>+91 92263 45875</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-muted-foreground">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Email Support</p>
                <p>shubham45mgm@gmail.com</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-muted-foreground">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Working Hours</p>
                <p>Monday - Saturday: 9 AM to 8 PM</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">Frequently Asked Questions</h2>
            
            <div className="space-y-4">
              <div className="pb-4 border-b">
                <h3 className="font-semibold text-foreground">How do I add a Cashier?</h3>
                <p className="text-sm text-muted-foreground mt-1">Upgrade to the Pro plan, then ask your cashier to sign up and choose "Join Shop". Give them your Shop ID from the Settings page.</p>
              </div>
              <div className="pb-4 border-b">
                <h3 className="font-semibold text-foreground">How does the Smart UPI work?</h3>
                <p className="text-sm text-muted-foreground mt-1">Add your UPI ID in settings. On the POS screen, a dynamic QR code will generate for every bill with the exact amount. (Pro Feature)</p>
              </div>
              <div className="pb-4 border-b">
                <h3 className="font-semibold text-foreground">What happens when my Pro plan expires?</h3>
                <p className="text-sm text-muted-foreground mt-1">Your account will automatically switch back to the Basic plan. You won't lose your data, but premium features will be locked until you renew.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Can I print receipts?</h3>
                <p className="text-sm text-muted-foreground mt-1">Yes! Click the "Print" button on the POS success screen. It's optimized for 2-3 inch thermal printers.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
