# PS Industries Production Management System

**A comprehensive web-based production management system for PS Industries Pvt. Ltd., a plastic injection moulding factory.**

## 🎯 Overview

This system automates production planning, material requirements calculation, reconciliation, and operational tracking — replacing manual Excel-based workflows.

### Key Stakeholders
- **PS Industries** (3 plants: Roorkee, Noida A-06, Noida A-07)
- **Customers:** Kent RO Systems, BMR HVAC, Haier, Veira, Prem Industries

---

## ✨ Features Implemented (Tier 1 - MVP)

### Authentication & Access Control
- ✅ Email/password login (Firebase Auth)
- ✅ Role-based access (5 roles: Admin, Plant Head, Accountant, Store Manager, Production Head)
- ✅ Secure session management
- ✅ Domain validation (@psindustries.in)

### Purchase Order Management
- ✅ **PO Upload** - Upload PDF/Excel files, auto-parse, preview before saving
- ✅ **PO List** - View all POs with filters (status, date, customer)
- ✅ **PO Approvals** - Plant Head can approve/reject POs with notes
- ✅ Real-time Firestore sync

### Material & Inventory
- ✅ **Material Check** - Auto-calculate raw material requirements based on:
  - Part weight (g) × Quantity × (1 + Scrap %)
  - Compare to current stock
  - Flag shortfalls in red
- ✅ Show shortfall alerts with "Procure" action
- ✅ Support for multiple materials per order

### Dashboard & Analytics
- ✅ **Admin Dashboard** - KPI cards (Open PO Value, Pending Approvals, Low Stock, Active Runs)
- ✅ **Real-time Updates** - All metrics fetch from Firestore
- ✅ **Production Tracking** - View active runs
- ✅ **Inventory Alerts** - Low stock warnings

### UI/UX
- ✅ Professional corporate design (Navy + Orange)
- ✅ Responsive layout (navbar + sidebar)
- ✅ Micro-interactions (hover effects, smooth transitions)
- ✅ Status badges (color-coded)
- ✅ Modal dialogs for details & confirmations
- ✅ Toast notifications

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (App Router), React, TypeScript |
| **Styling** | Tailwind CSS, Custom Design System |
| **Backend** | Next.js API Routes, Node.js |
| **Database** | Firebase Firestore (Cloud) |
| **Authentication** | Firebase Authentication |
| **Deployment** | Vercel-ready |

---

## 📊 Real Data

The system works with **real POs from actual customers:**

| Customer | PO # | Items | Total | Status |
|----------|------|-------|-------|--------|
| BMR HVAC | 4400042956-0 | 2 | ₹13,25,507 | Pending |
| Kent RO Systems | 426RM0461 | 2 | ₹3,90,735 | Approved |
| Prem Industries | 000612 | 1 | ₹84,800 | Material Check |

All data persists in **Firebase Firestore** (cloud-based, no manual database setup needed).

---

## 🔧 Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase project (with Auth + Firestore enabled)

### Steps

1. **Clone the repository**
```bash
   git clone https://github.com/soumya10rai/ps-industries-pms.git
   cd ps-industries-pms
```

2. **Install dependencies**
```bash
   npm install
```

3. **Set up environment variables**
```bash
   cp .env.example .env.local
```
   
   Fill in your Firebase credentials in `.env.local`:
