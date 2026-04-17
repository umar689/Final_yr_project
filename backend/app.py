from flask import Flask, request, jsonify
import requests
from flask_cors import CORS
import joblib
import numpy as np
import os
from datetime import datetime, timedelta

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# OpenWeatherMap Config
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
CITY = os.getenv("CITY", "Aligarh")

# Load the AI model dynamically
script_dir = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(script_dir, 'energy_model.pkl')

if os.path.exists(MODEL_PATH):
    model = joblib.load(MODEL_PATH)
    print(f"Model loaded successfully from {MODEL_PATH}")
else:
    model = None
    print(f"Warning: Model not found at {MODEL_PATH}")

def get_tomorrow_forecast():
    """Fetches next day weather forecast from OpenWeatherMap"""
    tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    
    try:
        url = f"https://api.openweathermap.org/data/2.5/forecast?q={CITY}&appid={WEATHER_API_KEY}&units=metric"
        response = requests.get(url, timeout=5)
        data = response.json()

        if response.status_code != 200:
            print(f"Weather API Error: {data.get('message', 'Unknown')}. Using mock data.")
            return {
                'peak_temp': 32.0,
                'min_temp': 22.0,
                'avg_humidity': 45.0,
                'date': tomorrow,
                'is_mock': True
            }

        tomorrow_temps = []
        tomorrow_humidities = []
        
        for entry in data['list']:
            if tomorrow in entry['dt_txt']:
                tomorrow_temps.append(entry['main']['temp'])
                tomorrow_humidities.append(entry['main']['humidity'])
        
        if not tomorrow_temps:
            print("No forecast found for tomorrow in API list. Using mock data.")
            return {
                'peak_temp': 30.5,
                'min_temp': 23.0,
                'avg_humidity': 48.0,
                'date': tomorrow,
                'is_mock': True
            }

        return {
            'peak_temp': max(tomorrow_temps),
            'min_temp': min(tomorrow_temps),
            'avg_humidity': sum(tomorrow_humidities) / len(tomorrow_humidities),
            'date': tomorrow,
            'is_mock': False
        }
    except Exception as e:
        print(f"Weather Fetch Exception: {str(e)}. Using mock data.")
        return {
            'peak_temp': 31.0,
            'min_temp': 22.5,
            'avg_humidity': 46.0,
            'date': tomorrow,
            'is_mock': True
        }

@app.route('/api/predict', methods=['POST'])
def predict():
    """Predicts next day energy consumption"""
    print("\n" + "="*50)
    print(f"[{datetime.now().strftime('%H:%M:%S')}] NEW PREDICTION REQUEST RECEIVED")
    
    if model is None:
        print("[ERROR] AI Model not found on server")
        return jsonify({'error': 'AI Model not found on server'}), 500
    
    try:
        # 1. Log Weather Fetching
        print(f"[STEP 1] Fetching Weather Data for {CITY}...")
        weather = get_tomorrow_forecast()
        
        if weather.get('is_mock'):
            print("[WARNING] Using MOCK weather data (API failed or Key pending)")
        else:
            print("[SUCCESS] Real weather data fetched from OpenWeatherMap")

        print(f"[DATA] Weather Data Extracted for {weather['date']}:")
        print(f"   - Peak Temperature: {weather['peak_temp']} C")
        print(f"   - Average Humidity: {weather['avg_humidity']}%")

        # 2. Log Model Input
        print(f"[STEP 2] Sending data to Random Forest Model...")
        input_data = np.array([[weather['peak_temp'], weather['avg_humidity']]])
        print(f"   - Model Input Features: {input_data}")

        # 3. Log Prediction Result
        prediction = model.predict(input_data)[0]
        
        # Add slight randomness if using mock data (to avoid "stuck" feeling)
        if weather.get('is_mock'):
            import random
            variation = random.uniform(-0.05, 0.05)
            prediction += variation
            print(f"[RANDOM] Added {round(variation, 3)} kWh noise to mock prediction")

        print(f"[STEP 3] AI Prediction complete!")
        print(f"   - Result: {round(float(prediction), 4)} kWh")
        print("="*50 + "\n")
        
        return jsonify({
            'prediction': round(float(prediction), 4),
            'weather_forecast': {
                'temp_peak': round(weather['peak_temp'], 1),
                'temp_min': round(weather['min_temp'], 1),
                'humidity': round(weather['avg_humidity'], 0),
                'date': weather['date'],
                'is_mock': weather.get('is_mock', False)
            },
            'unit': 'kWh'
        })
    except Exception as e:
        print(f"[CRITICAL ERROR] in /api/predict: {str(e)}")
        return jsonify({'error': f"Internal Server Error: {str(e)}"}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'model_loaded': model is not None})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
