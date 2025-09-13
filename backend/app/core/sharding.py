"""
Database Sharding Strategy for CA-DMS Horizontal Scaling
"""
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
import hashlib
import uuid
from sqlalchemy import create_engine, Engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings


class ShardingStrategy(Enum):
    """Available sharding strategies"""
    HASH_BASED = "hash_based"
    RANGE_BASED = "range_based"
    DIRECTORY_BASED = "directory_based"


class ShardConfig(BaseModel):
    """Configuration for a single shard"""
    shard_id: str
    database_url: str
    weight: float = 1.0
    is_active: bool = True
    read_replicas: List[str] = []


class ShardingConfig(BaseModel):
    """Complete sharding configuration"""
    strategy: ShardingStrategy = ShardingStrategy.HASH_BASED
    shards: List[ShardConfig]
    default_shard: str
    replication_factor: int = 1


class ShardManager:
    """Manages database sharding for horizontal scaling"""

    def __init__(self, config: ShardingConfig):
        self.config = config
        self.engines: Dict[str, Engine] = {}
        self.sessions: Dict[str, sessionmaker] = {}
        self._initialize_shards()

    def _initialize_shards(self):
        """Initialize connections to all shards"""
        for shard in self.config.shards:
            if shard.is_active:
                engine = create_engine(
                    shard.database_url,
                    pool_size=10,
                    max_overflow=20,
                    pool_pre_ping=True,
                    pool_recycle=3600
                )
                self.engines[shard.shard_id] = engine
                self.sessions[shard.shard_id] = sessionmaker(bind=engine)

    def get_shard_for_document(self, document_id: str) -> str:
        """Determine which shard to use for a document"""
        if self.config.strategy == ShardingStrategy.HASH_BASED:
            return self._hash_based_routing(document_id)
        elif self.config.strategy == ShardingStrategy.RANGE_BASED:
            return self._range_based_routing(document_id)
        elif self.config.strategy == ShardingStrategy.DIRECTORY_BASED:
            return self._directory_based_routing(document_id)
        else:
            return self.config.default_shard

    def get_shard_for_user(self, user_id: str) -> str:
        """Determine which shard to use for a user"""
        return self._hash_based_routing(user_id)

    def _hash_based_routing(self, key: str) -> str:
        """Route based on consistent hashing"""
        hash_value = int(hashlib.md5(key.encode()).hexdigest(), 16)
        active_shards = [s for s in self.config.shards if s.is_active]
        shard_index = hash_value % len(active_shards)
        return active_shards[shard_index].shard_id

    def _range_based_routing(self, key: str) -> str:
        """Route based on key ranges (for ordered data)"""
        # Extract timestamp or sequence from UUID for range-based routing
        if len(key) >= 8:
            prefix = key[:8]
            hash_value = int(prefix, 16) if all(c in '0123456789abcdef' for c in prefix.lower()) else hash(prefix)
            active_shards = [s for s in self.config.shards if s.is_active]
            ranges_per_shard = 2**32 // len(active_shards)
            shard_index = hash_value // ranges_per_shard
            return active_shards[min(shard_index, len(active_shards) - 1)].shard_id
        return self.config.default_shard

    def _directory_based_routing(self, key: str) -> str:
        """Route based on a directory service (future implementation)"""
        # This would consult a directory service to determine routing
        # For now, fall back to hash-based routing
        return self._hash_based_routing(key)

    def get_session(self, shard_id: str) -> Session:
        """Get database session for a specific shard"""
        if shard_id not in self.sessions:
            raise ValueError(f"Shard {shard_id} not found or not active")
        return self.sessions[shard_id]()

    def get_read_session(self, shard_id: str) -> Session:
        """Get read-only session (potentially from replica)"""
        shard = next((s for s in self.config.shards if s.shard_id == shard_id), None)
        if shard and shard.read_replicas:
            # Use read replica if available
            replica_url = shard.read_replicas[0]  # Simple round-robin can be added
            if shard_id + "_read" not in self.engines:
                engine = create_engine(replica_url, pool_size=5, max_overflow=10)
                self.engines[shard_id + "_read"] = engine
                self.sessions[shard_id + "_read"] = sessionmaker(bind=engine)
            return self.sessions[shard_id + "_read"]()

        # Fall back to main shard
        return self.get_session(shard_id)

    def get_all_shards(self) -> List[str]:
        """Get list of all active shard IDs"""
        return [s.shard_id for s in self.config.shards if s.is_active]

    def execute_on_all_shards(self, query_func, *args, **kwargs) -> Dict[str, Any]:
        """Execute a function on all shards (for migrations, etc.)"""
        results = {}
        for shard_id in self.get_all_shards():
            session = self.get_session(shard_id)
            try:
                results[shard_id] = query_func(session, *args, **kwargs)
                session.commit()
            except Exception as e:
                session.rollback()
                results[shard_id] = {"error": str(e)}
            finally:
                session.close()
        return results

    def migrate_shard(self, from_shard: str, to_shard: str, key_pattern: str = None):
        """Migrate data between shards (for rebalancing)"""
        # This would implement data migration logic
        # For now, this is a placeholder for future implementation
        pass


# Default sharding configuration
DEFAULT_SHARDING_CONFIG = ShardingConfig(
    strategy=ShardingStrategy.HASH_BASED,
    shards=[
        ShardConfig(
            shard_id="shard_001",
            database_url=settings.DATABASE_URL or "postgresql://ca_dms_user:ca_dms_password@postgres:5432/ca_dms_shard_001"
        )
    ],
    default_shard="shard_001",
    replication_factor=1
)

# Global shard manager instance
shard_manager: Optional[ShardManager] = None


def initialize_sharding(config: ShardingConfig = None):
    """Initialize the global shard manager"""
    global shard_manager
    config = config or DEFAULT_SHARDING_CONFIG
    shard_manager = ShardManager(config)


def get_shard_manager() -> ShardManager:
    """Get the global shard manager instance"""
    if shard_manager is None:
        initialize_sharding()
    return shard_manager


class ShardAwareSession:
    """Session wrapper that automatically routes to correct shard"""

    def __init__(self, entity_id: str, entity_type: str = "document"):
        self.entity_id = entity_id
        self.entity_type = entity_type
        self.manager = get_shard_manager()

        if entity_type == "document":
            self.shard_id = self.manager.get_shard_for_document(entity_id)
        elif entity_type == "user":
            self.shard_id = self.manager.get_shard_for_user(entity_id)
        else:
            self.shard_id = self.manager.config.default_shard

    def __enter__(self) -> Session:
        self.session = self.manager.get_session(self.shard_id)
        return self.session

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.session.rollback()
        else:
            self.session.commit()
        self.session.close()