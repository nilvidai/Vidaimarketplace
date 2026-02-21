from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone
import bcrypt
from jose import jwt, JWTError
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'vidai_secret_key')
JWT_ALGORITHM = "HS256"
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'vidai@01')

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class AdminLogin(BaseModel):
    username: str
    password: str

class VendorCreate(BaseModel):
    name: str
    email: str
    password: str
    company_name: str
    phone: Optional[str] = None

class VendorLogin(BaseModel):
    email: str
    password: str

class VendorResponse(BaseModel):
    id: str
    name: str
    email: str
    company_name: str
    phone: Optional[str] = None
    is_active: bool = True
    created_at: str

class ClinicCreate(BaseModel):
    name: str
    email: str
    password: str
    clinic_name: str
    phone: Optional[str] = None
    billing_address: str
    shipping_address: str
    city: str
    state: str
    zip_code: str
    country: str = "USA"

class ClinicLogin(BaseModel):
    email: str
    password: str

class ClinicResponse(BaseModel):
    id: str
    name: str
    email: str
    clinic_name: str
    phone: Optional[str] = None
    billing_address: str
    shipping_address: str
    city: str
    state: str
    zip_code: str
    country: str
    is_active: bool = True
    created_at: str

class VendorAssignment(BaseModel):
    clinic_id: str
    vendor_ids: List[str]

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    category: str
    sku: str
    stock_quantity: int = 0
    image_url: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    sku: Optional[str] = None
    stock_quantity: Optional[int] = None
    image_url: Optional[str] = None

class ProductResponse(BaseModel):
    id: str
    vendor_id: str
    vendor_name: Optional[str] = None
    name: str
    description: str
    price: float
    category: str
    sku: str
    stock_quantity: int
    image_url: Optional[str] = None
    is_active: bool = True
    is_approved: bool = False
    commission_rate: float = 10.0  # Default 10% commission
    commission_amount: float = 0.0
    vendor_amount: float = 0.0
    created_at: str

class ProductApproval(BaseModel):
    product_id: str
    approved: bool
    commission_rate: float = 10.0  # Commission percentage for VIDAI

class InventoryItem(BaseModel):
    product_id: str
    product_name: str
    sku: str
    category: str
    price: float
    stock_quantity: int
    vendor_id: str
    vendor_name: str
    is_approved: bool
    commission_rate: float
    commission_amount: float
    vendor_amount: float

class CommissionReport(BaseModel):
    total_products: int
    total_product_value: float
    total_vidai_commission: float
    total_vendor_amount: float
    by_vendor: List[dict]

class CartItem(BaseModel):
    product_id: str
    quantity: int

class OrderCreate(BaseModel):
    items: List[CartItem]
    billing_address: str
    shipping_address: str
    city: str
    state: str
    zip_code: str
    country: str

class CheckoutRequest(BaseModel):
    order_id: str
    origin_url: str

class OrderResponse(BaseModel):
    id: str
    clinic_id: str
    vendor_id: str
    items: List[dict]
    total_amount: float
    billing_address: str
    shipping_address: str
    city: str
    state: str
    zip_code: str
    country: str
    status: str
    payment_status: str
    stripe_session_id: Optional[str] = None
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    estimated_delivery: Optional[str] = None
    shipped_at: Optional[str] = None
    delivered_at: Optional[str] = None
    created_at: str
    vendor_name: Optional[str] = None

class ShippingUpdate(BaseModel):
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    estimated_delivery: Optional[str] = None

class ContactEnquiry(BaseModel):
    name: str
    email: str
    company: Optional[str] = None
    phone: Optional[str] = None
    message: str
    enquiry_type: str = "general"  # general, demo, pricing, partnership

class AdminSettings(BaseModel):
    contact_email: Optional[str] = None
    company_name: Optional[str] = "VIDAI"
    notify_on_enquiry: bool = True

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(data: dict) -> str:
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    return payload

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = await get_current_user(credentials)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload

async def get_vendor_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = await get_current_user(credentials)
    if payload.get("role") != "vendor":
        raise HTTPException(status_code=403, detail="Vendor access required")
    return payload

async def get_clinic_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = await get_current_user(credentials)
    if payload.get("role") != "clinic":
        raise HTTPException(status_code=403, detail="Clinic access required")
    return payload

# ==================== ADMIN ROUTES ====================

@api_router.post("/admin/login")
async def admin_login(data: AdminLogin):
    if data.username == "admin" and data.password == ADMIN_PASSWORD:
        token = create_token({"role": "admin", "username": "admin"})
        return {"token": token, "role": "admin"}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@api_router.post("/admin/vendors", response_model=VendorResponse)
