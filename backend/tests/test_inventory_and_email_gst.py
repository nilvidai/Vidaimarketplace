"""
Tests for:
1. Inventory auto-deduction after successful payment (deduct_inventory)
2. Order confirmation email GST breakdown (format_inr + send_order_confirmation_email template)

Since payment requires real Stripe session, we test deduct_inventory directly and via DB simulation.
"""
import os
import sys
import asyncio
import uuid
from datetime import datetime, timezone

import pytest
import requests

# Make backend importable
sys.path.insert(0, "/app/backend")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://clinic-shop-preview.preview.emergentagent.com").rstrip("/")

CLINIC_EMAIL = "clinic1@test.com"
CLINIC_PASSWORD = "test123"
VENDOR_EMAIL = "vendor1@test.com"
VENDOR_PASSWORD = "test123"
ADMIN_USER = "admin"
ADMIN_PASSWORD = "vidai@01"


# ---------------- Fixtures ----------------

@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def clinic_token(api):
    r = api.post(f"{BASE_URL}/api/clinic/login", json={"email": CLINIC_EMAIL, "password": CLINIC_PASSWORD})
    assert r.status_code == 200, f"Clinic login failed: {r.status_code} {r.text}"
    body = r.json()
    return body.get("token") or body.get("access_token")


# ---------------- Direct unit tests (format_inr) ----------------

def test_format_inr_basic():
    from server import format_inr
    assert format_inr(100) == "₹100.00"
    assert format_inr(1234.5) == "₹1,234.50"
    assert format_inr(0) == "₹0.00"
    assert format_inr(99999.999).startswith("₹")


# ---------------- Async tests for deduct_inventory ----------------

@pytest.mark.asyncio
async def test_deduct_inventory_decreases_stock():
    """Directly test deduct_inventory() function: insert product and order in DB, run deduction."""
    from server import deduct_inventory, db

    pid = f"TEST_PROD_{uuid.uuid4().hex[:8]}"
    initial_stock = 50
    qty = 7

    await db.products.insert_one({
        "id": pid,
        "name": "TEST_Inventory_Product",
        "price": 100.0,
        "stock_quantity": initial_stock,
        "is_approved": True,
        "is_active": True,
        "vendor_id": "test_vendor",
    })

    fake_order = {
        "id": f"TEST_ORD_{uuid.uuid4().hex[:8]}",
        "items": [{"product_id": pid, "quantity": qty, "price": 100, "name": "TEST_Inventory_Product"}],
    }

    try:
        ok = await deduct_inventory(fake_order)
        assert ok is True

        product = await db.products.find_one({"id": pid})
        assert product["stock_quantity"] == initial_stock - qty, \
            f"Expected stock {initial_stock - qty}, got {product['stock_quantity']}"
    finally:
        await db.products.delete_one({"id": pid})


@pytest.mark.asyncio
async def test_deduct_inventory_insufficient_stock_caps_at_zero():
    """If stock < quantity ordered, stock should be set to 0 (not go negative)."""
    from server import deduct_inventory, db

    pid = f"TEST_PROD_{uuid.uuid4().hex[:8]}"
    await db.products.insert_one({
        "id": pid,
        "name": "TEST_LowStock_Product",
        "price": 50.0,
        "stock_quantity": 3,
        "is_approved": True,
        "is_active": True,
        "vendor_id": "test_vendor",
    })

    fake_order = {
        "id": f"TEST_ORD_{uuid.uuid4().hex[:8]}",
        "items": [{"product_id": pid, "quantity": 10, "price": 50, "name": "TEST_LowStock_Product"}],
    }

    try:
        ok = await deduct_inventory(fake_order)
        assert ok is True
        product = await db.products.find_one({"id": pid})
        assert product["stock_quantity"] == 0, f"Expected stock 0, got {product['stock_quantity']}"
    finally:
        await db.products.delete_one({"id": pid})


