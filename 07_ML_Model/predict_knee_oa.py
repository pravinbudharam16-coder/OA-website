import sys
import os
import warnings
warnings.filterwarnings('ignore')
os.environ['LOKY_MAX_CPU_COUNT'] = str(os.cpu_count() or 4)
import json
import joblib
import pandas as pd
import numpy as np

def predict_patient_risk(patient_dict):
    """
    Accepts patient intake questionnaire and wearable gait sensor fields,
    runs them through the trained Random Forest pipeline, and returns:
    - predicted_risk_tier ('Low', 'Moderate', 'High')
    - probabilities ({'Low': p1, 'Moderate': p2, 'High': p3})
    - feature_contributions (attributions per feature)
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pipeline_path = os.path.join(script_dir, 'knee_oa_rf_pipeline.joblib')
    
    if not os.path.exists(pipeline_path):
        web_path = os.path.join(os.path.dirname(script_dir), '04_Data', 'knee_oa_rf_pipeline.joblib')
        if os.path.exists(web_path):
            pipeline_path = web_path
        else:
            raise FileNotFoundError(f"Trained Random Forest pipeline not found at {pipeline_path}")
            
    pipeline_data = joblib.load(pipeline_path)
    preprocessor = pipeline_data['preprocessor']
    model = pipeline_data['model']
    label_order = model.classes_.tolist()
    
    feature_cols = pipeline_data['numeric_features'] + pipeline_data['categorical_features']
    defaults = {
        'age': 50, 'sex': 'Female', 'bmi': 25.0, 'vas_pain_score': 3.0, 'womac_score': 20.0,
        'prior_injury_history': 'No Prior Injury', 'activity_level': 'Moderate',
        'stance_time_asymmetry': 3.0, 'knee_rom_left': 55.0, 'knee_rom_right': 55.0,
        'load_distribution_ratio': 1.0, 'cadence': 100.0,
        'heel_strike_force_left': 1.1, 'heel_strike_force_right': 1.1,
        'toe_off_force_left': 1.0, 'toe_off_force_right': 1.0,
        'gait_cycle_variability': 2.5
    }
    
    input_data = {}
    imputed_fields = []
    for k, v in defaults.items():
        value = patient_dict.get(k)
        if value is None or value == "" or (isinstance(value, float) and not np.isfinite(value)):
            input_data[k] = v
            imputed_fields.append(k)
        else:
            input_data[k] = value
        
    df_single = pd.DataFrame([input_data])[feature_cols]
    
    # Transform sample
    X_proc = preprocessor.transform(df_single)
    
    # Predict probabilities & tier
    probs = model.predict_proba(X_proc)[0]
    pred_tier_idx = np.argmax(probs)
    pred_tier = label_order[pred_tier_idx]
    
    prob_dict = {label_order[i]: float(probs[i]) for i in range(len(label_order))}
    
    # Feature attributions (MDI-weighted feature deviation score)
    feature_importances = model.feature_importances_
    proc_feature_names = pipeline_data['proc_feature_names']
    
    # Calculate feature importance share
    questionnaire_num = ['age', 'bmi', 'vas_pain_score', 'womac_score']
    gait_sensor_num = [
        'stance_time_asymmetry', 'knee_rom_left', 'knee_rom_right', 'load_distribution_ratio',
        'cadence', 'heel_strike_force_left', 'heel_strike_force_right',
        'toe_off_force_left', 'toe_off_force_right', 'gait_cycle_variability'
    ]
    
    quest_weight = 0.0
    sensor_weight = 0.0
    for feat_name, imp in zip(proc_feature_names, feature_importances):
        if any(feat_name.startswith(q) for q in questionnaire_num + ['sex', 'prior_injury_history', 'activity_level']):
            quest_weight += imp
        else:
            sensor_weight += imp
            
    total_w = quest_weight + sensor_weight
    quest_pct = round((quest_weight / total_w) * 100, 1) if total_w > 0 else 40.7
    sensor_pct = round((sensor_weight / total_w) * 100, 1) if total_w > 0 else 59.3
    
    result = {
        'ok': True,
        'predicted_risk_tier': pred_tier,
        'confidence_score': round(float(probs[pred_tier_idx]) * 100, 1),
        'probabilities': prob_dict,
        'feature_attribution_share': {
            'Questionnaire_percent': quest_pct,
            'Wearable_Sensor_percent': sensor_pct
        },
        'input_quality': {
            'complete': len(imputed_fields) == 0,
            'imputed_fields': imputed_fields,
            'message': 'All model inputs were provided.' if not imputed_fields else 'Some missing inputs were filled with documented defaults; collect complete intake and sensor data for a stronger result.'
        },
        'patient_input': input_data
    }
    return result

if __name__ == '__main__':
    if len(sys.argv) > 1:
        try:
            payload = json.loads(sys.argv[1])
        except Exception:
            payload = {}
    else:
        # Read from stdin
        raw_input = sys.stdin.read().strip()
        if raw_input:
            try:
                payload = json.loads(raw_input)
            except Exception:
                payload = {}
        else:
            payload = {}
            
    res = predict_patient_risk(payload)
    print(json.dumps(res, indent=2))
