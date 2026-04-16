import React, { useState } from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { Mail, Lock, LogIn, AlertCircle, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!isLogin && password !== confirmPassword) {
      setError("Passwords do not match!");
      setLoading(false);
      return;
    }
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError('Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
      setError('Google Sign-In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Background Decorations */}
      <motion.div 
        className="bg-glow"
        animate={{ x: [0, 50, 0], y: [0, 100, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        style={{ top: '10%', left: '10%', background: 'var(--primary)' }}
      />
      <motion.div 
        className="bg-glow"
        animate={{ x: [0, -50, 0], y: [0, -100, 0], scale: [1, 1.3, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{ bottom: '10%', right: '10%', background: 'var(--accent)' }}
      />

      <motion.div 
        className="login-card"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="login-header">
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
              <LogIn className="text-primary" size={32} />
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.h2
              key={isLogin ? 'login' : 'signup'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-white text-3xl font-bold mb-2"
            >
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </motion.h2>
          </AnimatePresence>
          <p className="text-muted text-sm px-4">
            {isLogin 
              ? 'Access your teacher cabin dashboard securely.' 
              : 'Join the smart energy management system today.'}
          </p>
        </div>

        {error && (
          <motion.div 
            className="error-message"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="input-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <Mail size={18} />
              <input 
                type="email" 
                className="login-input" 
                placeholder="teacher@university.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="input-wrapper">
              <Lock size={18} />
              <input 
                type="password" 
                className="login-input" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {!isLogin && (
            <motion.div 
              className="input-group"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
            >
              <label>Confirm Password</label>
              <div className="input-wrapper">
                <Lock size={18} />
                <input 
                  type="password" 
                  className="login-input" 
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </motion.div>
          )}

          <button 
            type="submit" 
            className="btn-premium btn-login mt-6"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-primary"></div>
            ) : (
              <>
                {isLogin ? 'Sign In' : 'Get Started'}
                <LogIn size={18} />
              </>
            )}
          </button>
        </form>

        <div className="divider">OR CONTINUE WITH</div>

        <button 
          className="btn-google" 
          onClick={handleGoogleLogin}
          disabled={loading}
          type="button"
        >
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="G" 
            className="google-icon"
          />
          Google Authentication
        </button>

        <div className="auth-toggle">
          <span>{isLogin ? "New to the system?" : "Have an account?"}</span>
          <button 
            className="auth-toggle-btn"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
          >
            {isLogin ? 'Sign Up' : 'Login Now'}
          </button>
        </div>

        <p className="footer-v6 text-center text-muted text-xs mt-12 opacity-50">
          &copy; 2026 Smart Energy IoT • AI Enabled Monitoring
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
