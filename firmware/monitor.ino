#include <WiFi.h>
#include <FirebaseESP32.h>
#include <time.h>

// 1. WiFi & Firebase Credentials
#define WIFI_SSID "YOUR_SSID"
#define WIFI_PASSWORD "YOUR_PASSWORD"
#define FIREBASE_HOST "majorproj-ca5fe-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_AUTH "YOUR_FIREBASE_DATABASE_SECRET" // Firebase Settings > Service Accounts > Database Secrets

// 2. Pin Definitions
const int SENSOR_PIN = 23; 
const int RELAY_PIN = 5;

// 3. Energy Constants
const float LOAD_POWER_WATTS = 15.0; // Baseline 15W bulb
float currentUnits = 0.0;
unsigned long lastMillis = 0;

// 4. Firebase Objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// NTP Time Settings (IST: GMT + 5:30)
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800; 
const int daylightOffset_sec = 0;

// Helper: Get Current Date (DD-MM-YYYY)
String getCurrentDate() {
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo)) return "01-01-2026";
  char dateChar[11];
  strftime(dateChar, sizeof(dateChar), "%d-%m-%Y", &timeinfo);
  return String(dateChar);
}

void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);

  // WiFi Connect
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");

  // Sync NTP Time
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  // Firebase Setup
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // --- SMART STARTUP LOGIC ---
  String today = getCurrentDate();
  String lastDate = "";
  
  if (Firebase.getString(fbdo, "/last_recorded_date")) {
    lastDate = fbdo.stringData();
  }

  // Agar aaj ka din badal gaya hai, toh archive karo aur units 0 karo
  if (lastDate != "" && lastDate != today) {
    Serial.println("New Day Detected! Archiving old data...");
    float finalDayUnits = 0;
    if (Firebase.getFloat(fbdo, "/current_units")) finalDayUnits = fbdo.floatData();
    
    // Archive to history
    Firebase.setFloat(fbdo, "/daily_usage_history/" + lastDate, finalDayUnits);
    
    // Reset for new day
    Firebase.setFloat(fbdo, "/current_units", 0.0);
    Firebase.setString(fbdo, "/last_recorded_date", today);
    currentUnits = 0.0;
  } else {
    // Purani units fetch karo agar power cut hua tha
    if (Firebase.getFloat(fbdo, "/current_units")) currentUnits = fbdo.floatData();
    Firebase.setString(fbdo, "/last_recorded_date", today);
  }

  lastMillis = millis();
}

void loop() {
  // 1. Check Emergency Cut from Dashboard
  bool emergencyCut = false;
  if (Firebase.getBool(fbdo, "/emergency_cut")) emergencyCut = fbdo.boolData();

  // 2. Sensor & Relay Logic
  bool presenceDetected = digitalRead(SENSOR_PIN) == LOW; // Low means object detected
  
  if (emergencyCut) {
    digitalWrite(RELAY_PIN, LOW); // Force OFF
    Firebase.setString(fbdo, "/load_status", "EMERGENCY_OFF");
  } else if (presenceDetected) {
    digitalWrite(RELAY_PIN, HIGH);
    Firebase.setString(fbdo, "/load_status", "ON");
    
    // Calculate Energy
    unsigned long currentMillis = millis();
    float secondsPassed = (currentMillis - lastMillis) / 1000.0;
    // Formula: Units (kWh) = (Watts * Hours) / 1000
    float addedUnits = (LOAD_POWER_WATTS * (secondsPassed / 3600.0)) / 1000.0;
    currentUnits += addedUnits;
    lastMillis = currentMillis;

    // Fast Sync to Firebase
    static unsigned long lastSync = 0;
    if (millis() - lastSync > 2000) {
      Firebase.setFloat(fbdo, "/current_units", currentUnits);
      lastSync = millis();
    }
  } else {
    digitalWrite(RELAY_PIN, LOW);
    Firebase.setString(fbdo, "/load_status", "OFF");
    lastMillis = millis(); // Reset timer when off
  }

  // 3. Heartbeat (30s Dashboard Timeout)
  static unsigned long lastHb = 0;
  if (millis() - lastHb > 10000) {
    lastHb = millis();
    Firebase.setInt(fbdo, "/last_seen", (int)time(nullptr));
  }
  
  delay(100); 
}
