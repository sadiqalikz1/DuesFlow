
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Mail, Phone, ExternalLink, LayoutList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

export default function SuppliersPage() {
  const firestore = useFirestore();
  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'suppliers');
  }, [firestore]);
  const { data: suppliers, isLoading } = useCollection(suppliersQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ 
    name: '', 
    category: '', 
    email: '', 
    phone: '', 
    defaultCreditDays: 30 
  });

  const handleAddSupplier = () => {
    if (!newSupplier.name || !firestore) return;
    
    addDocumentNonBlocking(collection(firestore, 'suppliers'), {
      ...newSupplier,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    setNewSupplier({ name: '', category: '', email: '', phone: '', defaultCreditDays: 30 });
    setIsDialogOpen(false);
  };

  return (
    <SidebarInset className="flex-1 bg-background">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="flex-1">
          <h2 className="text-xl md:text-2xl font-bold font-headline text-slate-900 tracking-tight">Suppliers</h2>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Add Supplier</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Supplier</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Supplier Name</Label>
                <Input 
                  value={newSupplier.name} 
                  onChange={e => setNewSupplier({...newSupplier, name: e.target.value})}
                  placeholder="Company Name"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input 
                  value={newSupplier.category} 
                  onChange={e => setNewSupplier({...newSupplier, category: e.target.value})}
                  placeholder="e.g. Logistics"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    value={newSupplier.email} 
                    onChange={e => setNewSupplier({...newSupplier, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input 
                    value={newSupplier.phone} 
                    onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Default Credit Days</Label>
                <Input 
                  type="number"
                  value={newSupplier.defaultCreditDays} 
                  onChange={e => setNewSupplier({...newSupplier, defaultCreditDays: parseInt(e.target.value)})}
                />
              </div>
              <Button className="w-full" onClick={handleAddSupplier}>Save Supplier</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-8">
          <p className="text-muted-foreground">Manage vendor records and default credit terms.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers?.map((supplier) => (
            <Card key={supplier.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <CardTitle className="text-lg font-bold truncate">{supplier.name}</CardTitle>
                    <CardDescription className="truncate">{supplier.category}</CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 shrink-0 ml-2">
                    {supplier.defaultCreditDays}d
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{supplier.email || 'No email'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span className="truncate">{supplier.phone || 'No phone'}</span>
                  </div>
                </div>
                
                <div className="pt-4 border-t flex gap-2">
                  <Link href={`/suppliers/${supplier.id}`} className="flex-1">
                    <Button variant="ghost" size="sm" className="w-full text-primary hover:bg-primary/5">
                      <LayoutList className="mr-2 h-4 w-4" />
                      View Ledger
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" className="w-10 px-0 shrink-0">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!suppliers || suppliers.length === 0) && !isLoading && (
            <div className="col-span-full text-center py-20 bg-white rounded-xl border-2 border-dashed">
              <p className="text-muted-foreground">No suppliers found. Add one to track dues.</p>
            </div>
          )}
        </div>
      </main>
    </SidebarInset>
  );
}
