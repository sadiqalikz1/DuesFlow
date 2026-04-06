"use client";

import { use, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, IndianRupee, TrendingUp, AlertCircle, Banknote } from 'lucide-react';
import Link from 'next/link';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { useCurrency } from '@/hooks/use-currency';

export default function SupplierLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: supplierId } = use(params);
  const firestore = useFirestore();
  const { formatCurrency } = useCurrency();

  // 1. Fetch Supplier Details
  const supplierRef = useMemoFirebase(() => {
    if (!firestore || !supplierId) return null;
    return doc(firestore, 'suppliers', supplierId);
  }, [firestore, supplierId]);
  const { data: supplier, isLoading: supplierLoading } = useDoc(supplierRef);

  // 2. Fetch Invoices for this Supplier
  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !supplierId) return null;
    return query(
      collection(firestore, 'invoices'), 
      where('supplierId', '==', supplierId),
      orderBy('dueDate', 'desc')
    );
  }, [firestore, supplierId]);
  const { data: invoices, isLoading: invoicesLoading } = useCollection(invoicesQuery);

  // 3. Aggregate Stats
  const stats = useMemo(() => {
    if (!invoices) return { total: 0, outstanding: 0, overdue: 0 };
    return invoices.reduce((acc, inv) => ({
      total: acc.total + (inv.invoiceAmount || 0),
      outstanding: acc.outstanding + (inv.remainingBalance || 0),
      overdue: acc.overdue + (inv.status === 'Overdue' ? (inv.remainingBalance || 0) : 0)
    }), { total: 0, outstanding: 0, overdue: 0 });
  }, [invoices]);

  if (supplierLoading) return null;

  return (
    <SidebarInset className="flex-1 bg-background">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <Link href="/suppliers">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl md:text-2xl font-bold font-headline text-slate-900 tracking-tight truncate">
            {supplier?.name}
          </h2>
        </div>
        <Link href="/payments" className="hidden sm:block">
          <Button size="sm" className="bg-primary">Log Payment</Button>
        </Link>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-8">
          <p className="text-muted-foreground">Vendor Ledger & Transaction History</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Billing</p>
                <TrendingUp className="h-4 w-4 text-primary shrink-0" />
              </div>
              <p className="text-2xl font-bold truncate">{formatCurrency(stats.total)}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Outstanding</p>
                <Banknote className="h-4 w-4 text-accent shrink-0" />
              </div>
              <p className="text-2xl font-bold text-primary truncate">{formatCurrency(stats.outstanding)}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white border-l-4 border-l-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">Overdue</p>
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              </div>
              <p className="text-2xl font-bold text-destructive truncate">{formatCurrency(stats.overdue)}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-headline">Purchase Register</CardTitle>
              <CardDescription className="hidden sm:block">All invoices received from {supplier?.name}</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-t">
                <TableRow>
                  <TableHead className="font-bold min-w-[100px]">Date</TableHead>
                  <TableHead className="font-bold min-w-[120px]">Invoice #</TableHead>
                  <TableHead className="font-bold min-w-[100px]">Due Date</TableHead>
                  <TableHead className="font-bold text-right min-w-[100px]">Original</TableHead>
                  <TableHead className="font-bold text-right min-w-[100px]">Balance</TableHead>
                  <TableHead className="font-bold text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices?.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-sm">{inv.invoiceDate}</TableCell>
                    <TableCell className="font-mono text-xs font-bold">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">{inv.dueDate}</TableCell>
                    <TableCell className="text-right">{formatCurrency(inv.invoiceAmount || 0)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{formatCurrency(inv.remainingBalance || 0)}</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={inv.status === 'Overdue' ? 'destructive' : 'secondary'}
                        className="font-bold text-[10px] uppercase px-2"
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!invoices || invoices.length === 0) && !invoicesLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">
                      No invoices found for this supplier.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </SidebarInset>
  );
}
