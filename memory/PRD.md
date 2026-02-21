# VIDAI IVF Healthcare Marketplace - PRD

## Project Overview
AI-Powered IVF Healthcare Marketplace connecting clinics with trusted vendors for medical consumables, equipment, and genetic testing kits.

## User Personas
1. **Admin** - Platform administrator managing vendors, clinics, assignments, product approvals, inventory, and order tracking
2. **Vendor** - Medical supply companies listing products, managing inventory, and fulfilling orders with shipping details
3. **Clinic** - IVF clinics purchasing products from assigned vendors and tracking order deliveries

## Core Requirements (Static)
- Landing page with hero, stats, features, login modals
- Admin panel for user management
- Vendor-to-clinic assignment system
- Product catalog with approval workflow
- Shopping cart and checkout with Stripe
- Order management with tracking
- Inventory and commission management

## What's Been Implemented

### MVP Phase (Complete) - Feb 21, 2026
- Landing page with vendor/clinic login modals
- Admin dashboard (admin/vidai@01)
  - Vendors tab: CRUD operations
  - Clinics tab: CRUD with address capture
  - Assignments tab: Assign vendors to clinics
  - Products tab: Approve/reject pending products
  - Marketplace link: View all approved products
- Vendor portal
  - Product management (CRUD)
  - Approval status display (Approved/Pending)
  - Orders view with status updates
- Clinic marketplace
  - View assigned vendors
  - Browse products by vendor/category
  - Shopping cart
  - Checkout with pre-filled address
  - Stripe payment integration
  - My Purchases view
  - Order history

### Iteration 2 (Feb 21, 2026)
- Product approval workflow (admin approves vendor products)
- Admin marketplace view (read-only)
- Clinic purchases list
- Category filtering
- Fixed Add Clinic modal scroll issue

### Iteration 3 (Feb 21, 2026) - Inventory & Commission Module
- Admin Inventory tab: View all products with stock levels, vendor filter
- Admin Reports tab: Commission breakdown (VIDAI vs vendor earnings)
- Vendor Inventory tab: View own products with commission details, potential earnings
- Product Approval with commission rate setting (% during approval)
- Commission calculations: VIDAI Commission + Vendor Amount per product

### Iteration 4 (Feb 21, 2026) - Order Management & Tracking
- Admin Orders tab: View ALL orders, filter by status/payment, summary cards
- Admin Order Detail modal: Full order info with tracking
- Vendor Orders: Status updates (pending→confirmed→processing→shipped→delivered)
- Vendor Shipping modal: Add carrier, tracking number, estimated delivery
- Clinic Track Orders: Progress tracker, tracking info, order details
- Status timestamps: shipped_at, delivered_at automatically recorded

## Tech Stack
- Frontend: React + Tailwind CSS
- Backend: FastAPI + MongoDB
- Payment: Stripe
- Auth: JWT

## Prioritized Backlog

### P0 (Critical)
- None remaining

### P1 (High)
- Email notifications for orders
- Inventory auto-deduction on purchase
- Vendor analytics dashboard

### P2 (Medium)
- Reorder from past purchases
- Bulk order discounts
- Product search
- Vendor ratings/reviews

## Test Credentials
- Admin: admin / vidai@01
- Vendor: vendor1@test.com / test123
- Clinic: clinic1@test.com / test123

## Key API Endpoints

### Admin
- POST /api/admin/login
- GET/POST /api/admin/vendors, /api/admin/clinics
- POST /api/admin/assign-vendors
- GET /api/admin/products/pending
- POST /api/admin/products/approve
- GET /api/admin/inventory
- GET /api/admin/reports/commissions
- GET /api/admin/orders

### Vendor
- POST /api/vendor/login
- GET/POST/PUT/DELETE /api/vendor/products
- GET /api/vendor/orders
- PUT /api/vendor/orders/{id}/status
- PUT /api/vendor/orders/{id}/shipping
- GET /api/vendor/inventory

### Clinic
- POST /api/clinic/login
- GET /api/clinic/assigned-vendors
- GET /api/clinic/vendors/{id}/products
- GET/POST /api/clinic/orders
- GET /api/clinic/purchases
- POST /api/checkout/create-session
