#!/usr/bin/env python3
"""
Backend tests for VIDAI IVF Marketplace - Inventory & Commission Module
Testing Admin Inventory, Admin Reports, and Vendor Inventory endpoints
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://clinic-shop-preview.preview.emergentagent.com').rstrip('/')
API_URL = f"{BASE_URL}/api"


class TestAdminInventoryAndCommission:
    """Test Admin Inventory and Commission Report endpoints"""
    
    admin_token = None
    vendor_token = None
    vendor_id = None
    product_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin and create test vendor/product"""
        # Admin login
        response = requests.post(f"{API_URL}/admin/login", json={
            "username": "admin",
            "password": "vidai@01"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        TestAdminInventoryAndCommission.admin_token = response.json()["token"]
        
    def get_admin_headers(self):
        return {"Authorization": f"Bearer {self.admin_token}"}
    
    def get_vendor_headers(self):
        return {"Authorization": f"Bearer {self.vendor_token}"}
    
    # ===== Admin Inventory Endpoint Tests =====
    
    def test_admin_inventory_endpoint_success(self):
        """Test GET /api/admin/inventory returns inventory data"""
        response = requests.get(
            f"{API_URL}/admin/inventory",
            headers=self.get_admin_headers()
        )
        assert response.status_code == 200, f"Failed to get inventory: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Inventory should be a list"
        
        # If there's data, verify structure
        if len(data) > 0:
            item = data[0]
            assert "product_id" in item, "Missing product_id"
            assert "product_name" in item, "Missing product_name"
            assert "sku" in item, "Missing sku"
            assert "price" in item, "Missing price"
            assert "stock_quantity" in item, "Missing stock_quantity"
            assert "vendor_id" in item, "Missing vendor_id"
            assert "vendor_name" in item, "Missing vendor_name"
            assert "commission_rate" in item, "Missing commission_rate"
            assert "commission_amount" in item, "Missing commission_amount"
            assert "vendor_amount" in item, "Missing vendor_amount"
            assert "is_approved" in item, "Missing is_approved"
            print(f"Inventory item structure validated: {item['product_name']}")
    
    def test_admin_inventory_vendor_filter(self):
        """Test GET /api/admin/inventory with vendor_id filter"""
        # First get all inventory to find a vendor_id
        response = requests.get(
            f"{API_URL}/admin/inventory",
            headers=self.get_admin_headers()
        )
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            vendor_id = data[0]["vendor_id"]
            
            # Now filter by vendor
            response = requests.get(
                f"{API_URL}/admin/inventory?vendor_id={vendor_id}",
                headers=self.get_admin_headers()
            )
            assert response.status_code == 200
            
            filtered_data = response.json()
            # All items should be from the same vendor
            for item in filtered_data:
                assert item["vendor_id"] == vendor_id, "Filter not working correctly"
            print(f"Vendor filter working - {len(filtered_data)} items from vendor {vendor_id}")
    
    def test_admin_inventory_requires_auth(self):
        """Test that inventory endpoint requires authentication"""
        response = requests.get(f"{API_URL}/admin/inventory")
        assert response.status_code in [401, 403], "Should require authentication"
    
    # ===== Admin Commission Report Tests =====
    
    def test_admin_commission_report_endpoint(self):
        """Test GET /api/admin/reports/commissions returns report data"""
        response = requests.get(
            f"{API_URL}/admin/reports/commissions",
            headers=self.get_admin_headers()
        )
        assert response.status_code == 200, f"Failed to get commission report: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "total_products" in data, "Missing total_products"
        assert "total_product_value" in data, "Missing total_product_value"
        assert "total_vidai_commission" in data, "Missing total_vidai_commission"
        assert "total_vendor_amount" in data, "Missing total_vendor_amount"
        assert "by_vendor" in data, "Missing by_vendor breakdown"
        
        # Verify totals are numbers
        assert isinstance(data["total_products"], int), "total_products should be int"
        assert isinstance(data["total_product_value"], (int, float)), "total_product_value should be numeric"
        assert isinstance(data["total_vidai_commission"], (int, float)), "total_vidai_commission should be numeric"
        assert isinstance(data["total_vendor_amount"], (int, float)), "total_vendor_amount should be numeric"
        
        # Verify by_vendor is a list
        assert isinstance(data["by_vendor"], list), "by_vendor should be a list"
        
        print(f"Commission Report: {data['total_products']} products, ${data['total_vidai_commission']} VIDAI commission")
    
    def test_admin_commission_report_by_vendor_structure(self):
        """Test that by_vendor breakdown has correct structure"""
        response = requests.get(
            f"{API_URL}/admin/reports/commissions",
            headers=self.get_admin_headers()
        )
        assert response.status_code == 200
        
        data = response.json()
        
        if len(data["by_vendor"]) > 0:
            vendor_data = data["by_vendor"][0]
            assert "vendor_id" in vendor_data, "Missing vendor_id in breakdown"
            assert "vendor_name" in vendor_data, "Missing vendor_name in breakdown"
            assert "product_count" in vendor_data, "Missing product_count in breakdown"
            assert "total_stock" in vendor_data, "Missing total_stock in breakdown"
            assert "total_value" in vendor_data, "Missing total_value in breakdown"
            assert "vidai_commission" in vendor_data, "Missing vidai_commission in breakdown"
            assert "vendor_amount" in vendor_data, "Missing vendor_amount in breakdown"
            print(f"Vendor breakdown validated: {vendor_data['vendor_name']} - {vendor_data['product_count']} products")
    
    def test_admin_commission_report_requires_auth(self):
        """Test that commission report endpoint requires authentication"""
        response = requests.get(f"{API_URL}/admin/reports/commissions")
        assert response.status_code in [401, 403], "Should require authentication"


class TestProductApprovalWithCommission:
    """Test Product Approval with Commission Rate Setting"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token"""
        response = requests.post(f"{API_URL}/admin/login", json={
            "username": "admin",
            "password": "vidai@01"
        })
        assert response.status_code == 200
        self.admin_token = response.json()["token"]
    
    def get_admin_headers(self):
        return {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_product_approval_with_custom_commission(self):
        """Test that product approval sets commission rate correctly"""
        # First, create a vendor and product to test with
        vendor_email = f"test_vendor_comm_{datetime.now().strftime('%H%M%S')}@test.com"
        
        # Create vendor
        response = requests.post(
            f"{API_URL}/admin/vendors",
            json={
                "name": "Test Vendor",
                "email": vendor_email,
                "password": "test123",
                "company_name": "Commission Test Corp"
            },
            headers=self.get_admin_headers()
        )
        assert response.status_code == 200, f"Failed to create vendor: {response.text}"
        vendor_id = response.json()["id"]
        
        # Login as vendor
        response = requests.post(f"{API_URL}/vendor/login", json={
            "email": vendor_email,
            "password": "test123"
        })
        assert response.status_code == 200
        vendor_token = response.json()["token"]
        vendor_headers = {"Authorization": f"Bearer {vendor_token}"}
        
        # Create a product
        product_data = {
            "name": "Commission Test Product",
            "description": "Testing commission rate",
            "price": 100.00,
            "category": "Equipment",
            "sku": f"CTP-{datetime.now().strftime('%H%M%S')}",
            "stock_quantity": 10
        }
        response = requests.post(
            f"{API_URL}/vendor/products",
            json=product_data,
            headers=vendor_headers
        )
        assert response.status_code == 200
        product_id = response.json()["id"]
        
        # Approve product with 15% commission
        approval_data = {
            "product_id": product_id,
            "approved": True,
            "commission_rate": 15.0
        }
        response = requests.post(
            f"{API_URL}/admin/products/approve",
            json=approval_data,
            headers=self.get_admin_headers()
        )
        assert response.status_code == 200, f"Failed to approve: {response.text}"
        
        result = response.json()
        assert "commission_rate" in result, "Should return commission_rate"
        assert result["commission_rate"] == 15.0, f"Commission rate should be 15%, got {result['commission_rate']}"
        assert "commission_amount" in result, "Should return commission_amount"
        assert result["commission_amount"] == 15.00, f"Commission amount should be $15.00 (15% of $100), got {result['commission_amount']}"
        assert "vendor_amount" in result, "Should return vendor_amount"
        assert result["vendor_amount"] == 85.00, f"Vendor amount should be $85.00, got {result['vendor_amount']}"
        
        print(f"Product approved with 15% commission: ${result['commission_amount']} commission, ${result['vendor_amount']} vendor")
        
        # Cleanup - delete product and vendor
        requests.delete(f"{API_URL}/vendor/products/{product_id}", headers=vendor_headers)
        requests.delete(f"{API_URL}/admin/vendors/{vendor_id}", headers=self.get_admin_headers())


class TestVendorInventory:
    """Test Vendor Inventory endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Create vendor and login"""
        # Admin login first
        response = requests.post(f"{API_URL}/admin/login", json={
            "username": "admin",
            "password": "vidai@01"
        })
        assert response.status_code == 200
        self.admin_token = response.json()["token"]
        
        # Try logging in with existing test vendor first
        response = requests.post(f"{API_URL}/vendor/login", json={
            "email": "vendor1@test.com",
            "password": "test123"
        })
        if response.status_code == 200:
            self.vendor_token = response.json()["token"]
            self.vendor_id = response.json().get("vendor_id")
        else:
            # Create test vendor
            vendor_email = f"test_vendor_inv_{datetime.now().strftime('%H%M%S')}@test.com"
            response = requests.post(
                f"{API_URL}/admin/vendors",
                json={
                    "name": "Inventory Test Vendor",
                    "email": vendor_email,
                    "password": "test123",
                    "company_name": "Inventory Test Corp"
                },
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            if response.status_code == 200:
                self.vendor_id = response.json()["id"]
                # Login as vendor
                response = requests.post(f"{API_URL}/vendor/login", json={
                    "email": vendor_email,
                    "password": "test123"
                })
                assert response.status_code == 200
                self.vendor_token = response.json()["token"]
            else:
                pytest.skip("Could not create test vendor")
    
    def get_vendor_headers(self):
        return {"Authorization": f"Bearer {self.vendor_token}"}
    
    def test_vendor_inventory_endpoint_success(self):
        """Test GET /api/vendor/inventory returns inventory data"""
        response = requests.get(
            f"{API_URL}/vendor/inventory",
            headers=self.get_vendor_headers()
        )
        assert response.status_code == 200, f"Failed to get vendor inventory: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "items" in data, "Missing items list"
        assert "summary" in data, "Missing summary"
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_products" in summary, "Missing total_products in summary"
        assert "total_stock_units" in summary, "Missing total_stock_units in summary"
        assert "total_stock_value" in summary, "Missing total_stock_value in summary"
        assert "total_vidai_commission" in summary, "Missing total_vidai_commission in summary"
        assert "total_vendor_earnings" in summary, "Missing total_vendor_earnings in summary"
        
        print(f"Vendor inventory: {summary['total_products']} products, ${summary['total_vendor_earnings']} potential earnings")
    
    def test_vendor_inventory_items_structure(self):
        """Test that inventory items have correct structure"""
        response = requests.get(
            f"{API_URL}/vendor/inventory",
            headers=self.get_vendor_headers()
        )
        assert response.status_code == 200
        
        data = response.json()
        
        if len(data["items"]) > 0:
            item = data["items"][0]
            assert "product_id" in item, "Missing product_id"
            assert "product_name" in item, "Missing product_name"
            assert "sku" in item, "Missing sku"
            assert "price" in item, "Missing price"
            assert "stock_quantity" in item, "Missing stock_quantity"
            assert "stock_value" in item, "Missing stock_value"
            assert "commission_rate" in item, "Missing commission_rate"
            assert "commission_amount" in item, "Missing commission_amount"
            assert "vendor_amount" in item, "Missing vendor_amount"
            assert "potential_earnings" in item, "Missing potential_earnings"
            assert "is_approved" in item, "Missing is_approved"
            print(f"Vendor inventory item validated: {item['product_name']} - ${item['potential_earnings']} potential")
    
    def test_vendor_inventory_requires_auth(self):
        """Test that vendor inventory endpoint requires authentication"""
        response = requests.get(f"{API_URL}/vendor/inventory")
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_vendor_inventory_requires_vendor_role(self):
        """Test that admin cannot access vendor inventory endpoint"""
        # Use admin token to try to access vendor inventory
        admin_response = requests.post(f"{API_URL}/admin/login", json={
            "username": "admin",
            "password": "vidai@01"
        })
        admin_token = admin_response.json()["token"]
        
        response = requests.get(
            f"{API_URL}/vendor/inventory",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 403, "Admin should not be able to access vendor inventory"


class TestSalesReport:
    """Test Admin Sales Report endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token"""
        response = requests.post(f"{API_URL}/admin/login", json={
            "username": "admin",
            "password": "vidai@01"
        })
        assert response.status_code == 200
        self.admin_token = response.json()["token"]
    
    def get_admin_headers(self):
        return {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_admin_sales_report_endpoint(self):
        """Test GET /api/admin/reports/sales returns sales data"""
        response = requests.get(
            f"{API_URL}/admin/reports/sales",
            headers=self.get_admin_headers()
        )
        assert response.status_code == 200, f"Failed to get sales report: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "total_orders" in data, "Missing total_orders"
        assert "total_sales" in data, "Missing total_sales"
        assert "total_vidai_commission" in data, "Missing total_vidai_commission"
        assert "total_vendor_earnings" in data, "Missing total_vendor_earnings"
        assert "by_vendor" in data, "Missing by_vendor breakdown"
        
        print(f"Sales Report: {data['total_orders']} orders, ${data['total_sales']} total sales")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
