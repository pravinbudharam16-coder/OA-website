"""Train a multiclass Random Forest on the supplied GaitClass workbook.

The NHANES XPT files are not joined here because they use SEQN, while the
gait workbook uses an unrelated ID column.  A join without a documented
crosswalk would create incorrect training examples.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pickle
import numpy as np
import pandas as pd


DEFAULT_INPUT = Path(__file__).resolve().parent / "knee_oa_dataset.csv"


class RandomForestClassifier:
    """Small dependency-light numeric Random Forest."""

    def __init__(self, n_estimators=300, max_features="sqrt", min_samples_leaf=2, random_state=42):
        self.n_estimators = n_estimators
        self.max_features = max_features
        self.min_samples_leaf = min_samples_leaf
        self.random_state = random_state

    def _gini(self, y):
        _, counts = np.unique(y, return_counts=True)
        p = counts / len(y)
        return float(1.0 - np.sum(p * p))

    def _grow(self, X, y, rng, depth=0):
        node = {"class": int(np.bincount(y).argmax()), "leaf": True}
        if len(np.unique(y)) == 1 or len(y) < self.min_samples_leaf * 2 or depth >= 12:
            return node
        k = max(1, int(np.sqrt(X.shape[1])) if self.max_features == "sqrt" else int(self.max_features))
        candidates = rng.choice(X.shape[1], size=min(k, X.shape[1]), replace=False)
        parent = self._gini(y)
        best = None
        for j in candidates:
            values = np.unique(X[:, j])
            if len(values) > 12:
                values = np.quantile(values, np.linspace(0.05, 0.95, 12))
            for threshold in values[:-1]:
                left = X[:, j] <= threshold
                nl = int(left.sum())
                nr = len(y) - nl
                if nl < self.min_samples_leaf or nr < self.min_samples_leaf:
                    continue
                score = (nl * self._gini(y[left]) + nr * self._gini(y[~left])) / len(y)
                gain = parent - score
                if best is None or gain > best[0]:
                    best = (gain, j, float(threshold), left)
        if best is None or best[0] <= 1e-10:
            return node
        _, j, threshold, left = best
        return {"leaf": False, "feature": int(j), "threshold": threshold,
                "left": self._grow(X[left], y[left], rng, depth + 1),
                "right": self._grow(X[~left], y[~left], rng, depth + 1)}

    def fit(self, X, y):
        X, y = np.asarray(X, dtype=float), np.asarray(y, dtype=int)
        rng = np.random.default_rng(self.random_state)
        self.classes_ = np.unique(y)
        self.trees_ = []
        for _ in range(self.n_estimators):
            idx = rng.integers(0, len(y), size=len(y))
            self.trees_.append(self._grow(X[idx], y[idx], rng))
        self.feature_importances_ = self._count_splits(self.trees_, X.shape[1])
        return self

    def _count_splits(self, trees, n_features):
        counts = np.zeros(n_features, dtype=float)
        def visit(node):
            if not node["leaf"]:
                counts[node["feature"]] += 1
                visit(node["left"])
                visit(node["right"])
        for tree in trees:
            visit(tree)
        total = counts.sum()
        return counts / total if total else counts

    def _predict_tree(self, tree, row):
        while not tree["leaf"]:
            tree = tree["left"] if row[tree["feature"]] <= tree["threshold"] else tree["right"]
        return tree["class"]

    def predict(self, X):
        X = np.asarray(X, dtype=float)
        votes = np.asarray([[self._predict_tree(t, row) for t in self.trees_] for row in X])
        return np.asarray([np.bincount(row.astype(int), minlength=int(self.classes_.max()) + 1).argmax() for row in votes])


def load_gait_data(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path) if path.suffix.lower() == ".csv" else pd.read_excel(path, sheet_name="Dataset")
    # The workbook contains leading/trailing spaces in several feature names.
    df.columns = [str(c).strip() for c in df.columns]
    required = {"ID", "Group"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")
    if df["Group"].isna().any():
        raise ValueError("Target column Group contains missing values")
    return df


def train(input_path: Path, output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    df = load_gait_data(input_path)

    # ID is an identifier, not a physiological measurement, so it must not be
    # allowed to influence the model.
    feature_columns = [c for c in df.columns if c not in {"ID", "Group", "DataSource"}]
    X = df[feature_columns].apply(pd.to_numeric, errors="coerce").fillna(df[feature_columns].median(numeric_only=True))
    X = X.fillna(0.0)
    y = df["Group"].astype(int)

    rng = np.random.default_rng(42)
    test_idx = []
    for label in sorted(y.unique()):
        ids = np.where(y.to_numpy() == label)[0]
        test_idx.extend(rng.choice(ids, size=max(1, int(round(len(ids) * 0.2))), replace=False).tolist())
    test_idx = np.asarray(sorted(test_idx))
    train_mask = np.ones(len(y), dtype=bool)
    train_mask[test_idx] = False
    X_train, X_test = X.iloc[train_mask], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_mask], y.iloc[test_idx]

    model = RandomForestClassifier(n_estimators=80, min_samples_leaf=2, random_state=42)
    model.fit(X_train.to_numpy(), y_train.to_numpy())

    labels = sorted(y.unique().tolist())
    y_pred = model.predict(X_test.to_numpy())
    cm = np.zeros((len(labels), len(labels)), dtype=int)
    for actual, predicted in zip(y_test, y_pred):
        cm[labels.index(int(actual)), labels.index(int(predicted))] += 1
    per_class = {}
    for label in labels:
        tp = cm[label, label]
        support = cm[label].sum()
        predicted_total = cm[:, label].sum()
        precision = tp / predicted_total if predicted_total else 0.0
        recall = tp / support if support else 0.0
        per_class[str(label)] = {"precision": precision, "recall": recall, "f1-score": (2 * precision * recall / (precision + recall)) if precision + recall else 0.0, "support": int(support)}
    report = per_class
    cv_scores = []
    for fold in range(3):
        fold_test = np.arange(fold, len(y), 5)
        fold_train = np.setdiff1d(np.arange(len(y)), fold_test)
        cv_model = RandomForestClassifier(n_estimators=40, min_samples_leaf=2, random_state=100 + fold)
        cv_model.fit(X.iloc[fold_train].to_numpy(), y.iloc[fold_train].to_numpy())
        cv_pred = cv_model.predict(X.iloc[fold_test].to_numpy())
        recalls = []
        for label in labels:
            mask = y.iloc[fold_test].to_numpy() == label
            recalls.append(float((cv_pred[mask] == label).mean()) if mask.any() else 0.0)
        cv_scores.append(float(np.mean(recalls)))
    importance = pd.DataFrame(
        {
            "feature": feature_columns,
            "random_forest_importance": model.feature_importances_,
        }
    ).sort_values("random_forest_importance", ascending=False)
    importance.to_csv(output_dir / "gait_feature_importance.csv", index=False)

    (output_dir / "gait_confusion_matrix.csv").write_text(pd.DataFrame(cm, index=labels, columns=labels).to_csv(), encoding="utf-8")

    artifact = {
        "model": model,
        "feature_columns": feature_columns,
        "target_column": "Group",
        "class_labels": labels,
        "source_file": str(input_path),
        "source_sheet": "Dataset",
        "nhanes_join_note": "NHANES XPT files use SEQN and were not joined to gait ID.",
    }
    # Separate OA-risk model. The workbook's documented groups identify hip
    # OA and knee OA as groups 1 and 2; the other groups are non-OA for this
    # binary screening target. This is a derived label, not a clinical risk
    # probability.
    oa_y = y.isin([1, 2]).astype(int)
    oa_model = RandomForestClassifier(n_estimators=80, min_samples_leaf=2, random_state=84)
    oa_model.fit(X_train.to_numpy(), oa_y.iloc[train_mask].to_numpy())
    oa_pred = oa_model.predict(X_test.to_numpy())
    oa_cm = np.zeros((2, 2), dtype=int)
    for actual, predicted in zip(oa_y.iloc[test_idx], oa_pred):
        oa_cm[int(actual), int(predicted)] += 1
    oa_tp = int(oa_cm[1, 1])
    oa_precision = oa_tp / int(oa_cm[:, 1].sum()) if oa_cm[:, 1].sum() else 0.0
    oa_recall = oa_tp / int(oa_cm[1].sum()) if oa_cm[1].sum() else 0.0
    oa_f1 = 2 * oa_precision * oa_recall / (oa_precision + oa_recall) if oa_precision + oa_recall else 0.0
    artifact["oa_risk_model"] = oa_model
    artifact["oa_risk_target_definition"] = "1 when Group is hip OA (1) or knee OA (2); 0 otherwise"
    with (output_dir / "gait_random_forest_pipeline.pkl").open("wb") as f:
        pickle.dump(artifact, f)

    metrics = {
        "source_rows": int(len(df)),
        "feature_count": len(feature_columns),
        "class_distribution": {str(k): int(v) for k, v in y.value_counts().sort_index().items()},
        "test_rows": int(len(y_test)),
        "test_accuracy": float(np.mean(y_pred == y_test.to_numpy())),
        "test_balanced_accuracy": float(np.mean([per_class[str(label)]["recall"] for label in labels])),
        "test_macro_f1": float(np.mean([per_class[str(label)]["f1-score"] for label in labels])),
        "cv_balanced_accuracy_mean": float(np.mean(cv_scores)),
        "cv_balanced_accuracy_std": float(np.std(cv_scores)),
        "labels": labels,
        "confusion_matrix": cm.tolist(),
        "classification_report": report,
        "top_features": importance.head(15).to_dict(orient="records"),
        "nhanes_files_not_joined": True,
        "oa_risk_target_definition": "OA present = Group 1 (hip OA) or Group 2 (knee OA); all other groups = no OA group",
        "oa_risk_class_distribution": {str(k): int(v) for k, v in oa_y.value_counts().sort_index().items()},
        "oa_risk_test_accuracy": float(np.mean(oa_pred == oa_y.iloc[test_idx].to_numpy())),
        "oa_risk_test_precision": float(oa_precision),
        "oa_risk_test_recall": float(oa_recall),
        "oa_risk_test_f1": float(oa_f1),
        "oa_risk_confusion_matrix": oa_cm.tolist(),
    }
    (output_dir / "gait_model_eval_results.json").write_text(
        json.dumps(metrics, indent=2), encoding="utf-8"
    )

    cleaned = df.copy()
    cleaned.to_csv(output_dir / "gaitclass_cleaned.csv", index=False)

    # Export an explicit imputed copy for downstream users. The current
    # supplied workbook has no missing cells, but future files can safely use
    # the same median-imputation rule used during training.
    imputed = df.copy()
    missing_before = {str(k): int(v) for k, v in imputed.isna().sum().items() if v}
    for column in feature_columns:
        numeric = pd.to_numeric(imputed[column], errors="coerce")
        if numeric.isna().any():
            median = numeric.median()
            imputed[column] = numeric.fillna(0.0 if pd.isna(median) else median)
    imputed.to_csv(output_dir / "gaitclass_imputed.csv", index=False)
    (output_dir / "gait_missing_value_report.json").write_text(
        json.dumps({
            "source_rows": int(len(df)),
            "missing_cells_before_imputation": int(sum(missing_before.values())),
            "missing_by_column_before_imputation": missing_before,
            "imputation_rule": "numeric feature missing values are filled with the column median; all-missing numeric columns use 0.0",
            "missing_cells_after_imputation": int(imputed.isna().sum().sum()),
        }, indent=2),
        encoding="utf-8",
    )
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path(DEFAULT_INPUT))
    parser.add_argument(
        "--output-dir", type=Path, default=Path(__file__).resolve().parent
    )
    args = parser.parse_args()
    result = train(args.input, args.output_dir)
    print(json.dumps(result, indent=2))
