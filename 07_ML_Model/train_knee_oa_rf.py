import os
import warnings
warnings.filterwarnings('ignore')
os.environ['LOKY_MAX_CPU_COUNT'] = str(os.cpu_count() or 4)
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support
)
from sklearn.inspection import permutation_importance
from imblearn.over_sampling import SMOTE

def train_knee_oa_random_forest():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, 'knee_oa_dataset.csv')
    
    if not os.path.exists(csv_path):
        from generate_dataset import generate_knee_oa_dataset
        df = generate_knee_oa_dataset(n_samples=1500, random_state=42)
        df.to_csv(csv_path, index=False)
    else:
        df = pd.read_csv(csv_path)

    print(f"Loaded dataset from {csv_path}. Total shape: {df.shape}")
    
    # 1. Feature Specifications
    questionnaire_num = ['age', 'bmi', 'vas_pain_score', 'womac_score']
    questionnaire_cat = ['sex', 'prior_injury_history', 'activity_level']
    
    gait_sensor_num = [
        'stance_time_asymmetry',
        'knee_rom_left',
        'knee_rom_right',
        'load_distribution_ratio',
        'cadence',
        'heel_strike_force_left',
        'heel_strike_force_right',
        'toe_off_force_left',
        'toe_off_force_right',
        'gait_cycle_variability'
    ]
    
    numeric_features = questionnaire_num + gait_sensor_num
    categorical_features = questionnaire_cat
    feature_cols = numeric_features + categorical_features
    
    X = df[feature_cols]
    y = df['risk_tier']
    
    label_order = ['Low', 'Moderate', 'High']

    print("\nInitial Class Distribution:")
    print(y.value_counts())
    
    # 2. Stratified Train/Test Split (80/20)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"\nTrain set shape: {X_train.shape}, Test set shape: {X_test.shape}")
    
    # 3. Column Preprocessor Setup
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numeric_features),
            ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical_features)
        ]
    )
    
    # Fit preprocessor on X_train and transform train/test sets
    X_train_proc = preprocessor.fit_transform(X_train)
    X_test_proc = preprocessor.transform(X_test)
    
    # Get feature names after OneHotEncoding
    ohe = preprocessor.named_transformers_['cat']
    cat_feature_names = ohe.get_feature_names_out(categorical_features).tolist()
    all_proc_feature_names = numeric_features + cat_feature_names
    
    # Map processed features back to original feature groups for importance attribution
    feature_group_map = {}
    for feat in numeric_features:
        if feat in questionnaire_num:
            feature_group_map[feat] = ('Questionnaire', feat)
        else:
            feature_group_map[feat] = ('Wearable Sensor', feat)
            
    for cat_orig in categorical_features:
        for cat_feat in cat_feature_names:
            if cat_feat.startswith(cat_orig + '_'):
                feature_group_map[cat_feat] = ('Questionnaire', cat_orig)
                
    # 4. Class Balancing via SMOTE
    print("\nApplying SMOTE class balancing on training data...")
    smote = SMOTE(random_state=42)
    X_train_res, y_train_res = smote.fit_resample(X_train_proc, y_train)
    
    print("Resampled Train Class Distribution:")
    print(pd.Series(y_train_res).value_counts())
    
    # 5. Train Random Forest Classifier
    rf_clf = RandomForestClassifier(
        n_estimators=150,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        max_features='sqrt',
        random_state=42,
        n_jobs=-1
    )
    
    # 5-fold Stratified Cross-Validation on training set
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(rf_clf, X_train_res, y_train_res, cv=skf, scoring='accuracy')
    print(f"\n5-Fold Stratified CV Accuracy: {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")
    
    rf_clf.fit(X_train_res, y_train_res)
    label_order = rf_clf.classes_.tolist()  # Ensures 100% alignment with model.predict_proba class ordering
    
    # 6. Evaluation on Unseen Test Set
    y_pred = rf_clf.predict(X_test_proc)
    y_proba = rf_clf.predict_proba(X_test_proc)
    
    acc = accuracy_score(y_test, y_pred)
    prec, rec, f1, supp = precision_recall_fscore_support(y_test, y_pred, labels=label_order)
    cm = confusion_matrix(y_test, y_pred, labels=label_order)
    
    clf_report_dict = classification_report(y_test, y_pred, labels=label_order, output_dict=True)
    clf_report_text = classification_report(y_test, y_pred, labels=label_order, digits=4)
    
    print("\n" + "="*60)
    print("                EVALUATION ON TEST SET                ")
    print("="*60)
    print(f"Overall Accuracy: {acc * 100:.2f}%\n")
    print(clf_report_text)
    print("Confusion Matrix (Rows=True, Cols=Predicted):")
    print("Labels: ", label_order)
    print(cm)
    print("="*60)
    
    # 7. Feature Importances (MDI & Permutation)
    mdi_importances = rf_clf.feature_importances_
    
    perm_importance_res = permutation_importance(
        rf_clf, X_test_proc, y_test, n_repeats=10, random_state=42, n_jobs=-1
    )
    perm_importances = perm_importance_res.importances_mean
    
    # Aggregate importances by feature & by group (Questionnaire vs Sensor)
    feat_imp_df = pd.DataFrame({
        'processed_feature': all_proc_feature_names,
        'mdi_importance': mdi_importances,
        'perm_importance': perm_importances,
        'group': [feature_group_map[f][0] for f in all_proc_feature_names],
        'orig_feature': [feature_group_map[f][1] for f in all_proc_feature_names]
    })
    
    # Group by original feature
    orig_feat_imp = feat_imp_df.groupby(['group', 'orig_feature'])[['mdi_importance', 'perm_importance']].sum().reset_index()
    orig_feat_imp = orig_feat_imp.sort_values(by='mdi_importance', ascending=False)
    
    # Group by domain (Questionnaire vs Sensor)
    group_imp = feat_imp_df.groupby('group')[['mdi_importance', 'perm_importance']].sum()
    quest_pct = group_imp.loc['Questionnaire', 'mdi_importance'] * 100
    sensor_pct = group_imp.loc['Wearable Sensor', 'mdi_importance'] * 100
    
    print("\n" + "="*60)
    print("           FEATURE IMPORTANCE ANALYSIS FOR CLINICIANS           ")
    print("="*60)
    print(f"Total Questionnaire Features Contribution: {quest_pct:.2f}%")
    print(f"Total Wearable Sensor Features Contribution: {sensor_pct:.2f}%\n")
    print("Top Features by MDI Importance:")
    print(orig_feat_imp.to_string(index=False))
    print("="*60)
    
    # 8. Save Visualizations
    plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
    
    # A) Confusion Matrix Plot
    fig, ax = plt.subplots(figsize=(7, 5.5))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=label_order, yticklabels=label_order, ax=ax, cbar=True, annot_kws={"size": 14, "weight": "bold"})
    ax.set_title('Knee OA Risk Tier - Confusion Matrix', fontsize=14, pad=12, fontweight='bold')
    ax.set_xlabel('Predicted Risk Tier', fontsize=12, labelpad=8)
    ax.set_ylabel('True Risk Tier', fontsize=12, labelpad=8)
    plt.tight_layout()
    cm_img_path = os.path.join(script_dir, 'confusion_matrix.png')
    plt.savefig(cm_img_path, dpi=300)
    plt.close()
    
    # B) Feature Importance Breakdown Plot
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6.5), gridspec_kw={'width_ratios': [1, 2]})
    
    # Donut chart for Questionnaire vs Sensor share
    ax1.pie(
        [quest_pct, sensor_pct],
        labels=['Questionnaire\n(Intake)', 'Wearable Sensors\n(10m Walk)'],
        colors=['#2b5c8f', '#0f766e'],
        autopct='%1.1f%%',
        startangle=140,
        wedgeprops=dict(width=0.4, edgecolor='w', linewidth=2),
        textprops={'fontsize': 11, 'weight': 'bold'}
    )
    ax1.set_title('Feature Group Contribution', fontsize=13, fontweight='bold', pad=15)
    
    # Horizontal bar plot for individual original features
    colors = ['#2b5c8f' if g == 'Questionnaire' else '#0f766e' for g in orig_feat_imp['group']]
    y_pos = np.arange(len(orig_feat_imp))
    ax2.barh(y_pos, orig_feat_imp['mdi_importance'], color=colors, height=0.7)
    ax2.set_yticks(y_pos)
    ax2.set_yticklabels(orig_feat_imp['orig_feature'], fontsize=10)
    ax2.invert_yaxis()  # top-down
    ax2.set_xlabel('Mean Decrease in Impurity (MDI) Importance', fontsize=11, labelpad=8)
    ax2.set_title('Clinician Feature Importances (Questionnaire vs Sensor)', fontsize=13, fontweight='bold', pad=15)
    
    # Legend for bar colors
    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor='#2b5c8f', label='Questionnaire Field'),
        Patch(facecolor='#0f766e', label='Wearable Sensor Feature')
    ]
    ax2.legend(handles=legend_elements, loc='lower right', fontsize=10)
    plt.tight_layout()
    fi_img_path = os.path.join(script_dir, 'feature_importances.png')
    plt.savefig(fi_img_path, dpi=300)
    plt.close()
    
    # 9. Save Artifacts & Exports
    # Save scikit-learn pipeline (preprocessor + model)
    full_pipeline = {
        'preprocessor': preprocessor,
        'model': rf_clf,
        'label_order': label_order,
        'numeric_features': numeric_features,
        'categorical_features': categorical_features,
        'proc_feature_names': all_proc_feature_names
    }
    pipeline_path = os.path.join(script_dir, 'knee_oa_rf_pipeline.joblib')
    joblib.dump(full_pipeline, pipeline_path)
    
    # Save target copy to 04_Data for web server integration
    web_data_dir = os.path.join(os.path.dirname(script_dir), '04_Data')
    os.makedirs(web_data_dir, exist_ok=True)
    joblib.dump(full_pipeline, os.path.join(web_data_dir, 'knee_oa_rf_pipeline.joblib'))
    
    # Save evaluation summary to JSON
    per_class_metrics = {}
    for i, label in enumerate(label_order):
        per_class_metrics[label] = {
            'precision': float(prec[i]),
            'recall': float(rec[i]),
            'f1_score': float(f1[i]),
            'support': int(supp[i])
        }
        
    eval_json = {
        'overall_accuracy': float(acc),
        'cross_val_accuracy_mean': float(cv_scores.mean()),
        'cross_val_accuracy_std': float(cv_scores.std()),
        'per_class_metrics': per_class_metrics,
        'confusion_matrix': cm.tolist(),
        'label_order': label_order,
        'feature_group_contribution': {
            'Questionnaire_percent': float(quest_pct),
            'Wearable_Sensor_percent': float(sensor_pct)
        },
        'top_features_importance': orig_feat_imp.to_dict(orient='records')
    }
    
    eval_json_path = os.path.join(script_dir, 'model_eval_results.json')
    with open(eval_json_path, 'w') as f:
        json.dump(eval_json, f, indent=2)
        
    with open(os.path.join(web_data_dir, 'model_eval_results.json'), 'w') as f:
        json.dump(eval_json, f, indent=2)
        
    print(f"\nSaved trained pipeline to: {pipeline_path}")
    print(f"Saved evaluation metrics JSON to: {eval_json_path}")
    print(f"Saved Confusion Matrix plot to: {cm_img_path}")
    print(f"Saved Feature Importance plot to: {fi_img_path}")
    
    return eval_json

if __name__ == '__main__':
    train_knee_oa_random_forest()
