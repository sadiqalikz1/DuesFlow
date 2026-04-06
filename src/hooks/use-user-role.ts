'use client';

import { useUser, useDoc, useFirestore } from '@/firebase';
import { useMemo } from 'react';
import { doc } from 'firebase/firestore';

export type UserRole = 'admin' | 'standard' | 'none';

export function useUserRole() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  
  // Check adminUsers collection
  const adminDocRef = useMemo(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [user, firestore]);
  
  // Check financeTeamUsers collection (Standard User)
  const standardDocRef = useMemo(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'financeTeamUsers', user.uid);
  }, [user, firestore]);

  // Use the useDoc hook from the project's firebase utils
  const { data: adminData, isLoading: isAdminLoading } = useDoc(adminDocRef);
  const { data: standardData, isLoading: isStandardLoading } = useDoc(standardDocRef);

  const role: UserRole = useMemo(() => {
    if (adminData) return 'admin';
    if (standardData) return 'standard';
    return 'none';
  }, [adminData, standardData]);

  const isLoading = isAuthLoading || isAdminLoading || isStandardLoading;

  return {
    role,
    isAdmin: role === 'admin',
    isStandard: role === 'standard',
    isLoading,
    user,
  };
}
