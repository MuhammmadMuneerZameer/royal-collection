import React, { useState } from 'react';
import { Mail, Lock, Crown, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';
import { signInWithEmail, signInWithGoogle, checkEmailExists } from './firebase';
import ForgotPassword from './ForgotPassword';

interface LoginProps {
  onLogin: (user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const user = await signInWithEmail(email, password);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!email) {
      setError('Please enter your email address first to verify it exists in our system');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      // Check if email exists in Firebase and get providers
      const emailCheck = await checkEmailExists(email);
      
      if (!emailCheck.exists) {
        setError('This email is not registered in our system. Please use a registered email.');
        return;
      }

      // Check if user has Google provider
      const hasGoogleProvider = emailCheck.providers.includes('google.com');
      if (!hasGoogleProvider) {
        setError('This email is registered with password authentication. Please use email and password to sign in.');
        return;
      }

      const user = await signInWithGoogle();
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <ForgotPassword 
        onBack={() => setShowForgotPassword(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-700 shadow-xl mx-auto mb-4">
            <Crown className="text-black w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold text-yellow-500 tracking-wider mb-2">ROYAL COLLECTION</h1>
          <p className="text-yellow-600/80 text-sm tracking-[0.2em] uppercase">Inventory System</p>
        </div>

        {/* Login Card */}
        <div className="bg-neutral-900 rounded-2xl shadow-2xl border border-yellow-600/20 p-8">
          <h2 className="text-2xl font-bold text-yellow-500 mb-6 text-center">Sign In</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-900/30 rounded-lg text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-yellow-600/80 uppercase tracking-wide mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-600/60 w-5 h-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-yellow-600 focus:border-transparent outline-none text-white placeholder-neutral-500"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-yellow-600/80 uppercase tracking-wide mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-12 pl-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-yellow-600 focus:border-transparent outline-none text-white placeholder-neutral-500"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-600/60 hover:text-yellow-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-yellow-700 to-yellow-500 hover:from-yellow-600 hover:to-yellow-400 text-black rounded-lg font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="text-center">
              <button 
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-yellow-500 hover:text-yellow-400 text-sm font-medium transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          </form>

          {/* Divider */}
          {/* <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-neutral-900 text-neutral-500">Or continue with</span>
            </div>
          </div> */}

          {/* Google Sign In */}
          {/* <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button> */}
        </div>
      </div>
    </div>
  );
};

export default Login;
