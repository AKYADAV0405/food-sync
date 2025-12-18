import firebase_admin
from firebase_admin import firestore

# Initialize Firebase app only once
if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()
