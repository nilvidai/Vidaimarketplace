# VIDAI IVF Healthcare Marketplace - PRD

## Project Overview
AI-Powered IVF Healthcare Marketplace connecting clinics with trusted vendors for medical consumables, equipment, and genetic testing kits.

## User Personas
1. **Admin** - Platform administrator managing vendors, clinics, assignments, and product approvals
2. **Vendor** - Medical supply companies listing products for sale
3. **Clinic** - IVF clinics purchasing products from assigned vendors

## Core Requirements (Static)
- Landing page with hero, stats, features, login modals
- Admin panel for user management
- Vendor-to-clinic assignment system
- Product catalog with approval workflow
- Shopping cart and checkout with Stripe
- Order management

## What's Been Implemented (Feb 21, 2026)
### MVP Phase (Complete)
- ✅ Landing page with vendor/clinic login modals
- ✅ Admin dashboard (admin/vidai@01)
  - Vendors tab: CRUD operations
  - Clinics tab: CRUD with address capture
  - Assignments tab: Assign vendors to clinics
  - Products tab: Approve/reject pending products
  - Marketplace link: View all approved products
- ✅ Vendor portal
  - Product management (CRUD)
  - Approval status display (Approved/Pending)
  - Orders view with status updates
- ✅ Clinic marketplace
  - View assigned vendors
  - Browse products by vendor/category
  - Shopping cart
  - Checkout with pre-filled address
  - Stripe payment integration
  - My Purchases view
  - Order history

### Iteration 2 (Feb 21, 2026)
- ✅ Product approval workflow (admin approves vendor products)
- ✅ Admin marketplace view (read-only)
- ✅ Clinic purchases list
- ✅ Category filtering
- ✅ Fixed Add Clinic modal scroll issue

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
