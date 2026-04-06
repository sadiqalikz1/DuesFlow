'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

/**
 * Custom hook to manage and format currencies based on user settings.
 * Defaults to SAR if no settings are found.
 * Supports Saudi Riyal (SAR) for KSA.
 */
export function useCurrency() {
  const { user } = useUser();
  const firestore = useFirestore();

  const settingsRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'userSettings', user.uid);
  }, [firestore, user?.uid]);

  const { data: settings } = useDoc(settingsRef);

  const currencyCode = settings?.currency || 'SAR';

  /**
   * Formats a numeric value into the user's preferred currency format.
   * SAR: Uses 'en-SA' or 'ar-SA'.
   * INR: Uses 'en-IN' for lakhs/crores notation.
   */
  const formatCurrency = (amount: number) => {
    let locale = 'en-US';
    if (currencyCode === 'INR') locale = 'en-IN';
    if (currencyCode === 'SAR') locale = 'en-SA';
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  return { currencyCode, formatCurrency };
}
