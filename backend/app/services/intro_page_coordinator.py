"""
Intro Page Coordinator Service
Orchestrates all data sources for the personalized intro page, manages caching, and provides performance optimization
"""
import logging
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy.exc import SQLAlchemyError

# Import all the service dependencies
from app.services.user_stats_service import UserStatsService
from app.services.system_stats_service import SystemStatsService
from app.services.actionable_items_service import ActionableItemsService
from app.services.activity_feed_service import ActivityFeedService

logger = logging.getLogger(__name__)


class IntroPageCoordinator:
    """Coordinator service for orchestrating all intro page data sources and personalization"""

    def __init__(self):
        # Initialize all service dependencies
        self.user_stats_service = UserStatsService()
        self.system_stats_service = SystemStatsService()
        self.actionable_items_service = ActionableItemsService()
        self.activity_feed_service = ActivityFeedService()

        # Coordination cache
        self.coordination_cache = {}
        self.cache_ttl = 180  # 3 minutes for full coordination cache

        # Performance tracking
        self.performance_metrics = {
            'service_response_times': {},
            'cache_hit_rates': {},
            'error_counts': {},
            'optimization_hints': []
        }

        # Personalization settings
        self.personalization_config = {
            'max_quick_actions': 6,
            'max_recent_documents': 5,
            'max_activity_items': 8,
            'urgent_threshold': 3,
            'productivity_insights_count': 3
        }

    async def get_intro_page_data(self, user_id: str, parallel: bool = True,
                                include_real_time: bool = False) -> Dict[str, Any]:
        """
        Get comprehensive intro page data by coordinating all services

        Args:
            user_id: User ID to get intro page data for
            parallel: Whether to fetch data in parallel for performance
            include_real_time: Whether to include real-time updates

        Returns:
            Dictionary with coordinated intro page data
        """
        if not user_id:
            return self._get_error_response("Invalid user ID")

        coordination_start = datetime.utcnow()
        cache_key = f"intro_page_{user_id}"

        # Check coordination cache first (unless real-time requested)
        if not include_real_time and self._is_coordination_cache_valid(cache_key):
            logger.info(f"Returning cached intro page data for user {user_id}")
            cached_data = self.coordination_cache[cache_key]['data']
            cached_data['cache_hit'] = True
            return cached_data

        try:
            # Fetch data from all services
            if parallel:
                service_data = await self._fetch_data_parallel(user_id, include_real_time)
            else:
                service_data = await self._fetch_data_sequential(user_id, include_real_time)

            # Extract individual service results
            user_statistics = service_data.get('user_statistics')
            system_overview = service_data.get('system_overview')
            actionable_items = service_data.get('actionable_items')
            activity_feed = service_data.get('activity_feed')
            service_errors = service_data.get('service_errors', {})

            # Generate personalized content
            personalization = await self.get_personalized_content(
                user_id, user_statistics, actionable_items, activity_feed
            )

            # Calculate performance metrics
            performance_metrics = await self.calculate_performance_metrics(user_id)

            # Generate layout recommendations
            layout_recommendations = self._generate_layout_recommendations(
                user_statistics, actionable_items, activity_feed
            )

            # Calculate coordination time
            coordination_end = datetime.utcnow()
            coordination_time_ms = (coordination_end - coordination_start).total_seconds() * 1000

            # Assemble final response
            intro_page_data = {
                'user_id': user_id,
                'user_statistics': user_statistics,
                'system_overview': system_overview,
                'actionable_items': actionable_items,
                'activity_feed': activity_feed,
                'personalization': personalization,
                'performance_metrics': performance_metrics,
                'layout_recommendations': layout_recommendations,
                'data_sources': self._get_data_source_info(),
                'coordination_time_ms': coordination_time_ms,
                'last_updated': coordination_end.isoformat(),
                'cache_hit': False,
                'service_errors': service_errors,
                'fallback_data': len(service_errors) > 0,
                'data_freshness': self._calculate_data_freshness(service_data),
                'real_time_updates': self._get_real_time_info(include_real_time)
            }

            # Cache the result (if not real-time)
            if not include_real_time:
                self._cache_coordination_data(cache_key, intro_page_data)

            logger.info(f"Intro page data coordinated for user {user_id} in {coordination_time_ms:.2f}ms")
            return intro_page_data

        except Exception as e:
            logger.error(f"Error coordinating intro page data for user {user_id}: {e}")
            return self._get_error_response(str(e))

    async def _fetch_data_parallel(self, user_id: str, include_real_time: bool = False) -> Dict[str, Any]:
        """Fetch data from all services in parallel for optimal performance"""
        service_data = {}
        service_errors = {}

        # Create tasks for parallel execution
        tasks = {
            'user_statistics': self._safe_service_call(
                self.user_stats_service.get_user_statistics, user_id
            ),
            'system_overview': self._safe_service_call(
                self.system_stats_service.get_system_overview
            ),
            'actionable_items': self._safe_service_call(
                self.actionable_items_service.get_user_actionable_items, user_id
            ),
            'activity_feed': self._safe_service_call(
                self.activity_feed_service.get_user_activity_feed,
                user_id, limit=self.personalization_config['max_activity_items'],
                include_real_time=include_real_time
            )
        }

        # Execute all tasks in parallel
        results = await asyncio.gather(*tasks.values(), return_exceptions=True)

        # Process results
        for i, (service_name, task) in enumerate(tasks.items()):
            result = results[i]
            if isinstance(result, Exception):
                logger.error(f"Service {service_name} failed: {result}")
                service_errors[service_name] = str(result)
                service_data[service_name] = self._get_fallback_data(service_name)
            else:
                service_data[service_name] = result

        service_data['service_errors'] = service_errors
        return service_data

    async def _fetch_data_sequential(self, user_id: str, include_real_time: bool = False) -> Dict[str, Any]:
        """Fetch data from all services sequentially (fallback method)"""
        service_data = {}
        service_errors = {}

        # Fetch user statistics
        try:
            service_data['user_statistics'] = await self.user_stats_service.get_user_statistics(user_id)
        except Exception as e:
            logger.error(f"User statistics service failed: {e}")
            service_errors['user_statistics'] = str(e)
            service_data['user_statistics'] = self._get_fallback_data('user_statistics')

        # Fetch system overview
        try:
            service_data['system_overview'] = await self.system_stats_service.get_system_overview()
        except Exception as e:
            logger.error(f"System overview service failed: {e}")
            service_errors['system_overview'] = str(e)
            service_data['system_overview'] = self._get_fallback_data('system_overview')

        # Fetch actionable items
        try:
            service_data['actionable_items'] = await self.actionable_items_service.get_user_actionable_items(user_id)
        except Exception as e:
            logger.error(f"Actionable items service failed: {e}")
            service_errors['actionable_items'] = str(e)
            service_data['actionable_items'] = self._get_fallback_data('actionable_items')

        # Fetch activity feed
        try:
            service_data['activity_feed'] = await self.activity_feed_service.get_user_activity_feed(
                user_id, limit=self.personalization_config['max_activity_items'],
                include_real_time=include_real_time
            )
        except Exception as e:
            logger.error(f"Activity feed service failed: {e}")
            service_errors['activity_feed'] = str(e)
            service_data['activity_feed'] = self._get_fallback_data('activity_feed')

        service_data['service_errors'] = service_errors
        return service_data

    async def _safe_service_call(self, service_method, *args, **kwargs):
        """Safely call a service method with error handling"""
        try:
            return await service_method(*args, **kwargs)
        except Exception as e:
            # Re-raise to be caught by the parallel executor
            raise e

    async def get_personalized_content(self, user_id: str, user_statistics: Optional[Dict] = None,
                                     actionable_items: Optional[Dict] = None,
                                     activity_feed: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Generate personalized content based on user data and context

        Args:
            user_id: User ID for personalization
            user_statistics: User's statistics data
            actionable_items: User's actionable items
            activity_feed: User's activity feed

        Returns:
            Dictionary with personalized content
        """
        try:
            # Generate welcome message
            welcome_message = self._generate_welcome_message(user_id, user_statistics)

            # Generate quick actions based on user context
            quick_actions = self._generate_quick_actions(user_statistics, actionable_items, activity_feed)

            # Suggest workflows based on user patterns
            suggested_workflows = self._generate_workflow_suggestions(user_statistics, activity_feed)

            # Get recent documents with personalized relevance
            recent_documents = self._get_personalized_recent_documents(activity_feed)

            # Generate productivity insights
            productivity_insights = self._generate_productivity_insights(user_statistics, actionable_items)

            # Check for urgent alerts
            urgent_alerts = self._generate_urgent_alerts(actionable_items)

            personalization = {
                'welcome_message': welcome_message,
                'quick_actions': quick_actions,
                'suggested_workflows': suggested_workflows,
                'recent_documents': recent_documents,
                'productivity_insights': productivity_insights,
                'urgent_alerts': urgent_alerts,
                'personalization_score': self._calculate_personalization_score(
                    user_statistics, actionable_items, activity_feed
                )
            }

            return personalization

        except Exception as e:
            logger.error(f"Error generating personalized content for user {user_id}: {e}")
            return self._get_fallback_personalization(user_id)

    async def calculate_performance_metrics(self, user_id: str) -> Dict[str, Any]:
        """
        Calculate performance metrics and optimization recommendations

        Args:
            user_id: User ID for context

        Returns:
            Dictionary with performance metrics and recommendations
        """
        try:
            # Calculate service response times
            response_times = {
                'user_statistics_service': self._get_service_response_time('user_statistics'),
                'system_stats_service': self._get_service_response_time('system_overview'),
                'actionable_items_service': self._get_service_response_time('actionable_items'),
                'activity_feed_service': self._get_service_response_time('activity_feed')
            }

            # Calculate cache hit rates
            cache_hit_rates = {
                'user_statistics': self._get_cache_hit_rate('user_statistics'),
                'system_overview': self._get_cache_hit_rate('system_overview'),
                'actionable_items': self._get_cache_hit_rate('actionable_items'),
                'activity_feed': self._get_cache_hit_rate('activity_feed'),
                'coordination': self._get_cache_hit_rate('coordination')
            }

            # Calculate data freshness
            data_freshness_score = self._calculate_overall_freshness_score()

            # Monitor service health
            service_health = {
                'user_statistics_service': self._get_service_health('user_statistics'),
                'system_stats_service': self._get_service_health('system_overview'),
                'actionable_items_service': self._get_service_health('actionable_items'),
                'activity_feed_service': self._get_service_health('activity_feed')
            }

            # Generate optimization hints
            optimization_hints = self._generate_optimization_hints(response_times, cache_hit_rates)

            performance_metrics = {
                'response_times': response_times,
                'cache_hit_rates': cache_hit_rates,
                'data_freshness': {'overall_score': data_freshness_score},
                'service_health': service_health,
                'optimization_hints': optimization_hints,
                'calculated_at': datetime.utcnow().isoformat()
            }

            return performance_metrics

        except Exception as e:
            logger.error(f"Error calculating performance metrics for user {user_id}: {e}")
            return self._get_default_performance_metrics()

    def _generate_welcome_message(self, user_id: str, user_statistics: Optional[Dict]) -> str:
        """Generate personalized welcome message"""
        if not user_statistics:
            return f"Welcome back! Ready to get productive?"

        docs_created = user_statistics.get('documents_created', 0)
        productivity_score = user_statistics.get('productivity_score', 0)

        if productivity_score > 80:
            return f"Welcome back, superstar! You've created {docs_created} documents and are crushing it! 🌟"
        elif productivity_score > 60:
            return f"Welcome back! You've been productive with {docs_created} documents created. Keep it up! 💪"
        elif docs_created > 0:
            return f"Welcome back! You have {docs_created} documents in progress. Let's make some progress! 📝"
        else:
            return "Welcome! Ready to create something amazing today? ✨"

    def _generate_quick_actions(self, user_statistics: Optional[Dict],
                              actionable_items: Optional[Dict],
                              activity_feed: Optional[Dict]) -> List[Dict[str, Any]]:
        """Generate contextual quick actions based on user data"""
        quick_actions = []

        # Always include create document
        quick_actions.append({
            'id': 'create_document',
            'title': 'Create New Document',
            'icon': '📄',
            'url': '/documents/new',
            'priority': 1
        })

        # Add urgent actions based on actionable items
        if actionable_items and actionable_items.get('urgent_items_count', 0) > 0:
            quick_actions.append({
                'id': 'review_urgent',
                'title': f"Review {actionable_items['urgent_items_count']} Urgent Items",
                'icon': '🚨',
                'url': '/dashboard/urgent',
                'priority': 5
            })

        # Add pending approvals if any
        if actionable_items and len(actionable_items.get('pending_approvals', [])) > 0:
            quick_actions.append({
                'id': 'pending_approvals',
                'title': f"Process {len(actionable_items['pending_approvals'])} Approvals",
                'icon': '✅',
                'url': '/workflows/pending',
                'priority': 4
            })

        # Add draft documents if any
        if actionable_items and len(actionable_items.get('draft_documents', [])) > 0:
            quick_actions.append({
                'id': 'continue_drafts',
                'title': f"Continue {len(actionable_items['draft_documents'])} Drafts",
                'icon': '✏️',
                'url': '/documents/drafts',
                'priority': 3
            })

        # Add view reports
        quick_actions.append({
            'id': 'view_reports',
            'title': 'View Reports',
            'icon': '📊',
            'url': '/reports',
            'priority': 2
        })

        # Add manage workflows
        quick_actions.append({
            'id': 'manage_workflows',
            'title': 'Manage Workflows',
            'icon': '🔄',
            'url': '/workflows',
            'priority': 2
        })

        # Sort by priority and limit
        quick_actions.sort(key=lambda x: x['priority'], reverse=True)
        return quick_actions[:self.personalization_config['max_quick_actions']]

    def _generate_workflow_suggestions(self, user_statistics: Optional[Dict],
                                     activity_feed: Optional[Dict]) -> List[Dict[str, Any]]:
        """Generate suggested workflows based on user patterns"""
        suggestions = []

        # Default suggestions
        suggestions.extend([
            {
                'id': 'document_review',
                'title': 'Document Review Workflow',
                'description': 'Standard document review and approval process',
                'estimated_time': '2-3 days'
            },
            {
                'id': 'policy_approval',
                'title': 'Policy Approval Workflow',
                'description': 'Multi-step policy approval with stakeholder review',
                'estimated_time': '1-2 weeks'
            }
        ])

        # Add suggestions based on user activity
        if user_statistics and user_statistics.get('documents_created', 0) > 5:
            suggestions.append({
                'id': 'bulk_document_review',
                'title': 'Bulk Document Review',
                'description': 'Efficiently review multiple documents at once',
                'estimated_time': '1-2 days'
            })

        return suggestions[:3]  # Limit to 3 suggestions

    def _get_personalized_recent_documents(self, activity_feed: Optional[Dict]) -> List[Dict[str, Any]]:
        """Extract recent documents from activity feed"""
        recent_documents = []

        if activity_feed and activity_feed.get('activities'):
            for activity in activity_feed['activities'][:self.personalization_config['max_recent_documents']]:
                if activity.get('document_title'):
                    recent_documents.append({
                        'id': activity.get('document_id'),
                        'title': activity['document_title'],
                        'last_activity': activity.get('timestamp'),
                        'activity_type': activity.get('activity_type')
                    })

        return recent_documents

    def _generate_productivity_insights(self, user_statistics: Optional[Dict],
                                      actionable_items: Optional[Dict]) -> List[Dict[str, Any]]:
        """Generate productivity insights and tips"""
        insights = []

        if user_statistics:
            productivity_score = user_statistics.get('productivity_score', 0)

            if productivity_score > 80:
                insights.append({
                    'type': 'achievement',
                    'title': 'High Productivity',
                    'message': 'You\'re in the top tier of productivity! Keep up the excellent work.',
                    'icon': '🏆'
                })

            if actionable_items and actionable_items.get('urgent_items_count', 0) > 3:
                insights.append({
                    'type': 'warning',
                    'title': 'High Urgency Load',
                    'message': 'Consider prioritizing urgent items to maintain workflow efficiency.',
                    'icon': '⚠️'
                })

            if user_statistics.get('documents_created', 0) > 0:
                insights.append({
                    'type': 'tip',
                    'title': 'Document Progress',
                    'message': f'You\'ve created {user_statistics["documents_created"]} documents. Great progress!',
                    'icon': '📈'
                })

        return insights[:self.personalization_config['productivity_insights_count']]

    def _generate_urgent_alerts(self, actionable_items: Optional[Dict]) -> List[Dict[str, Any]]:
        """Generate urgent alerts for immediate attention"""
        alerts = []

        if actionable_items:
            urgent_count = actionable_items.get('urgent_items_count', 0)

            if urgent_count >= self.personalization_config['urgent_threshold']:
                alerts.append({
                    'type': 'urgent',
                    'title': 'Urgent Items Require Attention',
                    'message': f'{urgent_count} items need immediate attention',
                    'action_url': '/dashboard/urgent'
                })

            # Check for overdue reviews
            overdue_reviews = actionable_items.get('overdue_reviews', [])
            if len(overdue_reviews) > 0:
                alerts.append({
                    'type': 'overdue',
                    'title': 'Overdue Reviews',
                    'message': f'{len(overdue_reviews)} reviews are overdue',
                    'action_url': '/reviews/overdue'
                })

        return alerts

    def _calculate_personalization_score(self, user_statistics: Optional[Dict],
                                       actionable_items: Optional[Dict],
                                       activity_feed: Optional[Dict]) -> float:
        """Calculate how well personalized the content is (0-100)"""
        score = 50.0  # Base score

        # Increase score based on available data
        if user_statistics:
            score += 15
        if actionable_items:
            score += 15
        if activity_feed and len(activity_feed.get('activities', [])) > 0:
            score += 15

        # Increase score based on urgency relevance
        if actionable_items and actionable_items.get('urgent_items_count', 0) > 0:
            score += 5

        return min(100.0, score)

    def _generate_layout_recommendations(self, user_statistics: Optional[Dict],
                                       actionable_items: Optional[Dict],
                                       activity_feed: Optional[Dict]) -> Dict[str, Any]:
        """Generate adaptive layout recommendations based on user context"""
        urgent_widgets = []
        hidden_widgets = []
        widget_priorities = {
            'user_statistics': 3,
            'system_overview': 2,
            'actionable_items': 4,
            'activity_feed': 3,
            'personalization': 5
        }

        # Prioritize actionable items if urgent
        if actionable_items and actionable_items.get('urgent_items_count', 0) > 0:
            urgent_widgets.append('actionable_items')
            widget_priorities['actionable_items'] = 5

        # Hide system overview if no admin privileges (simplified logic)
        if not user_statistics or user_statistics.get('documents_created', 0) < 10:
            hidden_widgets.append('system_overview')

        return {
            'widget_priorities': widget_priorities,
            'urgent_widgets': urgent_widgets,
            'hidden_widgets': hidden_widgets,
            'layout_mode': 'urgent' if len(urgent_widgets) > 0 else 'standard'
        }

    def _calculate_data_freshness(self, service_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate data freshness for each service"""
        freshness = {}
        current_time = datetime.utcnow()

        for service_name, data in service_data.items():
            if service_name == 'service_errors':
                continue

            if data and 'last_updated' in data:
                try:
                    last_updated = datetime.fromisoformat(data['last_updated'].replace('Z', '+00:00').replace('+00:00', ''))
                    age_seconds = (current_time - last_updated).total_seconds()
                    freshness[service_name] = {
                        'last_updated': data['last_updated'],
                        'age_seconds': age_seconds,
                        'freshness_score': max(0, 100 - (age_seconds / 60))  # Decay over minutes
                    }
                except (ValueError, TypeError):
                    freshness[service_name] = {
                        'last_updated': 'unknown',
                        'age_seconds': 0,
                        'freshness_score': 50
                    }
            else:
                freshness[service_name] = {
                    'last_updated': 'unavailable',
                    'age_seconds': 0,
                    'freshness_score': 0
                }

        return freshness

    def _get_real_time_info(self, include_real_time: bool) -> Dict[str, Any]:
        """Get real-time update information"""
        return {
            'supported_services': ['activity_feed_service'],
            'update_frequency_ms': 30000,  # 30 seconds
            'last_sync': datetime.utcnow().isoformat(),
            'enabled': include_real_time
        }

    def _get_data_source_info(self) -> Dict[str, Any]:
        """Get information about data sources"""
        return {
            'user_statistics': 'user_stats_service',
            'system_overview': 'system_stats_service',
            'actionable_items': 'actionable_items_service',
            'activity_feed': 'activity_feed_service',
            'coordination_layer': 'intro_page_coordinator'
        }

    def _get_service_response_time(self, service_name: str) -> float:
        """Get estimated response time for a service (mock implementation)"""
        # In real implementation, this would track actual response times
        mock_times = {
            'user_statistics': 45.0,
            'system_overview': 120.0,
            'actionable_items': 85.0,
            'activity_feed': 65.0
        }
        return mock_times.get(service_name, 100.0)

    def _get_cache_hit_rate(self, service_name: str) -> float:
        """Get cache hit rate for a service (mock implementation)"""
        # In real implementation, this would track actual cache statistics
        mock_rates = {
            'user_statistics': 85.5,
            'system_overview': 95.2,
            'actionable_items': 78.3,
            'activity_feed': 65.7,
            'coordination': 88.9
        }
        return mock_rates.get(service_name, 75.0)

    def _calculate_overall_freshness_score(self) -> float:
        """Calculate overall data freshness score"""
        # Mock implementation - in reality would aggregate from all services
        return 85.5

    def _get_service_health(self, service_name: str) -> Dict[str, Any]:
        """Get health status for a service"""
        # Mock implementation - in reality would ping services
        return {
            'status': 'healthy',
            'response_time_ms': self._get_service_response_time(service_name),
            'last_check': datetime.utcnow().isoformat()
        }

    def _generate_optimization_hints(self, response_times: Dict[str, float],
                                   cache_hit_rates: Dict[str, float]) -> Dict[str, List[Dict[str, str]]]:
        """Generate performance optimization hints"""
        hints = {
            'caching_recommendations': [],
            'service_optimizations': [],
            'query_optimizations': []
        }

        # Check for slow services
        for service, time_ms in response_times.items():
            if time_ms > 100:
                hints['service_optimizations'].append({
                    'action': f'Optimize {service} response time',
                    'impact': 'high',
                    'current_time': f'{time_ms:.1f}ms'
                })

        # Check for low cache hit rates
        for service, hit_rate in cache_hit_rates.items():
            if hit_rate < 80:
                hints['caching_recommendations'].append({
                    'action': f'Improve {service} caching strategy',
                    'impact': 'medium',
                    'current_rate': f'{hit_rate:.1f}%'
                })

        return hints

    def _get_fallback_data(self, service_name: str) -> Dict[str, Any]:
        """Get fallback data when a service fails"""
        fallback_data = {
            'user_statistics': {
                'user_id': None,
                'documents_created': 0,
                'productivity_score': 0,
                'last_updated': datetime.utcnow().isoformat(),
                'data_source': 'fallback'
            },
            'system_overview': {
                'total_documents': 0,
                'active_users': 0,
                'system_health_score': 50,
                'last_updated': datetime.utcnow().isoformat(),
                'data_source': 'fallback'
            },
            'actionable_items': {
                'user_id': None,
                'pending_approvals': [],
                'urgent_items_count': 0,
                'priority_score': 0,
                'last_updated': datetime.utcnow().isoformat(),
                'data_source': 'fallback'
            },
            'activity_feed': {
                'user_id': None,
                'activities': [],
                'total_count': 0,
                'last_updated': datetime.utcnow().isoformat(),
                'data_source': 'fallback'
            }
        }
        return fallback_data.get(service_name, {})

    def _get_fallback_personalization(self, user_id: str) -> Dict[str, Any]:
        """Get fallback personalization when personalization fails"""
        return {
            'welcome_message': 'Welcome back! Ready to be productive?',
            'quick_actions': [
                {
                    'id': 'create_document',
                    'title': 'Create New Document',
                    'icon': '📄',
                    'url': '/documents/new',
                    'priority': 1
                }
            ],
            'suggested_workflows': [],
            'recent_documents': [],
            'productivity_insights': [],
            'urgent_alerts': [],
            'personalization_score': 25.0
        }

    def _get_default_performance_metrics(self) -> Dict[str, Any]:
        """Get default performance metrics when calculation fails"""
        return {
            'response_times': {},
            'cache_hit_rates': {},
            'data_freshness': {'overall_score': 50.0},
            'service_health': {},
            'optimization_hints': {
                'caching_recommendations': [],
                'service_optimizations': [],
                'query_optimizations': []
            },
            'calculated_at': datetime.utcnow().isoformat()
        }

    def _is_coordination_cache_valid(self, cache_key: str) -> bool:
        """Check if coordination cache is still valid"""
        if cache_key not in self.coordination_cache:
            return False

        cache_entry = self.coordination_cache[cache_key]
        age = (datetime.utcnow() - cache_entry['timestamp']).total_seconds()
        return age < self.cache_ttl

    def _cache_coordination_data(self, cache_key: str, data: Dict[str, Any]) -> None:
        """Cache coordination data with timestamp"""
        self.coordination_cache[cache_key] = {
            'data': data,
            'timestamp': datetime.utcnow()
        }

    def _get_error_response(self, error: str) -> Dict[str, Any]:
        """Get error response for coordination failures"""
        return {
            'user_id': None,
            'user_statistics': self._get_fallback_data('user_statistics'),
            'system_overview': self._get_fallback_data('system_overview'),
            'actionable_items': self._get_fallback_data('actionable_items'),
            'activity_feed': self._get_fallback_data('activity_feed'),
            'personalization': self._get_fallback_personalization(None),
            'performance_metrics': self._get_default_performance_metrics(),
            'layout_recommendations': {'widget_priorities': {}, 'urgent_widgets': [], 'hidden_widgets': []},
            'data_sources': self._get_data_source_info(),
            'coordination_time_ms': 0,
            'last_updated': datetime.utcnow().isoformat(),
            'cache_hit': False,
            'service_errors': {'coordination': error},
            'fallback_data': True,
            'data_freshness': {},
            'real_time_updates': self._get_real_time_info(False),
            'error': error
        }