@pytest.mark.asyncio
async def test_deduct_inventory_multiple_items():
    """Multiple items in order should all be deducted."""
    from server import deduct_inventory, db

    pid1 = f"TEST_PROD_{uuid.uuid4().hex[:8]}"
    pid2 = f"TEST_PROD_{uuid.uuid4().hex[:8]}"

    await db.products.insert_many([
        {"id": pid1, "name": "TEST_Multi_1", "price": 100.0, "stock_quantity": 20,
         "is_approved": True, "is_active": True, "vendor_id": "v"},
        {"id": pid2, "name": "TEST_Multi_2", "price": 200.0, "stock_quantity": 15,
         "is_approved": True, "is_active": True, "vendor_id": "v"},
    ])

    fake_order = {
        "id": f"TEST_ORD_{uuid.uuid4().hex[:8]}",
        "items": [
            {"product_id": pid1, "quantity": 5, "price": 100, "name": "TEST_Multi_1"},
            {"product_id": pid2, "quantity": 3, "price": 200, "name": "TEST_Multi_2"},
        ],
    }
    try:
        await deduct_inventory(fake_order)
        p1 = await db.products.find_one({"id": pid1})
        p2 = await db.products.find_one({"id": pid2})
        assert p1["stock_quantity"] == 15
        assert p2["stock_quantity"] == 12
    finally:
        await db.products.delete_one({"id": pid1})
        await db.products.delete_one({"id": pid2})


# ---------------- Email template (send_order_confirmation_email) ----------------

@pytest.mark.asyncio
async def test_email_template_contains_gst_breakdown_inr():
    """Verify send_order_confirmation_email generates HTML containing GST breakdown,
       INR currency (₹), per-item GST badge, and grand total."""
    import server

    captured = {}

    async def fake_send_email(to_email, subject, html_content):
        captured["to"] = to_email
        captured["subject"] = subject
        captured["html"] = html_content
        return True

    original = server.send_email
    server.send_email = fake_send_email
    try:
        order = {
            "id": "order-1234abcd",
            "items": [
                {"product_id": "p1", "name": "Embryo Culture Media", "price": 299.99,
                 "quantity": 2, "subtotal": 599.98, "gst_percentage": 18, "gst_amount": 107.996,
                 "total": 707.976},
                {"product_id": "p2", "name": "IVF Catheter", "price": 150.00,
                 "quantity": 1, "subtotal": 150.00, "gst_percentage": 12, "gst_amount": 18.00,
                 "total": 168.00},
            ],
            "subtotal_amount": 749.98,
            "gst_amount": 126.00,
            "total_amount": 875.98,
            "shipping_address": "123 Test Street",
            "city": "Mumbai",
            "state": "MH",
            "zip_code": "400001",
            "country": "India",
        }
        result = await server.send_order_confirmation_email(order, "test@example.com", "Test Clinic")
        assert result is True
        html = captured["html"]

        # INR currency symbol present
        assert "₹" in html, "Email should contain INR ₹ symbol"

        # Subtotal, GST, Grand Total rows present
        assert "Subtotal" in html
        assert "GST" in html
        assert "Grand Total" in html

        # Formatted INR values present
        assert "₹749.98" in html, f"Subtotal ₹749.98 not found"
        assert "₹126.00" in html, f"GST ₹126.00 not found"
        assert "₹875.98" in html, f"Total ₹875.98 not found"

        # Per-item GST badge percentages
        assert "18% GST" in html, "Item-level 18% GST badge missing"
        assert "12% GST" in html, "Item-level 12% GST badge missing"

        # Subject contains order id
        assert "Order Confirmation" in captured["subject"]
        assert "ORDER-12" in captured["subject"].upper() or "#" in captured["subject"]
    finally:
        server.send_email = original


