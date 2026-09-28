# GaitClass Random Forest

`train_gait_random_forest.py` trains a multiclass Random Forest using the
`Dataset` sheet in `data set GaitClass (1).xlsx`.

The project copy at `knee_oa_dataset.csv` is the active project dataset. It
contains only the supplied GaitClass rows; NHANES files are not included.

The target is `Group` (classes 0–4). `ID` is excluded because it is only a
participant identifier. The pipeline applies median imputation and balanced
class weights, then reports held-out accuracy, balanced accuracy, macro F1,
3-fold cross-validation, a confusion matrix, and feature importance.

The same artifact also contains a separate binary OA-risk model: Group 1 (hip
osteoarthritis) or Group 2 (knee osteoarthritis) means `OA present`; all other
groups mean `No OA group`. This derived target is an OA-group classifier, not a
clinically validated risk probability.

Run from the repository root:

```text
<bundled-python> 07_ML_Model/train_gait_random_forest.py
```

The script writes `gait_random_forest_pipeline.pkl`, metrics JSON, cleaned
CSV, imputed CSV, missing-value report, confusion-matrix CSV, and
feature-importance CSV into `07_ML_Model`.

The supplied NHANES files are not joined: they identify participants with
`SEQN`, while the gait workbook identifies records with `ID` 1–206. A valid
crosswalk or a documented target derived from NHANES is required before those
files can be used as row-level training features.
