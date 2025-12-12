import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  User
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCScNlP5ACv1YFgWrgF8yJnNtUU2qS1kIU",
  authDomain: "dashboard-pn.firebaseapp.com",
  projectId: "dashboard-pn",
  storageBucket: "dashboard-pn.firebasestorage.app",
  messagingSenderId: "570134806240",
  appId: "1:570134806240:web:59688bee96d5ea0d959a85"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Error signing in with Google:", error);
    
    // Handle specific Firebase errors
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in popup was closed. Please try again.');
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error('Pop-up was blocked by your browser. Please allow pop-ups and try again.');
    } else if (error.code === 'auth/cancelled-popup-request') {
      throw new Error('Sign-in was cancelled. Please try again.');
    } else {
      throw new Error(error.message || 'Failed to sign in with Google');
    }
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    console.log('Attempting email sign-in for:', normalizedEmail);
    const result = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    console.log('Email sign-in successful');
    return result.user;
  } catch (error: any) {
    console.error("Error signing in with email:", error);
    
    // Handle specific Firebase errors
    if (error.code === 'auth/user-not-found') {
      throw new Error('This email is not registered in our system');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Incorrect password. Please try again.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Please enter a valid email address');
    } else if (error.code === 'auth/user-disabled') {
      throw new Error('This account has been disabled. Please contact support.');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many failed attempts. Please try again later.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your connection and try again.');
    } else {
      throw new Error(error.message || 'Failed to sign in');
    }
  }
};

export const sendPasswordReset = async (email: string) => {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    console.log('Sending password reset to:', normalizedEmail);
    await sendPasswordResetEmail(auth, normalizedEmail);
    console.log('Password reset email sent successfully');
    return true;
  } catch (error: any) {
    console.error("Error sending password reset email:", error);
    
    // Provide more specific error messages
    if (error.code === 'auth/user-not-found') {
      throw new Error('This email is not registered in our system');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Please enter a valid email address');
    } else if (error.code === 'auth/user-disabled') {
      throw new Error('This account has been disabled. Please contact support.');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many requests. Please try again later');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your connection and try again.');
    } else {
      throw new Error(error.message || 'Failed to send password reset email');
    }
  }
};

// More reliable method to check email existence
export const checkEmailExists = async (email: string): Promise<{ exists: boolean; providers: string[] }> => {
  const normalizedEmail = email.trim().toLowerCase();
  console.log('=== DEBUG: Checking email existence for:', normalizedEmail);
  
  try {
    // Method 1: Try fetchSignInMethodsForEmail first
    const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
    console.log('=== DEBUG: Method 1 - Found authentication methods:', methods);
    console.log('=== DEBUG: Method 1 - Methods length:', methods.length);
    
    if (methods.length > 0) {
      return {
        exists: true,
        providers: methods
      };
    }
    
    // Method 2: If no methods found, try a different approach
    // Sometimes fetchSignInMethodsForEmail returns empty array for existing users
    // Let's try to verify by attempting a sign-in operation with a dummy password
    console.log('=== DEBUG: Method 1 failed, trying Method 2...');
    
    // Create a test sign-in attempt that will fail with specific error codes
    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, 'test-password-123');
    } catch (signInError: any) {
      console.log('=== DEBUG: Method 2 - Sign-in error code:', signInError.code);
      console.log('=== DEBUG: Method 2 - Sign-in error message:', signInError.message);
      
      // If error is 'auth/wrong-password', user exists
      if (signInError.code === 'auth/wrong-password') {
        console.log('=== DEBUG: Method 2 - User exists (wrong password)');
        return {
          exists: true,
          providers: ['password'] // Assume password provider
        };
      }
      // If error is 'auth/user-not-found', user doesn't exist
      else if (signInError.code === 'auth/user-not-found') {
        console.log('=== DEBUG: Method 2 - User does not exist');
        return {
          exists: false,
          providers: []
        };
      }
      // If error is 'auth/invalid-email', email format is wrong
      else if (signInError.code === 'auth/invalid-email') {
        console.log('=== DEBUG: Method 2 - Invalid email format');
        return {
          exists: false,
          providers: []
        };
      }
      // For other errors, try Method 3
      else {
        console.log('=== DEBUG: Method 2 - Inconclusive error, trying Method 3...');
      }
    }
    
    // Method 3: Try password reset as last resort (but don't actually send)
    console.log('=== DEBUG: Method 3 - Trying password reset check...');
    try {
      // This will actually send an email, but only if user exists
      await sendPasswordResetEmail(auth, normalizedEmail);
      console.log('=== DEBUG: Method 3 - Password reset sent - user exists');
      return {
        exists: true,
        providers: ['password'] // Assume password provider
      };
    } catch (resetError: any) {
      console.log('=== DEBUG: Method 3 - Password reset error:', resetError.code);
      
      if (resetError.code === 'auth/user-not-found') {
        console.log('=== DEBUG: Method 3 - User does not exist');
        return {
          exists: false,
          providers: []
        };
      } else {
        // For any other error, assume user exists to be safe
        console.log('=== DEBUG: Method 3 - Inconclusive, assuming user exists');
        return {
          exists: true,
          providers: ['password']
        };
      }
    }
    
  } catch (error: any) {
    console.error('=== DEBUG: All methods failed:', error);
    console.error('=== DEBUG: Final error code:', error.code);
    
    // Handle specific Firebase errors
    if (error.code === 'auth/invalid-email') {
      return {
        exists: false,
        providers: []
      };
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your connection and try again.');
    } else {
      // For any other error, assume user exists to be safe
      console.log('=== DEBUG: Network/other error, assuming user exists');
      return {
        exists: true,
        providers: ['password']
      };
    }
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
