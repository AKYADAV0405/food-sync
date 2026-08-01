# 🥗 Food Sync — Smart Inventory & AI Culinary Assistant

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![React](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite-61DAFB?logo=react)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.11-009688?logo=fastapi)
![Firebase](https://img.shields.io/badge/Database-Firebase%20Firestore-FFCA28?logo=firebase)
![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini%202.5%20Flash-4285F4?logo=google)

**Food Sync** is an intelligent, zero-food-waste pantry management platform powered by AI. It tracks food expiry, recommends personalized recipes using items you already own, automates grocery restock planning, and features a real-time conversational AI Cooking Companion (**Jarvis**).

---

## 🌟 Key Features

- 🥑 **Smart Inventory Management**: Standardizes unit conversions, categories, and tracks shelf-life with automatic expiry purges.
- 📜 **OCR Receipt & Bill Scanner**: Instant camera scanning and receipt ingestion to auto-populate your pantry.
- 🥘 **Zero-Wastage Recipe Engine**: Matches meals strictly to ingredients already in your kitchen, minimizing food spoilage.
- 🤖 **Conversational AI Chef Companion (Jarvis)**: Hands-free voice and text chat assistant for step-by-step cooking walkthroughs.
- 📅 **Market Depletion & Restock Predictor**: AI algorithms analyze consumption rates to predict restock days and build smart shopping lists.
- ⚖️ **Adaptive Portion Scaler**: Learns from your leftover feedback to dynamically adjust recipe quantities.

---

## 🏗️ Architecture Overview

```
                          ┌───────────────────────────┐
                          │   React + Vite Frontend   │
                          │   (Deployed on Vercel)    │
                          └─────────────┬─────────────┘
                                        │ REST / HTTPS
                                        ▼
                          ┌───────────────────────────┐
                          │    FastAPI Python Backend │
                          │   (Deployed on Render)    │
                          └──────┬─────────────┬──────┘
                                 │             │
                    ┌────────────▼──┐       ┌──▼────────────┐
                    │ Firebase DB   │       │ Google Gemini │
                    │ (Firestore)   │       │   2.5 Flash   │
                    └───────────────┘       └───────────────┘
```

---

## 🚀 Quick Start (Local Setup)

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env     # Add your GEMINI_API_KEY
python -m uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd food-sync-frontend
npm install
cp .env.example .env     # Point VITE_API_URL to http://127.0.0.1:8000
npm run dev
```

---

## 🔒 Security & Environment Configuration

- **Zero Hardcoded Secrets**: All sensitive API keys (`GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_KEY`) are managed exclusively through environment variables.
- **Git Security**: Environment files (`.env`, `.env.local`) are strict ignored by `.gitignore`.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
