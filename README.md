# ⚡ Smart IoT Energy Management System (AI-Powered)

A comprehensive IoT solution for monitoring and intelligently predicting energy consumption in a teacher's cabin. This system combines real-time hardware state management, a premium Cyberpunk-inspired dashboard, and machine learning for predictive analytics.

---

## 🚀 Key Features

- **Real-Time Monitoring**: Live tracking of current energy consumption (kWh) with high precision.
- **AI Forecasting**: Uses a **Random Forest Regressor** and **OpenWeatherMap API** to predict energy usage for the next 24 hours based on forecasted weather (Temperature & Humidity).
- **Intelligent Load Control**: 
  - **Occupancy-Based**: Automatically manages loads based on proximity sensor feedback.
  - **Emergency Cut**: Remote override via the dashboard to completely halt power and tracking for safety.
- **Smart Data Archiving**: Automatically resets daily units at midnight and archives historical data to Firebase, even after power outages.
- **Premium UI**: Cyberpunk-Glassmorphism aesthetic with mesh gradients, interactive charts, and real-time status indicators.

---

## 🏗️ System Architecture

1.  **Hardware (ESP32)**:
    - **Sensors**: Inductive Proximity Sensor for cabin occupancy detection.
    - **Control**: 2-Channel Relay Module for load switching.
    - **Firmware**: Robust startup logic with NTP time synchronization and Firebase integration.
2.  **Cloud (Firebase)**:
    - **Realtime Database**: High-speed data synchronization between hardware and dashboard.
    - **Authentication**: Secure user login with Firebase Auth.
3.  **AI Backend (Flask/Python)**:
    - **Inference**: Fetches real-time weather forecasts and feeds them into the trained ML model.
    - **Model**: Trained on historical Aligarh energy data using Scikit-learn.
4.  **Dashboard (React/Vite)**:
    - Responsive, modern frontend using **Framer Motion** for animations and **Recharts** for data visualization.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Lucide React, Framer Motion, Recharts.
- **Backend**: Python (Flask), Scikit-learn, Pandas, Joblib, OpenWeatherMap API.
- **Firmware**: C++ (Arduino/ESP32 Core), Firebase ESP Client, NTP Time Server.
- **Styling**: Vanilla CSS (Custom Design System).

---

## 🚦 Getting Started

### Backend (AI Server)
1. Install dependencies: `pip install flask flask-cors joblib requests scikit-learn pandas openpyxl`
2. Run the server: `python backend/app.py`

### Frontend (Dashboard)
1. Install dependencies: `npm install`
2. Run development server: `npm run dev`

### Hardware (ESP32)
1. Configure credentials in `firmware/monitor.ino`.
2. Flash using Arduino IDE or VS Code PlatformIO.

---

## 🔮 Future Roadmap (v2.0)

- [ ] **PZEM-004T Integration**: Replace virtual calculations with a dedicated electricity sensor for 100% accuracy.
- [ ] **INR Bill Prediction**: Convert kWh predictions into local currency estimates (₹).
- [ ] **Mobile App & Notifications**: Native mobile dashboard with Firebase Cloud Messaging (FCM) for instant alerts.
- [ ] **Anomaly Detection**: Use AI to detect if appliances are left ON in an empty cabin.

---

## 👨‍💻 Project Developer
Developed for the final year project - IoT Smart Energy Management.
