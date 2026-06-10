from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, BackgroundTasks, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
from jose import jwt, JWTError
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutSessionRequest
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
import shutil

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
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

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== STRIPE HELPER ====================

async def get_active_stripe_key():
    """Get the active Stripe secret key from database or environment"""
    # First try database settings
    settings = await db.settings.find_one({"type": "stripe"})
    if settings:
        mode = settings.get("stripe_mode", "sandbox")
        if mode == "live" and settings.get("secret_key_live"):
            return settings["secret_key_live"]
        elif settings.get("secret_key_sandbox"):
            return settings["secret_key_sandbox"]
    
    # Fallback to environment variable
    return STRIPE_API_KEY

# ==================== EMAIL SERVICE ====================

async def _get_sendgrid_settings_from_db():
    """Get SendGrid settings from database (internal helper)"""
    settings = await db.settings.find_one({"type": "sendgrid"})
    if not settings:
        return None
    return settings

async def send_email(to_email: str, subject: str, html_content: str):
    """Send email via SendGrid using settings from database"""
    try:
        settings = await _get_sendgrid_settings_from_db()
        if not settings:
            logger.warning("SendGrid settings not configured")
            return False
        
        # Get API key based on mode
        api_key = settings.get("api_key_live") if settings.get("sendgrid_mode") == "live" else settings.get("api_key_sandbox")
        if not api_key:
            logger.warning("SendGrid API key not configured")
            return False
        
        from_email = settings.get("from_email", "noreply@vidai.com")
        from_name = settings.get("from_name", "VIDAI")
        
        message = Mail(
            from_email=Email(from_email, from_name),
            to_emails=To(to_email),
            subject=subject,
            html_content=Content("text/html", html_content)
        )
        
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)
        logger.info(f"Email sent to {to_email}, status: {response.status_code}")
        return response.status_code == 202
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False

