#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
from typing import Dict, List, Optional

class VIDAIMarketplaceAPITester:
    def __init__(self, base_url="https://clinic-shop-preview.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api"
        self.admin_token = None
        self.vendor_token = None
        self.clinic_token = None
        self.vendor_id = None
        self.clinic_id = None
        self.product_id = None
        self.order_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def make_request(self, method, endpoint, data=None, token=None, expected_status=None):
        """Make HTTP request and return response"""
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
            
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return None, f"Unsupported method: {method}"
                
            if expected_status and response.status_code != expected_status:
                return None, f"Expected {expected_status}, got {response.status_code}: {response.text}"
                
            return response, None
        except Exception as e:
            return None, f"Request failed: {str(e)}"

    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Test root endpoint
        response, error = self.make_request('GET', '/', expected_status=200)
        if response:
            self.log_test("Root API endpoint", True)
        else:
            self.log_test("Root API endpoint", False, error)
            
        # Test health endpoint
        response, error = self.make_request('GET', '/health', expected_status=200)
        if response:
            self.log_test("Health check endpoint", True)
        else:
            self.log_test("Health check endpoint", False, error)

    def test_admin_login(self):
        """Test admin login"""
        print("\n🔍 Testing Admin Authentication...")
        
        # Valid admin login
        data = {"username": "admin", "password": "vidai@01"}
        response, error = self.make_request('POST', '/admin/login', data, expected_status=200)
        
        if response and response.status_code == 200:
            result = response.json()
            if 'token' in result and result.get('role') == 'admin':
                self.admin_token = result['token']
                self.log_test("Admin login with valid credentials", True)
            else:
                self.log_test("Admin login with valid credentials", False, "Invalid response format")
        else:
            self.log_test("Admin login with valid credentials", False, error)
            
        # Invalid admin login
        data = {"username": "admin", "password": "wrong_password"}
        response, error = self.make_request('POST', '/admin/login', data)
        if response and response.status_code == 401:
            self.log_test("Admin login with invalid credentials", True)
        elif response and response.status_code != 200:
            self.log_test("Admin login with invalid credentials", True, f"Correctly rejected with {response.status_code}")
        else:
            self.log_test("Admin login with invalid credentials", False, f"Should return error, got {response.status_code if response else 'no response'}")

    def test_vendor_crud(self):
        """Test vendor CRUD operations"""
        print("\n🔍 Testing Vendor CRUD Operations...")
        
        if not self.admin_token:
            self.log_test("Vendor CRUD operations", False, "No admin token available")
            return
            
        # Create vendor
        vendor_data = {
            "name": "John Doe",
            "email": f"test_vendor_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "vendor123",
            "company_name": "Test Vendor Corp",
            "phone": "+1234567890"
        }
        
        response, error = self.make_request('POST', '/admin/vendors', vendor_data, self.admin_token, 200)
        if response and response.status_code == 200:
            result = response.json()
            self.vendor_id = result.get('id')
            self.vendor_email = vendor_data['email']
            self.log_test("Create vendor", True)
        else:
            self.log_test("Create vendor", False, error)
            return
            
        # Get all vendors
        response, error = self.make_request('GET', '/admin/vendors', token=self.admin_token, expected_status=200)
        if response and response.status_code == 200:
            vendors = response.json()
            if isinstance(vendors, list) and len(vendors) > 0:
                self.log_test("Get all vendors", True)
            else:
                self.log_test("Get all vendors", False, "Empty vendor list")
        else:
            self.log_test("Get all vendors", False, error)
            
        # Test vendor login
        if self.vendor_id:
            login_data = {"email": self.vendor_email, "password": "vendor123"}
            response, error = self.make_request('POST', '/vendor/login', login_data, expected_status=200)
            if response and response.status_code == 200:
                result = response.json()
                if 'token' in result:
                    self.vendor_token = result['token']
                    self.log_test("Vendor login", True)
                else:
                    self.log_test("Vendor login", False, "No token in response")
            else:
                self.log_test("Vendor login", False, error)

    def test_clinic_crud(self):
        """Test clinic CRUD operations"""
        print("\n🔍 Testing Clinic CRUD Operations...")
        
        if not self.admin_token:
            self.log_test("Clinic CRUD operations", False, "No admin token available")
            return
            
        # Create clinic
        clinic_data = {
            "name": "Dr. Jane Smith",
            "email": f"test_clinic_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "clinic123",
            "clinic_name": "Test IVF Clinic",
            "phone": "+1234567891",
            "billing_address": "123 Main St",
            "shipping_address": "123 Main St",
            "city": "Test City",
            "state": "CA",
            "zip_code": "12345",
            "country": "USA"
        }
        
        response, error = self.make_request('POST', '/admin/clinics', clinic_data, self.admin_token, 200)
        if response and response.status_code == 200:
            result = response.json()
            self.clinic_id = result.get('id')
            self.clinic_email = clinic_data['email']
            self.log_test("Create clinic", True)
        else:
            self.log_test("Create clinic", False, error)
            return
            
        # Get all clinics
        response, error = self.make_request('GET', '/admin/clinics', token=self.admin_token, expected_status=200)
        if response and response.status_code == 200:
            clinics = response.json()
            if isinstance(clinics, list) and len(clinics) > 0:
                self.log_test("Get all clinics", True)
            else:
                self.log_test("Get all clinics", False, "Empty clinic list")
        else:
            self.log_test("Get all clinics", False, error)
            
        # Test clinic login
        if self.clinic_id:
            login_data = {"email": self.clinic_email, "password": "clinic123"}
            response, error = self.make_request('POST', '/clinic/login', login_data, expected_status=200)
            if response and response.status_code == 200:
                result = response.json()
                if 'token' in result:
                    self.clinic_token = result['token']
                    self.log_test("Clinic login", True)
                else:
                    self.log_test("Clinic login", False, "No token in response")
            else:
                self.log_test("Clinic login", False, error)

    def test_vendor_assignment(self):
        """Test assigning vendors to clinics"""
        print("\n🔍 Testing Vendor Assignment...")
        
        if not self.admin_token or not self.vendor_id or not self.clinic_id:
            self.log_test("Vendor assignment", False, "Missing required IDs or tokens")
            return
            
        # Assign vendor to clinic
        assignment_data = {
            "clinic_id": self.clinic_id,
            "vendor_ids": [self.vendor_id]
        }
        
        response, error = self.make_request('POST', '/admin/assign-vendors', assignment_data, self.admin_token, 200)
        if response and response.status_code == 200:
            self.log_test("Assign vendor to clinic", True)
        else:
            self.log_test("Assign vendor to clinic", False, error)
            
        # Get clinic assignments
        response, error = self.make_request('GET', f'/admin/clinic/{self.clinic_id}/assignments', token=self.admin_token, expected_status=200)
        if response and response.status_code == 200:
            result = response.json()
            if self.vendor_id in result.get('assigned_vendors', []):
                self.log_test("Verify vendor assignment", True)
            else:
                self.log_test("Verify vendor assignment", False, "Vendor not in assigned list")
        else:
            self.log_test("Verify vendor assignment", False, error)

    def test_product_management(self):
        """Test vendor product management"""
        print("\n🔍 Testing Product Management...")
        
        if not self.vendor_token:
            self.log_test("Product management", False, "No vendor token available")
            return
            
        # Create product
        product_data = {
            "name": "Test Embryo Media",
            "description": "High-quality culture medium for embryo development",
            "price": 299.99,
            "category": "Media & Solutions",
            "sku": f"TEM-{datetime.now().strftime('%H%M%S')}",
            "stock_quantity": 50,
            "image_url": "https://example.com/media.jpg"
        }
        
        response, error = self.make_request('POST', '/vendor/products', product_data, self.vendor_token, 200)
        if response and response.status_code == 200:
            result = response.json()
            self.product_id = result.get('id')
            # Check that product defaults to pending approval
            if result.get('is_approved') == False:
                self.log_test("Create product (defaults to pending approval)", True)
            else:
                self.log_test("Create product (defaults to pending approval)", False, "Product should default to pending approval")
        else:
            self.log_test("Create product", False, error)
            return
            
        # Get vendor products
        response, error = self.make_request('GET', '/vendor/products', token=self.vendor_token, expected_status=200)
        if response and response.status_code == 200:
            products = response.json()
            if isinstance(products, list) and len(products) > 0:
                # Check approval status is visible
                product = products[0]
                if 'is_approved' in product:
                    self.log_test("Get vendor products (with approval status)", True)
                else:
                    self.log_test("Get vendor products (with approval status)", False, "Approval status missing")
            else:
                self.log_test("Get vendor products", False, "No products returned")
        else:
            self.log_test("Get vendor products", False, error)
            
        # Update product
        if self.product_id:
            update_data = {"price": 249.99, "stock_quantity": 45}
            response, error = self.make_request('PUT', f'/vendor/products/{self.product_id}', update_data, self.vendor_token, 200)
            if response and response.status_code == 200:
                self.log_test("Update product", True)
            else:
                self.log_test("Update product", False, error)

    def test_product_approval_workflow(self):
        """Test admin product approval workflow"""
        print("\n🔍 Testing Product Approval Workflow...")
        
        if not self.admin_token or not self.product_id:
            self.log_test("Product approval workflow", False, "Missing admin token or product ID")
            return
            
        # Get pending products
        response, error = self.make_request('GET', '/admin/products/pending', token=self.admin_token, expected_status=200)
        if response and response.status_code == 200:
            pending_products = response.json()
            if isinstance(pending_products, list) and len(pending_products) > 0:
                self.log_test("Get pending products", True)
            else:
                self.log_test("Get pending products", False, "No pending products found")
        else:
            self.log_test("Get pending products", False, error)
            
        # Get all products (admin view)
        response, error = self.make_request('GET', '/admin/products', token=self.admin_token, expected_status=200)
        if response and response.status_code == 200:
            all_products = response.json()
            if isinstance(all_products, list):
                self.log_test("Get all products (admin)", True)
            else:
                self.log_test("Get all products (admin)", False, "Invalid products response")
        else:
            self.log_test("Get all products (admin)", False, error)
            
        # Approve product
        approval_data = {"product_id": self.product_id, "approved": True}
        response, error = self.make_request('POST', '/admin/products/approve', approval_data, self.admin_token, 200)
        if response and response.status_code == 200:
            self.log_test("Approve product", True)
        else:
            self.log_test("Approve product", False, error)
            
        # Verify product is approved
        response, error = self.make_request('GET', '/vendor/products', token=self.vendor_token, expected_status=200)
        if response and response.status_code == 200:
            products = response.json()
            approved_product = next((p for p in products if p['id'] == self.product_id), None)
            if approved_product and approved_product.get('is_approved') == True:
                self.log_test("Verify product approved", True)
            else:
                self.log_test("Verify product approved", False, "Product not marked as approved")
        else:
            self.log_test("Verify product approved", False, error)

    def test_admin_marketplace(self):
        """Test admin marketplace endpoints"""
        print("\n🔍 Testing Admin Marketplace...")
        
        if not self.admin_token:
            self.log_test("Admin marketplace", False, "No admin token available")
            return
            
        # Get marketplace vendors
        response, error = self.make_request('GET', '/admin/marketplace/vendors', token=self.admin_token, expected_status=200)
        if response and response.status_code == 200:
            vendors = response.json()
            if isinstance(vendors, list):
                self.log_test("Get marketplace vendors (admin)", True)
            else:
                self.log_test("Get marketplace vendors (admin)", False, "Invalid vendors response")
        else:
            self.log_test("Get marketplace vendors (admin)", False, error)
            
        # Get marketplace categories
        response, error = self.make_request('GET', '/admin/marketplace/categories', token=self.admin_token, expected_status=200)
        if response and response.status_code == 200:
            categories = response.json()
            if isinstance(categories, list):
                self.log_test("Get marketplace categories (admin)", True)
            else:
                self.log_test("Get marketplace categories (admin)", False, "Invalid categories response")
        else:
            self.log_test("Get marketplace categories (admin)", False, error)
            
        # Get marketplace products
        response, error = self.make_request('GET', '/admin/marketplace/products', token=self.admin_token, expected_status=200)
        if response and response.status_code == 200:
            products = response.json()
            if isinstance(products, list):
                self.log_test("Get marketplace products (admin)", True)
            else:
                self.log_test("Get marketplace products (admin)", False, "Invalid products response")
        else:
            self.log_test("Get marketplace products (admin)", False, error)
            
        # Get vendor products (admin view)
        if self.vendor_id:
            response, error = self.make_request('GET', f'/admin/marketplace/vendors/{self.vendor_id}/products', token=self.admin_token, expected_status=200)
            if response and response.status_code == 200:
                products = response.json()
                if isinstance(products, list):
                    self.log_test("Get vendor products (admin marketplace)", True)
                else:
                    self.log_test("Get vendor products (admin marketplace)", False, "Invalid products response")
            else:
                self.log_test("Get vendor products (admin marketplace)", False, error)

    def test_category_filtering(self):
        """Test category filtering functionality"""
        print("\n🔍 Testing Category Filtering...")
        
        if not self.clinic_token or not self.vendor_id:
            self.log_test("Category filtering", False, "Missing clinic token or vendor ID")
            return
            
        # Get clinic categories
        response, error = self.make_request('GET', '/clinic/categories', token=self.clinic_token, expected_status=200)
        if response and response.status_code == 200:
            categories = response.json()
            if isinstance(categories, list):
                self.log_test("Get clinic categories", True)
            else:
                self.log_test("Get clinic categories", False, "Invalid categories response")
        else:
            self.log_test("Get clinic categories", False, error)
            
        # Get all clinic products
        response, error = self.make_request('GET', '/clinic/products', token=self.clinic_token, expected_status=200)
        if response and response.status_code == 200:
            products = response.json()
            if isinstance(products, list):
                self.log_test("Get all clinic products", True)
            else:
                self.log_test("Get all clinic products", False, "Invalid products response")
        else:
            self.log_test("Get all clinic products", False, error)
            
        # Test category filtering
        category = "Media & Solutions"
        response, error = self.make_request('GET', f'/clinic/vendors/{self.vendor_id}/products?category={category}', token=self.clinic_token, expected_status=200)
        if response and response.status_code == 200:
            filtered_products = response.json()
            if isinstance(filtered_products, list):
                self.log_test("Filter products by category", True)
            else:
                self.log_test("Filter products by category", False, "Invalid filtered products response")
        else:
            self.log_test("Filter products by category", False, error)

    def test_clinic_purchases(self):
        """Test clinic purchases functionality"""
        print("\n🔍 Testing Clinic Purchases...")
        
        if not self.clinic_token:
            self.log_test("Clinic purchases", False, "No clinic token available")
            return
            
        # Get clinic purchases (should be empty initially)
        response, error = self.make_request('GET', '/clinic/purchases', token=self.clinic_token, expected_status=200)
        if response and response.status_code == 200:
            purchases = response.json()
            if isinstance(purchases, list):
                self.log_test("Get clinic purchases", True)
            else:
                self.log_test("Get clinic purchases", False, "Invalid purchases response")
        else:
            self.log_test("Get clinic purchases", False, error)

    def test_marketplace_flow(self):
        """Test clinic marketplace functionality"""
        print("\n🔍 Testing Marketplace Flow...")
        
        if not self.clinic_token or not self.vendor_id:
            self.log_test("Marketplace flow", False, "Missing clinic token or vendor ID")
            return
            
        # Get assigned vendors
        response, error = self.make_request('GET', '/clinic/assigned-vendors', token=self.clinic_token, expected_status=200)
        if response and response.status_code == 200:
            vendors = response.json()
            if isinstance(vendors, list) and len(vendors) > 0:
                self.log_test("Get assigned vendors", True)
            else:
                self.log_test("Get assigned vendors", False, "No assigned vendors")
        else:
            self.log_test("Get assigned vendors", False, error)
            
        # Get vendor products for clinic (should only show approved products)
        response, error = self.make_request('GET', f'/clinic/vendors/{self.vendor_id}/products', token=self.clinic_token, expected_status=200)
        if response and response.status_code == 200:
            products = response.json()
            if isinstance(products, list):
                # Check that all products are approved
                all_approved = all(p.get('is_approved') == True for p in products)
                if all_approved or len(products) == 0:
                    self.log_test("Get vendor products for clinic (only approved)", True)
                else:
                    self.log_test("Get vendor products for clinic (only approved)", False, "Found unapproved products in clinic view")
            else:
                self.log_test("Get vendor products for clinic", False, "Invalid products response")
        else:
            self.log_test("Get vendor products for clinic", False, error)

    def test_order_creation(self):
        """Test order creation"""
        print("\n🔍 Testing Order Creation...")
        
        if not self.clinic_token or not self.product_id:
            self.log_test("Order creation", False, "Missing clinic token or product ID")
            return
            
        # Create order
        order_data = {
            "items": [{"product_id": self.product_id, "quantity": 2}],
            "billing_address": "123 Test St",
            "shipping_address": "123 Test St", 
            "city": "Test City",
            "state": "CA",
            "zip_code": "12345",
            "country": "USA"
        }
        
        response, error = self.make_request('POST', '/clinic/orders', order_data, self.clinic_token, 200)
        if response and response.status_code == 200:
            result = response.json()
            self.order_id = result.get('id')
            self.log_test("Create order", True)
        else:
            self.log_test("Create order", False, error)
            
        # Get clinic orders
        response, error = self.make_request('GET', '/clinic/orders', token=self.clinic_token, expected_status=200)
        if response and response.status_code == 200:
            orders = response.json()
            if isinstance(orders, list):
                self.log_test("Get clinic orders", True)
            else:
                self.log_test("Get clinic orders", False, "Invalid orders response")
        else:
            self.log_test("Get clinic orders", False, error)

    def test_stripe_checkout(self):
        """Test Stripe checkout session creation"""
        print("\n🔍 Testing Stripe Checkout...")
        
        if not self.clinic_token or not self.order_id:
            self.log_test("Stripe checkout", False, "Missing clinic token or order ID")
            return
            
        # Create checkout session
        checkout_data = {
            "order_id": self.order_id,
            "origin_url": self.base_url
        }
        
        response, error = self.make_request('POST', '/checkout/create-session', checkout_data, self.clinic_token)
        if response and response.status_code == 200:
            result = response.json()
            if 'checkout_url' in result and 'session_id' in result:
                self.log_test("Create Stripe checkout session", True)
            else:
                self.log_test("Create Stripe checkout session", False, "Missing checkout URL or session ID")
        else:
            # This might fail due to Stripe API key configuration, which is acceptable
            self.log_test("Create Stripe checkout session", False, f"Expected failure due to Stripe config: {error}")

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting VIDAI Marketplace API Tests")
        print(f"📍 Testing API: {self.api_url}")
        print("=" * 60)
        
        try:
            # Run test suites in order
            self.test_health_check()
            self.test_admin_login()
            self.test_vendor_crud()
            self.test_clinic_crud() 
            self.test_vendor_assignment()
            self.test_product_management()
            self.test_product_approval_workflow()
            self.test_admin_marketplace()
            self.test_category_filtering()
            self.test_clinic_purchases()
            self.test_marketplace_flow()
            self.test_order_creation()
            self.test_stripe_checkout()
            
        except Exception as e:
            print(f"❌ Fatal error during testing: {e}")
            
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"✅ Passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Failed: {self.tests_run - self.tests_passed}/{self.tests_run}")
        
        if self.tests_passed == self.tests_run:
            print("\n🎉 All tests passed! API is functioning correctly.")
            return 0
        else:
            print(f"\n⚠️  {self.tests_run - self.tests_passed} test(s) failed. Check the details above.")
            
            # Show failed tests
            failed_tests = [t for t in self.test_results if not t['success']]
            if failed_tests:
                print("\n❌ FAILED TESTS:")
                for test in failed_tests:
                    print(f"  • {test['test']}: {test['details']}")
                    
            return 1

def main():
    """Main test runner"""
    tester = VIDAIMarketplaceAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())