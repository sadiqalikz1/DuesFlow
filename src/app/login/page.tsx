'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, initiateEmailSignIn, initiateEmailSignUp, useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { CreditCard, LogIn, Mail, Lock, Loader2, UserPlus, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { doc } from 'firebase/firestore';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  
  const registrationRef = useMemoFirebase(() => {
    return doc(firestore, 'systemSettings', 'auth');
  }, [firestore]);

  const { data: registrationData, isLoading: isRegLoading } = useDoc(registrationRef);
  const signupDisabled = registrationData?.signupDisabled === true;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'registration-disabled') {
      setError('Registration is currently disabled. Only existing accounts can sign in.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && !isUserLoading) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      await initiateEmailSignIn(auth, email, password);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email. Please switch to the "Sign Up" tab to create one.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Incorrect password or user not found. Please try again.');
      } else {
        setError(err.message || 'Failed to sign in. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (signupDisabled) {
      setError('Registration is currently disabled by system administrator.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await initiateEmailSignUp(auth, email, password);
      setSuccess('Account created successfully! Redirecting...');
    } catch (err: any) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const showSignup = !isRegLoading && !signupDisabled;
  const defaultTab = showSignup ? "signup" : "signin";

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-body overflow-y-auto">
      <div className="w-full max-w-[420px] py-12">
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl shadow-2xl shadow-primary/30 mb-2">
            <CreditCard className="text-white w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 font-headline">DuesFlow</h1>
          <p className="text-slate-500 font-medium">Enterprise Supplier Dues Management</p>
        </div>

        <Card className="border-none shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[2.5rem] bg-white overflow-hidden">
          <Tabs defaultValue={defaultTab} key={defaultTab} className="w-full">
            <TabsList className={`w-full grid ${showSignup ? 'grid-cols-2' : 'grid-cols-1'} h-14 bg-slate-100/50 p-1 rounded-none border-b border-slate-50`}>
              <TabsTrigger value="signin" className="rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none font-bold text-sm">
                <LogIn className="w-4 h-4 mr-2" /> Sign In
              </TabsTrigger>
              {showSignup && (
                <TabsTrigger value="signup" className="rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none font-bold text-sm">
                  <UserPlus className="w-4 h-4 mr-2" /> Sign Up
                </TabsTrigger>
              )}
            </TabsList>

            <CardContent className="space-y-6 pt-10 px-8">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-2 flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className="p-4 bg-green-50 border border-green-100 rounded-xl text-green-600 text-sm font-medium animate-in fade-in slide-in-from-top-2 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  {success}
                </div>
              )}

              <TabsContent value="signin" className="mt-0 outline-none">
                <div className="space-y-6">
                  <div className="text-center space-y-1 mb-8">
                    <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>
                    <p className="text-slate-400 text-sm font-medium">Access your enterprise dashboard</p>
                  </div>
                  
                  <form onSubmit={handleEmailLogin} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email-signin" className="text-slate-600 font-bold ml-1">Work Email</Label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                        <Input 
                          id="email-signin"
                          type="email" 
                          placeholder="name@company.com" 
                          className="pl-12 bg-slate-50 border-transparent focus:border-primary/20 focus:bg-white h-12 rounded-xl transition-all font-medium text-slate-700"
                          value={email}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <Label htmlFor="password-signin" className="text-slate-600 font-bold">Password</Label>
                        <Button variant="link" className="p-0 h-auto text-xs font-bold text-primary opacity-80 hover:opacity-100">Forgot?</Button>
                      </div>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                        <Input 
                          id="password-signin"
                          type="password" 
                          placeholder="••••••••" 
                          className="pl-12 bg-slate-50 border-transparent focus:border-primary/20 focus:bg-white h-12 rounded-xl transition-all font-medium text-slate-700"
                          value={password}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all text-base" disabled={loading}>
                      {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <LogIn className="h-5 w-5 mr-2" />}
                      Authorize Access
                    </Button>
                  </form>
                </div>
              </TabsContent>

              <TabsContent value="signup" className="mt-0 outline-none">
                {signupDisabled ? (
                  <div className="py-8 px-4 text-center space-y-6">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-50 rounded-full mb-2">
                      <ShieldAlert className="w-10 h-10 text-orange-500" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-bold text-slate-900">Registrations Closed</h2>
                      <p className="text-slate-500 text-sm leading-relaxed px-4">
                        Self-signup is currently restricted. Please contact your system administrator to request access to the DuesFlow platform.
                      </p>
                    </div>
                    <div className="pt-4">
                      <Button variant="outline" className="rounded-xl font-bold px-8" asChild>
                        <a href="mailto:admin@duesflow.com">Contact Support</a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="text-center space-y-1 mb-8">
                      <h2 className="text-2xl font-bold text-slate-900">Create Account</h2>
                      <p className="text-slate-400 text-sm font-medium">Join our supplier tracking network</p>
                    </div>

                    <form onSubmit={handleEmailSignUp} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="email-signup" className="text-slate-600 font-bold ml-1">Work Email</Label>
                        <div className="relative group">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                          <Input 
                            id="email-signup"
                            type="email" 
                            placeholder="name@company.com" 
                            className="pl-12 bg-slate-50 border-transparent focus:border-primary/20 focus:bg-white h-12 rounded-xl transition-all font-medium text-slate-700"
                            value={email}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password-signup" className="text-slate-600 font-bold ml-1">Password</Label>
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                          <Input 
                            id="password-signup"
                            type="password" 
                            placeholder="Min. 8 characters" 
                            className="pl-12 bg-slate-50 border-transparent focus:border-primary/20 focus:bg-white h-12 rounded-xl transition-all font-medium text-slate-700"
                            value={password}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                          />
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all text-base" disabled={loading}>
                        {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <UserPlus className="h-5 w-5 mr-2" />}
                        Register Now
                      </Button>
                    </form>
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
          <CardFooter className="pb-10 pt-4 text-center justify-center">
            <p className="text-[11px] text-slate-400 font-medium px-8 leading-relaxed">
              By signing in, you agree to our <span className="text-primary/70 cursor-pointer hover:underline">Terms of Service</span> and <span className="text-primary/70 cursor-pointer hover:underline">Privacy Policy</span>.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
