import os
import numpy as np
import pandas as pd

def generate_knee_oa_dataset(n_samples=1500, random_state=42):
    """
    Generates a realistic clinical & wearable gait dataset for Knee Osteoarthritis Risk Prediction.
    
    Inputs:
    1. Questionnaire fields:
       - age (years)
       - sex ('Male', 'Female')
       - bmi (kg/m²)
       - vas_pain_score (0-10)
       - womac_score (0-96)
       - prior_injury_history ('None', 'ACL Tear', 'Meniscus Tear', 'Fracture', 'Repetitive Strain')
       - activity_level ('Sedentary', 'Light', 'Moderate', 'Active', 'Very Active')
       
    2. Gait features (derived from 10m walk trial via dual ESP32 IMU + FSR wearable):
       - stance_time_asymmetry (% stance duration difference between left & right knee)
       - knee_rom_left (degrees of flexion-extension range of motion)
       - knee_rom_right (degrees of flexion-extension range of motion)
       - load_distribution_ratio (medial/lateral or Left/Right peak force ratio)
       - cadence (steps per minute)
       - heel_strike_force_left (N / normalised unit force)
       - heel_strike_force_right (N / normalised unit force)
       - toe_off_force_left (N / normalised unit force)
       - toe_off_force_right (N / normalised unit force)
       - gait_cycle_variability (% CV of stride cycle time)
       
    Target:
       - risk_tier ('Low', 'Moderate', 'High')
    """
    np.random.seed(random_state)
    
    # Target distribution: ~45% Low, ~35% Moderate, ~20% High (imbalanced baseline to test SMOTE/balancing)
    n_low = int(n_samples * 0.45)
    n_mod = int(n_samples * 0.35)
    n_high = n_samples - n_low - n_mod
    
    data = []
    
    # ------------------ LOW RISK COHORT ------------------
    for _ in range(n_low):
        age = int(np.clip(np.random.normal(38, 10), 20, 65))
        sex = np.random.choice(['Male', 'Female'], p=[0.52, 0.48])
        bmi = float(np.clip(np.random.normal(23.5, 3.0), 18.5, 30.0))
        vas_pain = float(np.clip(np.random.normal(1.2, 1.0), 0.0, 3.5))
        womac = float(np.clip(np.random.normal(8.0, 5.0), 0.0, 22.0))
        prior_injury = np.random.choice(
            ['No Prior Injury', 'ACL Tear', 'Meniscus Tear', 'Fracture', 'Repetitive Strain'],
            p=[0.85, 0.04, 0.05, 0.02, 0.04]
        )
        activity = np.random.choice(
            ['Sedentary', 'Light', 'Moderate', 'Active', 'Very Active'],
            p=[0.10, 0.20, 0.35, 0.25, 0.10]
        )
        
        # Gait sensor features (symmetric, smooth gait, high ROM, low variability)
        stance_asym = float(np.clip(np.random.exponential(1.5), 0.1, 4.5))
        rom_base = np.random.normal(62, 4)
        rom_left = float(np.clip(rom_base + np.random.normal(0, 1.5), 50.0, 72.0))
        rom_right = float(np.clip(rom_base + np.random.normal(0, 1.5), 50.0, 72.0))
        load_ratio = float(np.clip(np.random.normal(1.00, 0.04), 0.90, 1.10))
        cadence = float(np.clip(np.random.normal(112, 8), 92.0, 132.0))
        
        hs_force_l = float(np.clip(np.random.normal(1.25, 0.10), 0.95, 1.55))
        hs_force_r = float(np.clip(np.random.normal(1.24, 0.10), 0.95, 1.55))
        to_force_l = float(np.clip(np.random.normal(1.15, 0.09), 0.88, 1.40))
        to_force_r = float(np.clip(np.random.normal(1.14, 0.09), 0.88, 1.40))
        
        gait_var = float(np.clip(np.random.normal(1.8, 0.5), 0.8, 3.2))
        
        data.append({
            'age': age, 'sex': sex, 'bmi': round(bmi, 1),
            'vas_pain_score': round(vas_pain, 1), 'womac_score': round(womac, 1),
            'prior_injury_history': prior_injury, 'activity_level': activity,
            'stance_time_asymmetry': round(stance_asym, 2),
            'knee_rom_left': round(rom_left, 1), 'knee_rom_right': round(rom_right, 1),
            'load_distribution_ratio': round(load_ratio, 3), 'cadence': round(cadence, 1),
            'heel_strike_force_left': round(hs_force_l, 2), 'heel_strike_force_right': round(hs_force_r, 2),
            'toe_off_force_left': round(to_force_l, 2), 'toe_off_force_right': round(to_force_r, 2),
            'gait_cycle_variability': round(gait_var, 2),
            'risk_tier': 'Low'
        })

    # ------------------ MODERATE RISK COHORT ------------------
    for _ in range(n_mod):
        age = int(np.clip(np.random.normal(56, 9), 35, 76))
        sex = np.random.choice(['Male', 'Female'], p=[0.42, 0.58])
        bmi = float(np.clip(np.random.normal(28.2, 3.8), 21.0, 36.0))
        vas_pain = float(np.clip(np.random.normal(4.3, 1.2), 1.8, 6.8))
        womac = float(np.clip(np.random.normal(32.0, 9.0), 14.0, 52.0))
        prior_injury = np.random.choice(
            ['No Prior Injury', 'ACL Tear', 'Meniscus Tear', 'Fracture', 'Repetitive Strain'],
            p=[0.45, 0.18, 0.22, 0.05, 0.10]
        )
        activity = np.random.choice(
            ['Sedentary', 'Light', 'Moderate', 'Active', 'Very Active'],
            p=[0.25, 0.38, 0.25, 0.10, 0.02]
        )
        
        # Moderate asymmetry & reduced ROM on affected side
        affected_side = np.random.choice(['left', 'right'])
        stance_asym = float(np.clip(np.random.normal(6.5, 2.0), 2.8, 11.5))
        
        rom_unaffected = np.random.normal(55, 4)
        rom_affected = rom_unaffected - np.random.normal(10, 3)
        
        if affected_side == 'left':
            rom_left, rom_right = rom_affected, rom_unaffected
            hs_force_l = float(np.clip(np.random.normal(0.95, 0.12), 0.65, 1.25))
            hs_force_r = float(np.clip(np.random.normal(1.16, 0.11), 0.85, 1.42))
            to_force_l = float(np.clip(np.random.normal(0.88, 0.10), 0.58, 1.15))
            to_force_r = float(np.clip(np.random.normal(1.06, 0.10), 0.78, 1.30))
            load_ratio = float(np.clip(np.random.normal(0.86, 0.07), 0.70, 0.98))
        else:
            rom_left, rom_right = rom_unaffected, rom_affected
            hs_force_l = float(np.clip(np.random.normal(1.16, 0.11), 0.85, 1.42))
            hs_force_r = float(np.clip(np.random.normal(0.95, 0.12), 0.65, 1.25))
            to_force_l = float(np.clip(np.random.normal(1.06, 0.10), 0.78, 1.30))
            to_force_r = float(np.clip(np.random.normal(0.88, 0.10), 0.58, 1.15))
            load_ratio = float(np.clip(np.random.normal(1.14, 0.07), 1.02, 1.30))

        rom_left = float(np.clip(rom_left, 38.0, 62.0))
        rom_right = float(np.clip(rom_right, 38.0, 62.0))
        cadence = float(np.clip(np.random.normal(96, 9), 75.0, 118.0))
        gait_var = float(np.clip(np.random.normal(4.2, 1.0), 2.2, 6.8))
        
        data.append({
            'age': age, 'sex': sex, 'bmi': round(bmi, 1),
            'vas_pain_score': round(vas_pain, 1), 'womac_score': round(womac, 1),
            'prior_injury_history': prior_injury, 'activity_level': activity,
            'stance_time_asymmetry': round(stance_asym, 2),
            'knee_rom_left': round(rom_left, 1), 'knee_rom_right': round(rom_right, 1),
            'load_distribution_ratio': round(load_ratio, 3), 'cadence': round(cadence, 1),
            'heel_strike_force_left': round(hs_force_l, 2), 'heel_strike_force_right': round(hs_force_r, 2),
            'toe_off_force_left': round(to_force_l, 2), 'toe_off_force_right': round(to_force_r, 2),
            'gait_cycle_variability': round(gait_var, 2),
            'risk_tier': 'Moderate'
        })

    # ------------------ HIGH RISK COHORT ------------------
    for _ in range(n_high):
        age = int(np.clip(np.random.normal(67, 8), 48, 88))
        sex = np.random.choice(['Male', 'Female'], p=[0.35, 0.65])
        bmi = float(np.clip(np.random.normal(32.5, 4.5), 24.5, 44.0))
        vas_pain = float(np.clip(np.random.normal(7.4, 1.1), 4.8, 9.9))
        womac = float(np.clip(np.random.normal(61.0, 12.0), 38.0, 92.0))
        prior_injury = np.random.choice(
            ['No Prior Injury', 'ACL Tear', 'Meniscus Tear', 'Fracture', 'Repetitive Strain'],
            p=[0.20, 0.30, 0.32, 0.10, 0.08]
        )
        activity = np.random.choice(
            ['Sedentary', 'Light', 'Moderate', 'Active', 'Very Active'],
            p=[0.55, 0.32, 0.10, 0.03, 0.00]
        )
        
        # High asymmetry, severely restricted ROM, antalgic loading, high gait variability
        affected_side = np.random.choice(['left', 'right'])
        stance_asym = float(np.clip(np.random.normal(13.2, 3.2), 7.5, 22.0))
        
        rom_unaffected = np.random.normal(46, 4)
        rom_affected = rom_unaffected - np.random.normal(14, 4)
        
        if affected_side == 'left':
            rom_left, rom_right = rom_affected, rom_unaffected
            hs_force_l = float(np.clip(np.random.normal(0.68, 0.12), 0.40, 0.95))
            hs_force_r = float(np.clip(np.random.normal(1.08, 0.12), 0.75, 1.35))
            to_force_l = float(np.clip(np.random.normal(0.60, 0.11), 0.35, 0.88))
            to_force_r = float(np.clip(np.random.normal(0.96, 0.11), 0.65, 1.22))
            load_ratio = float(np.clip(np.random.normal(0.68, 0.09), 0.48, 0.84))
        else:
            rom_left, rom_right = rom_unaffected, rom_affected
            hs_force_l = float(np.clip(np.random.normal(1.08, 0.12), 0.75, 1.35))
            hs_force_r = float(np.clip(np.random.normal(0.68, 0.12), 0.40, 0.95))
            to_force_l = float(np.clip(np.random.normal(0.96, 0.11), 0.65, 1.22))
            to_force_r = float(np.clip(np.random.normal(0.60, 0.11), 0.35, 0.88))
            load_ratio = float(np.clip(np.random.normal(1.36, 0.10), 1.15, 1.62))

        rom_left = float(np.clip(rom_left, 24.0, 52.0))
        rom_right = float(np.clip(rom_right, 24.0, 52.0))
        cadence = float(np.clip(np.random.normal(78, 10), 55.0, 98.0))
        gait_var = float(np.clip(np.random.normal(7.8, 1.8), 4.5, 14.0))
        
        data.append({
            'age': age, 'sex': sex, 'bmi': round(bmi, 1),
            'vas_pain_score': round(vas_pain, 1), 'womac_score': round(womac, 1),
            'prior_injury_history': prior_injury, 'activity_level': activity,
            'stance_time_asymmetry': round(stance_asym, 2),
            'knee_rom_left': round(rom_left, 1), 'knee_rom_right': round(rom_right, 1),
            'load_distribution_ratio': round(load_ratio, 3), 'cadence': round(cadence, 1),
            'heel_strike_force_left': round(hs_force_l, 2), 'heel_strike_force_right': round(hs_force_r, 2),
            'toe_off_force_left': round(to_force_l, 2), 'toe_off_force_right': round(to_force_r, 2),
            'gait_cycle_variability': round(gait_var, 2),
            'risk_tier': 'High'
        })

    df = pd.DataFrame(data)
    # Shuffle dataframe
    df = df.sample(frac=1.0, random_state=random_state).reset_index(drop=True)
    return df

if __name__ == '__main__':
    out_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(out_dir, exist_ok=True)
    csv_path = os.path.join(out_dir, 'knee_oa_dataset.csv')
    df = generate_knee_oa_dataset(n_samples=1500, random_state=42)
    df.to_csv(csv_path, index=False)
    print(f"Generated dataset saved to {csv_path}")
    print("Class distribution:")
    print(df['risk_tier'].value_counts())
