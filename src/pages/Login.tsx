import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, ArrowRight, Mail, CheckCircle2, X } from 'lucide-react';
import { 
  auth, 
  googleProvider,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signInWithPopup,
  updateProfile 
} from '../lib/firebase';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();
  
  // Support 1-Click Login from Super Admin
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const directToken = params.get('token');
    if (directToken) {
      localStorage.setItem('auth_token', directToken);
      api.auth.me().then(res => {
        login(directToken, res.user, res.shop);
        navigate(res.user?.role === 'cashier' ? '/pos' : '/');
      }).catch(err => {
        console.error('Super Admin impersonation failed:', err);
      });
    }
  }, []);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [roleChoice, setRoleChoice] = useState<'admin' | 'cashier'>('admin');
  const [joinShopId, setJoinShopId] = useState('');

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const formatFirebaseError = (err: any) => {
    const code = err?.code || '';
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return 'ईमेल किंवा पासवर्ड चुकीचा आहे.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'हा ईमेल आधीच नोंदणीकृत आहे. कृपया लॉगिन करा.';
    }
    if (code === 'auth/weak-password') {
      return 'पासवर्ड कमीत कमी 6 अक्षरांचा असावा.';
    }
    if (code === 'auth/invalid-email') {
      return 'कृपया योग्य ईमेल आयडी टाका.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google साइन इन विंडो बंद करण्यात आली.';
    }
    if (err?.message && (err.message.includes('Failed to fetch') || err.message.includes('not reachable') || err.message.includes('No response'))) {
      return 'बॅकएंड सर्व्हरशी संपर्क होऊ शकला नाही. कृपया बॅकएंड सर्व्हर (Port 5000) चालू असल्याची खात्री करा.';
    }
    return err?.message || 'लॉगिन अयशस्वी झाले. कृपया पुन्हा प्रयत्न करा.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetSuccessMessage('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (isLogin) {
        let authUser: any = null;
        let authShop: any = null;
        let authToken: string = '';
        let fbFailureReason: any = null;

        // 1. Try Firebase Authentication first
        try {
          const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
          const fbUser = userCredential.user;

          // Sync with Database
          const res = await api.auth.firebaseSync({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || name || cleanEmail.split('@')[0]
          });

          authToken = res.token;
          authUser = res.user;
          authShop = res.shop;
        } catch (fbErr: any) {
          console.warn('Firebase login failed, attempting direct database login:', fbErr?.code || fbErr?.message);
          fbFailureReason = fbErr;
        }

        // 2. If Firebase login failed, fallback to direct database login
        if (!authToken) {
          try {
            const dbRes = await api.auth.login({
              email: cleanEmail,
              password
            });
            authToken = dbRes.token;
            authUser = dbRes.user;
            authShop = dbRes.shop;
          } catch (dbErr: any) {
            console.error('Direct database login also failed:', dbErr);
            // If backend is down or unreachable
            if (dbErr.message && (dbErr.message.includes('Failed to fetch') || dbErr.message.includes('No response') || dbErr.message.includes('not reachable'))) {
              throw new Error('बॅकएंड सर्व्हरशी संपर्क होऊ शकला नाही. कृपया बॅकएंड (Port 5000) चालू करा.');
            }
            // If DB returned a specific error (e.g. registered with Google, wrong password)
            if (dbErr.message && !dbErr.message.includes('Server error')) {
              throw dbErr;
            }
            // Otherwise throw original Firebase error
            throw fbFailureReason || dbErr;
          }
        }

        login(authToken, authUser, authShop);
        navigate(authUser?.role === 'cashier' ? '/pos' : '/');
      } else {
        // Sign Up Flow
        if (roleChoice === 'cashier' && !joinShopId.trim()) {
          throw new Error('Please enter the Shop ID to join.');
        }

        // 1. Firebase Create Account
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const fbUser = userCredential.user;

        if (name) {
          try {
            await updateProfile(fbUser, { displayName: name });
          } catch (_e) {}
        }

        // 2. Sync & Store in MySQL Database
        const res = await api.auth.firebaseSync({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: name || cleanEmail.split('@')[0],
          role: roleChoice,
          shopId: roleChoice === 'cashier' ? joinShopId.trim() : undefined,
          shopName: roleChoice === 'admin' ? (shopName || 'My Kirana Store') : undefined,
          ownerName: name
        });

        login(res.token, res.user, res.shop);
        navigate(res.user?.role === 'cashier' ? '/pos' : '/');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(formatFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;

      const res = await api.auth.firebaseSync({
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
        shopName: `${fbUser.displayName || 'My'}'s Shop`,
        ownerName: fbUser.displayName || 'Owner'
      });

      login(res.token, res.user, res.shop);
      navigate(res.user?.role === 'cashier' ? '/pos' : '/');
    } catch (err: any) {
      console.error('Google sign in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google साइन इन विंडो बंद करण्यात आली.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // user clicked again while opening, ignore
      } else {
        setError(formatFirebaseError(err));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetError('Please enter your registered email address.');
      return;
    }

    setResetLoading(true);
    setResetError('');
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setShowForgotModal(false);
      setResetSuccessMessage(`Password reset link sent to ${resetEmail}! Please check your email inbox and spam folder.`);
      setResetEmail('');
    } catch (err: any) {
      console.error('Password reset error:', err);
      setResetError(formatFirebaseError(err));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Left side - Branding Panel */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-purple-600/80 z-0"></div>
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-30 z-0"></div>
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-2 backdrop-blur-md shadow-2xl overflow-hidden border border-white/20">
            <img src="/favicon.svg" alt="MartGPT Logo" className="h-10 w-10 rounded-xl object-contain shadow-md" />
          </div>
          <span className="text-3xl font-extrabold text-white tracking-tight">MartGPT</span>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            Manage your shop with modern precision.
          </h1>
          <p className="text-lg text-white/80 font-medium">
            Everything you need for billing, inventory, stock-in, and customer udhar in one powerful platform powered by Firebase Auth & MySQL.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-4 text-sm font-medium text-white/60">
          <span>© {new Date().getFullYear()} MartGPT Software</span>
          <span>•</span>
          <a href="/support" className="hover:text-white transition-colors">Privacy Policy</a>
          <span>•</span>
          <a href="/support" className="hover:text-white transition-colors">Terms of Service</a>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md space-y-8 relative z-10 p-8 sm:p-10 bg-card/50 backdrop-blur-xl border border-border/50 shadow-2xl rounded-3xl">
          
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLogin ? 'Enter your credentials to access your store' : 'Get started with MartGPT today'}
            </p>
          </div>

          {resetSuccessMessage && (
            <div className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-600 border border-emerald-500/30 font-medium flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{resetSuccessMessage}</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/15 p-4 text-sm text-destructive border border-destructive/20 font-medium">
              {error}
            </div>
          )}

          {/* Google 1-Click Login Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 font-semibold flex items-center justify-center gap-3 border-border hover:bg-muted transition-colors shadow-sm"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </Button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-border w-full"></div>
            <span className="bg-card px-3 text-xs uppercase text-muted-foreground font-semibold absolute">or email</span>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
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
                    <button 
                      type="button" 
                      className="text-sm font-medium text-primary hover:underline hover:text-primary/80 transition-colors"
                      onClick={() => {
                        setResetEmail(email);
                        setResetError('');
                        setShowForgotModal(true);
                      }}
                    >
                      Forgot password?
                    </button>
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

            <Button type="submit" className="w-full h-12 text-base font-semibold shadow-md bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading || googleLoading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {isLogin ? 'Signing in with Firebase...' : 'Creating Firebase Account...'}
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

      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border shadow-2xl rounded-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" /> Reset Password
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setShowForgotModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Enter your email address and Firebase will instantly send a secure password reset link to your inbox.
            </p>

            {resetError && (
              <div className="rounded-lg bg-destructive/15 p-3 text-xs text-destructive border border-destructive/20 font-medium">
                {resetError}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="resetEmail">Your Registered Email</Label>
                <Input
                  id="resetEmail"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setShowForgotModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={resetLoading}>
                  {resetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send Reset Link
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
