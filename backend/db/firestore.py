import os
import json
import base64
import firebase_admin
from firebase_admin import firestore, credentials

if not firebase_admin._apps:
    service_key = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    
    if service_key:
        try:
            raw_key = service_key.strip()
            if raw_key.startswith("{"):
                cert_dict = json.loads(raw_key)
            else:
                cert_dict = json.loads(base64.b64decode(raw_key).decode("utf-8"))
            firebase_admin.initialize_app(credentials.Certificate(cert_dict))
            print("[FIREBASE] Initialized with FIREBASE_SERVICE_ACCOUNT_KEY environment variable.")
        except Exception as e:
            print(f"[FIREBASE] Warning: Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY ({e}). Falling back to ADC.")
            firebase_admin.initialize_app()
    elif cred_path and os.path.exists(cred_path):
        firebase_admin.initialize_app(credentials.Certificate(cred_path))
        print(f"[FIREBASE] Initialized with credentials path: {cred_path}")
    else:
        firebase_admin.initialize_app()
        print("[FIREBASE] Initialized using default application credentials (ADC).")

db = firestore.client()

