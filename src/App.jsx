import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { ref, onValue, set } from "firebase/database";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from './components/Login.jsx';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import {
  Zap,
  Power,
  TrendingUp,
  Calendar,
  Activity,
  AlertCircle,
  Cpu,
  LogOut,
  User,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({
    current_units: 0,
    load_status: 'OFF',
    daily_usage_history: [],
    predicted_next_day: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiPrediction, setAiPrediction] = useState(null);
  const [forecastWeather, setForecastWeather] = useState(null);
  const [isHardwareOffline, setIsHardwareOffline] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Fallback to mock data if Firebase fails or is not configured
  const mockData = {
    current_units: 12.45,
    load_status: 'ON',
    daily_usage_history: [
      { name: 'Mon', usage: 10.2 },
      { name: 'Tue', usage: 12.5 },
      { name: 'Wed', usage: 15.1 },
      { name: 'Thu', usage: 11.4 },
      { name: 'Fri', usage: 14.8 },
      { name: 'Sat', usage: 16.2 },
      { name: 'Sun', usage: 12.4 }
    ],
    predicted_next_day: 13.5
  };

  useEffect(() => {
    // Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    try {
      const currentUnitsRef = ref(db, 'current_units');
      const loadStatusRef = ref(db, 'load_status');
      const historyRef = ref(db, 'daily_usage_history');

      // Listen for current units
      const unsubscribeUnits = onValue(currentUnitsRef, (snapshot) => {
        const val = snapshot.val();
        console.log("Firebase: Current Units Update ->", val);
        if (val !== null) {
          setData(prev => ({ ...prev, current_units: parseFloat(val) }));
          setError(null); // Clear any previous errors
        }
        setLoading(false);
      }, (err) => {
        console.error("Firebase Auth/Permission Error:", err);
        setError("Firebase connection error. Check your database rules.");
        setLoading(false);
      });

      // Listen for load status
      const unsubscribeStatus = onValue(loadStatusRef, (snapshot) => {
        const val = snapshot.val();
        console.log("Firebase: Load Status Update ->", val);
        if (val !== null) setData(prev => ({ ...prev, load_status: val }));
      });

      // Listen for history
      const unsubscribeHistory = onValue(historyRef, (snapshot) => {
        const val = snapshot.val();
        console.log("Firebase: Weekly History Update ->", val);

        if (val) {
          // 1. Convert object { "DD-MM-YYYY": value } to array of items
          const historyItems = Object.entries(val).map(([dateStr, usage]) => {
            if (dateStr.includes('-')) {
              // New format: DD-MM-YYYY
              const [day, month, year] = dateStr.split('-').map(Number);
              return {
                dateObj: new Date(year, month - 1, day),
                name: `${day}/${month}`, // e.g., 12/4
                usage: parseFloat(usage) || 0
              };
            } else {
              // Fallback for old numeric keys (0, 1, 2...)
              return {
                dateObj: new Date(2026, 0, parseInt(dateStr) + 1), // Dummy date for sorting
                name: `Day ${dateStr}`,
                usage: parseFloat(usage) || 0
              };
            }
          });

          // 2. Sort by date and take the last 7 days
          const sortedHistory = historyItems
            .sort((a, b) => a.dateObj - b.dateObj)
            .slice(-7);

          setData(prev => ({ ...prev, daily_usage_history: sortedHistory }));
        }
      }, (err) => {
        console.error("History fetch error:", err);
      });

      // Listen for Heartbeat (Last Seen)
      const heartbeatRef = ref(db, 'last_seen');
      const unsubscribeHeartbeat = onValue(heartbeatRef, (snapshot) => {
        const val = snapshot.val();
        if (val) setData(prev => ({ ...prev, last_seen: val }));
      });

      return () => {
        unsubscribeUnits();
        unsubscribeStatus();
        unsubscribeHistory();
        unsubscribeHeartbeat();
      };
    } catch (e) {
      console.error("Firebase Setup Error:", e);
      setLoading(false);
    }
  }, [user]);

  // Real-time Heartbeat Checker (runs every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const isOffline = Math.floor(Date.now() / 1000) - (data.last_seen || 0) > 30;
      setIsHardwareOffline(isOffline);
    }, 5000);
    return () => clearInterval(interval);
  }, [data.last_seen]);

  const toggleLoad = (status) => {
    try {
      if (status === 'OFF') {
        // Emergency Cut: Force both status and emergency flag
        set(ref(db, 'emergency_cut'), true);
        set(ref(db, 'load_status'), 'OFF');
      } else {
        // Restore Power: Clear emergency flag
        set(ref(db, 'emergency_cut'), false);
        set(ref(db, 'load_status'), 'ON');
      }
    } catch (e) {
      console.error("Failed to update Firebase:", e);
      setData(prev => ({ ...prev, load_status: status }));
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Fetch AI Prediction from Python Backend
  const fetchAiPrediction = async () => {
    if (!user) return;
    setIsAiLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:5001/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temp: 35, humidity: 40 })
      });

      if (!response.ok) throw new Error('AI Server error');

      const result = await response.json();
      if (result.prediction) {
        setAiPrediction(result.prediction);
        setForecastWeather(result.weather_forecast);
      }
    } catch (err) {
      console.warn("AI Prediction Backend connection failed.");
      setAiPrediction("OFFLINE");
      setForecastWeather(null);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    fetchAiPrediction();
  }, [user]);

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-container">
      {/* Background Decorations */}
      <motion.div
        className="bg-glow"
        animate={{
          x: [0, 100, 0],
          y: [0, -50, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{ top: '-10%', left: '-10%', background: 'var(--primary)' }}
      />
      <motion.div
        className="bg-glow"
        animate={{
          x: [0, -100, 0],
          y: [0, 50, 0],
          scale: [1, 1.3, 1]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        style={{ bottom: '-10%', right: '-10%', background: 'var(--accent)' }}
      />

      <nav className="custom-nav">
        <div className="nav-brand">IoT MONITOR</div>
        <div className="nav-user">
          <div className="flex items-center gap-2 text-muted text-sm">
            <User size={16} />
            <span>{user.email}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <h1 className="main-title">Smart Energy Dashboard</h1>
        <p className="subtitle">Real-time IoT Monitoring System • Teacher Cabin</p>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 flex items-center justify-center gap-2 text-error bg-error/10 px-4 py-2 rounded-full text-sm inline-flex border border-error/20"
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </motion.div>
        )}
      </motion.header>

      <motion.div
        className="dashboard-grid"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Total Consumption Card */}
        <motion.div className="card" variants={itemVariants}>
          <div className="card-title">
            <Zap className="text-primary" size={18} />
            Today's Consumption
          </div>
          <div className="card-value">
            {data.current_units.toFixed(5)}
            <span className="unit">kWh</span>
          </div>
          <div className="text-muted text-sm flex items-center gap-2 mt-2">
            <TrendingUp size={14} className="text-emerald-400" />
            <span>Consumption Tracking Active</span>
          </div>
        </motion.div>

        {/* Load Status Card */}
        <motion.div className="card" variants={itemVariants}>
          <div className="card-title">
            <Activity className="text-secondary" size={18} />
            System Status
          </div>
          <div className="card-value">
            <div className="status-indicator">
              {isHardwareOffline ? (
                <>
                  <div className="status-dot offline"></div>
                  <span className="text-gray-400">OFFLINE</span>
                </>
              ) : (
                <>
                  <div className={`status-dot ${data.load_status === 'OFF' ? 'off' : 'on'}`}></div>
                  <span className={data.load_status === 'OFF' ? 'text-red-400' : 'text-emerald-400'}>
                    {data.load_status}
                  </span>
                </>
              )}
            </div>
          </div>
          <p className="text-muted text-sm mt-2">
            {isHardwareOffline 
              ? "Hardware connection lost" 
              : `Load is currently ${data.load_status.toLowerCase()}`}
          </p>
        </motion.div>

        {/* AI Prediction Card */}
        <motion.div className="card" variants={itemVariants}>
          <div className="card-title flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Cpu className="text-accent" size={18} />
              AI Analytics
            </div>
            <button
              onClick={() => fetchAiPrediction()}
              disabled={isAiLoading}
              className="ai-refresh-btn"
              title="Refresh AI Prediction"
            >
              <RefreshCw
                size={12}
                className={isAiLoading ? 'spin-animation' : ''}
                style={{ transition: 'transform 0.3s ease' }}
              />
              <span>{isAiLoading ? 'Analyzing...' : 'Refresh'}</span>
            </button>
          </div>
          <div className="card-value">
            {isAiLoading ? (
              <span className="text-sm animate-pulse text-accent">Analyzing...</span>
            ) : (
              aiPrediction === "OFFLINE" ? (
                <span className="text-sm text-red-400">SERVER OFFLINE</span>
              ) : (
                <>
                  {aiPrediction || "---"}
                  <span className="unit ml-1">kWh</span>
                </>
              )
            )}
          </div>
          <div className="prediction-box">
            <div className="prediction-label">Next Day Weather Forecast</div>
            {forecastWeather ? (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Peak Temp:</span>
                  <span className="text-primary font-bold">{forecastWeather.temp_peak}°C</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Min Temp:</span>
                  <span className="text-secondary">{forecastWeather.temp_min}°C</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Humidity:</span>
                  <span className="text-accent">{forecastWeather.humidity}%</span>
                </div>
                <p className="text-[10px] text-muted mt-2 border-t border-white/5 pt-1 italic">
                   *Based on OpenWeatherMap for Aligarh
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted">Machine learning prediction based on historical patterns.</p>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Chart Section */}
      <motion.div
        className="chart-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8 }}
      >
        <div className="card-title mb-6">
          <Calendar className="text-secondary" size={18} />
          Weekly Performance Analysis
        </div>
        <div className="h-64 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.daily_usage_history}>
              <defs>
                <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  color: '#fff',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}
              />
              <Area
                type="monotone"
                dataKey="usage"
                stroke="var(--primary)"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#colorUsage)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Control Section */}
      <motion.div
        className="controls"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <button
          className="btn-premium btn-on"
          onClick={() => toggleLoad('ON')}
          disabled={isHardwareOffline || data.load_status === 'ON'}
          style={{ opacity: (isHardwareOffline || data.load_status === 'ON') ? 0.5 : 1, cursor: isHardwareOffline ? 'not-allowed' : 'pointer' }}
        >
          <Power size={20} />
          Restore Power
        </button>
        <button
          className="btn-premium btn-off"
          onClick={() => toggleLoad('OFF')}
          disabled={isHardwareOffline || data.load_status === 'OFF'}
          style={{ opacity: (isHardwareOffline || data.load_status === 'OFF') ? 0.5 : 1, cursor: isHardwareOffline ? 'not-allowed' : 'pointer' }}
        >
          <Power size={20} />
          Emergency Cut
        </button>
      </motion.div>

      <footer className="mt-12 text-center text-muted text-sm pb-8">
        <p>&copy; 2026 Smart Energy Monitor • Designed for Excellence</p>
      </footer>
    </div>
  );
}

export default App;
