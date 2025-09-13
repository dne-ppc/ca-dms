"""
Cache Warming Service

Provides intelligent cache warming strategies to proactively load
frequently accessed data into cache before user requests.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable, Set
from datetime import datetime, timedelta
from collections import defaultdict
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.services.cache_service import cache_service
from app.services.cached_document_service import CachedDocumentService
from app.models.document import Document
from app.models.user import User
from app.models.document_template import DocumentTemplate
from app.models.workflow import WorkflowInstance


logger = logging.getLogger(__name__)


class WarmingPriority(Enum):
    """Cache warming priority levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class WarmingStrategy(Enum):
    """Cache warming strategies"""
    RECENT_ACCESS = "recent_access"
    FREQUENT_ACCESS = "frequent_access"
    POPULAR_CONTENT = "popular_content"
    PREDICTIVE = "predictive"
    TIME_BASED = "time_based"
    USER_BASED = "user_based"


@dataclass
class WarmingRule:
    """Defines cache warming rules"""
    name: str
    strategy: WarmingStrategy
    priority: WarmingPriority
    data_fetcher: Callable
    cache_type: str
    key_generator: Callable
    ttl: Optional[int] = None
    batch_size: int = 50
    frequency_hours: int = 24
    enabled: bool = True
    created_at: datetime = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()


@dataclass
class WarmingTask:
    """Represents a cache warming task"""
    rule: WarmingRule
    scheduled_at: datetime
    status: str = "pending"  # pending, running, completed, failed
    items_warmed: int = 0
    execution_time: float = 0
    error_message: Optional[str] = None


