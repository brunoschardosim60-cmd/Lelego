#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime
import base64

# Backend URL from environment
BACKEND_URL = "https://realtime-matching.preview.emergentagent.com/api"

class LetsGoAPITester:
    def __init__(self):
        self.admin_token = None
        self.user_token = None
        self.test_results = []
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })
    
    def test_admin_login(self):
        """Test admin login with provided credentials"""
        print("🔐 Testing Admin Login...")
        
        try:
            response = requests.post(f"{BACKEND_URL}/auth/login", json={
                "email": "brunoschardosim60@gmail.com",
                "password": "Aa1234@Lets"
            })
            
            if response.status_code == 200:
                data = response.json()
                if data.get("user", {}).get("role") == "admin":
                    self.admin_token = data.get("access_token")
                    self.log_test("Admin Login", True, f"Admin user logged in successfully. Role: {data['user']['role']}")
                    return True
                else:
                    self.log_test("Admin Login", False, f"User role is not admin: {data.get('user', {}).get('role')}", data)
                    return False
            else:
                self.log_test("Admin Login", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
            return False
    
    def test_cpf_validation(self):
        """Test CPF validation during registration"""
        print("📋 Testing CPF Validation...")
        
        # Test invalid CPF (all zeros)
        try:
            response = requests.post(f"{BACKEND_URL}/auth/register", json={
                "name": "Test User Invalid CPF",
                "email": "test_invalid_cpf@example.com",
                "phone": "11999999999",
                "gender": "male",
                "cpf": "00000000000",
                "password": "TestPass123!",
                "role": "passenger"
            })
            
            if response.status_code == 400:
                self.log_test("CPF Validation - Invalid CPF Rejection", True, "Invalid CPF '00000000000' correctly rejected")
            else:
                self.log_test("CPF Validation - Invalid CPF Rejection", False, f"Invalid CPF should be rejected but got HTTP {response.status_code}", response.text)
        
        except Exception as e:
            self.log_test("CPF Validation - Invalid CPF Rejection", False, f"Exception: {str(e)}")
        
        # Test valid CPF (using a mathematically valid CPF)
        try:
            valid_cpf = "11144477735"  # This is a different valid CPF according to the algorithm
            timestamp = int(datetime.now().timestamp())
            response = requests.post(f"{BACKEND_URL}/auth/register", json={
                "name": "Test User Valid CPF",
                "email": f"test_valid_cpf_{timestamp}@example.com",
                "phone": f"119999{timestamp % 10000:04d}",
                "gender": "female",
                "cpf": valid_cpf,
                "password": "TestPass123!",
                "role": "passenger"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.user_token = data.get("access_token")
                self.log_test("CPF Validation - Valid CPF Acceptance", True, f"Valid CPF '{valid_cpf}' correctly accepted")
                return True
            else:
                self.log_test("CPF Validation - Valid CPF Acceptance", False, f"Valid CPF should be accepted but got HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("CPF Validation - Valid CPF Acceptance", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_dashboard(self):
        """Test admin dashboard endpoint"""
        print("📊 Testing Admin Dashboard...")
        
        if not self.admin_token:
            self.log_test("Admin Dashboard", False, "No admin token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{BACKEND_URL}/admin/dashboard", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["total_users", "total_drivers", "pending_drivers", "total_rides", "completed_rides", "cancelled_rides", "total_revenue", "app_earnings"]
                
                missing_fields = [field for field in required_fields if field not in data]
                if not missing_fields:
                    self.log_test("Admin Dashboard", True, f"Dashboard returned all required stats. Total users: {data['total_users']}, Total rides: {data['total_rides']}")
                    return True
                else:
                    self.log_test("Admin Dashboard", False, f"Missing fields: {missing_fields}", data)
                    return False
            else:
                self.log_test("Admin Dashboard", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Admin Dashboard", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_users(self):
        """Test admin users endpoint"""
        print("👥 Testing Admin Users...")
        
        if not self.admin_token:
            self.log_test("Admin Users", False, "No admin token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{BACKEND_URL}/admin/users", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "users" in data and "total" in data:
                    users = data["users"]
                    total = data["total"]
                    self.log_test("Admin Users", True, f"Retrieved {len(users)} users out of {total} total users")
                    return True
                else:
                    self.log_test("Admin Users", False, "Response missing 'users' or 'total' fields", data)
                    return False
            else:
                self.log_test("Admin Users", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Admin Users", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_rides(self):
        """Test admin rides endpoint"""
        print("🚗 Testing Admin Rides...")
        
        if not self.admin_token:
            self.log_test("Admin Rides", False, "No admin token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{BACKEND_URL}/admin/rides", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "rides" in data and "total" in data:
                    rides = data["rides"]
                    total = data["total"]
                    self.log_test("Admin Rides", True, f"Retrieved {len(rides)} rides out of {total} total rides")
                    return True
                else:
                    self.log_test("Admin Rides", False, "Response missing 'rides' or 'total' fields", data)
                    return False
            else:
                self.log_test("Admin Rides", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Admin Rides", False, f"Exception: {str(e)}")
            return False
    
    def test_driver_application(self):
        """Test driver application endpoint"""
        print("🚙 Testing Driver Application...")
        
        if not self.user_token:
            self.log_test("Driver Application", False, "No user token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # Create base64 encoded dummy images
            dummy_image = base64.b64encode(b"dummy_image_data").decode()
            
            application_data = {
                "vehicle_type": "car",
                "vehicle_color": "Branco",
                "vehicle_plate": "ABC1234",
                "vehicle_model": "Honda Civic 2020",
                "state": "SP",
                "cnh_photo": dummy_image,
                "face_photo": dummy_image,
                "vehicle_photo": dummy_image
            }
            
            response = requests.post(f"{BACKEND_URL}/driver/apply", json=application_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_test("Driver Application", True, f"Driver application submitted successfully: {data['message']}")
                    return True
                else:
                    self.log_test("Driver Application", False, "Response missing 'message' field", data)
                    return False
            else:
                self.log_test("Driver Application", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Driver Application", False, f"Exception: {str(e)}")
            return False
    
    def test_ranking_system(self):
        """Test ranking system endpoints"""
        print("🏆 Testing Ranking System...")
        
        if not self.user_token:
            self.log_test("Ranking System", False, "No user token available")
            return False
        
        success_count = 0
        
        # Test Brazil ranking
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = requests.get(f"{BACKEND_URL}/ranking/brazil", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Brazil Ranking", True, f"Retrieved Brazil ranking with {len(data)} drivers")
                    success_count += 1
                else:
                    self.log_test("Brazil Ranking", False, "Response is not a list", data)
            else:
                self.log_test("Brazil Ranking", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Brazil Ranking", False, f"Exception: {str(e)}")
        
        # Test São Paulo state ranking
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = requests.get(f"{BACKEND_URL}/ranking/state/SP", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("São Paulo State Ranking", True, f"Retrieved SP state ranking with {len(data)} drivers")
                    success_count += 1
                else:
                    self.log_test("São Paulo State Ranking", False, "Response is not a list", data)
            else:
                self.log_test("São Paulo State Ranking", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("São Paulo State Ranking", False, f"Exception: {str(e)}")
        
        return success_count == 2
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting LetsGo v2.0 Backend API Tests")
        print("=" * 50)
        
        # Test admin login first (required for admin endpoints)
        admin_login_success = self.test_admin_login()
        
        # Test CPF validation (also creates a user for driver application)
        cpf_validation_success = self.test_cpf_validation()
        
        # Test admin endpoints (require admin token)
        if admin_login_success:
            self.test_admin_dashboard()
            self.test_admin_users()
            self.test_admin_rides()
        else:
            print("⚠️  Skipping admin endpoints due to admin login failure")
        
        # Test driver application (requires user token)
        if cpf_validation_success:
            self.test_driver_application()
            self.test_ranking_system()
        else:
            print("⚠️  Skipping user endpoints due to user registration failure")
        
        # Print summary
        print("=" * 50)
        print("📋 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = LetsGoAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)