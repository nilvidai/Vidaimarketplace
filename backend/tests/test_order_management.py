"""
Test Order Management & Tracking Module
Tests Admin Orders, Vendor Shipping/Status Updates, Clinic Order Tracking

Endpoints tested:
- GET /api/admin/orders - Admin views all orders
- GET /api/admin/orders?status=X - Admin filters by status
- GET /api/admin/orders/{order_id} - Admin views order detail
- GET /api/vendor/orders - Vendor views their orders
- PUT /api/vendor/orders/{order_id}/status - Vendor updates order status
- PUT /api/vendor/orders/{order_id}/shipping - Vendor updates shipping info
- GET /api/clinic/orders - Clinic views their orders
- GET /api/clinic/orders/{order_id} - Clinic views order detail with tracking
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDENTIALS = {"username": "admin", "password": "vidai@01"}
VENDOR_CREDENTIALS = {"email": "vendor1@test.com", "password": "test123"}
CLINIC_CREDENTIALS = {"email": "clinic1@test.com", "password": "test123"}


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/admin/login", json=ADMIN_CREDENTIALS)
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def vendor_token():
    """Get vendor authentication token"""
    response = requests.post(f"{BASE_URL}/api/vendor/login", json=VENDOR_CREDENTIALS)
    assert response.status_code == 200, f"Vendor login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def clinic_token():
    """Get clinic authentication token"""
    response = requests.post(f"{BASE_URL}/api/clinic/login", json=CLINIC_CREDENTIALS)
    assert response.status_code == 200, f"Clinic login failed: {response.text}"
    return response.json()["token"]


class TestAdminOrders:
    """Test Admin Order Management endpoints"""

    def test_admin_get_all_orders(self, admin_token):
        """Admin can view all orders"""
        response = requests.get(
            f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Get admin orders failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Orders should be a list"
        # Verify structure of returned orders
        if len(data) > 0:
            order = data[0]
            assert "id" in order, "Order should have id"
            assert "status" in order, "Order should have status"
            assert "clinic_name" in order, "Order should have clinic_name"
            assert "vendor_name" in order, "Order should have vendor_name"
            assert "total_amount" in order, "Order should have total_amount"
            print(f"✓ Admin can view {len(data)} orders")

    def test_admin_filter_orders_by_status(self, admin_token):
        """Admin can filter orders by status"""
        # Test filtering by pending status
        response = requests.get(
            f"{BASE_URL}/api/admin/orders?status=pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Filter orders failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Filtered orders should be a list"
        # Verify all returned orders have the filtered status
        for order in data:
            assert order.get("status") == "pending", f"Order status should be pending, got {order.get('status')}"
        print(f"✓ Admin filtered orders by status=pending, found {len(data)}")

    def test_admin_filter_orders_by_payment_status(self, admin_token):
        """Admin can filter orders by payment status"""
        response = requests.get(
            f"{BASE_URL}/api/admin/orders?payment_status=pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Filter by payment status failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin filtered by payment_status=pending, found {len(data)}")


class TestVendorOrderManagement:
    """Test Vendor Order Management and Shipping endpoints"""

    def test_vendor_get_orders(self, vendor_token):
        """Vendor can view their orders"""
        response = requests.get(
            f"{BASE_URL}/api/vendor/orders",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        assert response.status_code == 200, f"Get vendor orders failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Vendor orders should be a list"
        print(f"✓ Vendor can view {len(data)} orders")
        return data

    def test_vendor_update_order_status_valid_statuses(self, vendor_token):
        """Vendor can update order status with valid status values"""
        # First get vendor's orders
        orders_response = requests.get(
            f"{BASE_URL}/api/vendor/orders",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No vendor orders to test status update")
        
        order_id = orders[0]["id"]
        current_status = orders[0]["status"]
        
        # Test updating to "processing" status
        response = requests.put(
            f"{BASE_URL}/api/vendor/orders/{order_id}/status?status=processing",
            json={},
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        assert response.status_code == 200, f"Update status failed: {response.text}"
        print(f"✓ Vendor updated order {order_id[:8]} status to 'processing'")

    def test_vendor_update_order_status_invalid_status(self, vendor_token):
        """Vendor receives 400 error for invalid status"""
        # First get vendor's orders
        orders_response = requests.get(
            f"{BASE_URL}/api/vendor/orders",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No vendor orders to test")
        
        order_id = orders[0]["id"]
        
        # Test with invalid status
        response = requests.put(
            f"{BASE_URL}/api/vendor/orders/{order_id}/status?status=invalid_status",
            json={},
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        assert response.status_code == 400, f"Should return 400 for invalid status, got {response.status_code}"
        print("✓ Invalid status correctly rejected with 400")

    def test_vendor_update_shipping_info(self, vendor_token):
        """Vendor can add/update shipping information"""
        # First get vendor's orders
        orders_response = requests.get(
            f"{BASE_URL}/api/vendor/orders",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No vendor orders to test shipping update")
        
        order_id = orders[0]["id"]
        
        # Update shipping information
        shipping_data = {
            "tracking_number": "TEST123456789",
            "carrier": "FedEx",
            "estimated_delivery": "2026-02-28"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/vendor/orders/{order_id}/shipping",
            json=shipping_data,
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        assert response.status_code == 200, f"Update shipping failed: {response.text}"
        
        # Verify shipping data was saved
        updated_order = response.json()
        assert updated_order.get("tracking_number") == "TEST123456789", "Tracking number not saved"
        assert updated_order.get("carrier") == "FedEx", "Carrier not saved"
        assert updated_order.get("estimated_delivery") == "2026-02-28", "Estimated delivery not saved"
        print(f"✓ Vendor updated shipping info for order {order_id[:8]}")

    def test_vendor_get_order_detail(self, vendor_token):
        """Vendor can view order detail"""
        # First get vendor's orders
        orders_response = requests.get(
            f"{BASE_URL}/api/vendor/orders",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No vendor orders to test")
        
        order_id = orders[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/vendor/orders/{order_id}",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        assert response.status_code == 200, f"Get order detail failed: {response.text}"
        
        order = response.json()
        assert order.get("id") == order_id
        assert "clinic_name" in order, "Order detail should include clinic_name"
        print(f"✓ Vendor can view order detail for {order_id[:8]}")


class TestClinicOrderTracking:
    """Test Clinic Order Tracking endpoints"""

    def test_clinic_get_orders(self, clinic_token):
        """Clinic can view their orders"""
        response = requests.get(
            f"{BASE_URL}/api/clinic/orders",
            headers={"Authorization": f"Bearer {clinic_token}"}
        )
        assert response.status_code == 200, f"Get clinic orders failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Clinic orders should be a list"
        
        # Verify vendor_name is included in orders
        if len(data) > 0:
            assert "vendor_name" in data[0], "Orders should include vendor_name"
        print(f"✓ Clinic can view {len(data)} orders")
        return data

    def test_clinic_get_order_detail_with_tracking(self, clinic_token):
        """Clinic can view order detail with tracking info"""
        # First get clinic's orders
        orders_response = requests.get(
            f"{BASE_URL}/api/clinic/orders",
            headers={"Authorization": f"Bearer {clinic_token}"}
        )
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No clinic orders to test")
        
        order_id = orders[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/clinic/orders/{order_id}",
            headers={"Authorization": f"Bearer {clinic_token}"}
        )
        assert response.status_code == 200, f"Get order detail failed: {response.text}"
        
        order = response.json()
        assert order.get("id") == order_id
        assert "vendor_name" in order, "Order detail should include vendor_name"
        assert "status" in order, "Order detail should include status"
        
        # Check for tracking fields (may or may not have values)
        tracking_fields = ["tracking_number", "carrier", "estimated_delivery"]
        for field in tracking_fields:
            # Fields should exist in response (even if None)
            if order.get("tracking_number"):
                print(f"  - Has tracking: {order.get('carrier')} {order.get('tracking_number')}")
        
        print(f"✓ Clinic can view order detail for {order_id[:8]}")


class TestAdminOrderDetail:
    """Test Admin Order Detail endpoint"""

    def test_admin_get_order_detail(self, admin_token):
        """Admin can view detailed order information"""
        # First get all orders
        orders_response = requests.get(
            f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No orders to test detail view")
        
        order_id = orders[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/admin/orders/{order_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Get order detail failed: {response.text}"
        
        order = response.json()
        assert order.get("id") == order_id
        assert "clinic_name" in order, "Should include clinic_name"
        assert "vendor_name" in order, "Should include vendor_name"
        assert "clinic_email" in order, "Should include clinic_email"
        assert "vendor_email" in order, "Should include vendor_email"
        print(f"✓ Admin can view detailed order info for {order_id[:8]}")

    def test_admin_order_not_found(self, admin_token):
        """Admin receives 404 for non-existent order"""
        response = requests.get(
            f"{BASE_URL}/api/admin/orders/nonexistent-order-id",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404, f"Should return 404, got {response.status_code}"
        print("✓ Non-existent order correctly returns 404")


class TestStatusFlowValidation:
    """Test order status flow: pending -> confirmed -> processing -> shipped -> delivered"""

    def test_status_to_shipped_adds_timestamp(self, vendor_token):
        """When status is set to 'shipped', shipped_at timestamp should be added"""
        # Get vendor orders
        orders_response = requests.get(
            f"{BASE_URL}/api/vendor/orders",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No orders to test")
        
        order_id = orders[0]["id"]
        
        # Update to shipped
        response = requests.put(
            f"{BASE_URL}/api/vendor/orders/{order_id}/status?status=shipped",
            json={},
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        assert response.status_code == 200, f"Update to shipped failed: {response.text}"
        
        # Get order detail to verify timestamp
        detail_response = requests.get(
            f"{BASE_URL}/api/vendor/orders/{order_id}",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        order = detail_response.json()
        assert order.get("shipped_at") is not None, "shipped_at timestamp should be set"
        print(f"✓ shipped_at timestamp added when status=shipped")

    def test_status_to_delivered_adds_timestamp(self, vendor_token):
        """When status is set to 'delivered', delivered_at timestamp should be added"""
        # Get vendor orders
        orders_response = requests.get(
            f"{BASE_URL}/api/vendor/orders",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No orders to test")
        
        order_id = orders[0]["id"]
        
        # Update to delivered
        response = requests.put(
            f"{BASE_URL}/api/vendor/orders/{order_id}/status?status=delivered",
            json={},
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        assert response.status_code == 200, f"Update to delivered failed: {response.text}"
        
        # Get order detail to verify timestamp
        detail_response = requests.get(
            f"{BASE_URL}/api/vendor/orders/{order_id}",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        order = detail_response.json()
        assert order.get("delivered_at") is not None, "delivered_at timestamp should be set"
        print(f"✓ delivered_at timestamp added when status=delivered")


class TestAuthorizationChecks:
    """Test that endpoints are properly protected"""

    def test_admin_orders_requires_auth(self):
        """Admin orders endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print("✓ Admin orders endpoint protected")

    def test_vendor_orders_requires_auth(self):
        """Vendor orders endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/vendor/orders")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print("✓ Vendor orders endpoint protected")

    def test_clinic_orders_requires_auth(self):
        """Clinic orders endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/clinic/orders")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print("✓ Clinic orders endpoint protected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
