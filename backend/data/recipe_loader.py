import pandas as pd

DATASET_PATH = "data/Cleaned_Indian_Food_Dataset.csv"

def load_recipes():
    """
    Load Indian recipe dataset as a pandas DataFrame
    """
    df = pd.read_csv(DATASET_PATH)
    df.columns = [c.strip().lower() for c in df.columns]
    return df
