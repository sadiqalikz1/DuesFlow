
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Search, Download, Filter, ChevronRight, Loader2 } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import Link from 'next/link';

interface LedgerSummary {
  supplierId: string;
  supplierName: string;
  totalInvoiced: number;
  totalPaid: number;
  outstandingBalance: number;
  daysOverdue: number;
  status: 'Current' | 'Overdue' | 'Critical';
}

export default function ReportsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const firestore = useFirestore();
  const { formatCurrency } = useCurrency();

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'invoices');
  }, [firestore]);
  const { data: invoices, isLoading: invoicesLoading } = useCollection(invoicesQuery);

  const debitNotesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'debitNotes');
  }, [firestore]);
  const { data: debitNotes } = useCollection(debitNotesQuery);

  const creditNotesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'creditNotes');
  }, [firestore]);
  const { data: creditNotes } = useCollection(creditNotesQuery);

  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'suppliers');
  }, [firestore]);
  const { data: suppliers } = useCollection(suppliersQuery);

  // Calculate ledger summaries with outstanding balances only
  const ledgers = useMemo(() => {
    const ledgerMap = new Map<string, LedgerSummary>();

    // Process invoices
    invoices?.forEach(inv => {
      if (!inv.supplierId) return;
      
      const existing = ledgerMap.get(inv.supplierId) || {
        supplierId: inv.supplierId,
        supplierName: suppliers?.find(s => s.id === inv.supplierId)?.name || 'Unknown',
        totalInvoiced: 0,
        totalPaid: 0,
        outstandingBalance: 0,
        daysOverdue: 0,
        status: 'Current' as const,
      };

      const invoiceAmount = inv.invoiceAmount || inv.totalAmount || inv.amount || 0;
      const remaining = inv.remainingBalance || 0;
      const paidAmount = invoiceAmount - remaining;

      if (invoiceAmount > 0) {
        existing.totalInvoiced += invoiceAmount;
        existing.totalPaid += paidAmount;
        existing.outstandingBalance += remaining;
      }

      // Calculate days overdue
      if (inv.dueDate) {
        const dueDate = new Date(inv.dueDate);
        const today = new Date();
        const daysOver = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysOver > 0) {
          existing.daysOverdue = Math.max(existing.daysOverdue, daysOver);
        }
      }

      ledgerMap.set(inv.supplierId, existing);
    });

    // Process debit notes (add to outstanding)
    debitNotes?.forEach(dn => {
      if (!dn.supplierId) return;
      
      const existing = ledgerMap.get(dn.supplierId) || {
        supplierId: dn.supplierId,
        supplierName: suppliers?.find(s => s.id === dn.supplierId)?.name || 'Unknown',
        totalInvoiced: 0,
        totalPaid: 0,
        outstandingBalance: 0,
        daysOverdue: 0,
        status: 'Current' as const,
      };

      const dnAmount = dn.amount || dn.debitAmount || dn.noteAmount || 0;
      if (dnAmount > 0) {
        existing.totalInvoiced += dnAmount;
        existing.outstandingBalance += dnAmount;
      }

      ledgerMap.set(dn.supplierId, existing);
    });

    // Process credit notes (reduce outstanding)
    creditNotes?.forEach(cn => {
      if (!cn.supplierId) return;
      
      const existing = ledgerMap.get(cn.supplierId) || {
        supplierId: cn.supplierId,
        supplierName: suppliers?.find(s => s.id === cn.supplierId)?.name || 'Unknown',
        totalInvoiced: 0,
        totalPaid: 0,
        outstandingBalance: 0,
        daysOverdue: 0,
        status: 'Current' as const,
      };

      const cnAmount = cn.amount || cn.creditAmount || cn.noteAmount || 0;
      if (cnAmount > 0) {
        existing.outstandingBalance -= cnAmount;
      }

      ledgerMap.set(cn.supplierId, existing);
    });

    // Convert to array, filter only outstanding, and set status
    const result = Array.from(ledgerMap.values())
      .filter(ledger => ledger.outstandingBalance > 0) // Only outstanding
      .map(ledger => ({
        ...ledger,
        status: ledger.daysOverdue > 30 ? 'Critical' : ledger.daysOverdue > 0 ? 'Overdue' : 'Current',
      }))
      .sort((a, b) => b.outstandingBalance - a.outstandingBalance);
    
    return result;
  }, [invoices, debitNotes, creditNotes, suppliers]);

  // Filter ledgers by search term
  const filtered = useMemo(() => {
    return ledgers.filter(ledger =>
      ledger.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [ledgers, searchTerm]);

  // Apply pagination
  const paginationInfo = useMemo(() => {
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = filtered.slice(startIndex, endIndex);

    return {
      totalItems,
      totalPages,
      currentPage,
      paginatedData,
    };
  }, [filtered, currentPage]);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalOutstanding = useMemo(() => {
    return ledgers.reduce((sum, ledger) => sum + ledger.outstandingBalance, 0);
  }, [ledgers]);

  return (
    <SidebarInset className="flex-1 bg-background">
      <header className="sticky top-0 z-10 flex h-20 shrink-0 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="h-4 w-[1px] bg-slate-200 hidden md:block" />
        <div className="flex flex-col">
          <h2 className="text-lg font-bold font-headline text-slate-900 tracking-tight">Outstanding Ledgers</h2>
          <p className="text-xs text-slate-500 mt-0.5">Suppliers with outstanding balances due</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full text-xs font-bold">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 bg-slate-50/40">
        {invoicesLoading ? (
          <div className="p-12 h-screen flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-slate-500 font-medium">Loading ledgers...</p>
          </div>
        ) : (
          <>
        {/* Summary Card */}
        <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Outstanding</p>
                <p className="text-3xl font-black text-primary">{formatCurrency(totalOutstanding)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Supplier Count</p>
                <p className="text-3xl font-black text-slate-900">{ledgers.length}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Critical Count</p>
                <p className="text-3xl font-black text-red-600">{ledgers.filter(l => l.status === 'Critical').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl bg-white">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search supplier name..." 
                  className="pl-10 bg-slate-50 border-slate-200 rounded-xl"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Ledgers Table */}
        <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl bg-white overflow-hidden">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <span>Ledgers ({paginationInfo.totalItems})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {paginationInfo.totalItems === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-500 text-sm">No outstanding ledgers found.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-100 bg-slate-50">
                        <TableHead className="h-12 px-6 text-xs font-bold">Supplier</TableHead>
                        <TableHead className="h-12 px-6 text-xs font-bold text-right">Total Invoiced</TableHead>
                        <TableHead className="h-12 px-6 text-xs font-bold text-right">Total Paid</TableHead>
                        <TableHead className="h-12 px-6 text-xs font-bold text-right">Outstanding</TableHead>
                        <TableHead className="h-12 px-6 text-xs font-bold text-center">Days Overdue</TableHead>
                        <TableHead className="h-12 px-6 text-xs font-bold">Status</TableHead>
                        <TableHead className="h-12 px-6 text-xs font-bold text-center">View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginationInfo.paginatedData.map((ledger) => (
                        <TableRow 
                          key={ledger.supplierId} 
                          className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <TableCell className="px-6 py-4 text-sm font-medium">
                            {ledger.supplierName}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-sm text-right">
                            {formatCurrency(ledger.totalInvoiced)}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-sm text-right">
                            {formatCurrency(ledger.totalPaid)}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-sm font-bold text-right text-primary">
                            {formatCurrency(ledger.outstandingBalance)}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-sm text-center font-medium">
                            {ledger.daysOverdue > 0 ? `${ledger.daysOverdue} days` : 'Current'}
                          </TableCell>
                          <TableCell className="px-6 py-4">
                            <Badge 
                              variant={ledger.status === 'Critical' ? 'destructive' : ledger.status === 'Overdue' ? 'secondary' : 'default'}
                              className="font-bold text-[10px] uppercase px-2 rounded-full"
                            >
                              {ledger.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-center">
                            <Link href={`/ledger/${ledger.supplierId}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-3 rounded-lg hover:bg-primary/10 text-primary"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                {paginationInfo.totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
                    <div className="text-sm text-slate-600 font-medium">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, paginationInfo.totalItems)} of {paginationInfo.totalItems} ledgers
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="rounded-lg"
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1 px-3">
                        <span className="text-sm font-medium text-slate-700">
                          {currentPage} / {paginationInfo.totalPages}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(paginationInfo.totalPages, currentPage + 1))}
                        disabled={currentPage === paginationInfo.totalPages}
                        className="rounded-lg"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
          </>
        )}
      </div>
    </SidebarInset>
  );
}
