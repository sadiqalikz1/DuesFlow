
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useUser, useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Settings, Globe, CheckCircle2, Loader2 } from 'lucide-react';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee (₹)' },
  { code: 'USD', name: 'US Dollar ($)' },
  { code: 'EUR', name: 'Euro (€)' },
  { code: 'GBP', name: 'British Pound (£)' },
];

export default function SettingsPage() {
  const { user } = useUser();
  const { firestore } = useFirestore();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'userSettings', user.uid);
  }, [firestore, user?.uid]);

  const { data: settings, isLoading } = useDoc(settingsRef);
  const [selectedCurrency, setSelectedCurrency] = useState('INR');

  useEffect(() => {
    if (settings?.currency) {
      setSelectedCurrency(settings.currency);
    }
  }, [settings]);

  const handleSave = () => {
    if (!firestore || !user?.uid) return;
    
    setSaving(true);
    setDocumentNonBlocking(
      doc(firestore, 'userSettings', user.uid),
      {
        userId: user.uid,
        currency: selectedCurrency,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setTimeout(() => {
      setSaving(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }, 800);
  };

  return (
    <SidebarInset className="flex-1 bg-background">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="flex-1">
          <h2 className="text-xl md:text-2xl font-bold font-headline text-slate-900 tracking-tight">Settings</h2>
        </div>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-8">
          <p className="text-muted-foreground">Manage your account preferences and application defaults.</p>
        </div>

        <div className="max-w-2xl mx-auto lg:mx-0">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Localization</CardTitle>
                <CardDescription>Select your preferred currency for financial reports.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
              <div className="space-y-2">
                <Label htmlFor="currency">Preferred Currency</Label>
                {isLoading ? (
                  <div className="h-10 w-full bg-slate-100 animate-pulse rounded-md" />
                ) : (
                  <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                    <SelectTrigger id="currency" className="w-full bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Select Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(curr => (
                        <SelectItem key={curr.code} value={curr.code}>{curr.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Button 
                  onClick={handleSave} 
                  disabled={saving || isLoading}
                  className="bg-primary min-w-[120px] w-full sm:w-auto"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : 'Save Changes'}
                </Button>
                {success && (
                  <div className="flex items-center text-green-600 text-sm font-bold">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Preferences updated successfully.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm mt-8 opacity-60">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                <Settings className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <CardTitle className="text-lg">More Settings Coming Soon</CardTitle>
                <CardDescription>Notifications, theme, and Tally sync defaults.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic">
                Advanced features are currently being enabled by our engineering team.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </SidebarInset>
  );
}
