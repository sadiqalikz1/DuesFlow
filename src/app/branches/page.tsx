
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, MapPin, Building2, TrendingUp } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

export default function BranchesPage() {
  const { firestore } = useFirestore();
  const branchesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'branches');
  }, [firestore]);
  const { data: branches, isLoading } = useCollection(branchesQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: '', address: '', contactPerson: '' });

  const handleAddBranch = () => {
    if (!newBranch.name || !firestore) return;
    
    addDocumentNonBlocking(collection(firestore, 'branches'), {
      ...newBranch,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    setNewBranch({ name: '', address: '', contactPerson: '' });
    setIsDialogOpen(false);
  };

  return (
    <SidebarInset className="flex-1 bg-background">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="flex-1">
          <h2 className="text-xl md:text-2xl font-bold font-headline text-slate-900 tracking-tight">Branches</h2>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Add Branch</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Branch</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Branch Name</Label>
                <Input 
                  value={newBranch.name} 
                  onChange={e => setNewBranch({...newBranch, name: e.target.value})}
                  placeholder="e.g. Mumbai North"
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input 
                  value={newBranch.address} 
                  onChange={e => setNewBranch({...newBranch, address: e.target.value})}
                  placeholder="Full address"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input 
                  value={newBranch.contactPerson} 
                  onChange={e => setNewBranch({...newBranch, contactPerson: e.target.value})}
                  placeholder="Name"
                />
              </div>
              <Button className="w-full" onClick={handleAddBranch}>Save Branch</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-6">
          <p className="text-muted-foreground">Operational centers and departmental credit tracking.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches?.map((branch) => (
            <Card key={branch.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg font-bold truncate">{branch.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{branch.address || 'No address provided'}</span>
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Active Contact</p>
                    <p className="text-sm font-bold text-slate-900 mt-1 truncate">{branch.contactPerson || 'N/A'}</p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-green-500 shrink-0 ml-2" />
                </div>
                <Button variant="link" className="w-full mt-4 text-primary text-xs font-bold">
                  View Branch Details
                </Button>
              </CardContent>
            </Card>
          ))}
          {(!branches || branches.length === 0) && !isLoading && (
            <div className="col-span-full text-center py-20 bg-white rounded-xl border-2 border-dashed">
              <p className="text-muted-foreground">No branches found. Add one to get started.</p>
            </div>
          )}
        </div>
      </main>
    </SidebarInset>
  );
}