async def create_vendor(data: VendorCreate, admin=Depends(get_admin_user)):
    existing = await db.vendors.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    vendor_id = str(uuid.uuid4())
    vendor_doc = {
        "id": vendor_id,
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "company_name": data.company_name,
        "phone": data.phone,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.vendors.insert_one(vendor_doc)
    del vendor_doc["password"]
    del vendor_doc["_id"]
    return vendor_doc

@api_router.get("/admin/vendors", response_model=List[VendorResponse])
async def get_all_vendors(admin=Depends(get_admin_user)):
    vendors = await db.vendors.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return vendors

@api_router.delete("/admin/vendors/{vendor_id}")
async def delete_vendor(vendor_id: str, admin=Depends(get_admin_user)):
    result = await db.vendors.delete_one({"id": vendor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"message": "Vendor deleted"}

@api_router.post("/admin/clinics", response_model=ClinicResponse)
async def create_clinic(data: ClinicCreate, admin=Depends(get_admin_user)):
    existing = await db.clinics.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    clinic_id = str(uuid.uuid4())
    clinic_doc = {
        "id": clinic_id,
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "clinic_name": data.clinic_name,
        "phone": data.phone,
        "billing_address": data.billing_address,
        "shipping_address": data.shipping_address,
        "city": data.city,
        "state": data.state,
        "zip_code": data.zip_code,
        "country": data.country,
        "is_active": True,
        "assigned_vendors": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.clinics.insert_one(clinic_doc)
    del clinic_doc["password"]
    del clinic_doc["_id"]
    del clinic_doc["assigned_vendors"]
    return clinic_doc

@api_router.get("/admin/clinics", response_model=List[ClinicResponse])
async def get_all_clinics(admin=Depends(get_admin_user)):
    clinics = await db.clinics.find({}, {"_id": 0, "password": 0, "assigned_vendors": 0}).to_list(1000)
    return clinics

@api_router.delete("/admin/clinics/{clinic_id}")
async def delete_clinic(clinic_id: str, admin=Depends(get_admin_user)):
    result = await db.clinics.delete_one({"id": clinic_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return {"message": "Clinic deleted"}

@api_router.post("/admin/assign-vendors")
async def assign_vendors_to_clinic(data: VendorAssignment, admin=Depends(get_admin_user)):
    clinic = await db.clinics.find_one({"id": data.clinic_id})
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    
    # Verify all vendors exist
    for vid in data.vendor_ids:
        vendor = await db.vendors.find_one({"id": vid})
        if not vendor:
            raise HTTPException(status_code=404, detail=f"Vendor {vid} not found")
    
    await db.clinics.update_one(
        {"id": data.clinic_id},
        {"$set": {"assigned_vendors": data.vendor_ids}}
    )
    return {"message": "Vendors assigned successfully"}

@api_router.get("/admin/clinic/{clinic_id}/assignments")
async def get_clinic_assignments(clinic_id: str, admin=Depends(get_admin_user)):
    clinic = await db.clinics.find_one({"id": clinic_id}, {"_id": 0})
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return {"clinic_id": clinic_id, "assigned_vendors": clinic.get("assigned_vendors", [])}

@api_router.get("/admin/products")
async def get_all_products_admin(admin=Depends(get_admin_user)):
    """Get all products with vendor info for admin review"""
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    # Add vendor name to each product
    for product in products:
        vendor = await db.vendors.find_one({"id": product["vendor_id"]}, {"_id": 0, "company_name": 1})
        product["vendor_name"] = vendor["company_name"] if vendor else "Unknown"
    return products

@api_router.get("/admin/products/pending")
async def get_pending_products(admin=Depends(get_admin_user)):
    """Get products pending approval"""
    products = await db.products.find({"is_approved": {"$ne": True}}, {"_id": 0}).to_list(1000)
    for product in products:
        vendor = await db.vendors.find_one({"id": product["vendor_id"]}, {"_id": 0, "company_name": 1})
        product["vendor_name"] = vendor["company_name"] if vendor else "Unknown"
    return products

@api_router.post("/admin/products/approve")
async def approve_product(data: ProductApproval, admin=Depends(get_admin_user)):
    """Approve or reject a product with commission calculation"""
    product = await db.products.find_one({"id": data.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = {"is_approved": data.approved}
    
    if data.approved:
        # Calculate commission when approving
        price = product["price"]
        commission_rate = data.commission_rate
        commission_amount = round(price * (commission_rate / 100), 2)
        vendor_amount = round(price - commission_amount, 2)
        
        update_data.update({
            "commission_rate": commission_rate,
            "commission_amount": commission_amount,
            "vendor_amount": vendor_amount
        })
    
    await db.products.update_one(
        {"id": data.product_id},
        {"$set": update_data}
    )
    return {
        "message": f"Product {'approved' if data.approved else 'rejected'} successfully",
        "commission_rate": data.commission_rate if data.approved else 0,
        "commission_amount": update_data.get("commission_amount", 0),
        "vendor_amount": update_data.get("vendor_amount", 0)
    }

@api_router.get("/admin/inventory")
async def get_admin_inventory(admin=Depends(get_admin_user), vendor_id: Optional[str] = None):
    """Get inventory for all products or filtered by vendor"""
    query = {}
    if vendor_id:
        query["vendor_id"] = vendor_id
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    inventory = []
    
    for product in products:
        vendor = await db.vendors.find_one({"id": product["vendor_id"]}, {"_id": 0, "company_name": 1})
        price = product["price"]
        commission_rate = product.get("commission_rate", 10.0)
        # Calculate vendor_amount dynamically if not stored
        stored_vendor_amount = product.get("vendor_amount", 0)
        if stored_vendor_amount == 0 and product.get("is_approved", False):
            vendor_amount = round(price * (1 - commission_rate / 100), 2)
        else:
            vendor_amount = stored_vendor_amount
        
        inventory.append({
            "product_id": product["id"],
            "product_name": product["name"],
            "sku": product["sku"],
            "category": product["category"],
            "price": price,
            "stock_quantity": product["stock_quantity"],
            "vendor_id": product["vendor_id"],
            "vendor_name": vendor["company_name"] if vendor else "Unknown",
            "is_approved": product.get("is_approved", False),
            "commission_rate": commission_rate,
            "commission_amount": round(price * commission_rate / 100, 2),
            "vendor_amount": vendor_amount
        })
    
    return inventory

@api_router.get("/admin/reports/commissions")
async def get_commission_report(admin=Depends(get_admin_user)):
    """Get commission report for all approved products"""
    products = await db.products.find({"is_approved": True}, {"_id": 0}).to_list(1000)
    
    # Group by vendor
    vendor_data = {}
    total_product_value = 0
    total_vidai_commission = 0
    total_vendor_amount = 0
    
    for product in products:
        vendor_id = product["vendor_id"]
        price = product["price"]
        commission_rate = product.get("commission_rate", 10.0)
        commission_amount = product.get("commission_amount", round(price * 0.1, 2))
        vendor_amount = product.get("vendor_amount", round(price * 0.9, 2))
        stock = product["stock_quantity"]
        
        # Total values (price * stock for potential sales value)
        product_total = price * stock
        commission_total = commission_amount * stock
        vendor_total = vendor_amount * stock
        
        total_product_value += product_total
        total_vidai_commission += commission_total
        total_vendor_amount += vendor_total
        
        if vendor_id not in vendor_data:
            vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0, "company_name": 1})
            vendor_data[vendor_id] = {
                "vendor_id": vendor_id,
                "vendor_name": vendor["company_name"] if vendor else "Unknown",
                "product_count": 0,
                "total_stock": 0,
                "total_value": 0,
                "vidai_commission": 0,
                "vendor_amount": 0
            }
        
        vendor_data[vendor_id]["product_count"] += 1
        vendor_data[vendor_id]["total_stock"] += stock
        vendor_data[vendor_id]["total_value"] += product_total
        vendor_data[vendor_id]["vidai_commission"] += commission_total
        vendor_data[vendor_id]["vendor_amount"] += vendor_total
    
    return {
        "total_products": len(products),
        "total_product_value": round(total_product_value, 2),
        "total_vidai_commission": round(total_vidai_commission, 2),
        "total_vendor_amount": round(total_vendor_amount, 2),
        "by_vendor": list(vendor_data.values())
    }

@api_router.get("/admin/reports/sales")
async def get_sales_report(admin=Depends(get_admin_user)):
    """Get sales report from paid orders"""
    orders = await db.orders.find({"payment_status": "paid"}, {"_id": 0}).to_list(1000)
    
    total_sales = 0
    total_commission = 0
    vendor_sales = {}
    
    for order in orders:
        order_total = order["total_amount"]
        vendor_id = order["vendor_id"]
        
        # Estimate commission at 10% (or could look up from products)
        commission = round(order_total * 0.1, 2)
        vendor_amount = round(order_total * 0.9, 2)
        
        total_sales += order_total
        total_commission += commission
        
        if vendor_id not in vendor_sales:
            vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0, "company_name": 1})
            vendor_sales[vendor_id] = {
                "vendor_id": vendor_id,
                "vendor_name": vendor["company_name"] if vendor else "Unknown",
                "order_count": 0,
                "total_sales": 0,
                "vidai_commission": 0,
                "vendor_earnings": 0
            }
        
        vendor_sales[vendor_id]["order_count"] += 1
        vendor_sales[vendor_id]["total_sales"] += order_total
        vendor_sales[vendor_id]["vidai_commission"] += commission
        vendor_sales[vendor_id]["vendor_earnings"] += vendor_amount
    
    return {
        "total_orders": len(orders),
        "total_sales": round(total_sales, 2),
        "total_vidai_commission": round(total_commission, 2),
        "total_vendor_earnings": round(total_sales - total_commission, 2),
        "by_vendor": list(vendor_sales.values())
    }

@api_router.get("/admin/orders")
async def get_all_orders_admin(admin=Depends(get_admin_user), status: Optional[str] = None, payment_status: Optional[str] = None):
    """Get all orders for admin view with optional filters"""
    query = {}
    if status:
        query["status"] = status
    if payment_status:
        query["payment_status"] = payment_status
    
    orders = await db.orders.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with clinic and vendor names
    for order in orders:
        clinic = await db.clinics.find_one({"id": order["clinic_id"]}, {"_id": 0, "clinic_name": 1})
        vendor = await db.vendors.find_one({"id": order["vendor_id"]}, {"_id": 0, "company_name": 1})
        order["clinic_name"] = clinic["clinic_name"] if clinic else "Unknown"
        order["vendor_name"] = vendor["company_name"] if vendor else "Unknown"
    
    return orders

@api_router.get("/admin/orders/{order_id}")
async def get_order_details_admin(order_id: str, admin=Depends(get_admin_user)):
    """Get detailed order information for admin"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    clinic = await db.clinics.find_one({"id": order["clinic_id"]}, {"_id": 0, "clinic_name": 1, "email": 1, "phone": 1})
    vendor = await db.vendors.find_one({"id": order["vendor_id"]}, {"_id": 0, "company_name": 1, "email": 1})
    
    order["clinic_name"] = clinic["clinic_name"] if clinic else "Unknown"
    order["clinic_email"] = clinic.get("email", "") if clinic else ""
    order["clinic_phone"] = clinic.get("phone", "") if clinic else ""
    order["vendor_name"] = vendor["company_name"] if vendor else "Unknown"
    order["vendor_email"] = vendor.get("email", "") if vendor else ""
    
    return order

@api_router.get("/admin/marketplace/vendors")
async def get_all_vendors_marketplace(admin=Depends(get_admin_user)):
    """Get all vendors for admin marketplace view"""
    vendors = await db.vendors.find({"is_active": True}, {"_id": 0, "password": 0}).to_list(1000)
    return vendors

@api_router.get("/admin/marketplace/vendors/{vendor_id}/products")
async def get_vendor_products_admin(vendor_id: str, admin=Depends(get_admin_user)):
    """Get all approved products for a vendor (admin view)"""
    products = await db.products.find(
        {"vendor_id": vendor_id, "is_active": True, "is_approved": True},
        {"_id": 0}
    ).to_list(1000)
    return products

@api_router.get("/admin/marketplace/categories")
async def get_all_categories(admin=Depends(get_admin_user)):
    """Get all unique product categories"""
    products = await db.products.find({"is_approved": True}, {"category": 1, "_id": 0}).to_list(1000)
    categories = list(set(p["category"] for p in products if "category" in p))
    return categories

@api_router.get("/admin/marketplace/products")
async def get_all_approved_products(admin=Depends(get_admin_user), vendor_id: Optional[str] = None, category: Optional[str] = None):
    """Get all approved products with optional filters"""
    query = {"is_active": True, "is_approved": True}
    if vendor_id:
        query["vendor_id"] = vendor_id
    if category:
        query["category"] = category
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    for product in products:
        vendor = await db.vendors.find_one({"id": product["vendor_id"]}, {"_id": 0, "company_name": 1})
        product["vendor_name"] = vendor["company_name"] if vendor else "Unknown"
    return products

# ==================== CONTACT SALES / ENQUIRY ROUTES ====================

@api_router.post("/contact")
async def submit_contact_enquiry(data: ContactEnquiry):
    """Public endpoint to submit contact/sales enquiry"""
    enquiry_id = str(uuid.uuid4())
    enquiry_doc = {
        "id": enquiry_id,
        "name": data.name,
        "email": data.email,
        "company": data.company,
        "phone": data.phone,
        "message": data.message,
        "enquiry_type": data.enquiry_type,
        "status": "new",  # new, contacted, converted, closed
        "created_at": datetime.now(timezone.utc).isoformat(),
        "notes": ""
    }
    await db.enquiries.insert_one(enquiry_doc)
    
    # Get admin settings for email notification
    settings = await db.settings.find_one({"type": "admin"}, {"_id": 0})
    if settings and settings.get("contact_email") and settings.get("notify_on_enquiry", True):
        # Email notification would be sent here
        # For now, we just store it
        pass
    
    return {"message": "Thank you for your enquiry. We'll get back to you soon!", "enquiry_id": enquiry_id}

@api_router.get("/admin/enquiries")
async def get_all_enquiries(admin=Depends(get_admin_user), status: Optional[str] = None):
    """Get all contact enquiries"""
    query = {}
    if status:
        query["status"] = status
    
    enquiries = await db.enquiries.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return enquiries

@api_router.get("/admin/enquiries/{enquiry_id}")
async def get_enquiry_detail(enquiry_id: str, admin=Depends(get_admin_user)):
    """Get single enquiry details"""
    enquiry = await db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return enquiry

@api_router.put("/admin/enquiries/{enquiry_id}/status")
async def update_enquiry_status(enquiry_id: str, status: str, admin=Depends(get_admin_user)):
    """Update enquiry status"""
    valid_statuses = ["new", "contacted", "converted", "closed"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    result = await db.enquiries.update_one(
        {"id": enquiry_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return {"message": "Status updated successfully"}

@api_router.put("/admin/enquiries/{enquiry_id}/notes")
async def update_enquiry_notes(enquiry_id: str, notes: str = "", admin=Depends(get_admin_user)):
    """Update enquiry notes"""
    result = await db.enquiries.update_one(
        {"id": enquiry_id},
        {"$set": {"notes": notes, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return {"message": "Notes updated successfully"}

@api_router.delete("/admin/enquiries/{enquiry_id}")
async def delete_enquiry(enquiry_id: str, admin=Depends(get_admin_user)):
    """Delete an enquiry"""
    result = await db.enquiries.delete_one({"id": enquiry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return {"message": "Enquiry deleted successfully"}

@api_router.get("/admin/settings")
async def get_admin_settings(admin=Depends(get_admin_user)):
    """Get admin settings"""
    settings = await db.settings.find_one({"type": "admin"}, {"_id": 0})
    if not settings:
        # Return default settings
        return {
            "type": "admin",
            "contact_email": "",
            "company_name": "VIDAI",
            "notify_on_enquiry": True
        }
    return settings

@api_router.put("/admin/settings")
async def update_admin_settings(data: AdminSettings, admin=Depends(get_admin_user)):
    """Update admin settings"""
    settings_doc = {
        "type": "admin",
        "contact_email": data.contact_email,
        "company_name": data.company_name,
        "notify_on_enquiry": data.notify_on_enquiry,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.settings.update_one(
        {"type": "admin"},
        {"$set": settings_doc},
        upsert=True
    )
    return {"message": "Settings updated successfully"}

# ==================== VENDOR ROUTES ====================

@api_router.post("/vendor/login")
async def vendor_login(data: VendorLogin):
    vendor = await db.vendors.find_one({"email": data.email})
    if not vendor or not verify_password(data.password, vendor["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not vendor.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    
    token = create_token({"role": "vendor", "vendor_id": vendor["id"], "email": vendor["email"]})
    return {
        "token": token, 
        "role": "vendor", 
        "vendor_id": vendor["id"],
        "name": vendor["name"],
        "company_name": vendor["company_name"]
    }

@api_router.get("/vendor/profile")
async def get_vendor_profile(user=Depends(get_vendor_user)):
    vendor = await db.vendors.find_one({"id": user["vendor_id"]}, {"_id": 0, "password": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor

@api_router.post("/vendor/products", response_model=ProductResponse)
async def create_product(data: ProductCreate, user=Depends(get_vendor_user)):
    product_id = str(uuid.uuid4())
    product_doc = {
        "id": product_id,
        "vendor_id": user["vendor_id"],
        "name": data.name,
        "description": data.description,
        "price": data.price,
        "category": data.category,
        "sku": data.sku,
        "stock_quantity": data.stock_quantity,
        "image_url": data.image_url,
        "is_active": True,
        "is_approved": False,  # Requires admin approval
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.products.insert_one(product_doc)
    del product_doc["_id"]
    return product_doc

@api_router.get("/vendor/products", response_model=List[ProductResponse])
async def get_vendor_products(user=Depends(get_vendor_user)):
    products = await db.products.find({"vendor_id": user["vendor_id"]}, {"_id": 0}).to_list(1000)
    return products

@api_router.put("/vendor/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, data: ProductUpdate, user=Depends(get_vendor_user)):
    product = await db.products.find_one({"id": product_id, "vendor_id": user["vendor_id"]})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.products.update_one({"id": product_id}, {"$set": update_data})
    
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return updated

@api_router.delete("/vendor/products/{product_id}")
async def delete_product(product_id: str, user=Depends(get_vendor_user)):
    result = await db.products.delete_one({"id": product_id, "vendor_id": user["vendor_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

@api_router.get("/vendor/orders", response_model=List[OrderResponse])
async def get_vendor_orders(user=Depends(get_vendor_user)):
    orders = await db.orders.find({"vendor_id": user["vendor_id"]}, {"_id": 0}).to_list(1000)
    return orders

@api_router.get("/vendor/inventory")
async def get_vendor_inventory(user=Depends(get_vendor_user)):
    """Get inventory for vendor's own products with commission details"""
    products = await db.products.find({"vendor_id": user["vendor_id"]}, {"_id": 0}).to_list(1000)
    
    inventory = []
    total_stock_value = 0
    total_commission = 0
    total_vendor_earnings = 0
    
    for product in products:
        price = product["price"]
        stock = product["stock_quantity"]
        commission_rate = product.get("commission_rate", 10.0)
        commission_amount = product.get("commission_amount", round(price * 0.1, 2))
        vendor_amount = product.get("vendor_amount", round(price * 0.9, 2))
        
        stock_value = price * stock
        total_stock_value += stock_value
        total_commission += commission_amount * stock
        total_vendor_earnings += vendor_amount * stock
        
        inventory.append({
            "product_id": product["id"],
            "product_name": product["name"],
            "sku": product["sku"],
            "category": product["category"],
            "price": price,
            "stock_quantity": stock,
            "stock_value": round(stock_value, 2),
            "is_approved": product.get("is_approved", False),
            "commission_rate": commission_rate,
            "commission_amount": commission_amount,
            "vendor_amount": vendor_amount,
            "potential_earnings": round(vendor_amount * stock, 2)
        })
    
    return {
        "items": inventory,
        "summary": {
            "total_products": len(products),
            "total_stock_units": sum(p["stock_quantity"] for p in products),
            "total_stock_value": round(total_stock_value, 2),
            "total_vidai_commission": round(total_commission, 2),
            "total_vendor_earnings": round(total_vendor_earnings, 2)
        }
    }

@api_router.put("/vendor/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, user=Depends(get_vendor_user)):
    valid_statuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    update_data = {"status": status}
    
    # Add timestamps for status changes
    if status == "shipped":
        update_data["shipped_at"] = datetime.now(timezone.utc).isoformat()
    elif status == "delivered":
        update_data["delivered_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.orders.update_one(
        {"id": order_id, "vendor_id": user["vendor_id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order status updated"}

@api_router.put("/vendor/orders/{order_id}/shipping")
async def update_order_shipping(order_id: str, data: ShippingUpdate, user=Depends(get_vendor_user)):
    """Update shipping/tracking information for an order"""
    order = await db.orders.find_one({"id": order_id, "vendor_id": user["vendor_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = {}
    if data.tracking_number is not None:
        update_data["tracking_number"] = data.tracking_number
    if data.carrier is not None:
        update_data["carrier"] = data.carrier
    if data.estimated_delivery is not None:
        update_data["estimated_delivery"] = data.estimated_delivery
    
    if update_data:
        await db.orders.update_one(
            {"id": order_id},
            {"$set": update_data}
        )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return updated_order

@api_router.get("/vendor/orders/{order_id}")
async def get_vendor_order_detail(order_id: str, user=Depends(get_vendor_user)):
    """Get detailed order information for vendor"""
    order = await db.orders.find_one({"id": order_id, "vendor_id": user["vendor_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    clinic = await db.clinics.find_one({"id": order["clinic_id"]}, {"_id": 0, "clinic_name": 1})
    order["clinic_name"] = clinic["clinic_name"] if clinic else "Unknown"
    
    return order

# ==================== CLINIC ROUTES ====================

@api_router.post("/clinic/login")
async def clinic_login(data: ClinicLogin):
    clinic = await db.clinics.find_one({"email": data.email})
    if not clinic or not verify_password(data.password, clinic["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not clinic.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    
    token = create_token({"role": "clinic", "clinic_id": clinic["id"], "email": clinic["email"]})
    return {
        "token": token,
        "role": "clinic",
        "clinic_id": clinic["id"],
        "name": clinic["name"],
        "clinic_name": clinic["clinic_name"],
        "billing_address": clinic["billing_address"],
        "shipping_address": clinic["shipping_address"],
        "city": clinic["city"],
        "state": clinic["state"],
        "zip_code": clinic["zip_code"],
        "country": clinic["country"]
    }

@api_router.get("/clinic/profile")
async def get_clinic_profile(user=Depends(get_clinic_user)):
    clinic = await db.clinics.find_one({"id": user["clinic_id"]}, {"_id": 0, "password": 0})
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic

@api_router.get("/clinic/assigned-vendors")
async def get_assigned_vendors(user=Depends(get_clinic_user)):
    clinic = await db.clinics.find_one({"id": user["clinic_id"]})
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    
    assigned_ids = clinic.get("assigned_vendors", [])
    vendors = await db.vendors.find(
        {"id": {"$in": assigned_ids}, "is_active": True},
        {"_id": 0, "password": 0}
    ).to_list(1000)
    return vendors

@api_router.get("/clinic/vendors/{vendor_id}/products")
async def get_vendor_products_for_clinic(vendor_id: str, user=Depends(get_clinic_user), category: Optional[str] = None):
    clinic = await db.clinics.find_one({"id": user["clinic_id"]})
    if vendor_id not in clinic.get("assigned_vendors", []):
        raise HTTPException(status_code=403, detail="Vendor not assigned to your clinic")
    
    query = {"vendor_id": vendor_id, "is_active": True, "is_approved": True}
    if category:
        query["category"] = category
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    return products

@api_router.get("/clinic/all-products")
async def get_all_products_for_clinic(user=Depends(get_clinic_user)):
    """Get all approved products from all assigned vendors with category and vendor info"""
    clinic = await db.clinics.find_one({"id": user["clinic_id"]})
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    
    assigned_ids = clinic.get("assigned_vendors", [])
    
    # Get all approved products from assigned vendors
    products = await db.products.find(
        {"vendor_id": {"$in": assigned_ids}, "is_active": True, "is_approved": True},
        {"_id": 0}
    ).to_list(1000)
    
    # Get vendor names
    vendors = await db.vendors.find(
        {"id": {"$in": assigned_ids}, "is_active": True},
        {"_id": 0, "id": 1, "company_name": 1}
    ).to_list(1000)
    vendor_map = {v["id"]: v["company_name"] for v in vendors}
    
    # Add vendor_name to products
    for product in products:
        product["vendor_name"] = vendor_map.get(product["vendor_id"], "Unknown")
    
    # Extract unique categories
    categories = list(set(p["category"] for p in products if p.get("category")))
    categories.sort()
    
    return {
        "products": products,
        "categories": categories,
        "vendors": vendors
    }

@api_router.get("/clinic/categories")
async def get_clinic_categories(user=Depends(get_clinic_user)):
    """Get all categories from approved products of assigned vendors"""
    clinic = await db.clinics.find_one({"id": user["clinic_id"]})
    assigned_ids = clinic.get("assigned_vendors", [])
    
    products = await db.products.find(
        {"vendor_id": {"$in": assigned_ids}, "is_approved": True},
        {"category": 1, "_id": 0}
    ).to_list(1000)
    categories = list(set(p["category"] for p in products if "category" in p))
    return categories

@api_router.get("/clinic/products")
async def get_all_clinic_products(user=Depends(get_clinic_user), vendor_id: Optional[str] = None, category: Optional[str] = None):
    """Get all approved products from assigned vendors with optional filters"""
    clinic = await db.clinics.find_one({"id": user["clinic_id"]})
    assigned_ids = clinic.get("assigned_vendors", [])
    
    query = {"vendor_id": {"$in": assigned_ids}, "is_active": True, "is_approved": True}
    if vendor_id and vendor_id in assigned_ids:
        query["vendor_id"] = vendor_id
    if category:
        query["category"] = category
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    for product in products:
        vendor = await db.vendors.find_one({"id": product["vendor_id"]}, {"_id": 0, "company_name": 1})
        product["vendor_name"] = vendor["company_name"] if vendor else "Unknown"
    return products

@api_router.get("/clinic/purchases")
async def get_clinic_purchases(user=Depends(get_clinic_user)):
    """Get all purchased products from paid orders"""
    orders = await db.orders.find(
        {"clinic_id": user["clinic_id"], "payment_status": "paid"},
        {"_id": 0}
    ).to_list(1000)
    
    # Aggregate all purchased products
    purchases = []
    for order in orders:
        for item in order.get("items", []):
            purchases.append({
                "order_id": order["id"],
                "order_date": order["created_at"],
                "product_name": item["name"],
                "product_id": item["product_id"],
                "price": item["price"],
                "quantity": item["quantity"],
                "subtotal": item["subtotal"],
                "vendor_id": order["vendor_id"]
            })
    
    # Add vendor names
    for purchase in purchases:
        vendor = await db.vendors.find_one({"id": purchase["vendor_id"]}, {"_id": 0, "company_name": 1})
        purchase["vendor_name"] = vendor["company_name"] if vendor else "Unknown"
    
    return purchases

@api_router.post("/clinic/orders", response_model=OrderResponse)
async def create_order(data: OrderCreate, user=Depends(get_clinic_user)):
    if not data.items:
        raise HTTPException(status_code=400, detail="Order must have at least one item")
    
    # Get first product to determine vendor
    first_product = await db.products.find_one({"id": data.items[0].product_id})
    if not first_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    vendor_id = first_product["vendor_id"]
    
    # Verify clinic has access to this vendor
    clinic = await db.clinics.find_one({"id": user["clinic_id"]})
    if vendor_id not in clinic.get("assigned_vendors", []):
        raise HTTPException(status_code=403, detail="Vendor not assigned to your clinic")
    
    # Build order items and calculate total
    order_items = []
    total_amount = 0.0
    
    for item in data.items:
        product = await db.products.find_one({"id": item.product_id})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if product["vendor_id"] != vendor_id:
            raise HTTPException(status_code=400, detail="All items must be from the same vendor")
        
        item_total = product["price"] * item.quantity
        order_items.append({
            "product_id": product["id"],
            "name": product["name"],
            "price": product["price"],
            "quantity": item.quantity,
            "subtotal": item_total
        })
        total_amount += item_total
    
    order_id = str(uuid.uuid4())
    order_doc = {
        "id": order_id,
        "clinic_id": user["clinic_id"],
        "vendor_id": vendor_id,
        "items": order_items,
        "total_amount": round(total_amount, 2),
        "billing_address": data.billing_address,
        "shipping_address": data.shipping_address,
        "city": data.city,
        "state": data.state,
        "zip_code": data.zip_code,
        "country": data.country,
        "status": "pending",
        "payment_status": "pending",
        "stripe_session_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order_doc)
    del order_doc["_id"]
    return order_doc

@api_router.get("/clinic/orders", response_model=List[OrderResponse])
async def get_clinic_orders(user=Depends(get_clinic_user)):
    orders = await db.orders.find({"clinic_id": user["clinic_id"]}, {"_id": 0}).to_list(1000)
    # Add vendor name to each order
    for order in orders:
        vendor = await db.vendors.find_one({"id": order["vendor_id"]}, {"_id": 0, "company_name": 1})
        order["vendor_name"] = vendor["company_name"] if vendor else "Unknown"
    return orders

@api_router.get("/clinic/orders/{order_id}")
async def get_clinic_order_detail(order_id: str, user=Depends(get_clinic_user)):
    """Get detailed order information for clinic with tracking"""
    order = await db.orders.find_one({"id": order_id, "clinic_id": user["clinic_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    vendor = await db.vendors.find_one({"id": order["vendor_id"]}, {"_id": 0, "company_name": 1})
    order["vendor_name"] = vendor["company_name"] if vendor else "Unknown"
    
    return order

# ==================== STRIPE PAYMENT ROUTES ====================

@api_router.post("/checkout/create-session")
async def create_checkout_session(data: CheckoutRequest, request: Request, user=Depends(get_clinic_user)):
    order = await db.orders.find_one({"id": data.order_id, "clinic_id": user["clinic_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["payment_status"] == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")
    
    host_url = data.origin_url.rstrip('/')
    webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    success_url = f"{host_url}/marketplace/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{host_url}/marketplace/checkout?order_id={data.order_id}"
    
    checkout_request = CheckoutSessionRequest(
        amount=float(order["total_amount"]),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "order_id": data.order_id,
            "clinic_id": user["clinic_id"]
        }
    )
    
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "order_id": data.order_id,
        "clinic_id": user["clinic_id"],
        "session_id": session.session_id,
        "amount": order["total_amount"],
        "currency": "usd",
        "payment_status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Update order with session ID
    await db.orders.update_one(
        {"id": data.order_id},
        {"$set": {"stripe_session_id": session.session_id}}
    )
    
    return {"checkout_url": session.url, "session_id": session.session_id}

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, request: Request, user=Depends(get_clinic_user)):
    webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update payment transaction and order if paid
    if status.payment_status == "paid":
        # Check if already processed
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        if transaction and transaction.get("payment_status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            order = await db.orders.find_one({"stripe_session_id": session_id})
            if order:
                await db.orders.update_one(
                    {"id": order["id"]},
                    {"$set": {"payment_status": "paid", "status": "confirmed"}}
                )
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    
    webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            order_id = webhook_response.metadata.get("order_id")
            
            if order_id:
                await db.orders.update_one(
                    {"id": order_id},
                    {"$set": {"payment_status": "paid", "status": "confirmed"}}
                )
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

# ==================== PUBLIC ROUTES ====================

# ==================== CLINIC DASHBOARD ROUTES ====================

@api_router.get("/clinic/dashboard/summary")
async def get_clinic_dashboard_summary(user=Depends(get_clinic_user)):
    """Get dashboard summary for clinic"""
    clinic_id = user["clinic_id"]
    
    # Get orders summary
    orders = await db.orders.find({"clinic_id": clinic_id}, {"_id": 0}).to_list(1000)
    total_orders = len(orders)
    pending_orders = len([o for o in orders if o["status"] in ["pending", "confirmed", "processing"]])
    shipped_orders = len([o for o in orders if o["status"] == "shipped"])
    delivered_orders = len([o for o in orders if o["status"] == "delivered"])
    total_spent = sum(o["total_amount"] for o in orders if o.get("payment_status") == "paid")
    
    # Get recent orders
    recent_orders = sorted(orders, key=lambda x: x.get("created_at", ""), reverse=True)[:5]
    for order in recent_orders:
        vendor = await db.vendors.find_one({"id": order["vendor_id"]}, {"_id": 0, "company_name": 1})
        order["vendor_name"] = vendor["company_name"] if vendor else "Unknown"
    
    return {
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "shipped_orders": shipped_orders,
        "delivered_orders": delivered_orders,
        "total_spent": round(total_spent, 2),
        "recent_orders": recent_orders
    }

@api_router.get("/clinic/dashboard/notifications")
async def get_clinic_notifications(user=Depends(get_clinic_user)):
    """Get notifications for clinic (order updates, new products, system alerts)"""
    clinic_id = user["clinic_id"]
    
    # Get clinic's assigned vendors
    clinic = await db.clinics.find_one({"id": clinic_id})
    assigned_vendors = clinic.get("assigned_vendors", [])
    
    notifications = []
    
    # Order status updates (orders updated in last 7 days)
    from datetime import timedelta
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    orders = await db.orders.find({
        "clinic_id": clinic_id,
        "updated_at": {"$gte": seven_days_ago}
    }, {"_id": 0}).to_list(100)
    
    for order in orders:
        vendor = await db.vendors.find_one({"id": order["vendor_id"]}, {"_id": 0, "company_name": 1})
        if order["status"] == "shipped":
            notifications.append({
                "id": f"order-shipped-{order['id']}",
                "type": "order_shipped",
                "title": "Order Shipped",
                "message": f"Your order #{order['id'][:8]} has been shipped by {vendor['company_name'] if vendor else 'vendor'}",
                "order_id": order["id"],
                "created_at": order.get("shipped_at", order.get("updated_at", "")),
                "read": False,
                "icon": "truck"
            })
        elif order["status"] == "delivered":
            notifications.append({
                "id": f"order-delivered-{order['id']}",
                "type": "order_delivered",
                "title": "Order Delivered",
                "message": f"Your order #{order['id'][:8]} has been delivered",
                "order_id": order["id"],
                "created_at": order.get("delivered_at", order.get("updated_at", "")),
                "read": False,
                "icon": "check-circle"
            })
    
    # New products from assigned vendors (added in last 7 days)
    new_products = await db.products.find({
        "vendor_id": {"$in": assigned_vendors},
        "is_approved": True,
        "is_active": True,
        "created_at": {"$gte": seven_days_ago}
    }, {"_id": 0}).to_list(20)
    
    for product in new_products:
        vendor = await db.vendors.find_one({"id": product["vendor_id"]}, {"_id": 0, "company_name": 1})
        notifications.append({
            "id": f"new-product-{product['id']}",
            "type": "new_product",
            "title": "New Product Available",
            "message": f"{product['name']} is now available from {vendor['company_name'] if vendor else 'vendor'}",
            "product_id": product["id"],
            "created_at": product.get("created_at", ""),
            "read": False,
            "icon": "package"
        })
    
    # Sort by date, most recent first
    notifications.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return notifications[:20]

@api_router.get("/clinic/dashboard/offers")
async def get_clinic_offers(user=Depends(get_clinic_user)):
    """Get special offers and promotions for clinic"""
    clinic_id = user["clinic_id"]
    
    # Get clinic's assigned vendors
    clinic = await db.clinics.find_one({"id": clinic_id})
    assigned_vendors = clinic.get("assigned_vendors", [])
    
    # Check for active offers
    offers = await db.offers.find({
        "$or": [
            {"vendor_id": {"$in": assigned_vendors}},
            {"type": "platform"}  # Platform-wide offers
        ],
        "is_active": True,
        "expiry_date": {"$gte": datetime.now(timezone.utc).isoformat()}
    }, {"_id": 0}).to_list(20)
    
    # If no offers exist, create some sample promotional offers
    if len(offers) == 0:
        # Generate dynamic offers based on vendors
        vendors = await db.vendors.find(
            {"id": {"$in": assigned_vendors}, "is_active": True},
            {"_id": 0, "id": 1, "company_name": 1}
        ).to_list(10)
        
        sample_offers = [
            {
                "id": "bulk-discount-2024",
                "type": "bulk_discount",
                "title": "Bulk Order Savings",
                "description": "Order $5,000+ and get 10% off your total purchase",
                "discount_type": "percentage",
                "discount_value": 10,
                "min_order_amount": 5000,
                "code": "BULK10",
                "expiry_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                "is_active": True,
                "icon": "percent"
            },
            {
                "id": "free-shipping-2024",
                "type": "free_shipping",
                "title": "Free Shipping",
                "description": "Free shipping on orders over $1,000",
                "discount_type": "shipping",
                "min_order_amount": 1000,
                "expiry_date": (datetime.now(timezone.utc) + timedelta(days=60)).isoformat(),
                "is_active": True,
                "icon": "truck"
            },
            {
                "id": "new-customer-2024",
                "type": "first_order",
                "title": "First Order Discount",
                "description": "5% off your first order with any new vendor",
                "discount_type": "percentage",
                "discount_value": 5,
                "code": "WELCOME5",
                "expiry_date": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat(),
                "is_active": True,
                "icon": "gift"
            }
        ]
        
        # Add vendor-specific offers
        for vendor in vendors[:2]:
            sample_offers.append({
                "id": f"vendor-promo-{vendor['id'][:8]}",
                "type": "vendor_promo",
                "title": f"{vendor['company_name']} Special",
                "description": f"Exclusive deal from {vendor['company_name']} - 8% off all products",
                "discount_type": "percentage",
                "discount_value": 8,
                "vendor_id": vendor["id"],
                "vendor_name": vendor["company_name"],
                "code": f"VND{vendor['id'][:4].upper()}",
                "expiry_date": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
                "is_active": True,
                "icon": "tag"
            })
        
        return sample_offers
    
    return offers

@api_router.get("/clinic/dashboard/pricing-trends")
async def get_clinic_pricing_trends(user=Depends(get_clinic_user)):
    """Get pricing trends from different vendors for comparison"""
    clinic_id = user["clinic_id"]
    
    # Get clinic's assigned vendors
    clinic = await db.clinics.find_one({"id": clinic_id})
    assigned_vendors = clinic.get("assigned_vendors", [])
    
    # Get all products from assigned vendors
    products = await db.products.find({
        "vendor_id": {"$in": assigned_vendors},
        "is_approved": True,
        "is_active": True
    }, {"_id": 0}).to_list(1000)
    
    # Get vendors info
    vendors = await db.vendors.find(
        {"id": {"$in": assigned_vendors}},
        {"_id": 0, "id": 1, "company_name": 1}
    ).to_list(100)
    vendor_map = {v["id"]: v["company_name"] for v in vendors}
    
    # Group products by category
    categories = {}
    for product in products:
        cat = product.get("category", "Other")
        if cat not in categories:
            categories[cat] = []
        categories[cat].append({
            "product_id": product["id"],
            "name": product["name"],
            "price": product["price"],
            "vendor_id": product["vendor_id"],
            "vendor_name": vendor_map.get(product["vendor_id"], "Unknown")
        })
    
    # Create pricing comparison data
    pricing_trends = []
    for category, prods in categories.items():
        if len(prods) == 0:
            continue
            
        prices = [p["price"] for p in prods]
        avg_price = sum(prices) / len(prices)
        min_price = min(prices)
        max_price = max(prices)
        
        # Get vendor with lowest price
        cheapest = min(prods, key=lambda x: x["price"])
        
        pricing_trends.append({
            "category": category,
            "product_count": len(prods),
            "avg_price": round(avg_price, 2),
            "min_price": round(min_price, 2),
            "max_price": round(max_price, 2),
            "price_range": round(max_price - min_price, 2),
            "cheapest_vendor": cheapest["vendor_name"],
            "products": prods[:5]  # Top 5 products in category
        })
    
    # Sort by product count
    pricing_trends.sort(key=lambda x: x["product_count"], reverse=True)
    
    # Create vendor comparison
    vendor_comparison = []
    for vendor_id in assigned_vendors:
        vendor_products = [p for p in products if p["vendor_id"] == vendor_id]
        if len(vendor_products) == 0:
            continue
            
        vendor_prices = [p["price"] for p in vendor_products]
        vendor_comparison.append({
            "vendor_id": vendor_id,
            "vendor_name": vendor_map.get(vendor_id, "Unknown"),
            "total_products": len(vendor_products),
            "avg_price": round(sum(vendor_prices) / len(vendor_prices), 2),
            "min_price": round(min(vendor_prices), 2),
            "max_price": round(max(vendor_prices), 2)
        })
    
    return {
        "by_category": pricing_trends,
        "by_vendor": vendor_comparison,
        "total_products": len(products),
        "total_vendors": len(vendors)
    }

@api_router.get("/")
async def root():
    return {"message": "VIDAI IVF Marketplace API"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
