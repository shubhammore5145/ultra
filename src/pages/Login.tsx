import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Store, Loader2, ArrowRight } from 'lucide-react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [roleChoice, setRoleChoice] = useState<'admin' | 'cashier'>('admin');
  const [joinShopId, setJoinShopId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/');
      } else {
        // Sign Up Flow
        if (roleChoice === 'cashier' && !joinShopId.trim()) {
          throw new Error('Please enter the Shop ID to join.');
        }

        // Verify Shop ID if joining
        if (roleChoice === 'cashier') {
          const shopRef = doc(db, 'shops', joinShopId.trim());
          const shopSnap = await getDoc(shopRef);
          if (!shopSnap.exists()) {
            throw new Error('Invalid Shop ID. Shop not found.');
          }

          // Check if cashier limit (3) is reached
          const q = query(collection(db, 'users'), where('shopId', '==', joinShopId.trim()), where('role', '==', 'cashier'));
          const querySnapshot = await getDocs(q);
          if (querySnapshot.size >= 3) {
            throw new Error('This shop has reached the maximum limit of 3 cashiers.');
          }
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        let finalShopId = '';

        if (roleChoice === 'admin') {
          // Generate a random shop ID
          finalShopId = `shop_${Date.now()}`;
          // Create Shop Document
          await setDoc(doc(db, 'shops', finalShopId), {
            id: finalShopId,
            name: shopName,
            address: '',
            phone: '',
            gstNumber: '',
            createdAt: new Date().toISOString()
          });
        } else {
          finalShopId = joinShopId.trim();
        }

        // Create User Document
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          name: name,
          role: roleChoice,
          shopId: finalShopId,
          createdAt: new Date().toISOString()
        });

        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Left side - Branding Panel */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-purple-600/80 z-0"></div>
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-30 z-0"></div>
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="rounded-xl bg-white/20 p-3 backdrop-blur-md shadow-2xl">
            <Store className="h-8 w-8 text-white" />
          </div>
          <span className="text-3xl font-extrabold text-white tracking-tight">KiranaPro</span>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            Manage your shop with modern precision.
          </h1>
          <p className="text-lg text-white/80 font-medium">
            Everything you need for billing, inventory, and customer management in one powerful platform designed specifically for Kirana stores.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-4 text-sm font-medium text-white/60">
          <span>© {new Date().getFullYear()} KiranaPro Software</span>
          <span>•</span>
          <a href="/support" className="hover:text-white transition-colors">Privacy Policy</a>
          <span>•</span>
          <a href="/support" className="hover:text-white transition-colors">Terms of Service</a>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative overflow-hidden">
        {/* Subtle background glow effect for right side */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md space-y-8 relative z-10 p-8 sm:p-10 bg-card/50 backdrop-blur-xl border border-border/50 shadow-2xl rounded-3xl">
          
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLogin ? 'Enter your credentials to access your store' : 'Get started with KiranaPro today'}
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg bg-destructive/15 p-4 text-sm text-destructive border border-destructive/20 font-medium">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              {!isLogin && (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-4 p-1 bg-muted rounded-lg">
                    <Button 
                      type="button"
                      variant={roleChoice === 'admin' ? 'default' : 'ghost'} 
                      className="text-xs sm:text-sm font-semibold"
                      onClick={() => setRoleChoice('admin')}
                    >
                      Create Shop (Admin)
                    </Button>
                    <Button 
                      type="button"
                      variant={roleChoice === 'cashier' ? 'default' : 'ghost'} 
                      className="text-xs sm:text-sm font-semibold"
                      onClick={() => setRoleChoice('cashier')}
                    >
                      Join Shop (Cashier)
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-foreground font-medium">Your Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Ramesh Patel"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={!isLogin}
                      className="h-12 bg-background border-input focus:ring-primary"
                    />
                  </div>
                  
                  {roleChoice === 'admin' ? (
                    <div className="space-y-2">
                      <Label htmlFor="shopName" className="text-foreground font-medium">Shop Name</Label>
                      <Input
                        id="shopName"
                        placeholder="e.g. Patel Provision Store"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        required={!isLogin && roleChoice === 'admin'}
                        className="h-12 bg-background border-input focus:ring-primary"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="joinShopId" className="text-foreground font-medium">Shop ID to Join</Label>
                      <Input
                        id="joinShopId"
                        placeholder="e.g. shop_123456789"
                        value={joinShopId}
                        onChange={(e) => setJoinShopId(e.target.value)}
                        required={!isLogin && roleChoice === 'cashier'}
                        className="h-12 bg-background border-input focus:ring-primary font-mono text-sm"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 bg-background border-input focus:ring-primary"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
                  {isLogin && (
                    <a 
                      href="#" 
                      className="text-sm font-medium text-primary hover:underline hover:text-primary/80 transition-colors"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!email) {
                          alert('Please enter your email address first.');
                          return;
                        }
                        try {
                          await sendPasswordResetEmail(auth, email);
                          alert(`Password reset email sent to ${email}. Please check your inbox.`);
                        } catch (err: any) {
                          alert(err.message || 'Failed to send reset email.');
                        }
                      }}
                    >
                      Forgot password?
                    </a>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 bg-background border-input focus:ring-primary"
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-base font-semibold shadow-md bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                <>
                  {isLogin ? 'Sign in' : 'Create Account'}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="font-semibold text-primary hover:underline hover:text-primary/80 transition-colors"
              >
                {isLogin ? 'Sign up now' : 'Sign in instead'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
