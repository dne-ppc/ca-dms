"""
PDF Generation Performance Testing for Task PERF.2

Following TDD methodology for PDF generation performance testing:
- Test PDF generation with complex documents
- Test generation time requirements (<3s)
- Test concurrent PDF generation with multiple placeholders
"""

import pytest
import time
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.models.document import Document
from app.models.user import User, UserRole
import sqlite3


client = TestClient(app)


class PDFPerformanceResults:
    """Container for PDF performance test metrics"""
    
    def __init__(self):
        self.response_times: List[float] = []
        self.successful_generations = 0
        self.failed_generations = 0
        self.total_generations = 0
        self.start_time: float = 0
        self.end_time: float = 0
        self.pdf_sizes: List[int] = []  # Track PDF file sizes
    
    @property
    def duration(self) -> float:
        return self.end_time - self.start_time
    
    @property
    def throughput(self) -> float:
        """PDFs per second"""
        return self.total_generations / self.duration if self.duration > 0 else 0
    
    @property
    def average_generation_time(self) -> float:
        """Average PDF generation time in seconds"""
        return statistics.mean(self.response_times) if self.response_times else 0
    
    @property
    def p95_generation_time(self) -> float:
        """95th percentile PDF generation time in seconds"""
        if not self.response_times:
            return 0
        sorted_times = sorted(self.response_times)
        index = int(0.95 * len(sorted_times))
        return sorted_times[index]
    
    @property
    def success_rate(self) -> float:
        """Success rate as percentage"""
        return (self.successful_generations / self.total_generations) * 100 if self.total_generations > 0 else 0
    
    @property
    def average_pdf_size(self) -> float:
        """Average PDF size in KB"""
        return statistics.mean([size / 1024 for size in self.pdf_sizes]) if self.pdf_sizes else 0


@pytest.fixture
def test_user_token():
    """Create test user and return authentication token for PDF testing"""
    # Register a test user for PDF generation
    user_data = {
        "username": "pdftestuser", 
        "email": "pdftest@example.com",
        "password": "pdftest123",
        "full_name": "PDF Test User",
        "role": "admin"
    }
    
    # Register the user
    register_response = client.post("/api/v1/auth/register", json=user_data)
    if register_response.status_code == 400:
        # User might already exist
        pass
    
    # Verify the user in database for testing
    try:
        conn = sqlite3.connect('ca_dms.db')
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET is_verified = 1 WHERE email = ?", (user_data["email"],))
        conn.commit()
        conn.close()
    except Exception:
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


def create_simple_document(user_id: str, doc_number: int, auth_headers: dict) -> str:
    """Create a simple document for PDF testing"""
    document_data = {
        "title": f"Simple PDF Test Document {doc_number}",
        "content": {
            "ops": [
                {"insert": f"Simple PDF Test Document {doc_number}\n"},
                {"insert": "This is a basic document for PDF generation testing.\n"},
                {"insert": "Testing PDF generation performance with minimal content.\n"}
            ]
        },
        "document_type": "governance",
        "placeholders": {},
        "created_by": user_id
    }
    
    response = client.post("/api/v1/documents/", json=document_data, headers=auth_headers)
    if response.status_code in [200, 201]:
        return response.json()["id"]
    else:
        pytest.fail(f"Failed to create document: {response.text}")


