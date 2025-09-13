"""
Cache Invalidation Service

Provides intelligent cache invalidation strategies including:
- Event-driven invalidation
- Time-based expiration
- Dependency-based invalidation
- Cascade invalidation patterns
"""

import asyncio
import logging
from typing import Dict, List, Set, Optional, Any, Callable
from datetime import datetime, timedelta
from collections import defaultdict
from enum import Enum

from app.services.cache_service import cache_service


logger = logging.getLogger(__name__)


class InvalidationStrategy(Enum):
    """Cache invalidation strategies"""
    IMMEDIATE = "immediate"
    DELAYED = "delayed"
    TIME_BASED = "time_based"
    DEPENDENCY_CASCADE = "dependency_cascade"
    LAZY = "lazy"


class InvalidationTrigger(Enum):
    """Events that trigger cache invalidation"""
    DOCUMENT_CREATED = "document_created"
    DOCUMENT_UPDATED = "document_updated"
    DOCUMENT_DELETED = "document_deleted"
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DELETED = "user_deleted"
    WORKFLOW_STARTED = "workflow_started"
    WORKFLOW_COMPLETED = "workflow_completed"
    TEMPLATE_CREATED = "template_created"
    TEMPLATE_UPDATED = "template_updated"
    TEMPLATE_DELETED = "template_deleted"
    SEARCH_INDEX_UPDATED = "search_index_updated"
    SYSTEM_MAINTENANCE = "system_maintenance"


class CacheInvalidationRule:
    """Defines cache invalidation rules"""

    def __init__(
        self,
        trigger: InvalidationTrigger,
        cache_patterns: List[str],
        strategy: InvalidationStrategy = InvalidationStrategy.IMMEDIATE,
        delay_seconds: int = 0,
        cascade_dependencies: List[str] = None
    ):
        self.trigger = trigger
        self.cache_patterns = cache_patterns
        self.strategy = strategy
        self.delay_seconds = delay_seconds
        self.cascade_dependencies = cascade_dependencies or []
        self.created_at = datetime.utcnow()


