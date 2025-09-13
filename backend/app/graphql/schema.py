"""
GraphQL schema for CA-DMS API
"""
import strawberry
from strawberry.fastapi import GraphQLRouter
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_optional_current_user
from app.graphql.resolvers import Query, Mutation


# Create the GraphQL schema
schema = strawberry.Schema(query=Query, mutation=Mutation)


async def get_context(request=None, response=None):
    """Get GraphQL context with database session and user"""
    db_session = next(get_db())
    current_user = None

    if request:
        try:
            # Try to get the current user from the request
            # This is optional for GraphQL queries that don't require authentication
            current_user = await get_current_user_optional(request)
        except Exception:
            # If authentication fails, continue with no user
            pass

    return {
        "db": db_session,
        "user": current_user,
        "request": request,
        "response": response
    }


# Create the GraphQL router
graphql_app = GraphQLRouter(
    schema,
    context_getter=get_context,
    path="/graphql"
)