def create_complex_document_with_placeholders(user_id: str, doc_number: int, auth_headers: dict) -> str:
    """Create a complex document with multiple placeholders for performance testing"""
    document_data = {
        "title": f"Complex PDF Test Document {doc_number}",
        "content": {
            "ops": [
                {"insert": f"Complex PDF Performance Test Document {doc_number}\n\n"},
                {"insert": "BOARD RESOLUTION - COMMUNITY ASSOCIATION\n"},
                {"insert": "Annual Meeting Governance Document\n\n"},
                {"insert": "WHEREAS, the Community Association Board has convened to address important matters affecting the community;\n\n"},
                {"insert": "WHEREAS, this document contains multiple placeholder elements for comprehensive testing;\n\n"},
                {"insert": "NOW, THEREFORE, BE IT RESOLVED:\n\n"},
                # Add various placeholder types
                {"insert": {"signature": {"label": "Board President", "includeDate": True, "includeTitle": True}}},
                {"insert": "\n\nDate of Resolution: "},
                {"insert": {"line-segment": {"length": "medium"}}},
                {"insert": "\n\nBoard Member Signatures:\n"},
                {"insert": {"signature": {"label": "Secretary", "includeDate": True, "includeTitle": False}}},
                {"insert": "\n"},
                {"insert": {"signature": {"label": "Treasurer", "includeDate": True, "includeTitle": True}}},
                {"insert": "\n\nDetailed Comments Section:\n"},
                {"insert": {"long-response": {"lines": 8, "label": "Board Comments"}}},
                {"insert": "\n\nAdditional Notes:\n"},
                {"insert": {"long-response": {"lines": 5, "label": "Meeting Notes"}}},
                {"insert": "\n\nApproval Information:\n"},
                {"insert": "Approved by: "},
                {"insert": {"line-segment": {"length": "long"}}},
                {"insert": "\nDate: "},
                {"insert": {"line-segment": {"length": "short"}}},
                {"insert": "\n\nVersion Information:\n"},
                {"insert": {"version-table": {"data": {"version": "2.1", "date": "2025-09-12", "author": "Board Secretary"}}}},
                {"insert": "\n\nThis document has been reviewed and approved by the Board of Directors.\n"},
                {"insert": "Effective Date: "},
                {"insert": {"line-segment": {"length": "medium"}}},
                {"insert": "\n\nEnd of Document"}
            ]
        },
        "document_type": "board_resolution",
        "placeholders": {
            "signatures": [
                {"id": "pres_sig", "label": "Board President", "includeDate": True, "includeTitle": True},
                {"id": "sec_sig", "label": "Secretary", "includeDate": True, "includeTitle": False},
                {"id": "treas_sig", "label": "Treasurer", "includeDate": True, "includeTitle": True}
            ],
            "longResponses": [
                {"id": "board_comments", "lines": 8, "label": "Board Comments"},
                {"id": "meeting_notes", "lines": 5, "label": "Meeting Notes"}
            ],
            "lineSegments": [
                {"id": "res_date", "length": "medium"},
                {"id": "approval_name", "length": "long"},
                {"id": "approval_date", "length": "short"},
                {"id": "effective_date", "length": "medium"}
            ],
            "versionTables": [
                {"id": "doc_version", "version": "2.1", "date": "2025-09-12", "author": "Board Secretary"}
            ]
        },
        "created_by": user_id
    }
    
    response = client.post("/api/v1/documents/", json=document_data, headers=auth_headers)
    if response.status_code in [200, 201]:
        return response.json()["id"]
    else:
        pytest.fail(f"Failed to create complex document: {response.text}")


def single_pdf_generation_test(document_id: str, test_number: int, auth_headers: dict) -> Dict[str, Any]:
    """Perform single PDF generation and measure performance"""
    start_time = time.time()
    
    try:
        response = client.get(f"/api/v1/documents/{document_id}/pdf", headers=auth_headers)
        
        end_time = time.time()
        generation_time = end_time - start_time
        
        success = response.status_code == 200
        pdf_size = len(response.content) if success else 0
        
        return {
            "success": success,
            "status_code": response.status_code,
            "generation_time": generation_time,
            "pdf_size": pdf_size,
            "test_number": test_number,
            "error": response.text if not success else None
        }
        
    except Exception as e:
        end_time = time.time()
        generation_time = end_time - start_time
        
        return {
            "success": False,
            "status_code": 500,
            "generation_time": generation_time,
            "pdf_size": 0,
            "test_number": test_number,
            "error": str(e)
        }


