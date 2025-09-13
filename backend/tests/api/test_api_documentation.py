"""
API Documentation Tests - TDD Red Phase
Testing comprehensive API documentation generation and compliance
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient
from fastapi.testclient import TestClient
from typing import Dict, Any
import json

# Mark all async tests in this module
pytestmark = pytest.mark.asyncio


class TestOpenAPIDocumentation:
    """Test suite for OpenAPI documentation generation and compliance"""

    async def test_openapi_schema_exists(self):
        """Test that OpenAPI schema is available"""
        # RED: This should pass - basic OpenAPI should exist
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            assert response.status_code == 200

            schema = response.json()
            assert "openapi" in schema
            assert "info" in schema
            assert "paths" in schema

    async def test_openapi_info_section_complete(self):
        """Test that OpenAPI info section is comprehensive"""
        # RED: Should fail - comprehensive info not complete yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            info = schema.get("info", {})

            # Should contain comprehensive information
            assert "title" in info
            assert "description" in info
            assert "version" in info
            assert "contact" in info
            assert "license" in info
            assert "termsOfService" in info

            # Should have meaningful content
            assert len(info["description"]) > 100  # Substantial description
            assert "intro page" in info["description"].lower()
            assert "api" in info["description"].lower()

    async def test_openapi_servers_configuration(self):
        """Test that servers are properly configured"""
        # RED: Should fail - servers not properly configured yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            # Should contain servers configuration
            assert "servers" in schema
            servers = schema["servers"]
            assert len(servers) > 0

            # Should include development and production servers
            server_urls = [server["url"] for server in servers]
            assert any("localhost" in url or "127.0.0.1" in url for url in server_urls)

            # Each server should have description
            for server in servers:
                assert "description" in server
                assert len(server["description"]) > 5

    async def test_intro_page_endpoint_documented(self):
        """Test that intro page endpoint is properly documented"""
        # RED: Should fail - comprehensive documentation not complete yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            paths = schema.get("paths", {})

            # Find intro page endpoint
            intro_page_path = None
            for path in paths:
                if "intro-page" in path:
                    intro_page_path = path
                    break

            assert intro_page_path is not None, "Intro page endpoint not found in OpenAPI schema"

            endpoint = paths[intro_page_path]
            assert "get" in endpoint

            get_spec = endpoint["get"]

            # Should have comprehensive documentation
            assert "summary" in get_spec
            assert "description" in get_spec
            assert "parameters" in get_spec
            assert "responses" in get_spec
            assert "tags" in get_spec

            # Description should be substantial
            assert len(get_spec["description"]) > 100

            # Should document all response codes
            responses = get_spec["responses"]
            assert "200" in responses
            assert "401" in responses
            assert "422" in responses
            assert "500" in responses

    async def test_service_endpoints_documented(self):
        """Test that all service endpoints are documented"""
        # RED: Should fail - service endpoints not fully documented yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            paths = schema.get("paths", {})

            # Expected service endpoints
            expected_services = [
                "user-stats",
                "system-stats",
                "actionable-items",
                "activity-feed",
                "personalization"
            ]

            documented_services = []
            for path in paths:
                if "/services/" in path:
                    for service in expected_services:
                        if service in path:
                            documented_services.append(service)

            # All services should be documented
            for service in expected_services:
                assert service in documented_services, f"Service {service} not documented"

    async def test_schema_components_defined(self):
        """Test that schema components are properly defined"""
        # RED: Should fail - comprehensive schema components not defined yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            # Should have components section
            assert "components" in schema
            components = schema["components"]
            assert "schemas" in components

            schemas = components["schemas"]

            # Should define key schemas
            expected_schemas = [
                "IntroPageResponse",
                "UserStatistics",
                "SystemOverview",
                "ActionableItems",
                "ActivityFeed",
                "Personalization",
                "HealthStatus"
            ]

            for schema_name in expected_schemas:
                assert schema_name in schemas, f"Schema {schema_name} not defined"

                schema_def = schemas[schema_name]
                assert "type" in schema_def
                assert "properties" in schema_def

                # Should have meaningful descriptions
                if "description" in schema_def:
                    assert len(schema_def["description"]) > 10

    async def test_authentication_documented(self):
        """Test that authentication is properly documented"""
        # RED: Should fail - authentication documentation not complete yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            # Should have security schemes
            assert "components" in schema
            components = schema["components"]
            assert "securitySchemes" in components

            security_schemes = components["securitySchemes"]

            # Should define JWT authentication
            assert "bearerAuth" in security_schemes or "JWTAuth" in security_schemes

            # Should have global security requirement
            assert "security" in schema
            security = schema["security"]
            assert len(security) > 0

    async def test_examples_included_in_documentation(self):
        """Test that documentation includes comprehensive examples"""
        # RED: Should fail - examples not included yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            # Find intro page endpoint
            paths = schema.get("paths", {})
            intro_page_found = False

            for path, path_spec in paths.items():
                if "intro-page" in path and "get" in path_spec:
                    get_spec = path_spec["get"]

                    if "responses" in get_spec and "200" in get_spec["responses"]:
                        response_spec = get_spec["responses"]["200"]

                        if "content" in response_spec:
                            content = response_spec["content"]
                            if "application/json" in content:
                                json_spec = content["application/json"]

                                # Should have examples
                                assert "examples" in json_spec or "example" in json_spec
                                intro_page_found = True
                                break

            assert intro_page_found, "Intro page endpoint examples not found"

    async def test_parameter_documentation_complete(self):
        """Test that all parameters are thoroughly documented"""
        # RED: Should fail - parameter documentation not complete yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            paths = schema.get("paths", {})

            # Check actionable items endpoint for parameter documentation
            actionable_items_path = None
            for path in paths:
                if "actionable-items" in path and "{user_id}" in path:
                    actionable_items_path = path
                    break

            assert actionable_items_path is not None

            endpoint = paths[actionable_items_path]["get"]
            assert "parameters" in endpoint

            parameters = endpoint["parameters"]

            # Should document path and query parameters
            param_names = [p["name"] for p in parameters]
            assert "user_id" in param_names
            assert "priority" in param_names
            assert "limit" in param_names
            assert "offset" in param_names

            # Each parameter should have description and schema
            for param in parameters:
                assert "description" in param
                assert "schema" in param
                assert len(param["description"]) > 10

    async def test_error_responses_documented(self):
        """Test that error responses are properly documented"""
        # RED: Should fail - error responses not fully documented yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            paths = schema.get("paths", {})

            # Check that endpoints document error responses
            endpoints_checked = 0

            for path, path_spec in paths.items():
                if "/services/" in path or "intro-page" in path:
                    for method, method_spec in path_spec.items():
                        if method in ["get", "post", "put", "delete"]:
                            responses = method_spec.get("responses", {})

                            # Should document common error codes
                            assert "401" in responses  # Unauthorized
                            assert "500" in responses  # Internal Server Error

                            # Error responses should have descriptions
                            for code in ["401", "500"]:
                                error_response = responses[code]
                                assert "description" in error_response
                                assert len(error_response["description"]) > 10

                            endpoints_checked += 1

                            if endpoints_checked >= 3:  # Check at least 3 endpoints
                                break

                if endpoints_checked >= 3:
                    break

            assert endpoints_checked >= 3, "Not enough endpoints checked for error documentation"

    async def test_tags_and_organization(self):
        """Test that API is properly organized with tags"""
        # RED: Should fail - tag organization not complete yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            # Should have tags definition
            assert "tags" in schema
            tags = schema["tags"]
            assert len(tags) > 0

            # Should have meaningful tag descriptions
            tag_names = [tag["name"] for tag in tags]
            expected_tags = ["Intro Page", "Individual Services"]

            for expected_tag in expected_tags:
                assert expected_tag in tag_names, f"Tag {expected_tag} not found"

            # Each tag should have description
            for tag in tags:
                assert "description" in tag
                assert len(tag["description"]) > 20

    async def test_deprecated_endpoints_marked(self):
        """Test that deprecated endpoints are properly marked"""
        # RED: This might pass initially - no deprecated endpoints yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            paths = schema.get("paths", {})

            # Check if any endpoints are marked as deprecated
            deprecated_found = False
            for path, path_spec in paths.items():
                for method, method_spec in path_spec.items():
                    if method_spec.get("deprecated", False):
                        deprecated_found = True
                        # If deprecated, should have explanation
                        assert "description" in method_spec
                        assert "deprecated" in method_spec["description"].lower()

            # This test passes if no deprecated endpoints or they're properly documented
            assert True  # Always passes for now

    async def test_api_documentation_ui_accessible(self):
        """Test that API documentation UI is accessible"""
        # RED: Should fail - documentation UI not fully configured yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            # Test Swagger UI
            response = await client.get("/docs")
            assert response.status_code == 200

            # Should contain Swagger UI content
            content = response.text
            assert "swagger" in content.lower() or "openapi" in content.lower()

            # Test ReDoc
            response = await client.get("/redoc")
            assert response.status_code == 200

            # Should contain ReDoc content
            content = response.text
            assert "redoc" in content.lower()

class TestAPIDocumentationContent:
    """Test suite for API documentation content quality"""

    async def test_intro_page_documentation_comprehensive(self):
        """Test that intro page documentation is comprehensive"""
        # RED: Should fail - comprehensive documentation not complete yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            # Find intro page endpoint documentation
            paths = schema.get("paths", {})
            intro_docs = None

            for path, path_spec in paths.items():
                if "intro-page" in path and "get" in path_spec:
                    intro_docs = path_spec["get"]
                    break

            assert intro_docs is not None

            # Should have comprehensive description
            description = intro_docs.get("description", "")

            # Description should mention key features
            required_mentions = [
                "coordinates",
                "services",
                "statistics",
                "actionable",
                "activity",
                "personalization",
                "performance"
            ]

            for mention in required_mentions:
                assert mention.lower() in description.lower(), f"Documentation missing mention of '{mention}'"

    async def test_service_endpoints_usage_examples(self):
        """Test that service endpoints include usage examples"""
        # RED: Should fail - usage examples not included yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            paths = schema.get("paths", {})
            components = schema.get("components", {}).get("schemas", {})

            # Check that key response schemas have examples
            key_schemas = ["UserStatistics", "SystemOverview", "ActionableItems"]

            for schema_name in key_schemas:
                if schema_name in components:
                    schema_def = components[schema_name]

                    # Should have example data
                    assert "example" in schema_def or "examples" in schema_def, f"Schema {schema_name} missing examples"

    async def test_authentication_documentation_clear(self):
        """Test that authentication documentation is clear and helpful"""
        # RED: Should fail - authentication docs not comprehensive yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            # Check security scheme documentation
            components = schema.get("components", {})
            security_schemes = components.get("securitySchemes", {})

            # Should have detailed auth documentation
            auth_scheme = None
            for scheme_name, scheme_def in security_schemes.items():
                if "bearer" in scheme_def.get("type", "").lower() or "http" in scheme_def.get("type", "").lower():
                    auth_scheme = scheme_def
                    break

            assert auth_scheme is not None, "No bearer/JWT authentication scheme found"

            # Should have description
            assert "description" in auth_scheme
            description = auth_scheme["description"]
            assert len(description) > 50
            assert "jwt" in description.lower() or "token" in description.lower()

    async def test_rate_limiting_documented(self):
        """Test that rate limiting is documented"""
        # RED: Should fail - rate limiting not documented yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            # Should mention rate limiting in info or endpoint descriptions
            info_description = schema.get("info", {}).get("description", "")

            rate_limit_mentioned = "rate limit" in info_description.lower()

            if not rate_limit_mentioned:
                # Check if mentioned in any endpoint descriptions
                paths = schema.get("paths", {})
                for path, path_spec in paths.items():
                    for method, method_spec in path_spec.items():
                        description = method_spec.get("description", "")
                        if "rate limit" in description.lower():
                            rate_limit_mentioned = True
                            break
                    if rate_limit_mentioned:
                        break

            assert rate_limit_mentioned, "Rate limiting not documented"

    async def test_caching_behavior_documented(self):
        """Test that caching behavior is documented"""
        # RED: Should fail - caching not documented yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            # Should document caching in responses
            paths = schema.get("paths", {})
            caching_documented = False

            for path, path_spec in paths.items():
                for method, method_spec in path_spec.items():
                    responses = method_spec.get("responses", {})

                    for code, response_spec in responses.items():
                        if code == "200":
                            # Check if headers mention caching
                            headers = response_spec.get("headers", {})
                            if any("cache" in header.lower() or "etag" in header.lower()
                                   for header in headers.keys()):
                                caching_documented = True
                                break

                    if caching_documented:
                        break

                if caching_documented:
                    break

            # Alternative: check if mentioned in descriptions
            if not caching_documented:
                info_description = schema.get("info", {}).get("description", "")
                caching_documented = "caching" in info_description.lower() or "cache" in info_description.lower()

            assert caching_documented, "Caching behavior not documented"

    async def test_pagination_documented(self):
        """Test that pagination is properly documented"""
        # RED: Should fail - pagination not fully documented yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            paths = schema.get("paths", {})

            # Find actionable items endpoint
            actionable_items_path = None
            for path in paths:
                if "actionable-items" in path:
                    actionable_items_path = path
                    break

            assert actionable_items_path is not None

            endpoint = paths[actionable_items_path]["get"]

            # Should document pagination parameters
            parameters = endpoint.get("parameters", [])
            param_names = [p["name"] for p in parameters]

            assert "limit" in param_names
            assert "offset" in param_names

            # Should document pagination in response
            responses = endpoint.get("responses", {})
            if "200" in responses:
                response_spec = responses["200"]
                description = response_spec.get("description", "")

                # Should mention pagination in response description
                assert "pagination" in description.lower() or "limit" in description.lower()

class TestAPIDocumentationAccessibility:
    """Test suite for API documentation accessibility and usability"""

    async def test_documentation_search_functionality(self):
        """Test that documentation has search functionality"""
        # RED: Should fail - search functionality not verified yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            # Test that Swagger UI includes search
            response = await client.get("/docs")
            content = response.text

            # Swagger UI should have search functionality
            assert "search" in content.lower() or "filter" in content.lower()

    async def test_documentation_mobile_friendly(self):
        """Test that documentation is mobile-friendly"""
        # RED: Should fail - mobile-friendliness not verified yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/docs")
            content = response.text

            # Should include viewport meta tag for mobile
            assert "viewport" in content.lower()
            assert "mobile" in content.lower() or "responsive" in content.lower()

    async def test_documentation_includes_contact_info(self):
        """Test that documentation includes contact information"""
        # RED: Should fail - contact info not complete yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            info = schema.get("info", {})

            # Should have contact information
            assert "contact" in info
            contact = info["contact"]

            # Contact should have name and email/url
            assert "name" in contact
            assert "email" in contact or "url" in contact

            if "email" in contact:
                assert "@" in contact["email"]

            if "url" in contact:
                assert "http" in contact["url"]

    async def test_documentation_version_information(self):
        """Test that documentation includes proper version information"""
        # RED: Should fail - version info not comprehensive yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            info = schema.get("info", {})

            # Should have version
            assert "version" in info
            version = info["version"]

            # Version should follow semantic versioning
            import re
            version_pattern = r'^\d+\.\d+\.\d+'
            assert re.match(version_pattern, version), f"Invalid version format: {version}"

            # Should indicate API status
            description = info.get("description", "")
            status_indicators = ["beta", "alpha", "stable", "v1", "production"]
            assert any(indicator in description.lower() for indicator in status_indicators)

    async def test_documentation_changelog_reference(self):
        """Test that documentation references changelog or release notes"""
        # RED: Should fail - changelog not referenced yet
        from app.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            schema = response.json()

            info = schema.get("info", {})
            description = info.get("description", "")

            # Should mention changelog or version history
            changelog_mentioned = any(term in description.lower() for term in [
                "changelog", "release notes", "version history", "updates"
            ])

            # Alternative: check if externalDocs points to changelog
            if not changelog_mentioned:
                external_docs = info.get("externalDocs") or schema.get("externalDocs")
                if external_docs:
                    url = external_docs.get("url", "")
                    description = external_docs.get("description", "")
                    changelog_mentioned = any(term in (url + description).lower() for term in [
                        "changelog", "release", "version"
                    ])

            assert changelog_mentioned, "Changelog or release notes not referenced"