import React, { useState } from 'react';
import { Mail, ArrowLeft, Crown } from 'lucide-react';
import { sendPasswordReset, checkEmailExists } from './firebase';

interface ForgotPasswordProps {
  onBack: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Check if email exists in Firebase and get providers
      const emailCheck = await checkEmailExists(email);
      
      if (!emailCheck.exists) {
        setError('This email is not registered in our system');
        return;
      }

      // Send password reset email - Firebase will handle provider validation
      await sendPasswordReset(email);
      setSuccess('Password reset link has been sent to your email. Please check your Gmail inbox.');
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-700 shadow-xl mx-auto mb-4">
            <Crown className="text-black w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-yellow-500 mb-2">ROYAL COLLECTION</h1>
          <p className="text-slate-400 text-sm">Reset Your Password</p>
        </div>

        {/* Forgot Password Form */}
        <div className="bg-neutral-900 rounded-2xl shadow-2xl border border-yellow-600/20 p-8">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-yellow-500 mb-6 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Sign In
          </button>

          <h2 className="text-xl font-bold text-slate-200 mb-6">Forgot Password?</h2>
          <p className="text-slate-400 text-sm mb-6">
            Enter your email address and we'll send you a link to reset your password. 
            Only registered emails will receive the reset link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-yellow-600/80 uppercase tracking-wide mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-yellow-600 focus:border-transparent outline-none text-white placeholder-slate-500"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-900/30 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-900/20 border border-green-900/30 rounded-lg p-3">
                <p className="text-green-400 text-sm">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-700 to-yellow-500 hover:from-yellow-600 hover:to-yellow-400 text-black rounded-lg font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Mail size={20} />
                  Send Reset Link
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              Remember your password?{' '}
              <button 
                onClick={onBack}
                className="text-yellow-500 hover:text-yellow-400 font-medium"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-slate-500 text-xs">
            © 2024 Royal Collection. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
