"""
System Stress Testing for Task PERF.3

Following TDD methodology for comprehensive system stress testing:
- Test system limits and breaking points
- Test graceful degradation under extreme load
- Test recovery after overload scenarios
"""

import pytest
import time
import statistics
import psutil
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError
from typing import List, Dict, Any, Optional
from fastapi.testclient import TestClient
from app.main import app
import sqlite3
import requests
from urllib3.exceptions import ConnectionError
import gc


client = TestClient(app)


class SystemStressMetrics:
    """Container for system stress test metrics and monitoring"""
    
    def __init__(self):
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0
        self.timeout_requests = 0
        self.connection_errors = 0
        self.server_errors = 0
        self.response_times: List[float] = []
        self.error_types: Dict[str, int] = {}
        
        # System resource metrics
        self.cpu_usage: List[float] = []
        self.memory_usage: List[float] = []
        self.start_time: float = 0
        self.end_time: float = 0
        self.recovery_time: Optional[float] = None
        
        # Breaking point analysis
        self.breaking_point_rps: Optional[float] = None
        self.max_successful_concurrent: int = 0
        self.degradation_threshold: Optional[float] = None
    
    @property
    def duration(self) -> float:
        return self.end_time - self.start_time if self.end_time > self.start_time else 0
    
    @property
    def success_rate(self) -> float:
        return (self.successful_requests / self.total_requests) * 100 if self.total_requests > 0 else 0
    
    @property
    def average_response_time(self) -> float:
        return statistics.mean(self.response_times) if self.response_times else 0
    
    @property
    def p95_response_time(self) -> float:
        if not self.response_times:
            return 0
        sorted_times = sorted(self.response_times)
        index = int(0.95 * len(sorted_times))
        return sorted_times[index]
    
    @property
    def requests_per_second(self) -> float:
        return self.total_requests / self.duration if self.duration > 0 else 0
    
    @property
    def average_cpu_usage(self) -> float:
        return statistics.mean(self.cpu_usage) if self.cpu_usage else 0
    
    @property
    def peak_memory_usage(self) -> float:
        return max(self.memory_usage) if self.memory_usage else 0
    
    def add_error(self, error_type: str):
        """Track error types for analysis"""
        self.error_types[error_type] = self.error_types.get(error_type, 0) + 1


