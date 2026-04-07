'use client';

import { use, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowLeft, Download, TrendingUp, AlertCircle, Banknote, CreditCard,
  Edit3, Save, Phone, Mail, Building2, ShieldCheck, Clock, CheckCircle2,
  FileText, Receipt, User, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { useCurrency } from '@/hooks/use-currency';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

export default function SupplierLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: supplierId } = use(params);
  const firestore = useFirestore();
  const { formatCurrency } = useCurrency();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  // ── Fetch Supplier ─────────────────────────────────────────────────────
  const supplierRef = useMemoFirebase(() => {
    if (!firestore || !supplierId) return null;
    return doc(firestore, 'suppliers', supplierId);
  }, [firestore, supplierId]);
  const { data: supplier, isLoading: supplierLoading } = useDoc(supplierRef);

  // ── Fetch Invoices ─────────────────────────────────────────────────────
  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !supplierId) return null;
    return query(
      collection(firestore, 'invoices'),
      where('supplierId', '==', supplierId),
      orderBy('date', 'desc')
    );
  }, [firestore, supplierId]);
  const { data: invoices, isLoading: invoicesLoading } = useCollection(invoicesQuery);

  // ── Fetch Payments ─────────────────────────────────────────────────────
  const paymentsQuery = useMemoFirebase(() => {
    if (!firestore || !supplierId) return null;
    return query(
      collection(firestore, 'payments'),
      where('supplierId', '==', supplierId),
      orderBy('date', 'desc')
    );
  }, [firestore, supplierId]);
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery);

  // ── Stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalBilled = (invoices || []).reduce((a, inv) => a + (inv.totalAmount || inv.invoiceAmount || 0), 0);
    const totalPaid = (payments || []).reduce((a, p) => a + (p.amount || p.amountPaid || 0), 0);
    const outstanding = Math.max(0, totalBilled - totalPaid);
    const overdue = (invoices || [])
      .filter(inv => inv.status === 'Overdue' || inv.status === 'overdue')
      .reduce((a, inv) => a + (inv.remainingBalance || 0), 0);
    return { totalBilled, totalPaid, outstanding, overdue };
  }, [invoices, payments]);

  // ── Edit Handler ───────────────────────────────────────────────────────
  const startEdit = () => {
    setEditForm({
      name: supplier?.name || '',
      category: supplier?.category || '',
      phone: supplier?.phone || '',
      email: supplier?.email || '',
      address: supplier?.address || '',
      vatNumber: supplier?.vatNumber || '',
      defaultCreditDays: supplier?.defaultCreditDays || 30,
    });
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (!supplierRef || !firestore) return;
    updateDocumentNonBlocking(supplierRef, editForm);
    setIsEditing(false);
  };

  // ── Export ─────────────────────────────────────────────────────────────
  const exportLedger = () => {
    const invRows = (invoices || []).map(inv => ({
      Type: 'Purchase',
      'Invoice #': inv.invoiceNumber || inv.refNumber || '—',
      Date: inv.date || '—',
      'Due Date': inv.dueDate || '—',
      'Total Amount': inv.totalAmount || inv.invoiceAmount || 0,
      'Balance': inv.remainingBalance ?? (inv.totalAmount || 0),
      Status: inv.status || '—',
    }));
    const payRows = (payments || []).map(p => ({
      Type: 'Payment',
      'Invoice #': p.paymentNumber || p.referenceNumber || '—',
      Date: p.date || p.paymentDate || '—',
      'Due Date': '—',
      'Total Amount': p.amount || p.amountPaid || 0,
      'Balance': '—',
      Status: 'Paid',
    }));
    const all = [...invRows, ...payRows];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(all), 'Ledger');
    XLSX.writeFile(wb, `${supplier?.name || 'Supplier'}_Ledger.xlsx`);
  };

  if (supplierLoading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  const statusColor = (s: string) => {
    switch ((s || '').toLowerCase()) {
      case 'paid': return 'bg-green-50 text-green-700 border-green-100';
      case 'partially paid': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'overdue': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-amber-50 text-amber-700 border-amber-100';
    }
  };

  return (
    <SidebarInset className="flex-1 bg-background">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 backdrop-blur-md px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="h-4 w-[1px] bg-slate-200 hidden md:block" />
        <Link href="/suppliers">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-black text-slate-900 tracking-tight truncate leading-tight">
            {supplier?.name}
          </h2>
          {supplier?.category && (
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{supplier.category}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={exportLedger} className="rounded-full border-slate-200 gap-1.5 h-9 text-xs font-bold hidden sm:flex">
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
          <Link href="/payments">
            <Button size="sm" className="rounded-full shadow-lg shadow-primary/20 h-9 text-xs font-bold">
              <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Log Payment
            </Button>
          </Link>
        </div>
      </header>

      <main className="p-4 md:p-8 space-y-6">
        {/* ── KPI Stats ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-[2rem] bg-white">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Billed</p>
                <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
              </div>
              <p className="text-xl font-black truncate text-slate-900">{formatCurrency(stats.totalBilled)}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-[2rem] bg-white">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Paid</p>
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              </div>
              <p className="text-xl font-black truncate text-green-600">{formatCurrency(stats.totalPaid)}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm ring-1 ring-primary/20 rounded-[2rem] bg-primary/5">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Outstanding</p>
                <Banknote className="h-3.5 w-3.5 text-primary shrink-0" />
              </div>
              <p className="text-xl font-black truncate text-primary">{formatCurrency(stats.outstanding)}</p>
            </CardContent>
          </Card>
          <Card className={`border-none shadow-sm rounded-[2rem] ${stats.overdue > 0 ? 'ring-1 ring-red-200 bg-red-50/50' : 'ring-1 ring-slate-100 bg-white'}`}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-2">
                <p className={`text-[10px] font-black uppercase tracking-widest ${stats.overdue > 0 ? 'text-red-400' : 'text-slate-400'}`}>Overdue</p>
                <AlertCircle className={`h-3.5 w-3.5 shrink-0 ${stats.overdue > 0 ? 'text-red-500' : 'text-slate-300'}`} />
              </div>
              <p className={`text-xl font-black truncate ${stats.overdue > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                {formatCurrency(stats.overdue)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <Tabs defaultValue="purchases" className="w-full">
          <TabsList className="bg-slate-100/70 rounded-full p-1 h-10 w-fit">
            <TabsTrigger value="purchases" className="rounded-full text-xs font-bold px-5 gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Purchase Register
            </TabsTrigger>
            <TabsTrigger value="payments" className="rounded-full text-xs font-bold px-5 gap-1.5">
              <Receipt className="w-3.5 h-3.5" /> Payment History
            </TabsTrigger>
            <TabsTrigger value="profile" className="rounded-full text-xs font-bold px-5 gap-1.5">
              <User className="w-3.5 h-3.5" /> Supplier Profile
            </TabsTrigger>
          </TabsList>

          {/* ── Purchase Register ── */}
          <TabsContent value="purchases" className="mt-6">
            <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden rounded-[2rem] bg-white">
              <CardHeader className="px-8 pt-7 pb-5 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black">Purchase Register</CardTitle>
                  <CardDescription className="text-xs mt-1">All invoices from {supplier?.name}</CardDescription>
                </div>
                <Badge variant="outline" className="font-black text-xs">
                  {invoices?.length || 0} invoices
                </Badge>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="hover:bg-transparent border-b-slate-100">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-5 pl-8">Date</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-5">Invoice #</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-5">Due Date</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-5">Amount</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-5">Balance</TableHead>
                      <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-5 pr-8">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices?.map((inv) => (
                      <TableRow key={inv.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-50">
                        <TableCell className="text-xs text-slate-500 font-medium pl-8 py-4">{inv.date || inv.invoiceDate || '—'}</TableCell>
                        <TableCell className="font-mono text-xs font-black text-slate-700 py-4">{inv.invoiceNumber || '—'}</TableCell>
                        <TableCell className="text-xs text-slate-500 font-medium py-4">{inv.dueDate || '—'}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-bold text-slate-700 py-4">
                          {formatCurrency(inv.totalAmount || inv.invoiceAmount || 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-black text-primary py-4">
                          {formatCurrency(inv.remainingBalance ?? (inv.totalAmount || 0))}
                        </TableCell>
                        <TableCell className="text-center py-4 pr-8">
                          <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColor(inv.status)}`}>
                            {inv.status || 'Pending'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!invoices || invoices.length === 0) && !invoicesLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic text-sm">
                          No purchase invoices found for this supplier.
                        </TableCell>
                      </TableRow>
                    )}
                    {invoicesLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <Loader2 className="w-4 h-4 animate-spin mx-auto text-primary" />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Payment History ── */}
          <TabsContent value="payments" className="mt-6">
            <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden rounded-[2rem] bg-white">
              <CardHeader className="px-8 pt-7 pb-5 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black">Payment History</CardTitle>
                  <CardDescription className="text-xs mt-1">All payments recorded for {supplier?.name}</CardDescription>
                </div>
                <Badge variant="outline" className="font-black text-xs bg-green-50 text-green-600 border-green-100">
                  {payments?.length || 0} payments
                </Badge>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="hover:bg-transparent border-b-slate-100">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-5 pl-8">Date</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-5">Reference</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-5">Method</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-5 pr-8">Amount Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments?.map((p) => (
                      <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-50">
                        <TableCell className="text-xs text-slate-500 font-medium pl-8 py-4">
                          {p.date || p.paymentDate || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-black text-slate-700 py-4">
                          {p.paymentNumber || p.referenceNumber || '—'}
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider bg-slate-50 border-slate-200 text-slate-500">
                            {p.method || p.paymentMethod || 'Bank Transfer'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-base font-black text-green-600 py-4 pr-8">
                          {formatCurrency(p.amount || p.amountPaid || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!payments || payments.length === 0) && !paymentsLoading && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic text-sm">
                          No payments recorded for this supplier yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {paymentsLoading && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12">
                          <Loader2 className="w-4 h-4 animate-spin mx-auto text-primary" />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Supplier Profile ── */}
          <TabsContent value="profile" className="mt-6">
            <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-[2rem] bg-white max-w-2xl">
              <CardHeader className="px-8 pt-7 pb-5 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black">Supplier Profile</CardTitle>
                  <CardDescription className="text-xs mt-1">View and edit supplier master data</CardDescription>
                </div>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={startEdit} className="rounded-full border-slate-200 gap-1.5 text-xs font-bold">
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="rounded-full text-xs font-bold">Cancel</Button>
                    <Button size="sm" onClick={saveEdit} className="rounded-full shadow-lg shadow-primary/20 gap-1.5 text-xs font-bold">
                      <Save className="w-3.5 h-3.5" /> Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-8 space-y-5">
                {isEditing ? (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-wide text-slate-400">Supplier Name *</Label>
                      <Input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="bg-slate-50 border-none rounded-2xl h-11" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-wide text-slate-400">Category</Label>
                        <Input value={editForm.category || ''} onChange={e => setEditForm({ ...editForm, category: e.target.value })} className="bg-slate-50 border-none rounded-2xl h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-wide text-slate-400">Default Credit Days</Label>
                        <Input type="number" value={editForm.defaultCreditDays || 30} onChange={e => setEditForm({ ...editForm, defaultCreditDays: parseInt(e.target.value) || 30 })} className="bg-slate-50 border-none rounded-2xl h-11" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-wide text-slate-400">Phone</Label>
                        <Input value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="bg-slate-50 border-none rounded-2xl h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-wide text-slate-400">Email</Label>
                        <Input value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="bg-slate-50 border-none rounded-2xl h-11" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-wide text-slate-400">VAT / TRN Number</Label>
                      <Input value={editForm.vatNumber || ''} onChange={e => setEditForm({ ...editForm, vatNumber: e.target.value })} className="bg-slate-50 border-none rounded-2xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-wide text-slate-400">Address</Label>
                      <Input value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} className="bg-slate-50 border-none rounded-2xl h-11" />
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    {[
                      { icon: <Phone className="w-4 h-4 text-slate-400" />, label: 'Phone', value: supplier?.phone },
                      { icon: <Mail className="w-4 h-4 text-slate-400" />, label: 'Email', value: supplier?.email },
                      { icon: <ShieldCheck className="w-4 h-4 text-primary/50" />, label: 'VAT / TRN', value: supplier?.vatNumber },
                      { icon: <Building2 className="w-4 h-4 text-slate-400" />, label: 'Address', value: supplier?.address },
                      { icon: <Clock className="w-4 h-4 text-slate-400" />, label: 'Default Credit Days', value: supplier?.defaultCreditDays ? `${supplier.defaultCreditDays} days` : null },
                    ].map(({ icon, label, value }) => (
                      <div key={label} className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl">
                        <div className="mt-0.5">{icon}</div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
                          <p className="text-sm font-bold text-slate-700">{value || <span className="text-slate-300 font-medium italic">Not set</span>}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </SidebarInset>
  );
}
