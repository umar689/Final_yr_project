#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <time.h>

// 1. WiFi & Firebase Credentials
#define WIFI_SSID "Anshoberoi"
#define WIFI_PASSWORD "7055285262"
#define DATABASE_URL "https://majorproj-ca5fe-default-rtdb.asia-southeast1.firebasedatabase.app"
#define DATABASE_SECRET "C0UxRFnnjwzZ6t07Bkl1kIH4VZ1eEiyEPWQSl842"

// 2. Hardware Pins & Config
#define SENSOR_PIN 23
#define RELAY_PIN 5
const float LOAD_POWER_WATTS = 15.0; // Baseline 15W bulb

// 3. NTP Time Server Config (IST)
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 19800; // IST: GMT + 5:30
const int   daylightOffset_sec = 0;

// Variables
float currentUnits = 0.0;
unsigned long lastMillis = 0;
String todayDate = "";

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Helper: Get Current Date (DD-MM-YYYY)
String getFormattedDate() {
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo)) return "ERROR";
  char dateStr[11];
  strftime(dateStr, sizeof(dateStr), "%d-%m-%Y", &timeinfo);
  return String(dateStr);
}

void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); // OFF initially (Low-level trigger)

  // WiFi Connect
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected ✅");

  // Sync NTP Time
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  // Firebase Setup (Firebase_ESP_Client Syntax)
  config.database_url = DATABASE_URL;
  config.signer.tokens.legacy_token = DATABASE_SECRET;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println("Checking for Date Change / First Run...");
  delay(3000); // Wait for NTP sync

  todayDate = getFormattedDate();

  // Load existing units from Firebase
  if (Firebase.RTDB.getFloat(&fbdo, "/current_units")) {
    currentUnits = fbdo.floatData();
  }

  String lastDate = "";
  if (Firebase.RTDB.getString(&fbdo, "/last_recorded_date")) {
    lastDate = fbdo.stringData();
  }

  // --- STARTUP DATE RESET LOGIC ---
  if (todayDate != "ERROR") {
    if (lastDate == "" || todayDate != lastDate) {
      Serial.println("New Day Detected! Archiving old data...");
      if (lastDate != "" && currentUnits > 0) {
        // Archive to history
        Firebase.RTDB.setFloat(&fbdo, "/daily_usage_history/" + lastDate, currentUnits);
      }
      // Reset for new day
      currentUnits = 0.0;
      Firebase.RTDB.setFloat(&fbdo, "/current_units", 0.0);
      Firebase.RTDB.setString(&fbdo, "/last_recorded_date", todayDate);
    }
  }

  lastMillis = millis();
}

void loop() {
  if (Firebase.ready()) {
    
    // 1. Date Check (For continuous running beyond midnight)
    String liveDate = getFormattedDate();
    if (liveDate != todayDate && liveDate != "ERROR") {
      Firebase.RTDB.setFloat(&fbdo, "/daily_usage_history/" + todayDate, currentUnits);
      currentUnits = 0.0;
      Firebase.RTDB.setFloat(&fbdo, "/current_units", 0.0);
      todayDate = liveDate;
      Firebase.RTDB.setString(&fbdo, "/last_recorded_date", todayDate);
    }

    // 2. Check Emergency Cut from Dashboard
    bool emergencyCut = false;
    if (Firebase.RTDB.getBool(&fbdo, "/emergency_cut")) {
      emergencyCut = fbdo.boolData();
    }

    if (emergencyCut) {
      digitalWrite(RELAY_PIN, HIGH); // Force OFF (Low-level trigger)
      Firebase.RTDB.setString(&fbdo, "/load_status", "EMERGENCY_OFF");
    } else {
      // 3. SENSOR & RELAY LOGIC
      bool sensorState = digitalRead(SENSOR_PIN);

      // 🔴 Metal touch (HIGH) -> DOOR CLOSED -> OFF
      if (sensorState == HIGH) {
        digitalWrite(RELAY_PIN, HIGH); // OFF
        Firebase.RTDB.setString(&fbdo, "/load_status", "OFF");
      } 
      // 🟢 Metal remove (LOW) -> DOOR OPEN -> ON
      else {
        digitalWrite(RELAY_PIN, LOW); // ON
        Firebase.RTDB.setString(&fbdo, "/load_status", "ON");

        // Energy Calculation
        unsigned long currentMillis = millis();
        float secondsPassed = (currentMillis - lastMillis) / 1000.0;
        float addedUnits = (LOAD_POWER_WATTS * (secondsPassed / 3600.0)) / 1000.0;
        currentUnits += addedUnits;
        lastMillis = currentMillis;

        // Sync units to Firebase every 2 seconds
        static unsigned long lastSync = 0;
        if (millis() - lastSync > 2000) {
          Firebase.RTDB.setFloat(&fbdo, "/current_units", currentUnits);
          lastSync = millis();
        }
      }
    }

    // 4. Heartbeat (To prevent "Offline" dashboard status)
    static unsigned long lastHb = 0;
    if (millis() - lastHb > 10000) {
      lastHb = millis();
      Firebase.RTDB.setInt(&fbdo, "/last_seen", (int)time(nullptr));
    }
  }
  delay(100);
}