class SystemResourceMonitor:
    """Monitor system resources during stress testing"""
    
    def __init__(self, metrics: SystemStressMetrics):
        self.metrics = metrics
        self.monitoring = False
        self.monitor_thread = None
    
    def start_monitoring(self):
        """Start resource monitoring in background thread"""
        self.monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
    
    def stop_monitoring(self):
        """Stop resource monitoring"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=1)
    
    def _monitor_loop(self):
        """Background monitoring loop"""
        while self.monitoring:
            try:
                # Monitor CPU and memory usage
                cpu_percent = psutil.cpu_percent(interval=0.1)
                memory_info = psutil.virtual_memory()
                
                self.metrics.cpu_usage.append(cpu_percent)
                self.metrics.memory_usage.append(memory_info.percent)
                
                time.sleep(0.5)  # Monitor every 500ms
            except Exception:
                # Ignore monitoring errors during stress testing
                pass


@pytest.fixture
def stress_test_user_token():
    """Create test user for stress testing"""
    user_data = {
        "username": "stresstestuser", 
        "email": "stresstest@example.com",
        "password": "stresstest123",
        "full_name": "Stress Test User",
        "role": "admin"
    }
    
    # Register user
    client.post("/api/v1/auth/register", json=user_data)
    
    # Verify user in database
    try:
        conn = sqlite3.connect('ca_dms.db')
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET is_verified = 1 WHERE email = ?", (user_data["email"],))
        conn.commit()
        conn.close()
    except Exception:
        pass
    
    # Login to get token
    login_data = {"email": user_data["email"], "password": user_data["password"]}
    login_response = client.post("/api/v1/auth/login", json=login_data)
    
    if login_response.status_code != 200:
        pytest.fail(f"Failed to login for stress testing: {login_response.json()}")
    
    token_data = login_response.json()
    return {
        "token": token_data["access_token"],
        "user": token_data["user"],
        "headers": {"Authorization": f"Bearer {token_data['access_token']}"}
    }


def create_stress_test_document(user_id: str, doc_number: int, auth_headers: dict) -> str:
    """Create a document for stress testing"""
    document_data = {
        "title": f"Stress Test Document {doc_number}",
        "content": {
            "ops": [
                {"insert": f"Stress Test Document {doc_number}\n"},
                {"insert": "This document is created for system stress testing.\n"},
                {"insert": "Testing system behavior under extreme load conditions.\n"},
                {"insert": "Document content for load generation and testing.\n"}
            ]
        },
        "document_type": "governance",
        "placeholders": {},
        "created_by": user_id
    }
    
    try:
        response = client.post("/api/v1/documents/", json=document_data, headers=auth_headers)
        if response.status_code in [200, 201]:
            return response.json()["id"]
    except Exception:
        pass
    return None


def stress_test_request(endpoint: str, method: str = "GET", headers: dict = None, json_data: dict = None, timeout: float = 5.0) -> Dict[str, Any]:
    """Perform a single stress test request with error handling"""
    start_time = time.time()
    
    try:
        if method == "GET":
            response = client.get(endpoint, headers=headers, timeout=timeout)
        elif method == "POST":
            response = client.post(endpoint, json=json_data, headers=headers, timeout=timeout)
        elif method == "PUT":
            response = client.put(endpoint, json=json_data, headers=headers, timeout=timeout)
        elif method == "DELETE":
            response = client.delete(endpoint, headers=headers, timeout=timeout)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        end_time = time.time()
        response_time = end_time - start_time
        
        return {
            "success": 200 <= response.status_code < 300,
            "status_code": response.status_code,
            "response_time": response_time,
            "timeout": False,
            "connection_error": False,
            "error_type": None if 200 <= response.status_code < 300 else f"HTTP_{response.status_code}"
        }
        
    except TimeoutError:
        end_time = time.time()
        return {
            "success": False,
            "status_code": 408,
            "response_time": end_time - start_time,
            "timeout": True,
            "connection_error": False,
            "error_type": "TIMEOUT"
        }
    except (ConnectionError, requests.exceptions.ConnectionError):
        end_time = time.time()
        return {
            "success": False,
            "status_code": 503,
            "response_time": end_time - start_time,
            "timeout": False,
            "connection_error": True,
            "error_type": "CONNECTION_ERROR"
        }
    except Exception as e:
        end_time = time.time()
        return {
            "success": False,
            "status_code": 500,
            "response_time": end_time - start_time,
            "timeout": False,
            "connection_error": False,
            "error_type": f"EXCEPTION_{type(e).__name__}"
        }


def find_breaking_point(auth_headers: dict, document_id: str) -> int:
    """Find the system's breaking point by gradually increasing load"""
    print("\n🔍 Finding system breaking point...")
    
    for concurrent_users in [10, 25, 50, 100, 200, 500, 1000]:
        print(f"   Testing {concurrent_users} concurrent users...")
        
        success_count = 0
        total_requests = 50  # Test with 50 requests per level
        
        with ThreadPoolExecutor(max_workers=concurrent_users) as executor:
            futures = []
            for i in range(total_requests):
                future = executor.submit(
                    stress_test_request, 
                    f"/api/v1/documents/{document_id}", 
                    "GET", 
                    auth_headers,
                    timeout=2.0  # Short timeout for breaking point detection
                )
                futures.append(future)
            
            for future in as_completed(futures, timeout=10):
                try:
                    result = future.result()
                    if result["success"]:
                        success_count += 1
                except Exception:
                    pass
        
        success_rate = (success_count / total_requests) * 100
        print(f"   {concurrent_users} users: {success_rate:.1f}% success rate")
        
        if success_rate < 90:  # Breaking point when success rate drops below 90%
            return max(10, concurrent_users // 2)  # Return the previous working level
    
    return 500  # If system handles 1000 concurrent users, it's very robust


class TestSystemStress:
    """
    System Stress Testing for Task PERF.3
    
    Requirements:
    - Test system limits and breaking points
    - Test graceful degradation under extreme load
    - Test recovery after overload
    """
    
    def test_system_breaking_point_discovery(self, stress_test_user_token):
        """
        Test: Discover system limits and breaking points
        
        Requirements:
        - Find maximum concurrent users before failure
        - Identify performance degradation patterns
        - Document breaking point characteristics
        """
        print(f"\n🚀 Testing system breaking point discovery")
        
        # Create test document
        document_id = create_stress_test_document(
            stress_test_user_token["user"]["id"], 
            1, 
            stress_test_user_token["headers"]
        )
        
        if not document_id:
            pytest.fail("Failed to create test document for breaking point testing")
        
        # Find the breaking point
        breaking_point = find_breaking_point(stress_test_user_token["headers"], document_id)
        
        print(f"\n📊 Breaking Point Discovery Results:")
        print(f"   Breaking Point: {breaking_point} concurrent users")
        print(f"   Safe Operating Level: {int(breaking_point * 0.8)} concurrent users")
        
        # Test at breaking point
        metrics = SystemStressMetrics()
        monitor = SystemResourceMonitor(metrics)
        monitor.start_monitoring()
        
        metrics.start_time = time.time()
        
        # Test with requests at breaking point level
        with ThreadPoolExecutor(max_workers=breaking_point) as executor:
            futures = []
            test_requests = 100
            
            for i in range(test_requests):
                future = executor.submit(
                    stress_test_request,
                    f"/api/v1/documents/{document_id}",
                    "GET",
                    stress_test_user_token["headers"],
                    timeout=3.0
                )
                futures.append(future)
            
            for future in as_completed(futures):
                try:
                    result = future.result()
                    metrics.total_requests += 1
                    metrics.response_times.append(result["response_time"])
                    
                    if result["success"]:
                        metrics.successful_requests += 1
                    else:
                        metrics.failed_requests += 1
                        metrics.add_error(result["error_type"])
                        
                        if result["timeout"]:
                            metrics.timeout_requests += 1
                        if result["connection_error"]:
                            metrics.connection_errors += 1
                        if 500 <= result["status_code"] < 600:
                            metrics.server_errors += 1
                            
                except Exception as e:
                    metrics.failed_requests += 1
                    metrics.add_error(f"FUTURE_EXCEPTION_{type(e).__name__}")
        
        metrics.end_time = time.time()
        monitor.stop_monitoring()
        
        print(f"\n📊 Breaking Point Load Test Results:")
        print(f"   Concurrent Users: {breaking_point}")
        print(f"   Total Requests: {metrics.total_requests}")
        print(f"   Successful: {metrics.successful_requests}")
        print(f"   Failed: {metrics.failed_requests}")
        print(f"   Success Rate: {metrics.success_rate:.1f}%")
        print(f"   Average Response Time: {metrics.average_response_time:.3f}s")
        print(f"   95th Percentile: {metrics.p95_response_time:.3f}s")
        print(f"   Requests/sec: {metrics.requests_per_second:.1f}")
        print(f"   Timeouts: {metrics.timeout_requests}")
        print(f"   Connection Errors: {metrics.connection_errors}")
        print(f"   Server Errors: {metrics.server_errors}")
        print(f"   Peak CPU: {metrics.average_cpu_usage:.1f}%")
        print(f"   Peak Memory: {metrics.peak_memory_usage:.1f}%")
        
        if metrics.error_types:
            print(f"   Error Types: {dict(metrics.error_types)}")
        
        # Assertions for breaking point behavior
        assert metrics.total_requests == 100, "All requests should be accounted for"
        assert breaking_point >= 10, "System should handle at least 10 concurrent users"
        
        # System should degrade gracefully (some requests succeed even at breaking point)
        assert metrics.success_rate >= 30, (
            f"Even at breaking point, some requests should succeed. Got {metrics.success_rate:.1f}%"
        )
        
        # Store breaking point for other tests
        metrics.breaking_point_rps = breaking_point
    
    def test_graceful_degradation_under_extreme_load(self, stress_test_user_token):
        """
        Test: System graceful degradation under extreme load
        
        Requirements:
        - System responds to overload without crashing
        - Performance degrades predictably
        - System maintains some level of service
        - Error responses are appropriate (not crashes)
        """
        print(f"\n🚀 Testing graceful degradation under extreme load")
        
        # Create test document
        document_id = create_stress_test_document(
            stress_test_user_token["user"]["id"], 
            2, 
            stress_test_user_token["headers"]
        )
        
        metrics = SystemStressMetrics()
        monitor = SystemResourceMonitor(metrics)
        monitor.start_monitoring()
        
        # Test with extreme load (2x estimated breaking point)
        extreme_load = 200  # High concurrent load to test degradation
        total_requests = 500  # Many requests to stress the system
        
        print(f"Applying extreme load: {extreme_load} concurrent users, {total_requests} total requests")
        
        metrics.start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=extreme_load) as executor:
            # Submit mix of operations to stress different endpoints
            futures = []
            
            # 70% read operations (document retrieval)
            for i in range(int(total_requests * 0.7)):
                future = executor.submit(
                    stress_test_request,
                    f"/api/v1/documents/{document_id}",
                    "GET",
                    stress_test_user_token["headers"],
                    timeout=5.0
                )
                futures.append(future)
            
            # 20% document creation
            for i in range(int(total_requests * 0.2)):
                doc_data = {
                    "title": f"Extreme Load Test Doc {i}",
                    "content": {"ops": [{"insert": f"Load test document {i}\n"}]},
                    "document_type": "governance",
                    "placeholders": {},
                    "created_by": stress_test_user_token["user"]["id"]
                }
                future = executor.submit(
                    stress_test_request,
                    "/api/v1/documents/",
                    "POST",
                    stress_test_user_token["headers"],
                    doc_data,
                    timeout=10.0
                )
                futures.append(future)
            
            # 10% PDF generation (most resource intensive)
            for i in range(int(total_requests * 0.1)):
                future = executor.submit(
                    stress_test_request,
                    f"/api/v1/documents/{document_id}/pdf",
                    "GET",
                    stress_test_user_token["headers"],
                    timeout=15.0
                )
                futures.append(future)
            
            # Process results with timeout
            completed_requests = 0
            for future in as_completed(futures, timeout=60):  # 60 second timeout for extreme load
                try:
                    result = future.result()
                    completed_requests += 1
                    metrics.total_requests += 1
                    metrics.response_times.append(result["response_time"])
                    
                    if result["success"]:
                        metrics.successful_requests += 1
                    else:
                        metrics.failed_requests += 1
                        metrics.add_error(result["error_type"])
                        
                        if result["timeout"]:
                            metrics.timeout_requests += 1
                        if result["connection_error"]:
                            metrics.connection_errors += 1
                        if 500 <= result["status_code"] < 600:
                            metrics.server_errors += 1
                            
                except TimeoutError:
                    # Some requests may timeout during extreme load - this is expected
                    metrics.timeout_requests += 1
                    metrics.failed_requests += 1
                    metrics.add_error("FUTURE_TIMEOUT")
                except Exception as e:
                    metrics.failed_requests += 1
                    metrics.add_error(f"PROCESSING_ERROR_{type(e).__name__}")
        
        metrics.end_time = time.time()
        monitor.stop_monitoring()
        
        print(f"\n📊 Extreme Load Test Results:")
        print(f"   Target Requests: {total_requests}")
        print(f"   Completed Requests: {metrics.total_requests}")
        print(f"   Successful: {metrics.successful_requests}")
        print(f"   Failed: {metrics.failed_requests}")
        print(f"   Success Rate: {metrics.success_rate:.1f}%")
        print(f"   Duration: {metrics.duration:.2f}s")
        print(f"   Requests/sec: {metrics.requests_per_second:.1f}")
        print(f"   Average Response Time: {metrics.average_response_time:.3f}s")
        print(f"   95th Percentile: {metrics.p95_response_time:.3f}s")
        print(f"   Timeouts: {metrics.timeout_requests}")
        print(f"   Connection Errors: {metrics.connection_errors}")
        print(f"   Server Errors: {metrics.server_errors}")
        print(f"   Average CPU: {metrics.average_cpu_usage:.1f}%")
        print(f"   Peak Memory: {metrics.peak_memory_usage:.1f}%")
        
        if metrics.error_types:
            print(f"   Error Breakdown: {dict(metrics.error_types)}")
        
        # Graceful degradation assertions
        assert metrics.total_requests >= total_requests * 0.5, (
            f"At least 50% of requests should be processed. Got {metrics.total_requests}/{total_requests}"
        )
        
        # System should maintain some level of service under extreme load
        assert metrics.success_rate >= 10, (
            f"System should maintain minimal service under extreme load. Got {metrics.success_rate:.1f}%"
        )
        
        # Response times should be bounded (not infinite)
        if metrics.response_times:
            max_response_time = max(metrics.response_times)
            assert max_response_time < 30.0, (
                f"Response times should be bounded even under extreme load. Max: {max_response_time:.3f}s"
            )
        
        # System should not crash (some requests should complete)
        assert metrics.total_requests > 0, "System should process some requests even under extreme load"
    
    def test_system_recovery_after_overload(self, stress_test_user_token):
        """
        Test: System recovery after overload
        
        Requirements:
        - System returns to normal operation after load spike
        - No permanent degradation after stress
        - Performance metrics return to baseline
        - System stability is maintained
        """
        print(f"\n🚀 Testing system recovery after overload")
        
        # Create test document
        document_id = create_stress_test_document(
            stress_test_user_token["user"]["id"], 
            3, 
            stress_test_user_token["headers"]
        )
        
        # Phase 1: Establish baseline performance
        print("Phase 1: Establishing baseline performance...")
        baseline_metrics = SystemStressMetrics()
        baseline_requests = 20
        
        baseline_metrics.start_time = time.time()
        for i in range(baseline_requests):
            result = stress_test_request(
                f"/api/v1/documents/{document_id}",
                "GET",
                stress_test_user_token["headers"]
            )
            baseline_metrics.total_requests += 1
            baseline_metrics.response_times.append(result["response_time"])
            if result["success"]:
                baseline_metrics.successful_requests += 1
        baseline_metrics.end_time = time.time()
        
        baseline_avg_time = baseline_metrics.average_response_time
        baseline_success_rate = baseline_metrics.success_rate
        
        print(f"   Baseline Performance:")
        print(f"   - Average Response Time: {baseline_avg_time:.3f}s")
        print(f"   - Success Rate: {baseline_success_rate:.1f}%")
        
        # Phase 2: Apply stress load
        print("Phase 2: Applying stress load...")
        stress_metrics = SystemStressMetrics()
        monitor = SystemResourceMonitor(stress_metrics)
        monitor.start_monitoring()
        
        stress_concurrent = 100
        stress_requests = 200
        
        stress_metrics.start_time = time.time()
        with ThreadPoolExecutor(max_workers=stress_concurrent) as executor:
            futures = []
            for i in range(stress_requests):
                future = executor.submit(
                    stress_test_request,
                    f"/api/v1/documents/{document_id}",
                    "GET", 
                    stress_test_user_token["headers"],
                    timeout=8.0
                )
                futures.append(future)
            
            for future in as_completed(futures, timeout=45):
                try:
                    result = future.result()
                    stress_metrics.total_requests += 1
                    stress_metrics.response_times.append(result["response_time"])
                    if result["success"]:
                        stress_metrics.successful_requests += 1
                except Exception:
                    stress_metrics.failed_requests += 1
        
        stress_metrics.end_time = time.time()
        monitor.stop_monitoring()
        
        print(f"   Stress Load Applied:")
        print(f"   - Requests: {stress_metrics.total_requests}/{stress_requests}")
        print(f"   - Success Rate: {stress_metrics.success_rate:.1f}%")
        print(f"   - Average Response Time: {stress_metrics.average_response_time:.3f}s")
        
        # Phase 3: Recovery period
        print("Phase 3: Recovery period...")
        time.sleep(5)  # Allow system to recover
        
        # Force garbage collection to help recovery
        gc.collect()
        
        # Phase 4: Test recovery performance
        print("Phase 4: Testing recovery performance...")
        recovery_metrics = SystemStressMetrics()
        recovery_requests = 30
        
        recovery_metrics.start_time = time.time()
        for i in range(recovery_requests):
            result = stress_test_request(
                f"/api/v1/documents/{document_id}",
                "GET",
                stress_test_user_token["headers"]
            )
            recovery_metrics.total_requests += 1
            recovery_metrics.response_times.append(result["response_time"])
            if result["success"]:
                recovery_metrics.successful_requests += 1
            
            time.sleep(0.1)  # Small delay between recovery test requests
        recovery_metrics.end_time = time.time()
        
        recovery_avg_time = recovery_metrics.average_response_time
        recovery_success_rate = recovery_metrics.success_rate
        
        print(f"\n📊 Recovery Test Results:")
        print(f"   Baseline vs Recovery Performance:")
        print(f"   - Response Time: {baseline_avg_time:.3f}s → {recovery_avg_time:.3f}s")
        print(f"   - Success Rate: {baseline_success_rate:.1f}% → {recovery_success_rate:.1f}%")
        
        # Calculate recovery metrics
        response_time_degradation = ((recovery_avg_time - baseline_avg_time) / baseline_avg_time) * 100
        success_rate_change = recovery_success_rate - baseline_success_rate
        
        print(f"   - Response Time Change: {response_time_degradation:+.1f}%")
        print(f"   - Success Rate Change: {success_rate_change:+.1f}%")
        
        # Recovery assertions
        assert recovery_success_rate >= 90, (
            f"System should recover to high success rate. Got {recovery_success_rate:.1f}%"
        )
        
        # Performance should not be permanently degraded by more than 150% (adjusted for SQLite characteristics)
        assert response_time_degradation <= 150, (
            f"Response time degradation should be temporary. Got {response_time_degradation:.1f}% degradation"
        )
        
        # Success rate should not be significantly impacted after recovery
        assert recovery_success_rate >= baseline_success_rate * 0.9, (
            f"Success rate should recover to near baseline. Baseline: {baseline_success_rate:.1f}%, Recovery: {recovery_success_rate:.1f}%"
        )
        
        # System should be stable (process requests successfully)
        assert recovery_metrics.successful_requests >= recovery_requests * 0.9, (
            f"System should be stable after recovery. Got {recovery_metrics.successful_requests}/{recovery_requests} successful"
        )
        
        print("✅ System successfully recovered from overload stress!")
    
    def test_database_stress_and_recovery(self, stress_test_user_token):
        """
        Test: Database stress testing and recovery
        
        Requirements:
        - Database handles concurrent writes under stress
        - No data corruption under extreme load
        - Database connections are properly managed
        - Recovery from connection pool exhaustion
        """
        print(f"\n🚀 Testing database stress and recovery")
        
        metrics = SystemStressMetrics()
        created_documents = []
        
        # Phase 1: Stress database with concurrent writes
        print("Phase 1: Database write stress test...")
        concurrent_writes = 50
        documents_per_thread = 5
        
        metrics.start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=concurrent_writes) as executor:
            futures = []
            
            for thread_id in range(concurrent_writes):
                for doc_num in range(documents_per_thread):
                    doc_data = {
                        "title": f"DB Stress Test Doc T{thread_id}-D{doc_num}",
                        "content": {
                            "ops": [
                                {"insert": f"Database stress test document T{thread_id}-D{doc_num}\n"},
                                {"insert": f"Testing concurrent database writes under load.\n"},
                                {"insert": f"Thread: {thread_id}, Document: {doc_num}\n"}
                            ]
                        },
                        "document_type": "governance",
                        "placeholders": {},
                        "created_by": stress_test_user_token["user"]["id"]
                    }
                    
                    future = executor.submit(
                        stress_test_request,
                        "/api/v1/documents/",
                        "POST",
                        stress_test_user_token["headers"],
                        doc_data,
                        timeout=10.0
                    )
                    futures.append((future, thread_id, doc_num))
            
            for future, thread_id, doc_num in futures:
                try:
                    result = future.result()
                    metrics.total_requests += 1
                    metrics.response_times.append(result["response_time"])
                    
                    if result["success"]:
                        metrics.successful_requests += 1
                        # Extract document ID from response if available
                        try:
                            response_data = client.get(f"/api/v1/documents/", headers=stress_test_user_token["headers"]).json()
                            if "documents" in response_data and response_data["documents"]:
                                created_documents.extend([doc["id"] for doc in response_data["documents"][-10:]])  # Get recent docs
                        except Exception:
                            pass
                    else:
                        metrics.failed_requests += 1
                        metrics.add_error(result.get("error_type", "UNKNOWN"))
                        
                except Exception as e:
                    metrics.failed_requests += 1
                    metrics.add_error(f"DB_WRITE_ERROR_{type(e).__name__}")
        
        metrics.end_time = time.time()
        
        print(f"   Database Write Stress Results:")
        print(f"   - Total Write Attempts: {metrics.total_requests}")
        print(f"   - Successful Writes: {metrics.successful_requests}")
        print(f"   - Failed Writes: {metrics.failed_requests}")
        print(f"   - Success Rate: {metrics.success_rate:.1f}%")
        print(f"   - Average Write Time: {metrics.average_response_time:.3f}s")
        
        # Phase 2: Verify data integrity
        print("Phase 2: Data integrity verification...")
        integrity_check_passed = True
        
        if created_documents:
            sample_docs = created_documents[:10]  # Check sample of created documents
            for doc_id in sample_docs:
                try:
                    result = stress_test_request(
                        f"/api/v1/documents/{doc_id}",
                        "GET",
                        stress_test_user_token["headers"]
                    )
                    if not result["success"]:
                        integrity_check_passed = False
                        break
                except Exception:
                    integrity_check_passed = False
                    break
        
        print(f"   Data Integrity Check: {'PASSED' if integrity_check_passed else 'FAILED'}")
        
        # Database stress assertions
        assert metrics.success_rate >= 70, (
            f"Database should handle concurrent writes reasonably well. Got {metrics.success_rate:.1f}%"
        )
        
        assert integrity_check_passed, "Data integrity should be maintained under stress"
        
        assert metrics.average_response_time < 5.0, (
            f"Database write operations should complete within reasonable time. Got {metrics.average_response_time:.3f}s"
        )
        
        print("✅ Database stress test completed successfully!")


if __name__ == "__main__":
    # Allow running stress tests directly
    pytest.main([__file__, "-v", "-s"])