'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import {FirestorePermissionError} from '@/firebase/errors';

/**
 * Checks if the user is currently authenticated.
 * @returns True if user is authenticated, false otherwise.
 */
function isUserAuthenticated(): boolean {
  try {
    const auth = getAuth();
    return auth.currentUser !== null;
  } catch {
    return false;
  }
}

/**
 * Ensures the user has a valid Firebase ID token.
 * This is more robust than just checking currentUser.
 * @returns True if user has a valid token, false otherwise.
 */
async function ensureValidToken(): Promise<boolean> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      return false;
    }

    // Force refresh to ensure valid token - handles token expiration
    await user.getIdToken(true);
    return true;
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
}

/**
 * Initiates a setDoc operation for a document reference.
 * Does NOT await the write operation internally.
 * Validates authentication before attempting write.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions) {
  if (!isUserAuthenticated()) {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'write',
        requestResourceData: data,
      })
    );
    return;
  }
  
  setDoc(docRef, data, options).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'write', // or 'create'/'update' based on options
        requestResourceData: data,
      })
    )
  })
  // Execution continues immediately
}


/**
 * Initiates an addDoc operation for a collection reference.
 * Does NOT await the write operation internally.
 * Returns the Promise for the new doc ref, but typically not awaited by caller.
 * Validates authentication before attempting write.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  if (!isUserAuthenticated()) {
    const error = new FirestorePermissionError({
      path: colRef.path,
      operation: 'create',
      requestResourceData: data,
    });
    errorEmitter.emit('permission-error', error);
    return Promise.reject(error);
  }
  
  const promise = addDoc(colRef, data)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: data,
        })
      )
    });
  return promise;
}


/**
 * Initiates an updateDoc operation for a document reference.
 * Does NOT await the write operation internally.
 * Validates authentication before attempting write.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  if (!isUserAuthenticated()) {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: data,
      })
    );
    return;
  }
  
  updateDoc(docRef, data)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: data,
        })
      )
    });
}
/**
 * Safe wrapper for direct addDoc calls.
 * Validates authentication before attempting write.
 * Ensures user has a valid Firebase ID token.
 * @throws FirestorePermissionError if user is not authenticated
 */
export async function addDocSafe(colRef: CollectionReference, data: any) {
  if (!isUserAuthenticated()) {
    throw new FirestorePermissionError({
      path: colRef.path,
      operation: 'create',
      requestResourceData: data,
    });
  }

  // For direct awaited calls, ensure valid token
  const hasValidToken = await ensureValidToken();
  if (!hasValidToken) {
    throw new FirestorePermissionError({
      path: colRef.path,
      operation: 'create',
      requestResourceData: data,
    });
  }

  return addDoc(colRef, data);
}

/**
 * Safe wrapper for direct setDoc calls.
 * Validates authentication before attempting write.
 * Ensures user has a valid Firebase ID token.
 * @throws FirestorePermissionError if user is not authenticated
 */
export async function setDocSafe(docRef: DocumentReference, data: any, options?: SetOptions) {
  if (!isUserAuthenticated()) {
    throw new FirestorePermissionError({
      path: docRef.path,
      operation: 'write',
      requestResourceData: data,
    });
  }

  // For direct awaited calls, ensure valid token
  const hasValidToken = await ensureValidToken();
  if (!hasValidToken) {
    throw new FirestorePermissionError({
      path: docRef.path,
      operation: 'write',
      requestResourceData: data,
    });
  }

  return setDoc(docRef, data, options);
}

/**
 * Initiates a deleteDoc operation for a document reference.
 * Does NOT await the write operation internally.
 * Validates authentication before attempting write.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  if (!isUserAuthenticated()) {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete',
      })
    );
    return;
  }
  
  deleteDoc(docRef)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        })
      )
    });
}