class TestPDFGenerationPerformance:
    """
    PDF Generation Performance Testing for Task PERF.2
    
    Requirements:
    - PDF generation with complex documents
    - Generation time < 3 seconds (95th percentile)
    - Test concurrent PDF generation
    - Test multiple placeholder performance
    """
    
    def test_simple_pdf_generation_performance(self, test_user_token):
        """
        Test: Simple PDF generation baseline performance
        
        Requirements:
        - Single PDF generation time < 1 second
        - Success rate > 99%
        - PDF file size reasonable (< 1MB for simple docs)
        """
        print(f"\n🚀 Testing simple PDF generation performance")
        
        # Create a simple document
        document_id = create_simple_document(
            test_user_token["user"]["id"], 
            1, 
            test_user_token["headers"]
        )
        
        # Test 10 PDF generations to establish baseline
        results = PDFPerformanceResults()
        results.start_time = time.time()
        
        for i in range(10):
            result = single_pdf_generation_test(document_id, i, test_user_token["headers"])
            
            results.total_generations += 1
            results.response_times.append(result["generation_time"])
            
            if result["success"]:
                results.successful_generations += 1
                results.pdf_sizes.append(result["pdf_size"])
            else:
                results.failed_generations += 1
                print(f"❌ PDF generation {i} failed: {result['error']}")
        
        results.end_time = time.time()
        
        # Print results
        print(f"\n📊 Simple PDF Generation Results:")
        print(f"   Successful: {results.successful_generations}/10")
        print(f"   Success Rate: {results.success_rate:.1f}%")
        print(f"   Average Generation Time: {results.average_generation_time:.3f}s")
        print(f"   95th Percentile Time: {results.p95_generation_time:.3f}s")
        print(f"   Average PDF Size: {results.average_pdf_size:.1f} KB")
        
        # Performance assertions (may fail initially - TDD Red phase)
        assert results.success_rate > 99.0, (
            f"Simple PDF success rate {results.success_rate:.1f}% is below required 99%"
        )
        
        assert results.p95_generation_time < 1.0, (
            f"Simple PDF 95th percentile generation time {results.p95_generation_time:.3f}s exceeds 1s limit"
        )
        
        assert results.average_pdf_size < 1024, (  # < 1MB
            f"Simple PDF average size {results.average_pdf_size:.1f}KB is too large"
        )
    
    def test_complex_pdf_generation_performance(self, test_user_token):
        """
        Test: Complex PDF generation with multiple placeholders
        
        Requirements:
        - Complex PDF generation time < 3 seconds (95th percentile) 
        - Success rate > 95%
        - Handle multiple placeholder types efficiently
        """
        print(f"\n🚀 Testing complex PDF generation performance")
        
        # Create a complex document with multiple placeholders
        document_id = create_complex_document_with_placeholders(
            test_user_token["user"]["id"], 
            1, 
            test_user_token["headers"]
        )
        
        # Test 20 complex PDF generations
        results = PDFPerformanceResults()
        results.start_time = time.time()
        
        for i in range(20):
            result = single_pdf_generation_test(document_id, i, test_user_token["headers"])
            
            results.total_generations += 1
            results.response_times.append(result["generation_time"])
            
            if result["success"]:
                results.successful_generations += 1
                results.pdf_sizes.append(result["pdf_size"])
            else:
                results.failed_generations += 1
                print(f"❌ Complex PDF generation {i} failed: {result['error']}")
        
        results.end_time = time.time()
        
        # Print results
        print(f"\n📊 Complex PDF Generation Results:")
        print(f"   Successful: {results.successful_generations}/20")
        print(f"   Success Rate: {results.success_rate:.1f}%")
        print(f"   Average Generation Time: {results.average_generation_time:.3f}s")
        print(f"   95th Percentile Time: {results.p95_generation_time:.3f}s")
        print(f"   Average PDF Size: {results.average_pdf_size:.1f} KB")
        print(f"   Throughput: {results.throughput:.2f} PDFs/sec")
        
        # Performance assertions (main PERF.2 requirements)
        assert results.success_rate > 95.0, (
            f"Complex PDF success rate {results.success_rate:.1f}% is below required 95%"
        )
        
        assert results.p95_generation_time < 3.0, (
            f"Complex PDF 95th percentile generation time {results.p95_generation_time:.3f}s exceeds 3s limit"
        )
        
        assert results.throughput > 1.0, (
            f"Complex PDF throughput {results.throughput:.2f} PDFs/sec is below minimum 1 PDF/sec"
        )
    
    def test_concurrent_pdf_generation_performance(self, test_user_token):
        """
        Test: Concurrent PDF generation under load
        
        Requirements:
        - 20 concurrent complex PDF generations
        - 95th percentile time < 3 seconds under concurrent load
        - Success rate > 95% under concurrent load
        """
        print(f"\n🚀 Testing concurrent PDF generation performance")
        
        # Create 5 complex documents for concurrent testing
        document_ids = []
        for i in range(5):
            doc_id = create_complex_document_with_placeholders(
                test_user_token["user"]["id"], 
                i, 
                test_user_token["headers"]
            )
            document_ids.append(doc_id)
        
        results = PDFPerformanceResults()
        concurrent_generations = 20
        max_workers = 5  # Limit concurrency for PDF generation
        
        print(f"Generating {concurrent_generations} PDFs concurrently with {max_workers} workers")
        
        results.start_time = time.time()
        
        # Execute concurrent PDF generations
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit PDF generation requests
            future_to_test = {}
            for i in range(concurrent_generations):
                doc_id = document_ids[i % len(document_ids)]  # Rotate through documents
                future = executor.submit(
                    single_pdf_generation_test, 
                    doc_id, 
                    i, 
                    test_user_token["headers"]
                )
                future_to_test[future] = i
            
            # Collect results
            for future in as_completed(future_to_test):
                test_number = future_to_test[future]
                try:
                    result = future.result()
                    
                    results.total_generations += 1
                    results.response_times.append(result["generation_time"])
                    
                    if result["success"]:
                        results.successful_generations += 1
                        results.pdf_sizes.append(result["pdf_size"])
                    else:
                        results.failed_generations += 1
                        print(f"❌ Concurrent PDF {test_number} failed: {result['error']}")
                        
                except Exception as e:
                    results.total_generations += 1
                    results.failed_generations += 1
                    print(f"❌ Exception for PDF {test_number}: {str(e)}")
        
        results.end_time = time.time()
        
        # Print results
        print(f"\n📊 Concurrent PDF Generation Results:")
        print(f"   Total PDFs: {results.total_generations}")
        print(f"   Successful: {results.successful_generations}")
        print(f"   Failed: {results.failed_generations}")
        print(f"   Success Rate: {results.success_rate:.1f}%")
        print(f"   Duration: {results.duration:.2f} seconds")
        print(f"   Throughput: {results.throughput:.2f} PDFs/sec")
        print(f"   Average Generation Time: {results.average_generation_time:.3f}s")
        print(f"   95th Percentile Time: {results.p95_generation_time:.3f}s")
        print(f"   Average PDF Size: {results.average_pdf_size:.1f} KB")
        
        # Concurrent load performance assertions
        assert results.success_rate > 95.0, (
            f"Concurrent PDF success rate {results.success_rate:.1f}% is below required 95%"
        )
        
        assert results.p95_generation_time < 3.0, (
            f"Concurrent PDF 95th percentile time {results.p95_generation_time:.3f}s exceeds 3s limit"
        )
        
        assert results.total_generations == concurrent_generations, (
            f"Expected {concurrent_generations} generations, got {results.total_generations}"
        )
        
        assert results.throughput > 2.0, (
            f"Concurrent PDF throughput {results.throughput:.2f} PDFs/sec is below minimum 2 PDFs/sec"
        )


if __name__ == "__main__":
    # Allow running PDF performance tests directly
    pytest.main([__file__, "-v", "-s"])