class CacheWarmingService:
    """Manages cache warming operations"""

    def __init__(self):
        self.warming_rules: Dict[str, WarmingRule] = {}
        self.warming_history: List[WarmingTask] = []
        self.max_history_size = 500
        self.access_patterns: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self.running_tasks: Set[str] = set()

        # Register default warming rules
        self._register_default_rules()

    def _register_default_rules(self):
        """Register default cache warming rules"""

        # Recent documents warming
        self.add_rule(WarmingRule(
            name="recent_documents",
            strategy=WarmingStrategy.RECENT_ACCESS,
            priority=WarmingPriority.HIGH,
            data_fetcher=self._fetch_recent_documents,
            cache_type="document",
            key_generator=lambda doc: f"doc:{doc.id}",
            ttl=3600,  # 1 hour
            batch_size=50,
            frequency_hours=1
        ))

        # Popular documents warming
        self.add_rule(WarmingRule(
            name="popular_documents",
            strategy=WarmingStrategy.POPULAR_CONTENT,
            priority=WarmingPriority.MEDIUM,
            data_fetcher=self._fetch_popular_documents,
            cache_type="document",
            key_generator=lambda doc: f"doc:{doc.id}",
            ttl=7200,  # 2 hours
            batch_size=30,
            frequency_hours=6
        ))

        # Active users warming
        self.add_rule(WarmingRule(
            name="active_users",
            strategy=WarmingStrategy.RECENT_ACCESS,
            priority=WarmingPriority.MEDIUM,
            data_fetcher=self._fetch_active_users,
            cache_type="user",
            key_generator=lambda user: f"user:{user.id}",
            ttl=1800,  # 30 minutes
            batch_size=100,
            frequency_hours=2
        ))

        # Document templates warming
        self.add_rule(WarmingRule(
            name="document_templates",
            strategy=WarmingStrategy.POPULAR_CONTENT,
            priority=WarmingPriority.LOW,
            data_fetcher=self._fetch_popular_templates,
            cache_type="template",
            key_generator=lambda tpl: f"template:{tpl.id}",
            ttl=14400,  # 4 hours
            batch_size=20,
            frequency_hours=12
        ))

        # Document lists by type warming
        self.add_rule(WarmingRule(
            name="document_lists",
            strategy=WarmingStrategy.FREQUENT_ACCESS,
            priority=WarmingPriority.MEDIUM,
            data_fetcher=self._fetch_document_lists,
            cache_type="document",
            key_generator=lambda data: f"type:{data['type']}",
            ttl=1800,  # 30 minutes
            batch_size=10,
            frequency_hours=3
        ))

        # Workflow instances warming
        self.add_rule(WarmingRule(
            name="active_workflows",
            strategy=WarmingStrategy.RECENT_ACCESS,
            priority=WarmingPriority.HIGH,
            data_fetcher=self._fetch_active_workflows,
            cache_type="workflow",
            key_generator=lambda wf: f"workflow:{wf.id}",
            ttl=900,  # 15 minutes
            batch_size=25,
            frequency_hours=1
        ))

    def add_rule(self, rule: WarmingRule):
        """Add a cache warming rule"""
        self.warming_rules[rule.name] = rule
        logger.debug(f"Added warming rule: {rule.name} ({rule.strategy.value})")

    def remove_rule(self, rule_name: str) -> bool:
        """Remove a cache warming rule"""
        if rule_name in self.warming_rules:
            del self.warming_rules[rule_name]
            logger.debug(f"Removed warming rule: {rule_name}")
            return True
        return False

    def enable_rule(self, rule_name: str) -> bool:
        """Enable a warming rule"""
        if rule_name in self.warming_rules:
            self.warming_rules[rule_name].enabled = True
            return True
        return False

    def disable_rule(self, rule_name: str) -> bool:
        """Disable a warming rule"""
        if rule_name in self.warming_rules:
            self.warming_rules[rule_name].enabled = False
            return True
        return False

    async def warm_cache_by_rule(self, rule_name: str) -> WarmingTask:
        """Execute cache warming for a specific rule"""
        if rule_name not in self.warming_rules:
            raise ValueError(f"Warming rule '{rule_name}' not found")

        rule = self.warming_rules[rule_name]

        if not rule.enabled:
            raise ValueError(f"Warming rule '{rule_name}' is disabled")

        if rule_name in self.running_tasks:
            raise ValueError(f"Warming rule '{rule_name}' is already running")

        task = WarmingTask(
            rule=rule,
            scheduled_at=datetime.utcnow()
        )

        self.running_tasks.add(rule_name)

        try:
            await self._execute_warming_task(task)
        finally:
            self.running_tasks.discard(rule_name)

        self._record_warming_task(task)
        return task

    async def warm_cache_by_priority(self, priority: WarmingPriority) -> List[WarmingTask]:
        """Execute cache warming for all rules of a specific priority"""
        tasks = []

        for rule_name, rule in self.warming_rules.items():
            if rule.priority == priority and rule.enabled and rule_name not in self.running_tasks:
                try:
                    task = await self.warm_cache_by_rule(rule_name)
                    tasks.append(task)
                except Exception as e:
                    logger.error(f"Failed to warm cache for rule {rule_name}: {e}")

        return tasks

    async def warm_all_caches(self) -> Dict[WarmingPriority, List[WarmingTask]]:
        """Execute cache warming for all enabled rules"""
        results = {}

        # Execute in priority order
        for priority in [WarmingPriority.CRITICAL, WarmingPriority.HIGH, WarmingPriority.MEDIUM, WarmingPriority.LOW]:
            tasks = await self.warm_cache_by_priority(priority)
            results[priority] = tasks

            # Add delay between priority levels
            if tasks:
                await asyncio.sleep(1)

        return results

    async def _execute_warming_task(self, task: WarmingTask):
        """Execute a single warming task"""
        start_time = datetime.utcnow()
        task.status = "running"

        try:
            rule = task.rule
            logger.info(f"Starting cache warming: {rule.name}")

            # Fetch data using the rule's data fetcher
            db = next(get_db())
            try:
                data_items = await rule.data_fetcher(db, rule.batch_size)
            finally:
                db.close()

            # Warm cache in batches
            batch_size = min(rule.batch_size, 20)  # Limit concurrent operations
            total_warmed = 0

            for i in range(0, len(data_items), batch_size):
                batch = data_items[i:i + batch_size]
                batch_tasks = []

                for item in batch:
                    cache_key = rule.key_generator(item)
                    batch_tasks.append(self._warm_cache_item(rule, cache_key, item))

                # Execute batch concurrently
                results = await asyncio.gather(*batch_tasks, return_exceptions=True)

                # Count successful operations
                total_warmed += sum(1 for result in results if result is True)

                # Small delay between batches
                await asyncio.sleep(0.1)

            task.items_warmed = total_warmed
            task.status = "completed"

            execution_time = (datetime.utcnow() - start_time).total_seconds()
            task.execution_time = execution_time

            logger.info(f"Completed cache warming: {rule.name} ({total_warmed} items in {execution_time:.2f}s)")

        except Exception as e:
            task.status = "failed"
            task.error_message = str(e)
            task.execution_time = (datetime.utcnow() - start_time).total_seconds()
            logger.error(f"Cache warming failed for {task.rule.name}: {e}")

    async def _warm_cache_item(self, rule: WarmingRule, cache_key: str, item: Any) -> bool:
        """Warm a single cache item"""
        try:
            # Convert item to cacheable format
            cache_data = self._serialize_item(item)

            # Store in cache
            success = await cache_service.set(
                rule.cache_type,
                cache_key,
                cache_data,
                ttl=rule.ttl
            )

            if success:
                logger.debug(f"Warmed cache: {rule.cache_type}:{cache_key}")

            return success

        except Exception as e:
            logger.warning(f"Failed to warm cache item {cache_key}: {e}")
            return False

    def _serialize_item(self, item: Any) -> Dict[str, Any]:
        """Serialize database model to cacheable format"""
        if hasattr(item, '__dict__'):
            # SQLAlchemy model
            serialized = {}
            for key, value in item.__dict__.items():
                if not key.startswith('_'):
                    if isinstance(value, datetime):
                        serialized[key] = value.isoformat()
                    elif hasattr(value, '__dict__'):
                        # Skip relationship objects
                        continue
                    else:
                        serialized[key] = value
            return serialized
        else:
            # Already a dict or other serializable type
            return item

    async def _fetch_recent_documents(self, db: Session, limit: int) -> List[Document]:
        """Fetch recently accessed documents"""
        return db.query(Document).order_by(desc(Document.updated_at)).limit(limit).all()

    async def _fetch_popular_documents(self, db: Session, limit: int) -> List[Document]:
        """Fetch popular documents based on access patterns"""
        # In a real implementation, this would use analytics data
        # For now, return documents with multiple versions (indicating activity)
        return (
            db.query(Document)
            .filter(Document.version > 1)
            .order_by(desc(Document.version), desc(Document.updated_at))
            .limit(limit)
            .all()
        )

    async def _fetch_active_users(self, db: Session, limit: int) -> List[User]:
        """Fetch recently active users"""
        cutoff_date = datetime.utcnow() - timedelta(days=7)
        return (
            db.query(User)
            .filter(User.is_active == True)
            .filter(User.last_login > cutoff_date)
            .order_by(desc(User.last_login))
            .limit(limit)
            .all()
        )

    async def _fetch_popular_templates(self, db: Session, limit: int) -> List[DocumentTemplate]:
        """Fetch popular document templates"""
        return (
            db.query(DocumentTemplate)
            .filter(DocumentTemplate.access_level.in_(["public", "organization"]))
            .order_by(desc(DocumentTemplate.updated_at))
            .limit(limit)
            .all()
        )

    async def _fetch_document_lists(self, db: Session, limit: int) -> List[Dict[str, Any]]:
        """Fetch document type lists for warming"""
        # Get distinct document types
        document_types = db.query(Document.document_type).distinct().limit(limit).all()

        return [{"type": doc_type[0]} for doc_type in document_types]

    async def _fetch_active_workflows(self, db: Session, limit: int) -> List[WorkflowInstance]:
        """Fetch active workflow instances"""
        return (
            db.query(WorkflowInstance)
            .filter(WorkflowInstance.status.in_(["pending", "in_progress"]))
            .order_by(desc(WorkflowInstance.updated_at))
            .limit(limit)
            .all()
        )

    def record_access_pattern(self, cache_type: str, cache_key: str):
        """Record cache access patterns for predictive warming"""
        hour = datetime.utcnow().hour
        self.access_patterns[f"{cache_type}:{cache_key}"][hour] += 1

    def get_predictive_warming_candidates(self, limit: int = 50) -> List[str]:
        """Get cache keys that should be warmed based on access patterns"""
        current_hour = datetime.utcnow().hour
        predicted_hour = (current_hour + 1) % 24

        candidates = []

        for cache_key, hourly_access in self.access_patterns.items():
            # Check if this key is typically accessed in the next hour
            if hourly_access.get(predicted_hour, 0) > 2:  # Threshold of 2+ accesses
                candidates.append(cache_key)

        # Sort by predicted access frequency
        candidates.sort(
            key=lambda k: self.access_patterns[k].get(predicted_hour, 0),
            reverse=True
        )

        return candidates[:limit]

    async def predictive_warming(self) -> WarmingTask:
        """Execute predictive cache warming based on access patterns"""
        rule = WarmingRule(
            name="predictive_warming",
            strategy=WarmingStrategy.PREDICTIVE,
            priority=WarmingPriority.MEDIUM,
            data_fetcher=lambda db, limit: [],  # Not used for predictive
            cache_type="predictive",
            key_generator=lambda x: x,
            ttl=1800,
            batch_size=50
        )

        task = WarmingTask(rule=rule, scheduled_at=datetime.utcnow())
        task.status = "running"

        try:
            candidates = self.get_predictive_warming_candidates()
            warmed_count = 0

            for cache_key in candidates:
                cache_type, key = cache_key.split(":", 1)

                # Check if key is already cached
                if not await cache_service.exists(cache_type, key):
                    # This would require re-fetching data from the database
                    # For now, just count as a candidate
                    warmed_count += 1

            task.items_warmed = warmed_count
            task.status = "completed"

        except Exception as e:
            task.status = "failed"
            task.error_message = str(e)

        self._record_warming_task(task)
        return task

    def _record_warming_task(self, task: WarmingTask):
        """Record warming task in history"""
        self.warming_history.append(task)

        # Keep history size manageable
        if len(self.warming_history) > self.max_history_size:
            self.warming_history = self.warming_history[-self.max_history_size:]

    async def get_warming_stats(self) -> Dict[str, Any]:
        """Get cache warming statistics"""
        total_tasks = len(self.warming_history)
        successful_tasks = len([t for t in self.warming_history if t.status == "completed"])
        failed_tasks = len([t for t in self.warming_history if t.status == "failed"])

        # Calculate average items warmed
        completed_tasks = [t for t in self.warming_history if t.status == "completed"]
        avg_items_warmed = sum(t.items_warmed for t in completed_tasks) / len(completed_tasks) if completed_tasks else 0

        # Calculate average execution time
        avg_execution_time = sum(t.execution_time for t in completed_tasks) / len(completed_tasks) if completed_tasks else 0

        # Count by strategy
        strategy_counts = defaultdict(int)
        for task in self.warming_history:
            strategy_counts[task.rule.strategy.value] += 1

        return {
            "total_tasks": total_tasks,
            "successful_tasks": successful_tasks,
            "failed_tasks": failed_tasks,
            "success_rate": (successful_tasks / total_tasks * 100) if total_tasks > 0 else 0,
            "running_tasks": len(self.running_tasks),
            "avg_items_warmed": round(avg_items_warmed, 2),
            "avg_execution_time": round(avg_execution_time, 2),
            "strategy_counts": dict(strategy_counts),
            "total_rules": len(self.warming_rules),
            "enabled_rules": len([r for r in self.warming_rules.values() if r.enabled]),
            "access_patterns_tracked": len(self.access_patterns)
        }

    async def get_warming_schedule(self) -> Dict[str, Any]:
        """Get warming schedule based on rule frequencies"""
        schedule = {}
        current_time = datetime.utcnow()

        for rule_name, rule in self.warming_rules.items():
            if rule.enabled:
                # Find last execution
                last_execution = None
                for task in reversed(self.warming_history):
                    if task.rule.name == rule_name and task.status == "completed":
                        last_execution = task.scheduled_at
                        break

                # Calculate next execution
                if last_execution:
                    next_execution = last_execution + timedelta(hours=rule.frequency_hours)
                else:
                    next_execution = current_time  # Schedule immediately if never run

                schedule[rule_name] = {
                    "strategy": rule.strategy.value,
                    "priority": rule.priority.value,
                    "frequency_hours": rule.frequency_hours,
                    "last_execution": last_execution.isoformat() if last_execution else None,
                    "next_execution": next_execution.isoformat(),
                    "is_due": next_execution <= current_time,
                    "batch_size": rule.batch_size
                }

        return schedule

    async def execute_due_warming_tasks(self) -> List[WarmingTask]:
        """Execute all warming tasks that are due"""
        schedule = await self.get_warming_schedule()
        tasks = []

        for rule_name, schedule_info in schedule.items():
            if schedule_info["is_due"] and rule_name not in self.running_tasks:
                try:
                    task = await self.warm_cache_by_rule(rule_name)
                    tasks.append(task)
                except Exception as e:
                    logger.error(f"Failed to execute due warming task {rule_name}: {e}")

        return tasks


# Global cache warming service instance
cache_warming_service = CacheWarmingService()


# Utility functions
async def warm_document_cache(document_ids: List[str]) -> int:
    """Warm cache for specific documents"""
    db = next(get_db())
    try:
        documents = db.query(Document).filter(Document.id.in_(document_ids)).all()
        cached_service = CachedDocumentService(db)

        warmed_count = 0
        for doc in documents:
            cache_key = f"doc:{doc.id}"
            doc_dict = cached_service._document_to_dict(doc)
            success = await cache_service.set("document", cache_key, doc_dict)
            if success:
                warmed_count += 1

        return warmed_count
    finally:
        db.close()


async def warm_user_cache(user_ids: List[str]) -> int:
    """Warm cache for specific users"""
    db = next(get_db())
    try:
        users = db.query(User).filter(User.id.in_(user_ids)).all()

        warmed_count = 0
        for user in users:
            cache_key = f"user:{user.id}"
            user_dict = {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role.value if user.role else None,
                "is_active": user.is_active
            }
            success = await cache_service.set("user", cache_key, user_dict)
            if success:
                warmed_count += 1

        return warmed_count
    finally:
        db.close()