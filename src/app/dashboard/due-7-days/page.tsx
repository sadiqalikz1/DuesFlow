'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { ChevronLeft, Search, Clock, TrendingUp } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useCollection, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useCurrency } from '@/hooks/use-currency';
import Link from 'next/link';

export default function DueIn7DaysPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { formatCurrency } = useCurrency();
  const [searchRef, setSearchRef] = useState('');

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'invoices');
  }, [firestore, user]);
  const { data: invoices } = useCollection(invoicesQuery);

  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'suppliers');
  }, [firestore, user]);
  const { data: suppliers } = useCollection(suppliersQuery);

  const dueSoonInvoices = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    let filtered = (invoices || []).filter(inv => {
      if (inv.status === 'Paid') return false;
      if (!inv.dueDate) return false;
      const dueDate = new Date(inv.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today && dueDate <= sevenDaysLater;
    });

    if (searchRef) {
      filtered = filtered.filter(inv =>
        inv.invoiceNumber?.toLowerCase().includes(searchRef.toLowerCase())
      );
    }

    return filtered.map(inv => ({
      ...inv,
      supplierName: suppliers?.find(s => s.id === inv.supplierId)?.name || 'Unknown',
      daysRemaining: differenceInDays(new Date(inv.dueDate), today),
    })).sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [invoices, suppliers, searchRef]);

  const totalAmount = useMemo(
    () => dueSoonInvoices.reduce((sum, inv) => sum + (inv.remainingBalance || 0), 0),
    [dueSoonInvoices]
  );

  return (
    <SidebarInset className="flex-1 overflow-auto bg-background">
      <header className="sticky top-0 z-10 flex h-20 shrink-0 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <Link href="/">
          <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg hover:bg-slate-100">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </Link>
        <div className="flex flex-col">
          <h2 className="text-lg font-bold font-headline text-slate-900 tracking-tight">Due in 7 Days</h2>
          <p className="text-xs text-slate-500 mt-0.5">{dueSoonInvoices.length} invoices due soon</p>
        </div>
      </header>

      <main className="p-4 md:p-8 space-y-6">
        {/* Summary Card */}
        <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">Total Amount Due</div>
                <div className="text-3xl font-black text-blue-700">{formatCurrency(totalAmount)}</div>
              </div>
              <Clock className="w-12 h-12 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by invoice number..."
              value={searchRef}
              onChange={(e) => setSearchRef(e.target.value)}
              className="pl-9 rounded-xl border-slate-200"
            />
          </div>
        </div>

        {/* Bills Table */}
        <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl overflow-hidden">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Bills Due Soon ({dueSoonInvoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {dueSoonInvoices.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-500 text-sm">No bills due in the next 7 days.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 bg-slate-50">
                      <TableHead className="h-12 px-6 text-xs font-bold">Invoice #</TableHead>
                      <TableHead className="h-12 px-6 text-xs font-bold">Supplier</TableHead>
                      <TableHead className="h-12 px-6 text-xs font-bold">Invoice Date</TableHead>
                      <TableHead className="h-12 px-6 text-xs font-bold">Due Date</TableHead>
                      <TableHead className="h-12 px-6 text-xs font-bold text-right">Amount</TableHead>
                      <TableHead className="h-12 px-6 text-xs font-bold text-right">Remaining</TableHead>
                      <TableHead className="h-12 px-6 text-xs font-bold">Days Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dueSoonInvoices.map((inv) => (
                      <TableRow key={inv.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <TableCell className="px-6 py-4 text-sm font-mono font-bold text-slate-700">
                          {inv.invoiceNumber}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-sm font-medium text-slate-600">
                          {inv.supplierName}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-sm text-slate-600">
                          {format(new Date(inv.invoiceDate || inv.date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-sm text-slate-600">
                          {format(new Date(inv.dueDate), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-sm font-mono text-right text-slate-700">
                          {formatCurrency(inv.amount || inv.totalAmount || 0)}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-sm font-mono text-right font-bold text-primary">
                          {formatCurrency(inv.remainingBalance || 0)}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge variant="outline" className="text-xs font-bold bg-blue-50 text-blue-700 border-blue-200">
                            {inv.daysRemaining} days
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </SidebarInset>
  );
}
