# VIDAI IVF Healthcare Marketplace - PRD

## Project Overview
AI-Powered IVF Healthcare Marketplace connecting clinics with trusted vendors for medical consumables, equipment, and genetic testing kits.

## User Personas
1. **Admin** - Platform administrator managing vendors, clinics, product approvals, inventory, orders, enquiries, settings, and payment/email configuration
2. **Vendor** - Medical supply companies listing products, managing inventory, and fulfilling orders with shipping details
3. **Clinic** - IVF clinics purchasing products from marketplace and tracking order deliveries

## Core Requirements (Static)
- Landing page with hero, stats, features, login modals, contact sales
- Admin panel for user management
- Product catalog with approval workflow
- Shopping cart and checkout with Stripe
- Order management with tracking
- Inventory and commission management
- Contact enquiry management
- Stripe payment configuration (sandbox/live)
- SendGrid email notifications

## What's Been Implemented

### MVP Phase (Complete) - Feb 21, 2026
- Landing page with vendor/clinic login modals
- Admin dashboard (admin/vidai@01)
  - Vendors tab: CRUD operations
  - Clinics tab: CRUD with address capture
  - Assignments tab: Assign vendors to clinics (now optional)
  - Products tab: Approve/reject pending products
  - Marketplace link: View all approved products
- Vendor portal
  - Product management (CRUD)
  - Approval status display (Approved/Pending)
  - Orders view with status updates
- Clinic marketplace
  - View all approved products (no vendor assignment required)
  - Browse products by category
  - Shopping cart
  - Checkout with pre-filled address
  - Stripe payment integration
  - My Purchases view
  - Order history

### Iteration 2-6 (Previously Completed)
- Product approval workflow, admin marketplace view, clinic purchases
- Inventory & Commission Module
- Order Management & Tracking
- Contact Sales form & Admin Enquiries
- Landing Page Redesign
- Clinic Dashboard with Overview, Notifications, Offers, Pricing Trends

### Iteration 7 - Admin Dashboard Enhancement (Feb 21, 2026)
- Admin Overview tab with key metrics (revenue, orders, commission)
- Recent orders and top vendors display

### Iteration 8 - Support Ticket System (Feb 21, 2026)
- Clinics can raise tickets on orders
- Vendors can view and reply to tickets
- Admin can oversee all tickets
- Ticket status management (open/in_progress/resolved/closed)

### Iteration 9 - Mar 9, 2026 - Critical Fixes & Settings Enhancement
**Bug Fixes:**
- Fixed cart page total price and currency display issue
- Fixed addToCart function to properly handle vendor info
- Added null-safety to price calculations

**Product Approval Flow Simplified:**
- Removed vendor assignment requirement
- Approved products now visible to ALL clinics immediately
- Clinics can order from any approved product

**Admin Settings Enhancement:**
- **Stripe Settings Section:**
  - Sandbox/Live mode toggle
  - Sandbox publishable and secret key inputs
  - Live publishable and secret key inputs
  - Keys stored in database, not env vars
  - GET/PUT /api/admin/settings/stripe

- **SendGrid Email Settings Section:**
  - Sandbox/Live mode toggle
  - From Email and From Name configuration
  - Sandbox and Live API key inputs
  - GET/PUT /api/admin/settings/sendgrid

**Email Notifications:**
- Order confirmation emails sent upon successful payment
- HTML email template with order details, items, prices
- Email triggered from both checkout status and webhook handlers

### Iteration 10 - Mar 26, 2026 - Dashboard UX & Currency Fixes
**Bug Fixes:**
- Fixed "formatPrice is not defined" runtime error in Admin Dashboard
- Passed formatPrice prop to all child components (ProductsApprovalTab, AdminOrdersTab, InventoryTab, ReportsTab, OrderDetailModal)
- Fixed hardcoded $ signs in Orders.js, AdminMarketplace.js, VendorDashboard.js, PaymentSuccess.js

**Clickable Stat Cards:**
- Admin Dashboard: All stat cards clickable (Revenue→Orders, Vendors→Vendors tab, etc.)
- Clinic Dashboard: All stat cards clickable (navigate to /marketplace/orders)
- VendorDashboard: Added formatPrice prop to ProductsTab, OrdersTab, VendorInventoryTab

**Currency Consistency:**
- All pages now use formatPrice from CurrencyContext
- INR (₹) displays correctly across all dashboards and order pages

## Tech Stack
- Frontend: React + Tailwind CSS + CurrencyContext for global formatting
- Backend: FastAPI + MongoDB
- Payment: Stripe (configurable via admin settings)
- Email: SendGrid (configurable via admin settings)
- Auth: JWT

## Prioritized Backlog

### P0 (Critical)
- None remaining

### P1 (High)
- Inventory auto-deduction on purchase
- Vendor analytics dashboard

### P2 (Medium)
- Reorder from past purchases
- Bulk order discounts
- Product search
- Vendor ratings/reviews
- Refactor server.py into modular routers
- Break down large React components (AdminDashboard.js, Marketplace.js)

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
- GET/PUT/DELETE /api/admin/enquiries
- GET/PUT /api/admin/settings
- GET/PUT /api/admin/settings/stripe
- GET/PUT /api/admin/settings/sendgrid

### Contact (Public)
- POST /api/contact

### Vendor
- POST /api/vendor/login
- GET/POST/PUT/DELETE /api/vendor/products
- GET /api/vendor/orders
- PUT /api/vendor/orders/{id}/status
- PUT /api/vendor/orders/{id}/shipping
- GET /api/vendor/inventory

### Clinic
- POST /api/clinic/login
- GET /api/clinic/all-products (all approved products, no vendor filter)
- GET /api/clinic/products (with optional vendor/category filter)
- GET/POST /api/clinic/orders
- GET /api/clinic/purchases
- POST /api/checkout/create-session
