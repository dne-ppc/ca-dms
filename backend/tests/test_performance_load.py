"""
Performance Load Testing for Document Operations

Following TDD methodology for Task PERF.1: Document Operations Load Testing
- Test 100 concurrent document creations
- Test response time requirements (<200ms)  
- Test throughput measurements
"""

import pytest
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.models.document import Document
from app.models.user import User, UserRole
from app.schemas.document import DocumentCreate
from sqlalchemy.orm import Session
from sqlalchemy import text
import statistics


client = TestClient(app)


class LoadTestResults:
    """Container for load test metrics"""
    
    def __init__(self):
        self.response_times: List[float] = []
        self.successful_requests = 0
        self.failed_requests = 0
        self.total_requests = 0
        self.start_time: float = 0
        self.end_time: float = 0
    
    @property
    def duration(self) -> float:
        return self.end_time - self.start_time
    
    @property
    def throughput(self) -> float:
        """Requests per second"""
        return self.total_requests / self.duration if self.duration > 0 else 0
    
    @property
    def average_response_time(self) -> float:
        """Average response time in milliseconds"""
        return statistics.mean(self.response_times) * 1000 if self.response_times else 0
    
    @property
    def p95_response_time(self) -> float:
        """95th percentile response time in milliseconds"""
        if not self.response_times:
            return 0
        sorted_times = sorted(self.response_times)
        index = int(0.95 * len(sorted_times))
        return sorted_times[index] * 1000
    
    @property
    def success_rate(self) -> float:
        """Success rate as percentage"""
        return (self.successful_requests / self.total_requests) * 100 if self.total_requests > 0 else 0


@pytest.fixture
def test_user_token():
    """Create test user and return authentication token for load testing"""
    # Register a test user
    user_data = {
        "username": "loadtestuser", 
        "email": "loadtest@example.com",
        "password": "loadtest123",
        "full_name": "Load Test User",
        "role": "admin"
    }
    
    # Register the user using proper registration endpoint
    register_response = client.post("/api/v1/auth/register", json=user_data)
    if register_response.status_code == 400:
        # User might already exist, that's fine for load testing
        pass
    elif register_response.status_code not in [200, 201]:
        # Registration failed, let's check if the user already exists by trying login
        pass
    
    # For load testing, we need to verify the user manually in the database
    # since we don't want to deal with email verification flows
    import sqlite3
    try:
        conn = sqlite3.connect('ca_dms.db')
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET is_verified = 1 WHERE email = ?", (user_data["email"],))
        conn.commit()
        conn.close()
    except Exception:
        # If database update fails, continue anyway
        pass
    
    # Login to get token
    login_data = {
        "email": user_data["email"],
        "password": user_data["password"]
    }
    
    login_response = client.post("/api/v1/auth/login", json=login_data)
    if login_response.status_code != 200:
        pytest.fail(f"Failed to login: {login_response.json()}")
    
    token_data = login_response.json()
    return {
        "token": token_data["access_token"],
        "user": token_data["user"],
        "headers": {"Authorization": f"Bearer {token_data['access_token']}"}
    }


def create_document_request(user_id: int, doc_number: int) -> Dict[str, Any]:
    """Create a document creation request payload"""
    return {
        "title": f"Load Test Document {doc_number}",
        "content": {
            "ops": [
                {"insert": f"This is load test document number {doc_number}\n"},
                {"insert": "Testing concurrent document creation performance.\n"}
            ]
        },
        "document_type": "board_resolution",
        "placeholders": {},  # Should be a dictionary, not an array
        "created_by": user_id
    }


def single_document_create_test(user_id: int, doc_number: int, auth_headers: dict) -> Dict[str, Any]:
    """Perform single document creation and measure response time"""
    start_time = time.time()
    
    try:
        payload = create_document_request(user_id, doc_number)
        response = client.post("/api/v1/documents/", json=payload, headers=auth_headers)
        
        end_time = time.time()
        response_time = end_time - start_time
        
        return {
            "success": response.status_code in [200, 201],  # Accept both 200 and 201 as success
            "status_code": response.status_code,
            "response_time": response_time,
            "doc_number": doc_number,
            "response_data": response.json() if response.status_code in [200, 201] else None,
            "error": response.text if response.status_code not in [200, 201] else None
        }
        
    except Exception as e:
        end_time = time.time()
        response_time = end_time - start_time
        
        return {
            "success": False,
            "status_code": 500,
            "response_time": response_time,
            "doc_number": doc_number,
            "response_data": None,
            "error": str(e)
        }