@pytest.mark.asyncio
async def test_email_template_calculates_gst_when_missing():
    """If order doesn't have subtotal_amount stored, function should derive from items/total."""
    import server

    captured = {}

    async def fake_send_email(to_email, subject, html_content):
        captured["html"] = html_content
        return True

    original = server.send_email
    server.send_email = fake_send_email
    try:
        order = {
            "id": "order-fallback",
            "items": [
                {"name": "P1", "price": 100, "quantity": 2, "subtotal": 200,
                 "gst_percentage": 18, "gst_amount": 36},
            ],
            "total_amount": 236.00,
            # subtotal_amount intentionally missing
            "shipping_address": "x",
            "city": "x", "state": "x", "zip_code": "x", "country": "x",
        }
        await server.send_order_confirmation_email(order, "t@e.com", "C")
        html = captured["html"]
        # Derived subtotal 200 and gst 36
        assert "₹200.00" in html
        assert "₹36.00" in html
        assert "₹236.00" in html
    finally:
        server.send_email = original


# ---------------- End-to-end API + DB simulation ----------------

@pytest.mark.asyncio
async def test_end_to_end_order_then_deduct_inventory(api, clinic_token):
    """
    Full flow: create order via API as clinic, simulate payment paid by calling deduct_inventory
    on the persisted order (mirrors what get_checkout_status/webhook does).
    """
    from server import db, deduct_inventory

    # Find an approved product owned by vendor of clinic
    headers = {"Authorization": f"Bearer {clinic_token}"}
    resp = requests.get(f"{BASE_URL}/api/clinic/all-products", headers=headers)
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    products = payload.get("products", [])
    assert len(products) > 0, "No approved products available for clinic"

    # Use a product with stock > 1
    product = next((p for p in products if p.get("stock_quantity", 0) > 1), None)
    assert product is not None, "No product with sufficient stock"

    product_id = product["id"]
    initial_stock = product["stock_quantity"]
    order_qty = 1

    # Create order
    order_payload = {
        "items": [{"product_id": product_id, "quantity": order_qty}],
        "billing_address": "TEST_Addr",
        "shipping_address": "TEST_Addr",
        "city": "Mumbai", "state": "MH", "zip_code": "400001", "country": "India",
    }
    create_resp = requests.post(f"{BASE_URL}/api/clinic/orders", json=order_payload, headers=headers)
    assert create_resp.status_code == 200, create_resp.text
    order = create_resp.json()
    order_id = order["id"]

    # Fetch raw order doc from DB to verify subtotal_amount & gst_amount are persisted
    # (OrderResponse model does not expose these fields - bug to report)
    raw_order = await db.orders.find_one({"id": order_id})
    assert raw_order is not None
    assert "subtotal_amount" in raw_order, "Order doc missing subtotal_amount in DB"
    assert "gst_amount" in raw_order, "Order doc missing gst_amount in DB"
    assert "total_amount" in raw_order
    expected_total = round(raw_order["subtotal_amount"] + raw_order["gst_amount"], 2)
    assert abs(expected_total - raw_order["total_amount"]) < 0.01, \
        f"Total {raw_order['total_amount']} != subtotal {raw_order['subtotal_amount']} + gst {raw_order['gst_amount']}"

    # Items should have gst_percentage and gst_amount
    for item in raw_order["items"]:
        assert "gst_percentage" in item
        assert "gst_amount" in item
        assert "subtotal" in item

    try:
        # Simulate payment success → call deduct_inventory like checkout/status does
        order_doc = await db.orders.find_one({"id": order_id})
        assert order_doc is not None
        await deduct_inventory(order_doc)

        # Verify stock decreased
        updated_product = await db.products.find_one({"id": product_id})
        assert updated_product["stock_quantity"] == initial_stock - order_qty, \
            f"Expected {initial_stock - order_qty}, got {updated_product['stock_quantity']}"

        # Restore stock to be a good neighbor
        await db.products.update_one({"id": product_id}, {"$inc": {"stock_quantity": order_qty}})
    finally:
        # Cleanup test order
        await db.orders.delete_one({"id": order_id})


# Configure asyncio mode for pytest-asyncio
def pytest_collection_modifyitems(config, items):
    pass
