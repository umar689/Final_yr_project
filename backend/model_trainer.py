import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, confusion_matrix, classification_report
import joblib
import os

def train_model():
    # Dynamically find the project root
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    file_path = os.path.join(base_dir, 'data', 'aligarh_energy_year_with_meter.xlsx')
    
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found.")
        return

    print("Loading data...")
    df = pd.read_excel(file_path)
    
    # Preprocessing
    # Features: Temp, Humidity. Target: Units
    X = df[['Temp', 'Humidity']]
    y = df['Units']
    
    print("Training Random Forest model...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Save the model in the same directory as this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, 'energy_model.pkl')
    joblib.dump(model, model_path)
    print(f"Model saved to {model_path}")
    
    # Verify score
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    mse = mean_squared_error(y_test, y_pred)
    r2 = model.score(X_test, y_test)
    
    print("\n--- Model Evaluation Metrics ---")
    print(f"R^2 Score: {r2:.4f}")
    print(f"Mean Absolute Error (MAE): {mae:.4f} kWh")
    print(f"Mean Squared Error (MSE): {mse:.4f}")
    print("--------------------------------\n")
    
    # Binned Confusion Matrix (For visualization in regression)
    def bin_data(val):
        if val < 2.3: return 'Low'
        elif val < 2.7: return 'Medium'
        else: return 'High'
        
    y_test_binned = [bin_data(v) for v in y_test]
    y_pred_binned = [bin_data(v) for v in y_pred]
    labels = ['Low', 'Medium', 'High']
    
    cm = confusion_matrix(y_test_binned, y_pred_binned, labels=labels)
    
    print("Binned Confusion Matrix (Low/Medium/High):")
    print("           Predicted")
    print(f"Actual    {labels[0]:<8} {labels[1]:<8} {labels[2]:<8}")
    for i, label in enumerate(labels):
        print(f"{label:<9} {cm[i][0]:<8} {cm[i][1]:<8} {cm[i][2]:<8}")
    print("\n--------------------------------")

if __name__ == "__main__":
    train_model()