async def send_order_confirmation_email(order: dict, clinic_email: str, clinic_name: str):
    """Send order confirmation email with invoice details"""
    order_id = order.get("id", "")[:8].upper()
    items_html = ""
    
    for item in order.get("items", []):
        items_html += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">{item.get('name', 'Product')}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">{item.get('quantity', 1)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${item.get('price', 0):.2f}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${item.get('subtotal', 0):.2f}</td>
        </tr>
        """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Order Confirmation - VIDAI</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #E07A5F, #D55B3E); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">VIDAI</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">IVF Healthcare Marketplace</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px;">
                <h2 style="color: #333; margin: 0 0 20px 0;">Order Confirmation</h2>
                <p style="color: #666; line-height: 1.6;">
                    Dear {clinic_name},<br><br>
                    Thank you for your order! We're pleased to confirm that your order has been successfully placed.
                </p>
                
                <!-- Order Info -->
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 5px 0;"><strong>Order ID:</strong></td>
                            <td style="text-align: right; color: #E07A5F; font-weight: bold;">#{order_id}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0;"><strong>Order Date:</strong></td>
                            <td style="text-align: right;">{datetime.now().strftime('%B %d, %Y')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0;"><strong>Status:</strong></td>
                            <td style="text-align: right;"><span style="background: #28a745; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px;">Confirmed</span></td>
                        </tr>
                    </table>
                </div>
                
                <!-- Order Items -->
                <h3 style="color: #333; margin: 25px 0 15px 0;">Order Details</h3>
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #eee; border-radius: 8px;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 12px; text-align: left;">Product</th>
                            <th style="padding: 12px; text-align: center;">Qty</th>
                            <th style="padding: 12px; text-align: right;">Price</th>
                            <th style="padding: 12px; text-align: right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items_html}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f8f9fa;">
                            <td colspan="3" style="padding: 15px; text-align: right; font-weight: bold;">Total:</td>
                            <td style="padding: 15px; text-align: right; font-weight: bold; color: #E07A5F; font-size: 18px;">${order.get('total_amount', 0):.2f}</td>
                        </tr>
                    </tfoot>
                </table>
                
                <!-- Shipping Address -->
                <h3 style="color: #333; margin: 25px 0 15px 0;">Shipping Address</h3>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <p style="margin: 0; color: #666; line-height: 1.6;">
                        {order.get('shipping_address', 'N/A')}<br>
                        {order.get('city', '')}, {order.get('state', '')} {order.get('zip_code', '')}<br>
                        {order.get('country', '')}
                    </p>
                </div>
                
                <p style="color: #666; margin-top: 25px; line-height: 1.6;">
                    You will receive another email when your order is shipped with tracking information.
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #333; padding: 20px; text-align: center;">
                <p style="color: #999; margin: 0; font-size: 14px;">
                    &copy; {datetime.now().year} VIDAI. All rights reserved.<br>
                    <span style="color: #666; font-size: 12px;">This is an automated email, please do not reply.</span>
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    subject = f"Order Confirmation - #{order_id} | VIDAI"
    return await send_email(clinic_email, subject, html_content)

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

class VendorRegister(BaseModel):
    name: str
    email: str
    password: str
    company_name: str
    phone: Optional[str] = None

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
    gst_percentage: float = 18.0  # Default 18% GST

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    sku: Optional[str] = None
    stock_quantity: Optional[int] = None
    image_url: Optional[str] = None
    gst_percentage: Optional[float] = None

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
    gst_percentage: float = 18.0  # Default 18% GST
    created_at: str

class ProductApproval(BaseModel):
    product_id: str
    approved: bool
    commission_rate: float = 10.0  # Commission percentage for VIDAI

class TicketCreate(BaseModel):
    order_id: str
    product_id: Optional[str] = None
    subject: str
    message: str
    priority: str = "medium"  # low, medium, high

class TicketReply(BaseModel):
    message: str

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
    currency: Optional[str] = "INR"  # Default to Indian Rupees
    currency_symbol: Optional[str] = "₹"  # Default currency symbol

class StripeSettings(BaseModel):
    stripe_mode: str = "sandbox"  # sandbox or live
    publishable_key_sandbox: Optional[str] = None
    secret_key_sandbox: Optional[str] = None
    publishable_key_live: Optional[str] = None
    secret_key_live: Optional[str] = None

class SendGridSettings(BaseModel):
    sendgrid_mode: str = "sandbox"  # sandbox or live
    api_key_sandbox: Optional[str] = None
    api_key_live: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = "VIDAI"

class IntegrationSettings(BaseModel):
    stripe: Optional[StripeSettings] = None
    sendgrid: Optional[SendGridSettings] = None

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

# ==================== ADMIN DASHBOARD STATS ====================

@api_router.get("/admin/dashboard/stats")
async def get_admin_dashboard_stats(admin=Depends(get_admin_user)):
    """Get comprehensive dashboard statistics for admin"""
    
    # Count totals
    total_vendors = await db.vendors.count_documents({"is_active": True})
    total_clinics = await db.clinics.count_documents({"is_active": True})
    total_products = await db.products.count_documents({"is_approved": True, "is_active": True})
    pending_approvals = await db.products.count_documents({"is_approved": False})
    
    # Orders stats
    all_orders = await db.orders.find({}, {"_id": 0}).to_list(10000)
    total_orders = len(all_orders)
    total_revenue = sum(o.get("total_amount", 0) for o in all_orders if o.get("payment_status") == "paid")
    pending_orders = len([o for o in all_orders if o["status"] in ["pending", "confirmed", "processing"]])
    shipped_orders = len([o for o in all_orders if o["status"] == "shipped"])
    delivered_orders = len([o for o in all_orders if o["status"] == "delivered"])
    
    # Calculate commission earned
    total_commission = 0
    for order in all_orders:
        if order.get("payment_status") == "paid":
            for item in order.get("items", []):
                commission_rate = item.get("commission_rate", 10.0)
                total_commission += item["price"] * item["quantity"] * (commission_rate / 100)
    
    # Recent orders (last 5)
    recent_orders = sorted(all_orders, key=lambda x: x.get("created_at", ""), reverse=True)[:5]
    for order in recent_orders:
        clinic = await db.clinics.find_one({"id": order["clinic_id"]}, {"_id": 0, "name": 1})
        vendor = await db.vendors.find_one({"id": order["vendor_id"]}, {"_id": 0, "company_name": 1})
        order["clinic_name"] = clinic["name"] if clinic else "Unknown"
        order["vendor_name"] = vendor["company_name"] if vendor else "Unknown"
    
    # Enquiries stats
    total_enquiries = await db.enquiries.count_documents({})
    new_enquiries = await db.enquiries.count_documents({"status": "new"})
    
    # Top vendors by sales
    vendor_sales = {}
    for order in all_orders:
        if order.get("payment_status") == "paid":
            vid = order["vendor_id"]
            if vid not in vendor_sales:
                vendor_sales[vid] = {"total": 0, "orders": 0}
            vendor_sales[vid]["total"] += order.get("total_amount", 0)
            vendor_sales[vid]["orders"] += 1
    
    top_vendors = []
    for vid, stats in sorted(vendor_sales.items(), key=lambda x: x[1]["total"], reverse=True)[:5]:
        vendor = await db.vendors.find_one({"id": vid}, {"_id": 0, "company_name": 1})
        top_vendors.append({
            "vendor_id": vid,
            "vendor_name": vendor["company_name"] if vendor else "Unknown",
            "total_sales": round(stats["total"], 2),
            "order_count": stats["orders"]
        })
    
    # Monthly revenue (last 6 months)
    monthly_revenue = {}
    for order in all_orders:
        if order.get("payment_status") == "paid" and order.get("created_at"):
            try:
                date = datetime.fromisoformat(order["created_at"].replace("Z", "+00:00"))
                month_key = date.strftime("%Y-%m")
                if month_key not in monthly_revenue:
                    monthly_revenue[month_key] = 0
                monthly_revenue[month_key] += order.get("total_amount", 0)
            except:
                pass
    
    # Sort and get last 6 months
    sorted_months = sorted(monthly_revenue.items(), reverse=True)[:6]
    revenue_trend = [{"month": m, "revenue": round(r, 2)} for m, r in reversed(sorted_months)]
    
    return {
        "summary": {
            "total_vendors": total_vendors,
            "total_clinics": total_clinics,
            "total_products": total_products,
            "pending_approvals": pending_approvals,
            "total_orders": total_orders,
            "total_revenue": round(total_revenue, 2),
            "total_commission": round(total_commission, 2),
            "pending_orders": pending_orders,
            "shipped_orders": shipped_orders,
            "delivered_orders": delivered_orders,
            "total_enquiries": total_enquiries,
            "new_enquiries": new_enquiries
        },
        "recent_orders": recent_orders,
        "top_vendors": top_vendors,
        "revenue_trend": revenue_trend
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
    
    # Send email notification to admin
    try:
        # Get admin settings for email notification
        admin_settings = await db.settings.find_one({"type": "admin"}, {"_id": 0})
        contact_email = admin_settings.get("contact_email") if admin_settings else None
        
        if contact_email:
            enquiry_type_labels = {
                'general': 'General Inquiry',
                'demo': 'Demo Request',
                'pricing': 'Pricing Information',
                'partnership': 'Partnership Opportunity',
                'support': 'Support Request'
            }
            
            # Email to admin about new enquiry
            admin_email_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">VIDAI Marketplace</h1>
                </div>
                <div style="padding: 30px; background: #f8f9fa;">
                    <h2 style="color: #1e3a5f;">New Contact Enquiry</h2>
                    <p>You have received a new enquiry from the website.</p>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 120px;">Name:</td>
                                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">{data.name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">Email:</td>
                                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><a href="mailto:{data.email}">{data.email}</a></td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">Company:</td>
                                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">{data.company or 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">Phone:</td>
                                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">{data.phone or 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">Type:</td>
                                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">{enquiry_type_labels.get(data.enquiry_type, data.enquiry_type)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; font-weight: bold; vertical-align: top;">Message:</td>
                                <td style="padding: 10px 0;">{data.message}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">Please respond to this enquiry within 24-48 hours.</p>
                </div>
                <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
                    <p>© 2024 VIDAI Marketplace. All rights reserved.</p>
                </div>
            </div>
            """
            
            await send_email(contact_email, f"New {enquiry_type_labels.get(data.enquiry_type, 'Contact')} from {data.name}", admin_email_html)
            
            # Send auto-reply to the customer
            customer_email_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">VIDAI Marketplace</h1>
                </div>
                <div style="padding: 30px; background: #f8f9fa;">
                    <h2 style="color: #1e3a5f;">Thank You for Contacting Us!</h2>
                    <p>Dear {data.name},</p>
                    <p>Thank you for reaching out to VIDAI Marketplace. We have received your enquiry and our team will get back to you within 24-48 hours.</p>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #1e3a5f; margin-top: 0;">Your Enquiry Details:</h3>
                        <p><strong>Type:</strong> {enquiry_type_labels.get(data.enquiry_type, data.enquiry_type)}</p>
                        <p><strong>Message:</strong> {data.message}</p>
                    </div>
                    
                    <p>In the meantime, feel free to explore our marketplace or reach out to us at our contact email if you have any urgent questions.</p>
                    
                    <p>Best regards,<br>The VIDAI Team</p>
                </div>
                <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
                    <p>© 2024 VIDAI Marketplace. All rights reserved.</p>
                </div>
            </div>
            """
            
            await send_email(data.email, "Thank you for contacting VIDAI Marketplace", customer_email_html)
            
    except Exception as e:
        logger.error(f"Failed to send contact enquiry email: {e}")
        # Don't fail the request if email fails
    
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
        # Return default settings with INR as default currency
        return {
            "type": "admin",
            "contact_email": "",
            "company_name": "VIDAI",
            "notify_on_enquiry": True,
            "currency": "INR",
            "currency_symbol": "₹"
        }
    # Ensure currency fields exist
    if "currency" not in settings:
        settings["currency"] = "INR"
    if "currency_symbol" not in settings:
        settings["currency_symbol"] = "₹"
    return settings

@api_router.put("/admin/settings")
async def update_admin_settings(data: AdminSettings, admin=Depends(get_admin_user)):
    """Update admin settings"""
    settings_doc = {
        "type": "admin",
        "contact_email": data.contact_email,
        "company_name": data.company_name,
        "notify_on_enquiry": data.notify_on_enquiry,
        "currency": data.currency or "INR",
        "currency_symbol": data.currency_symbol or "₹",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.settings.update_one(
        {"type": "admin"},
        {"$set": settings_doc},
        upsert=True
    )
    return {"message": "Settings updated successfully"}

# ==================== STRIPE SETTINGS ====================

@api_router.get("/admin/settings/stripe")
async def get_stripe_settings(admin=Depends(get_admin_user)):
    """Get Stripe configuration settings"""
    settings = await db.settings.find_one({"type": "stripe"}, {"_id": 0})
    if not settings:
        return {
            "type": "stripe",
            "stripe_mode": "sandbox",
            "publishable_key_sandbox": "",
            "secret_key_sandbox": "",
            "publishable_key_live": "",
            "secret_key_live": ""
        }
    # Mask secret keys for security (show only last 4 characters)
    if settings.get("secret_key_sandbox"):
        settings["secret_key_sandbox_masked"] = "••••" + settings["secret_key_sandbox"][-4:]
    if settings.get("secret_key_live"):
        settings["secret_key_live_masked"] = "••••" + settings["secret_key_live"][-4:]
    return settings

@api_router.put("/admin/settings/stripe")
async def update_stripe_settings(data: StripeSettings, admin=Depends(get_admin_user)):
    """Update Stripe configuration settings"""
    settings_doc = {
        "type": "stripe",
        "stripe_mode": data.stripe_mode,
        "publishable_key_sandbox": data.publishable_key_sandbox,
        "secret_key_sandbox": data.secret_key_sandbox,
        "publishable_key_live": data.publishable_key_live,
        "secret_key_live": data.secret_key_live,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.settings.update_one(
        {"type": "stripe"},
        {"$set": settings_doc},
        upsert=True
    )
    
    # Update the global Stripe API key based on mode
    global STRIPE_API_KEY
    if data.stripe_mode == "live" and data.secret_key_live:
        STRIPE_API_KEY = data.secret_key_live
    elif data.secret_key_sandbox:
        STRIPE_API_KEY = data.secret_key_sandbox
    
    return {"message": "Stripe settings updated successfully"}

# ==================== SENDGRID SETTINGS ====================

@api_router.get("/admin/settings/sendgrid")
async def get_sendgrid_settings(admin=Depends(get_admin_user)):
    """Get SendGrid configuration settings"""
    settings = await db.settings.find_one({"type": "sendgrid"}, {"_id": 0})
    if not settings:
        return {
            "type": "sendgrid",
            "sendgrid_mode": "sandbox",
            "api_key_sandbox": "",
            "api_key_live": "",
            "from_email": "",
            "from_name": "VIDAI"
        }
    # Mask API keys for security
    if settings.get("api_key_sandbox"):
        settings["api_key_sandbox_masked"] = "••••" + settings["api_key_sandbox"][-4:]
    if settings.get("api_key_live"):
        settings["api_key_live_masked"] = "••••" + settings["api_key_live"][-4:]
    return settings

@api_router.put("/admin/settings/sendgrid")
async def update_sendgrid_settings(data: SendGridSettings, admin=Depends(get_admin_user)):
    """Update SendGrid configuration settings"""
    settings_doc = {
        "type": "sendgrid",
        "sendgrid_mode": data.sendgrid_mode,
        "api_key_sandbox": data.api_key_sandbox,
        "api_key_live": data.api_key_live,
        "from_email": data.from_email,
        "from_name": data.from_name,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.settings.update_one(
        {"type": "sendgrid"},
        {"$set": settings_doc},
        upsert=True
    )
    return {"message": "SendGrid settings updated successfully"}

# GST Settings Models
class GSTRate(BaseModel):
    value: float
    label: str
    is_default: bool = False

class GSTSettings(BaseModel):
    gst_enabled: bool = True
    gst_rates: List[GSTRate] = [
        GSTRate(value=0, label="0% (Exempt)", is_default=False),
        GSTRate(value=5, label="5%", is_default=False),
        GSTRate(value=12, label="12%", is_default=False),
        GSTRate(value=18, label="18%", is_default=True),
        GSTRate(value=28, label="28%", is_default=False)
    ]
    default_gst_rate: float = 18.0
    show_gst_on_products: bool = True
    gst_inclusive_pricing: bool = False  # If True, prices include GST

@api_router.get("/admin/settings/gst")
async def get_gst_settings(admin=Depends(get_admin_user)):
    """Get GST configuration settings"""
    settings = await db.settings.find_one({"type": "gst"}, {"_id": 0})
    if not settings:
        # Return default settings
        return {
            "type": "gst",
            "gst_enabled": True,
            "gst_rates": [
                {"value": 0, "label": "0% (Exempt)", "is_default": False},
                {"value": 5, "label": "5%", "is_default": False},
                {"value": 12, "label": "12%", "is_default": False},
                {"value": 18, "label": "18%", "is_default": True},
                {"value": 28, "label": "28%", "is_default": False}
            ],
            "default_gst_rate": 18.0,
            "show_gst_on_products": True,
            "gst_inclusive_pricing": False
        }
    return settings

@api_router.put("/admin/settings/gst")
async def update_gst_settings(data: GSTSettings, admin=Depends(get_admin_user)):
    """Update GST configuration settings"""
    # Convert GSTRate objects to dicts
    gst_rates_dict = [{"value": r.value, "label": r.label, "is_default": r.is_default} for r in data.gst_rates]
    
    settings_doc = {
        "type": "gst",
        "gst_enabled": data.gst_enabled,
        "gst_rates": gst_rates_dict,
        "default_gst_rate": data.default_gst_rate,
        "show_gst_on_products": data.show_gst_on_products,
        "gst_inclusive_pricing": data.gst_inclusive_pricing,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.settings.update_one(
        {"type": "gst"},
        {"$set": settings_doc},
        upsert=True
    )
    return {"message": "GST settings updated successfully"}

@api_router.get("/public/gst-settings")
async def get_public_gst_settings():
    """Public endpoint to get GST settings for vendors and clinics"""
    settings = await db.settings.find_one({"type": "gst"}, {"_id": 0})
    if not settings:
        return {
            "gst_enabled": True,
            "gst_rates": [
                {"value": 0, "label": "0% (Exempt)", "is_default": False},
                {"value": 5, "label": "5%", "is_default": False},
                {"value": 12, "label": "12%", "is_default": False},
                {"value": 18, "label": "18%", "is_default": True},
                {"value": 28, "label": "28%", "is_default": False}
            ],
            "default_gst_rate": 18.0,
            "show_gst_on_products": True,
            "gst_inclusive_pricing": False
        }
    return settings

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

@api_router.post("/vendor/register")
async def vendor_register(data: VendorRegister):
    """Register a new vendor account"""
    # Check if email already exists
    existing = await db.vendors.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create vendor
    vendor_id = str(uuid.uuid4())
    hashed_password = hash_password(data.password)
    
    vendor_doc = {
        "id": vendor_id,
        "name": data.name,
        "email": data.email,
        "password": hashed_password,
        "company_name": data.company_name,
        "phone": data.phone,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vendors.insert_one(vendor_doc)
    
    # Generate token and return
    token = create_token({"role": "vendor", "vendor_id": vendor_id, "email": data.email})
    return {
        "token": token,
        "role": "vendor",
        "vendor_id": vendor_id,
        "name": data.name,
        "company_name": data.company_name,
        "message": "Registration successful"
    }

class ForgotPasswordRequest(BaseModel):
    email: str

@api_router.post("/vendor/forgot-password")
async def vendor_forgot_password(data: ForgotPasswordRequest):
    """Send password reset email to vendor"""
    vendor = await db.vendors.find_one({"email": data.email})
    
    # Always return success to prevent email enumeration
    if not vendor:
        return {"message": "If an account exists with this email, you will receive password reset instructions."}
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Store reset token in database
    await db.password_resets.update_one(
        {"email": data.email},
        {
            "$set": {
                "email": data.email,
                "token": reset_token,
                "expires_at": expires_at.isoformat(),
                "user_type": "vendor"
            }
        },
        upsert=True
    )
    
    # Send reset email
    reset_link = f"{os.environ.get('FRONTEND_URL', 'https://vidaimarketplace.com')}/reset-password?token={reset_token}"
    
    email_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">VIDAI Marketplace</h1>
        </div>
        <div style="padding: 30px; background: #f8f9fa;">
            <h2 style="color: #1e3a5f;">Password Reset Request</h2>
            <p>Hello {vendor.get('name', 'User')},</p>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}" style="background: #E07A5F; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
            </div>
            <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        </div>
        <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
            <p>© 2024 VIDAI Marketplace. All rights reserved.</p>
        </div>
    </div>
    """
    
    await send_email(data.email, "VIDAI - Password Reset Request", email_html)
    
    return {"message": "If an account exists with this email, you will receive password reset instructions."}

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@api_router.post("/vendor/reset-password")
async def vendor_reset_password(data: ResetPasswordRequest):
    """Reset vendor password using reset token"""
    # Find reset token
    reset_record = await db.password_resets.find_one({"token": data.token})
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check if token is expired
    expires_at = datetime.fromisoformat(reset_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        # Delete expired token
        await db.password_resets.delete_one({"token": data.token})
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")
    
    # Validate password length
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
    
    # Hash new password
    hashed_password = bcrypt.hashpw(data.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Update vendor password
    result = await db.vendors.update_one(
        {"email": reset_record["email"]},
        {"$set": {"password": hashed_password}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Vendor account not found")
    
    # Delete used reset token
    await db.password_resets.delete_one({"token": data.token})
    
    return {"message": "Password has been reset successfully. You can now log in with your new password."}

@api_router.get("/vendor/reset-password/validate")
async def validate_reset_token(token: str):
    """Validate if a reset token is still valid"""
    reset_record = await db.password_resets.find_one({"token": token})
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid reset token")
    
    expires_at = datetime.fromisoformat(reset_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.password_resets.delete_one({"token": token})
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    return {"valid": True, "email": reset_record["email"]}

@api_router.get("/vendor/profile")
async def get_vendor_profile(user=Depends(get_vendor_user)):
    vendor = await db.vendors.find_one({"id": user["vendor_id"]}, {"_id": 0, "password": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor

@api_router.get("/vendor/dashboard-summary")
async def get_vendor_dashboard_summary(user=Depends(get_vendor_user)):
    """Get vendor dashboard overview statistics"""
    vendor_id = user["vendor_id"]
    
    # Get products stats
    products = await db.products.find({"vendor_id": vendor_id}, {"_id": 0}).to_list(1000)
    total_products = len(products)
    approved_products = len([p for p in products if p.get("is_approved")])
    pending_products = len([p for p in products if not p.get("is_approved")])
    low_stock_products = len([p for p in products if p.get("stock_quantity", 0) <= 10 and p.get("is_approved")])
    
    # Get orders stats
    orders = await db.orders.find({}, {"_id": 0}).to_list(10000)
    vendor_orders = []
    total_revenue = 0
    total_commission_paid = 0
    
    for order in orders:
        for item in order.get("items", []):
            if item.get("vendor_id") == vendor_id:
                vendor_orders.append(order)
                vendor_amount = item.get("vendor_amount", item.get("subtotal", 0))
                commission = item.get("commission_amount", 0)
                total_revenue += vendor_amount
                total_commission_paid += commission
                break
    
    # Count orders by status
    pending_orders = len([o for o in vendor_orders if o.get("status") in ["pending", "processing"]])
    shipped_orders = len([o for o in vendor_orders if o.get("status") == "shipped"])
    delivered_orders = len([o for o in vendor_orders if o.get("status") == "delivered"])
    
    # Get recent orders (last 5)
    recent_orders = sorted(vendor_orders, key=lambda x: x.get("created_at", ""), reverse=True)[:5]
    
    # Get low stock items
    low_stock_items = [
        {"name": p["name"], "stock": p.get("stock_quantity", 0), "id": p["id"]}
        for p in products 
        if p.get("stock_quantity", 0) <= 10 and p.get("is_approved")
    ][:5]
    
    # Get tickets count
    tickets = await db.tickets.find({"vendor_id": vendor_id}, {"_id": 0}).to_list(1000)
    open_tickets = len([t for t in tickets if t.get("status") in ["open", "in_progress"]])
    
    return {
        "products": {
            "total": total_products,
            "approved": approved_products,
            "pending": pending_products,
            "low_stock": low_stock_products
        },
        "orders": {
            "total": len(vendor_orders),
            "pending": pending_orders,
            "shipped": shipped_orders,
            "delivered": delivered_orders
        },
        "revenue": {
            "total": round(total_revenue, 2),
            "commission_paid": round(total_commission_paid, 2),
            "net_earnings": round(total_revenue, 2)
        },
        "tickets": {
            "open": open_tickets,
            "total": len(tickets)
        },
        "recent_orders": recent_orders,
        "low_stock_items": low_stock_items
    }

# ==================== IMAGE UPLOAD ====================

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

@api_router.post("/upload/image")
async def upload_image(file: UploadFile = File(...), user=Depends(get_vendor_user)):
    """Upload product image and return URL"""
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Read file content
    content = await file.read()
    
    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = UPLOADS_DIR / unique_filename
    
    # Save file
    with open(file_path, "wb") as buffer:
        buffer.write(content)
    
    # Return the URL path (will be served via /uploads/...)
    return {"image_url": f"/uploads/{unique_filename}"}

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
        "gst_percentage": data.gst_percentage,
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
    """Get all approved products for the clinic - no vendor assignment required"""
    # Get ALL approved products from active vendors
    products = await db.products.find(
        {"is_active": True, "is_approved": True},
        {"_id": 0}
    ).to_list(1000)
    
    # Get all active vendor IDs
    vendor_ids = list(set(p["vendor_id"] for p in products if p.get("vendor_id")))
    
    # Get vendor names
    vendors = await db.vendors.find(
        {"id": {"$in": vendor_ids}, "is_active": True},
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
    """Get all categories from all approved products"""
    products = await db.products.find(
        {"is_active": True, "is_approved": True},
        {"category": 1, "_id": 0}
    ).to_list(1000)
    categories = list(set(p["category"] for p in products if "category" in p))
    return categories

@api_router.get("/clinic/products")
async def get_all_clinic_products(user=Depends(get_clinic_user), vendor_id: Optional[str] = None, category: Optional[str] = None):
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
    
    # Verify the product is approved and active (no vendor assignment required)
    if not first_product.get("is_approved") or not first_product.get("is_active", True):
        raise HTTPException(status_code=403, detail="Product is not available for purchase")
    
    # Build order items and calculate total with GST
    order_items = []
    subtotal_amount = 0.0
    total_gst_amount = 0.0
    
    for item in data.items:
        product = await db.products.find_one({"id": item.product_id})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if product["vendor_id"] != vendor_id:
            raise HTTPException(status_code=400, detail="All items must be from the same vendor")
        
        item_subtotal = product["price"] * item.quantity
        gst_percentage = product.get("gst_percentage", 18.0)
        item_gst = round(item_subtotal * gst_percentage / 100, 2)
        item_total = item_subtotal + item_gst
        
        order_items.append({
            "product_id": product["id"],
            "name": product["name"],
            "price": product["price"],
            "quantity": item.quantity,
            "subtotal": item_subtotal,
            "gst_percentage": gst_percentage,
            "gst_amount": item_gst,
            "total": item_total
        })
        subtotal_amount += item_subtotal
        total_gst_amount += item_gst
    
    total_amount = subtotal_amount + total_gst_amount
    
    order_id = str(uuid.uuid4())
    order_doc = {
        "id": order_id,
        "clinic_id": user["clinic_id"],
        "vendor_id": vendor_id,
        "items": order_items,
        "subtotal_amount": round(subtotal_amount, 2),
        "gst_amount": round(total_gst_amount, 2),
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
    
    # Get active Stripe key from database or environment
    stripe_key = await get_active_stripe_key()
    if not stripe_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured. Please configure Stripe keys in Admin Settings.")
    
    host_url = data.origin_url.rstrip('/')
    webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=stripe_key, webhook_url=webhook_url)
    
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
async def get_checkout_status(session_id: str, request: Request, user=Depends(get_clinic_user), background_tasks: BackgroundTasks = None):
    # Get active Stripe key
    stripe_key = await get_active_stripe_key()
    if not stripe_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured")
    
    webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_key, webhook_url=webhook_url)
    
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
                
                # Send order confirmation email
                clinic = await db.clinics.find_one({"id": order["clinic_id"]})
                if clinic:
                    clinic_email = clinic.get("email", "")
                    clinic_name = clinic.get("name", "Customer")
                    # Use background task to send email without blocking
                    import asyncio
                    asyncio.create_task(send_order_confirmation_email(order, clinic_email, clinic_name))
    
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
    
    # Get active Stripe key
    stripe_key = await get_active_stripe_key()
    if not stripe_key:
        return {"status": "error", "message": "Stripe is not configured"}
    
    webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_key, webhook_url=webhook_url)
    
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
                
                # Send order confirmation email
                order = await db.orders.find_one({"id": order_id})
                if order:
                    clinic = await db.clinics.find_one({"id": order["clinic_id"]})
                    if clinic:
                        clinic_email = clinic.get("email", "")
                        clinic_name = clinic.get("name", "Customer")
                        import asyncio
                        asyncio.create_task(send_order_confirmation_email(order, clinic_email, clinic_name))
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

# ==================== PUBLIC ROUTES ====================

@api_router.get("/public/settings")
async def get_public_settings():
    """Get public settings (currency, company name) - no auth required"""
    settings = await db.settings.find_one({"type": "admin"}, {"_id": 0})
    return {
        "currency": settings.get("currency", "INR") if settings else "INR",
        "currency_symbol": settings.get("currency_symbol", "₹") if settings else "₹",
        "company_name": settings.get("company_name", "VIDAI") if settings else "VIDAI"
    }

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

# ==================== TICKET/SUPPORT SYSTEM ====================

@api_router.post("/tickets")
async def create_ticket(ticket: TicketCreate, user=Depends(get_clinic_user)):
    """Create a support ticket for an order"""
    clinic_id = user["clinic_id"]
    
    # Verify order belongs to clinic
    order = await db.orders.find_one({"id": ticket.order_id, "clinic_id": clinic_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    ticket_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    ticket_data = {
        "id": ticket_id,
        "order_id": ticket.order_id,
        "product_id": ticket.product_id,
        "clinic_id": clinic_id,
        "clinic_name": user.get("clinic_name", "Unknown Clinic"),
        "vendor_id": order["vendor_id"],
        "subject": ticket.subject,
        "priority": ticket.priority,
        "status": "open",  # open, in_progress, resolved, closed
        "messages": [
            {
                "id": str(uuid.uuid4()),
                "sender_type": "clinic",
                "sender_id": clinic_id,
                "sender_name": user.get("clinic_name", "Clinic"),
                "message": ticket.message,
                "created_at": now
            }
        ],
        "created_at": now,
        "updated_at": now
    }
    
    await db.tickets.insert_one(ticket_data)
    
    return {"message": "Ticket created successfully", "ticket_id": ticket_id}

@api_router.get("/clinic/tickets")
async def get_clinic_tickets(user=Depends(get_clinic_user)):
    """Get all tickets for a clinic"""
    clinic_id = user["clinic_id"]
    tickets = await db.tickets.find({"clinic_id": clinic_id}, {"_id": 0}).to_list(100)
    
    # Add vendor name to each ticket
    for ticket in tickets:
        vendor = await db.vendors.find_one({"id": ticket["vendor_id"]}, {"_id": 0, "company_name": 1})
        ticket["vendor_name"] = vendor["company_name"] if vendor else "Unknown"
    
    return sorted(tickets, key=lambda x: x.get("updated_at", ""), reverse=True)

@api_router.post("/clinic/tickets/{ticket_id}/reply")
async def clinic_reply_ticket(ticket_id: str, reply: TicketReply, user=Depends(get_clinic_user)):
    """Add a reply to a ticket from clinic"""
    clinic_id = user["clinic_id"]
    
    ticket = await db.tickets.find_one({"id": ticket_id, "clinic_id": clinic_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc).isoformat()
    message = {
        "id": str(uuid.uuid4()),
        "sender_type": "clinic",
        "sender_id": clinic_id,
        "sender_name": user.get("clinic_name", "Clinic"),
        "message": reply.message,
        "created_at": now
    }
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {
            "$push": {"messages": message},
            "$set": {"updated_at": now}
        }
    )
    
    return {"message": "Reply added successfully"}

@api_router.get("/vendor/tickets")
async def get_vendor_tickets(user=Depends(get_vendor_user)):
    """Get all tickets for a vendor"""
    vendor_id = user["vendor_id"]
    tickets = await db.tickets.find({"vendor_id": vendor_id}, {"_id": 0}).to_list(100)
    
    return sorted(tickets, key=lambda x: x.get("updated_at", ""), reverse=True)

@api_router.post("/vendor/tickets/{ticket_id}/reply")
async def vendor_reply_ticket(ticket_id: str, reply: TicketReply, user=Depends(get_vendor_user)):
    """Add a reply to a ticket from vendor"""
    vendor_id = user["vendor_id"]
    
    ticket = await db.tickets.find_one({"id": ticket_id, "vendor_id": vendor_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0, "company_name": 1})
    now = datetime.now(timezone.utc).isoformat()
    
    message = {
        "id": str(uuid.uuid4()),
        "sender_type": "vendor",
        "sender_id": vendor_id,
        "sender_name": vendor["company_name"] if vendor else "Vendor",
        "message": reply.message,
        "created_at": now
    }
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {
            "$push": {"messages": message},
            "$set": {"updated_at": now, "status": "in_progress"}
        }
    )
    
    return {"message": "Reply added successfully"}

@api_router.put("/vendor/tickets/{ticket_id}/status")
async def vendor_update_ticket_status(ticket_id: str, status: str = "", user=Depends(get_vendor_user)):
    """Update ticket status"""
    vendor_id = user["vendor_id"]
    
    if status not in ["open", "in_progress", "resolved", "closed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.tickets.update_one(
        {"id": ticket_id, "vendor_id": vendor_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return {"message": "Status updated"}

@api_router.get("/admin/tickets")
async def get_admin_tickets(admin=Depends(get_admin_user)):
    """Get all tickets for admin"""
    tickets = await db.tickets.find({}, {"_id": 0}).to_list(500)
    
    # Add vendor and clinic names
    for ticket in tickets:
        vendor = await db.vendors.find_one({"id": ticket["vendor_id"]}, {"_id": 0, "company_name": 1})
        ticket["vendor_name"] = vendor["company_name"] if vendor else "Unknown"
    
    return sorted(tickets, key=lambda x: x.get("updated_at", ""), reverse=True)

@api_router.post("/admin/tickets/{ticket_id}/reply")
async def admin_reply_ticket(ticket_id: str, reply: TicketReply, admin=Depends(get_admin_user)):
    """Add a reply to a ticket from admin"""
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc).isoformat()
    message = {
        "id": str(uuid.uuid4()),
        "sender_type": "admin",
        "sender_id": "admin",
        "sender_name": "VIDAI Support",
        "message": reply.message,
        "created_at": now
    }
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {
            "$push": {"messages": message},
            "$set": {"updated_at": now}
        }
    )
    
    return {"message": "Reply added successfully"}

@api_router.put("/admin/tickets/{ticket_id}/status")
async def admin_update_ticket_status(ticket_id: str, status: str = "", admin=Depends(get_admin_user)):
    """Update ticket status by admin"""
    if status not in ["open", "in_progress", "resolved", "closed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return {"message": "Status updated"}

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
