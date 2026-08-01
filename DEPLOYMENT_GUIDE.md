# 🚀 Deployment Guide: Food Sync

This guide explains how to deploy the **Food Sync** app:
- **Backend (FastAPI + Firebase Firestore + Gemini AI)** on **Render (Docker)**
- **Frontend (Vite + React)** on **Vercel**

---

## Part 1: Deploy Backend to Render (Docker)

1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New > Web Service**.
2. Connect your GitHub repository.
3. Configure the Web Service settings:
   - **Name**: `food-sync-backend`
   - **Language / Environment**: `Docker`
   - **Dockerfile Path**: `backend/Dockerfile`
   - **Docker Context**: `backend`
4. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: *(Your Google Gemini API Key)*
   - `FIREBASE_SERVICE_ACCOUNT_KEY`: *(Optional: Firebase JSON key string or Base64 string for Firestore authentication)*
5. Click **Create Web Service**.
6. Once deployed, copy your backend live URL (e.g., `https://food-sync-backend.onrender.com`).

---

## Part 2: Deploy Frontend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New > Project**.
2. Import your GitHub repository.
3. In **Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Select `food-sync-frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables** and add:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://food-sync-backend.onrender.com` *(Your live Render backend URL)*
5. Click **Deploy**.

---

## Done! 🎉
Your app will be live on Vercel and fully connected to your Render backend API.