class TestDocumentOperationsLoad:
    """
    Load testing for document CRUD operations
    
    Requirements from Task PERF.1:
    - Test 100 concurrent document creations
    - Test response time requirements (<200ms)
    - Test throughput measurements
    """
    
    def test_concurrent_document_creation_load(self, test_user_token):
        """
        Test: document CRUD operations under load
        
        Requirements:
        - 100 concurrent document creations
        - Response time < 200ms (95th percentile)
        - Measure throughput (requests/second)
        - Success rate > 95%
        """
        # This test will initially fail as the system is not optimized for load
        
        load_results = LoadTestResults()
        concurrent_requests = 100
        max_workers = 20  # Limit concurrent threads to avoid overwhelming system
        
        print(f"\n🚀 Starting load test: {concurrent_requests} concurrent document creations")
        
        load_results.start_time = time.time()
        
        # Execute concurrent document creation requests
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all requests
            future_to_doc = {
                executor.submit(single_document_create_test, test_user_token["user"]["id"], i, test_user_token["headers"]): i 
                for i in range(1, concurrent_requests + 1)
            }
            
            # Collect results
            for future in as_completed(future_to_doc):
                doc_number = future_to_doc[future]
                try:
                    result = future.result()
                    load_results.total_requests += 1
                    load_results.response_times.append(result["response_time"])
                    
                    if result["success"]:
                        load_results.successful_requests += 1
                    else:
                        load_results.failed_requests += 1
                        print(f"❌ Document {doc_number} failed: {result['error']}")
                        
                except Exception as e:
                    load_results.total_requests += 1
                    load_results.failed_requests += 1
                    print(f"❌ Exception for document {doc_number}: {str(e)}")
        
        load_results.end_time = time.time()
        
        # Print detailed results
        print(f"\n📊 Load Test Results:")
        print(f"   Total Requests: {load_results.total_requests}")
        print(f"   Successful: {load_results.successful_requests}")
        print(f"   Failed: {load_results.failed_requests}")
        print(f"   Success Rate: {load_results.success_rate:.1f}%")
        print(f"   Duration: {load_results.duration:.2f} seconds")
        print(f"   Throughput: {load_results.throughput:.2f} req/sec")
        print(f"   Average Response Time: {load_results.average_response_time:.2f}ms")
        print(f"   95th Percentile Response Time: {load_results.p95_response_time:.2f}ms")
        
        # Performance assertions (these will initially fail)
        # This follows TDD - we write the failing test first
        
        # Requirement: Success rate > 95%
        assert load_results.success_rate > 95.0, (
            f"Success rate {load_results.success_rate:.1f}% is below required 95%"
        )
        
        # Requirement: 95th percentile response time < 200ms
        assert load_results.p95_response_time < 200.0, (
            f"95th percentile response time {load_results.p95_response_time:.2f}ms exceeds 200ms limit"
        )
        
        # Requirement: Minimum throughput of 10 req/sec under load
        assert load_results.throughput > 10.0, (
            f"Throughput {load_results.throughput:.2f} req/sec is below minimum 10 req/sec"
        )
        
        # Requirement: All requests should complete
        assert load_results.total_requests == concurrent_requests, (
            f"Expected {concurrent_requests} requests, got {load_results.total_requests}"
        )
    
    def test_document_read_operations_load(self, test_user_token):
        """
        Test: document read operations under load
        
        Requirements:
        - 200 concurrent document read requests
        - Response time < 100ms (95th percentile) for reads
        - Higher throughput for read operations
        """
        # Create some test documents first
        test_docs = []
        for i in range(10):
            payload = create_document_request(test_user_token["user"]["id"], i)
            response = client.post("/api/v1/documents/", json=payload, headers=test_user_token["headers"])
            if response.status_code == 201:
                test_docs.append(response.json()["id"])
        
        assert len(test_docs) > 0, "Failed to create test documents for read load testing"
        
        load_results = LoadTestResults()
        concurrent_requests = 200
        max_workers = 50  # Higher concurrency for read operations
        
        print(f"\n🚀 Starting read load test: {concurrent_requests} concurrent document reads")
        
        def single_document_read_test(doc_id: int, request_number: int) -> Dict[str, Any]:
            """Perform single document read and measure response time"""
            start_time = time.time()
            
            try:
                response = client.get(f"/api/v1/documents/{doc_id}", headers=test_user_token["headers"])
                end_time = time.time()
                response_time = end_time - start_time
                
                return {
                    "success": response.status_code == 200,
                    "status_code": response.status_code,
                    "response_time": response_time,
                    "request_number": request_number
                }
                
            except Exception as e:
                end_time = time.time()
                response_time = end_time - start_time
                
                return {
                    "success": False,
                    "status_code": 500,
                    "response_time": response_time,
                    "request_number": request_number,
                    "error": str(e)
                }
        
        load_results.start_time = time.time()
        
        # Execute concurrent document read requests
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all requests (randomly distribute across test documents)
            import random
            future_to_request = {
                executor.submit(
                    single_document_read_test, 
                    random.choice(test_docs), 
                    i
                ): i for i in range(1, concurrent_requests + 1)
            }
            
            # Collect results
            for future in as_completed(future_to_request):
                request_number = future_to_request[future]
                try:
                    result = future.result()
                    load_results.total_requests += 1
                    load_results.response_times.append(result["response_time"])
                    
                    if result["success"]:
                        load_results.successful_requests += 1
                    else:
                        load_results.failed_requests += 1
                        
                except Exception as e:
                    load_results.total_requests += 1
                    load_results.failed_requests += 1
        
        load_results.end_time = time.time()
        
        # Print results
        print(f"\n📊 Read Load Test Results:")
        print(f"   Total Requests: {load_results.total_requests}")
        print(f"   Successful: {load_results.successful_requests}")
        print(f"   Failed: {load_results.failed_requests}")
        print(f"   Success Rate: {load_results.success_rate:.1f}%")
        print(f"   Duration: {load_results.duration:.2f} seconds")
        print(f"   Throughput: {load_results.throughput:.2f} req/sec")
        print(f"   Average Response Time: {load_results.average_response_time:.2f}ms")
        print(f"   95th Percentile Response Time: {load_results.p95_response_time:.2f}ms")
        
        # Performance assertions for read operations (more stringent)
        assert load_results.success_rate > 98.0, (
            f"Read success rate {load_results.success_rate:.1f}% is below required 98%"
        )
        
        assert load_results.p95_response_time < 100.0, (
            f"Read 95th percentile response time {load_results.p95_response_time:.2f}ms exceeds 100ms limit"
        )
        
        assert load_results.throughput > 50.0, (
            f"Read throughput {load_results.throughput:.2f} req/sec is below minimum 50 req/sec"
        )
    
    def test_mixed_crud_operations_load(self, test_user_token):
        """
        Test: mixed CRUD operations under load
        
        Simulates realistic usage patterns with mixed operations:
        - 40% read operations
        - 30% create operations  
        - 20% update operations
        - 10% delete operations
        """
        # This test represents realistic load patterns
        # Will initially fail until system is optimized
        
        load_results = LoadTestResults()
        total_operations = 100
        max_workers = 20
        
        # Define operation mix
        read_ops = int(total_operations * 0.4)    # 40%
        create_ops = int(total_operations * 0.3)  # 30%
        update_ops = int(total_operations * 0.2)  # 20%
        delete_ops = int(total_operations * 0.1)  # 10%
        
        print(f"\n🚀 Starting mixed CRUD load test:")
        print(f"   Read operations: {read_ops}")
        print(f"   Create operations: {create_ops}")
        print(f"   Update operations: {update_ops}")
        print(f"   Delete operations: {delete_ops}")
        
        # Create some initial documents for update/delete operations
        initial_docs = []
        for i in range(update_ops + delete_ops):
            payload = create_document_request(test_user_token["user"]["id"], i)
            response = client.post("/api/v1/documents/", json=payload, headers=test_user_token["headers"])
            if response.status_code == 201:
                initial_docs.append(response.json()["id"])
        
        def mixed_operation_test(op_type: str, op_number: int, doc_id: int = None) -> Dict[str, Any]:
            """Perform mixed CRUD operations"""
            start_time = time.time()
            
            try:
                if op_type == "read":
                    response = client.get(f"/api/v1/documents/{doc_id}", headers=test_user_token["headers"])
                    expected_status = 200
                    
                elif op_type == "create":
                    payload = create_document_request(test_user_token["user"]["id"], op_number)
                    response = client.post("/api/v1/documents/", json=payload, headers=test_user_token["headers"])
                    expected_status = 201
                    
                elif op_type == "update":
                    payload = {
                        "title": f"Updated Document {op_number}",
                        "content": {"ops": [{"insert": f"Updated content {op_number}\n"}]}
                    }
                    response = client.put(f"/api/v1/documents/{doc_id}", json=payload, headers=test_user_token["headers"])
                    expected_status = 200
                    
                elif op_type == "delete":
                    response = client.delete(f"/api/v1/documents/{doc_id}", headers=test_user_token["headers"])
                    expected_status = 204
                    
                else:
                    raise ValueError(f"Unknown operation type: {op_type}")
                
                end_time = time.time()
                response_time = end_time - start_time
                
                return {
                    "success": response.status_code == expected_status,
                    "status_code": response.status_code,
                    "response_time": response_time,
                    "operation": op_type,
                    "op_number": op_number
                }
                
            except Exception as e:
                end_time = time.time()
                response_time = end_time - start_time
                
                return {
                    "success": False,
                    "status_code": 500,
                    "response_time": response_time,
                    "operation": op_type,
                    "op_number": op_number,
                    "error": str(e)
                }
        
        load_results.start_time = time.time()
        
        # Build operation queue
        operations = []
        doc_index = 0
        
        # Add read operations
        for i in range(read_ops):
            doc_id = initial_docs[i % len(initial_docs)] if initial_docs else None
            operations.append(("read", i, doc_id))
        
        # Add create operations
        for i in range(create_ops):
            operations.append(("create", i, None))
        
        # Add update operations
        for i in range(update_ops):
            doc_id = initial_docs[doc_index % len(initial_docs)] if initial_docs else None
            operations.append(("update", i, doc_id))
            doc_index += 1
        
        # Add delete operations
        for i in range(delete_ops):
            doc_id = initial_docs[doc_index % len(initial_docs)] if initial_docs else None
            operations.append(("delete", i, doc_id))
            doc_index += 1
        
        # Shuffle operations to simulate realistic mixed load
        import random
        random.shuffle(operations)
        
        # Execute mixed operations
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_op = {
                executor.submit(mixed_operation_test, op_type, op_num, doc_id): (op_type, op_num)
                for op_type, op_num, doc_id in operations
            }
            
            # Collect results
            for future in as_completed(future_to_op):
                op_type, op_num = future_to_op[future]
                try:
                    result = future.result()
                    load_results.total_requests += 1
                    load_results.response_times.append(result["response_time"])
                    
                    if result["success"]:
                        load_results.successful_requests += 1
                    else:
                        load_results.failed_requests += 1
                        
                except Exception as e:
                    load_results.total_requests += 1
                    load_results.failed_requests += 1
        
        load_results.end_time = time.time()
        
        # Print results
        print(f"\n📊 Mixed CRUD Load Test Results:")
        print(f"   Total Operations: {load_results.total_requests}")
        print(f"   Successful: {load_results.successful_requests}")
        print(f"   Failed: {load_results.failed_requests}")
        print(f"   Success Rate: {load_results.success_rate:.1f}%")
        print(f"   Duration: {load_results.duration:.2f} seconds")
        print(f"   Throughput: {load_results.throughput:.2f} ops/sec")
        print(f"   Average Response Time: {load_results.average_response_time:.2f}ms")
        print(f"   95th Percentile Response Time: {load_results.p95_response_time:.2f}ms")
        
        # Mixed operations performance requirements
        assert load_results.success_rate > 90.0, (
            f"Mixed ops success rate {load_results.success_rate:.1f}% is below required 90%"
        )
        
        assert load_results.p95_response_time < 300.0, (
            f"Mixed ops 95th percentile response time {load_results.p95_response_time:.2f}ms exceeds 300ms limit"
        )
        
        assert load_results.throughput > 8.0, (
            f"Mixed ops throughput {load_results.throughput:.2f} ops/sec is below minimum 8 ops/sec"
        )


if __name__ == "__main__":
    # Allow running performance tests directly
    pytest.main([__file__, "-v", "-s"])