class CacheInvalidationService:
    """Manages cache invalidation across the application"""

    def __init__(self):
        self.invalidation_rules: Dict[InvalidationTrigger, List[CacheInvalidationRule]] = defaultdict(list)
        self.pending_invalidations: List[Dict[str, Any]] = []
        self.invalidation_history: List[Dict[str, Any]] = []
        self.max_history_size = 1000

        # Dependency graph for cascade invalidation
        self.dependency_graph: Dict[str, Set[str]] = defaultdict(set)

        # Register default invalidation rules
        self._register_default_rules()

    def _register_default_rules(self):
        """Register default cache invalidation rules"""

        # Document-related invalidations
        self.add_rule(CacheInvalidationRule(
            trigger=InvalidationTrigger.DOCUMENT_CREATED,
            cache_patterns=[
                "document:docs:*",
                "document:type:*",
                "document:popular:*",
                "search:*"
            ],
            strategy=InvalidationStrategy.IMMEDIATE
        ))

        self.add_rule(CacheInvalidationRule(
            trigger=InvalidationTrigger.DOCUMENT_UPDATED,
            cache_patterns=[
                "document:doc:{document_id}",
                "document:docs:*",
                "document:type:{document_type}",
                "search:*"
            ],
            strategy=InvalidationStrategy.IMMEDIATE
        ))

        self.add_rule(CacheInvalidationRule(
            trigger=InvalidationTrigger.DOCUMENT_DELETED,
            cache_patterns=[
                "document:doc:{document_id}",
                "document:docs:*",
                "document:type:*",
                "search:*"
            ],
            strategy=InvalidationStrategy.IMMEDIATE
        ))

        # User-related invalidations
        self.add_rule(CacheInvalidationRule(
            trigger=InvalidationTrigger.USER_UPDATED,
            cache_patterns=[
                "user:user:{user_id}",
                "user:*"
            ],
            strategy=InvalidationStrategy.IMMEDIATE
        ))

        # Template-related invalidations
        self.add_rule(CacheInvalidationRule(
            trigger=InvalidationTrigger.TEMPLATE_CREATED,
            cache_patterns=[
                "template:*",
                "document:docs:*"  # Templates affect document lists
            ],
            strategy=InvalidationStrategy.IMMEDIATE
        ))

        self.add_rule(CacheInvalidationRule(
            trigger=InvalidationTrigger.TEMPLATE_UPDATED,
            cache_patterns=[
                "template:template:{template_id}",
                "template:*"
            ],
            strategy=InvalidationStrategy.IMMEDIATE
        ))

        # Workflow-related invalidations
        self.add_rule(CacheInvalidationRule(
            trigger=InvalidationTrigger.WORKFLOW_COMPLETED,
            cache_patterns=[
                "workflow:*",
                "document:doc:{document_id}",  # Workflow completion may update document
                "analytics:*"
            ],
            strategy=InvalidationStrategy.DELAYED,
            delay_seconds=30  # Allow time for workflow processing
        ))

        # Search index invalidations
        self.add_rule(CacheInvalidationRule(
            trigger=InvalidationTrigger.SEARCH_INDEX_UPDATED,
            cache_patterns=[
                "search:*",
                "analytics:*"
            ],
            strategy=InvalidationStrategy.DELAYED,
            delay_seconds=60  # Search index updates can be delayed
        ))

    def add_rule(self, rule: CacheInvalidationRule):
        """Add a cache invalidation rule"""
        self.invalidation_rules[rule.trigger].append(rule)
        logger.debug(f"Added invalidation rule for trigger: {rule.trigger.value}")

    def remove_rule(self, trigger: InvalidationTrigger, rule_index: int = 0) -> bool:
        """Remove a cache invalidation rule"""
        if trigger in self.invalidation_rules:
            rules = self.invalidation_rules[trigger]
            if 0 <= rule_index < len(rules):
                removed_rule = rules.pop(rule_index)
                logger.debug(f"Removed invalidation rule for trigger: {trigger.value}")
                return True
        return False

    async def trigger_invalidation(
        self,
        trigger: InvalidationTrigger,
        context: Optional[Dict[str, Any]] = None
    ):
        """Trigger cache invalidation based on an event"""
        context = context or {}

        if trigger not in self.invalidation_rules:
            logger.debug(f"No invalidation rules for trigger: {trigger.value}")
            return

        rules = self.invalidation_rules[trigger]
        logger.info(f"Processing {len(rules)} invalidation rules for trigger: {trigger.value}")

        for rule in rules:
            await self._execute_invalidation_rule(rule, context)

    async def _execute_invalidation_rule(
        self,
        rule: CacheInvalidationRule,
        context: Dict[str, Any]
    ):
        """Execute a single invalidation rule"""
        try:
            # Format cache patterns with context variables
            formatted_patterns = []
            for pattern in rule.cache_patterns:
                formatted_pattern = pattern.format(**context)
                formatted_patterns.append(formatted_pattern)

            invalidation_task = {
                'rule': rule,
                'patterns': formatted_patterns,
                'context': context,
                'scheduled_at': datetime.utcnow(),
                'executed_at': None,
                'status': 'pending'
            }

            if rule.strategy == InvalidationStrategy.IMMEDIATE:
                await self._execute_immediate_invalidation(invalidation_task)

            elif rule.strategy == InvalidationStrategy.DELAYED:
                await self._schedule_delayed_invalidation(invalidation_task)

            elif rule.strategy == InvalidationStrategy.DEPENDENCY_CASCADE:
                await self._execute_cascade_invalidation(invalidation_task)

            elif rule.strategy == InvalidationStrategy.TIME_BASED:
                await self._schedule_time_based_invalidation(invalidation_task)

            elif rule.strategy == InvalidationStrategy.LAZY:
                await self._mark_for_lazy_invalidation(invalidation_task)

        except Exception as e:
            logger.error(f"Failed to execute invalidation rule: {e}")

    async def _execute_immediate_invalidation(self, task: Dict[str, Any]):
        """Execute immediate cache invalidation"""
        try:
            rule = task['rule']
            patterns = task['patterns']

            invalidated_count = 0

            for pattern in patterns:
                # Extract cache type and key pattern
                cache_type, key_pattern = self._parse_cache_pattern(pattern)

                if '*' in key_pattern:
                    # Pattern-based invalidation
                    count = await cache_service.delete_pattern(cache_type, key_pattern)
                    invalidated_count += count
                else:
                    # Single key invalidation
                    success = await cache_service.delete(cache_type, key_pattern)
                    if success:
                        invalidated_count += 1

            task['executed_at'] = datetime.utcnow()
            task['status'] = 'completed'
            task['invalidated_count'] = invalidated_count

            self._record_invalidation(task)

            logger.info(f"Immediate invalidation completed: {invalidated_count} keys invalidated")

        except Exception as e:
            task['status'] = 'failed'
            task['error'] = str(e)
            self._record_invalidation(task)
            logger.error(f"Immediate invalidation failed: {e}")

    async def _schedule_delayed_invalidation(self, task: Dict[str, Any]):
        """Schedule delayed cache invalidation"""
        rule = task['rule']
        task['execute_at'] = datetime.utcnow() + timedelta(seconds=rule.delay_seconds)

        self.pending_invalidations.append(task)

        logger.debug(f"Scheduled delayed invalidation for {rule.delay_seconds} seconds")

        # Schedule the actual execution
        asyncio.create_task(self._execute_delayed_task(task))

    async def _execute_delayed_task(self, task: Dict[str, Any]):
        """Execute a delayed invalidation task"""
        rule = task['rule']
        await asyncio.sleep(rule.delay_seconds)

        # Convert to immediate execution
        task['rule'].strategy = InvalidationStrategy.IMMEDIATE
        await self._execute_immediate_invalidation(task)

        # Remove from pending list
        if task in self.pending_invalidations:
            self.pending_invalidations.remove(task)

    async def _execute_cascade_invalidation(self, task: Dict[str, Any]):
        """Execute cascade invalidation based on dependencies"""
        try:
            patterns = task['patterns']
            invalidated_keys = set()

            # Find all dependent keys
            all_patterns_to_invalidate = set(patterns)

            for pattern in patterns:
                dependencies = self._find_dependencies(pattern)
                all_patterns_to_invalidate.update(dependencies)

            # Execute invalidation for all patterns
            invalidated_count = 0
            for pattern in all_patterns_to_invalidate:
                cache_type, key_pattern = self._parse_cache_pattern(pattern)

                if '*' in key_pattern:
                    count = await cache_service.delete_pattern(cache_type, key_pattern)
                    invalidated_count += count
                else:
                    success = await cache_service.delete(cache_type, key_pattern)
                    if success:
                        invalidated_count += 1

            task['executed_at'] = datetime.utcnow()
            task['status'] = 'completed'
            task['invalidated_count'] = invalidated_count
            task['cascade_patterns'] = list(all_patterns_to_invalidate)

            self._record_invalidation(task)

            logger.info(f"Cascade invalidation completed: {invalidated_count} keys invalidated")

        except Exception as e:
            task['status'] = 'failed'
            task['error'] = str(e)
            self._record_invalidation(task)
            logger.error(f"Cascade invalidation failed: {e}")

    async def _schedule_time_based_invalidation(self, task: Dict[str, Any]):
        """Schedule time-based invalidation (e.g., daily cleanup)"""
        # This would integrate with a job scheduler like Celery
        # For now, just mark as scheduled
        task['status'] = 'scheduled'
        self.pending_invalidations.append(task)

        logger.debug("Time-based invalidation scheduled")

    async def _mark_for_lazy_invalidation(self, task: Dict[str, Any]):
        """Mark cache entries for lazy invalidation (invalidate on next access)"""
        try:
            patterns = task['patterns']

            for pattern in patterns:
                cache_type, key_pattern = self._parse_cache_pattern(pattern)

                # Set a special marker for lazy invalidation
                lazy_key = f"lazy_invalidate:{cache_type}:{key_pattern}"
                await cache_service.set("metadata", lazy_key, True, ttl=3600)  # 1 hour marker

            task['executed_at'] = datetime.utcnow()
            task['status'] = 'completed'

            self._record_invalidation(task)

            logger.debug(f"Lazy invalidation markers set for {len(patterns)} patterns")

        except Exception as e:
            task['status'] = 'failed'
            task['error'] = str(e)
            self._record_invalidation(task)
            logger.error(f"Lazy invalidation marking failed: {e}")

    def _parse_cache_pattern(self, pattern: str) -> tuple[str, str]:
        """Parse cache pattern into cache type and key pattern"""
        parts = pattern.split(':', 1)
        if len(parts) == 2:
            return parts[0], parts[1]
        else:
            return 'general', pattern

    def _find_dependencies(self, pattern: str) -> Set[str]:
        """Find dependent cache keys for cascade invalidation"""
        dependencies = set()

        # Check dependency graph
        for key, deps in self.dependency_graph.items():
            if pattern in deps:
                dependencies.add(key)

        return dependencies

    def add_dependency(self, dependent_key: str, dependency_key: str):
        """Add a cache dependency relationship"""
        self.dependency_graph[dependent_key].add(dependency_key)

    def remove_dependency(self, dependent_key: str, dependency_key: str):
        """Remove a cache dependency relationship"""
        if dependent_key in self.dependency_graph:
            self.dependency_graph[dependent_key].discard(dependency_key)

    def _record_invalidation(self, task: Dict[str, Any]):
        """Record invalidation in history"""
        history_entry = {
            'trigger': task['rule'].trigger.value,
            'strategy': task['rule'].strategy.value,
            'patterns': task['patterns'],
            'executed_at': task.get('executed_at'),
            'status': task['status'],
            'invalidated_count': task.get('invalidated_count', 0),
            'error': task.get('error'),
            'context': task.get('context', {})
        }

        self.invalidation_history.append(history_entry)

        # Keep history size manageable
        if len(self.invalidation_history) > self.max_history_size:
            self.invalidation_history = self.invalidation_history[-self.max_history_size:]

    async def check_lazy_invalidation(self, cache_type: str, key: str) -> bool:
        """Check if a cache key should be lazily invalidated"""
        lazy_key = f"lazy_invalidate:{cache_type}:{key}"
        marker = await cache_service.get("metadata", lazy_key)

        if marker:
            # Invalidate the cache entry
            await cache_service.delete(cache_type, key)
            # Remove the lazy marker
            await cache_service.delete("metadata", lazy_key)
            return True

        return False

    async def get_pending_invalidations(self) -> List[Dict[str, Any]]:
        """Get list of pending invalidations"""
        return [
            {
                'trigger': task['rule'].trigger.value,
                'strategy': task['rule'].strategy.value,
                'scheduled_at': task['scheduled_at'],
                'execute_at': task.get('execute_at'),
                'patterns': task['patterns'],
                'status': task['status']
            }
            for task in self.pending_invalidations
        ]

    async def get_invalidation_stats(self) -> Dict[str, Any]:
        """Get cache invalidation statistics"""
        total_invalidations = len(self.invalidation_history)
        successful_invalidations = len([h for h in self.invalidation_history if h['status'] == 'completed'])
        failed_invalidations = len([h for h in self.invalidation_history if h['status'] == 'failed'])

        # Count by trigger type
        trigger_counts = defaultdict(int)
        for entry in self.invalidation_history:
            trigger_counts[entry['trigger']] += 1

        # Count by strategy
        strategy_counts = defaultdict(int)
        for entry in self.invalidation_history:
            strategy_counts[entry['strategy']] += 1

        return {
            'total_invalidations': total_invalidations,
            'successful_invalidations': successful_invalidations,
            'failed_invalidations': failed_invalidations,
            'success_rate': (successful_invalidations / total_invalidations * 100) if total_invalidations > 0 else 0,
            'pending_invalidations': len(self.pending_invalidations),
            'trigger_counts': dict(trigger_counts),
            'strategy_counts': dict(strategy_counts),
            'total_rules': sum(len(rules) for rules in self.invalidation_rules.values())
        }

    async def manual_invalidation(
        self,
        cache_patterns: List[str],
        strategy: InvalidationStrategy = InvalidationStrategy.IMMEDIATE,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Manually trigger cache invalidation"""
        rule = CacheInvalidationRule(
            trigger=InvalidationTrigger.SYSTEM_MAINTENANCE,
            cache_patterns=cache_patterns,
            strategy=strategy
        )

        task = {
            'rule': rule,
            'patterns': cache_patterns,
            'context': context or {},
            'scheduled_at': datetime.utcnow(),
            'executed_at': None,
            'status': 'pending'
        }

        await self._execute_invalidation_rule(rule, context or {})

        return {
            'success': True,
            'patterns': cache_patterns,
            'strategy': strategy.value,
            'executed_at': task.get('executed_at')
        }


# Global cache invalidation service instance
cache_invalidation_service = CacheInvalidationService()


# Convenience functions for common invalidation patterns
async def invalidate_document_cache(document_id: str, document_type: str = None):
    """Invalidate document-related caches"""
    context = {'document_id': document_id}
    if document_type:
        context['document_type'] = document_type

    await cache_invalidation_service.trigger_invalidation(
        InvalidationTrigger.DOCUMENT_UPDATED,
        context
    )


async def invalidate_user_cache(user_id: str):
    """Invalidate user-related caches"""
    await cache_invalidation_service.trigger_invalidation(
        InvalidationTrigger.USER_UPDATED,
        {'user_id': user_id}
    )


async def invalidate_template_cache(template_id: str):
    """Invalidate template-related caches"""
    await cache_invalidation_service.trigger_invalidation(
        InvalidationTrigger.TEMPLATE_UPDATED,
        {'template_id': template_id}
    )


async def invalidate_search_cache():
    """Invalidate search-related caches"""
    await cache_invalidation_service.trigger_invalidation(
        InvalidationTrigger.SEARCH_INDEX_UPDATED
    )