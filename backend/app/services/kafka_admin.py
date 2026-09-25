"""Kafka admin client wrapper for monitoring topic metrics."""

import logging
import time
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    from confluent_kafka.admin import AdminClient, ConfigResource, ConfigSource, NewTopic
    from confluent_kafka import Consumer, KafkaError
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False
    logger.warning("confluent_kafka not installed — Kafka monitoring will be unavailable")


@dataclass
class TopicMetrics:
    """Metrics for a single Kafka topic."""
    name: str
    partition_count: int
    total_messages: int
    messages_per_sec: float  # 1m average
    consumer_lag: int  # sum across all partitions
    oldest_unconsumed_age_seconds: int
    last_message_timestamp: Optional[datetime]
    status: str  # 'healthy', 'lagging', 'stalled'
    consumer_groups: List[str]
    retention_bytes: Optional[int]
    retention_ms: Optional[int]


@dataclass
class PartitionMetrics:
    """Metrics for a single partition."""
    partition: int
    leader: int
    log_end_offset: int  # total messages in partition
    committed_offset: int  # highest offset consumed by group
    lag: int  # log_end_offset - committed_offset


class KafkaAdminClient:
    """Wrapper around Kafka admin operations for monitoring."""

    def __init__(self, bootstrap_servers: Optional[str] = None):
        """Initialize Kafka admin client.

        Args:
            bootstrap_servers: Kafka bootstrap servers, defaults to settings.KAFKA_BOOTSTRAP_SERVERS
        """
        self.bootstrap_servers = bootstrap_servers or settings.KAFKA_BOOTSTRAP_SERVERS
        self.admin_client: Optional[AdminClient] = None
        self._initialize()

    def _initialize(self):
        """Initialize the admin client connection."""
        if not KAFKA_AVAILABLE:
            logger.warning("Kafka admin client not available - confluent_kafka not installed")
            return

        logger.info(f"Attempting to create Kafka admin client for {self.bootstrap_servers}...")

        try:
            # Create admin client with explicit configuration
            config = {
                'bootstrap.servers': self.bootstrap_servers,
                'client.id': 'suqafuran-monitoring',
                'socket.timeout.ms': 10000,
                'connections.max.idle.ms': 540000,
                'api.version.request.timeout.ms': 10000,
            }
            logger.info(f"AdminClient config: {config}")

            self.admin_client = AdminClient(config)
            logger.info(f"AdminClient object created: {type(self.admin_client)}")

            if self.admin_client is None:
                logger.error("AdminClient creation returned None")
                return

            logger.info(f"✓ Kafka admin client initialized for {self.bootstrap_servers}")

            # Wait a moment for connection to establish
            time.sleep(1)

            # Verify connection by listing topics
            try:
                logger.info("Testing connection by listing topics...")
                metadata = self.admin_client.list_topics(timeout=10)
                existing = set(metadata.topics.keys())
                logger.info(f"✓ Successfully connected to Kafka broker, found {len(existing)} topics")
            except Exception as e:
                logger.error(f"✗ Failed to list topics: {e}")
                self.admin_client = None
                return

            logger.info("✓ Kafka admin client is ready for topic operations")

        except Exception as e:
            logger.error(f"Failed to initialize Kafka admin client: {e}", exc_info=True)
            self.admin_client = None

    def create_default_topics(self, retries: int = 3, delay: float = 2.0):
        """Create default Kafka topics with retry logic.

        Args:
            retries: Number of retry attempts
            delay: Delay between retries in seconds
        """
        logger.info("Starting Kafka topic creation process...")

        if self.admin_client is None:
            logger.error("Kafka admin client is not initialized")
            return False

        # Define topic names and configurations
        # Format: (num_partitions, replication_factor)
        default_topics = {
            # Core business events
            'suqafuran-orders': (3, 1),
            'suqafuran-payments': (3, 1),
            'suqafuran-deliveries': (2, 1),
            'suqafuran-business-events': (3, 1),

            # System notifications
            'suqafuran-alerts': (1, 1),
            'suqafuran-notifications': (2, 1),
            'suqafuran-events': (3, 1),

            # User monitoring & analytics
            'suqafuran-signup': (2, 1),           # User registration events
            'suqafuran-signin': (3, 1),           # User login events (high volume)
            'suqafuran-tracking': (3, 1),         # Analytics & user behavior tracking
            'suqafuran-checkout': (3, 1),         # Purchase/checkout events
            'suqafuran-upload-failures': (2, 1),  # Image/file upload failure tracking
        }

        for attempt in range(1, retries + 1):
            try:
                logger.info(f"[Attempt {attempt}/{retries}] Fetching existing Kafka topics...")

                # Get existing topics
                existing_topics = set(self.admin_client.list_topics(timeout=10).topics.keys())
                logger.info(f"✓ Found {len(existing_topics)} existing topics: {existing_topics}")

                # Build list of topics to create
                topics_to_create = []
                for topic_name, (partitions, replication) in default_topics.items():
                    if topic_name not in existing_topics:
                        logger.info(f"  → Will create: {topic_name} ({partitions} partitions)")
                        topics_to_create.append(
                            NewTopic(topic_name, num_partitions=partitions, replication_factor=replication)
                        )
                    else:
                        logger.info(f"  ✓ Already exists: {topic_name}")

                if not topics_to_create:
                    logger.info("All default Kafka topics already exist!")
                    return True

                # Create missing topics
                logger.info(f"📝 Creating {len(topics_to_create)} missing topics...")
                fs = self.admin_client.create_topics(
                    topics_to_create,
                    validate_only=False
                )

                created_count = 0
                failed_count = 0

                # Wait for all topics to be created
                for topic, future in fs.items():
                    try:
                        future.result(timeout=30)
                        logger.info(f"Created: {topic}")
                        created_count += 1
                    except Exception as e:
                        error_msg = str(e).lower()
                        if 'already exists' in error_msg or 'topic_already_exists' in error_msg:
                            logger.info(f"✓ Already exists: {topic}")
                            created_count += 1
                        else:
                            logger.warning(f"⚠️  Failed to create {topic}: {e}")
                            failed_count += 1

                if failed_count == 0:
                    logger.info(f"Kafka topic creation completed successfully! ({created_count} topics)")
                    return True
                else:
                    logger.warning(f"⚠️  {failed_count} topics failed, retrying...")

            except Exception as e:
                logger.warning(f"[Attempt {attempt}/{retries}] Error: {e}")
                if attempt < retries:
                    logger.info(f"Retrying in {delay}s...")
                    time.sleep(delay)
                continue

        logger.error("Failed to create Kafka topics after all retries")
        return False

    def list_topics(self) -> Dict[str, TopicMetrics]:
        """List all topics with metrics.

        Returns:
            Dict mapping topic names to TopicMetrics
        """
        if self.admin_client is None:
            logger.warning("Kafka admin client not available")
            return {}

        try:
            metadata = self.admin_client.list_topics(timeout=5)
            topics_dict = {}

            for topic_name in metadata.topics:
                # Skip internal topics
                if topic_name.startswith('__'):
                    continue

                # Get topic metadata
                partitions = metadata.topics[topic_name].partitions
                partition_count = len(partitions)

                # Estimate metrics
                total_messages = self._get_topic_message_count(topic_name)
                lag = self._get_consumer_lag(topic_name)
                consumer_groups = self._get_consumer_groups_for_topic(topic_name)

                # Get topic config
                retention_info = self._get_topic_retention(topic_name)

                status = self._determine_topic_status(lag, total_messages)

                topics_dict[topic_name] = TopicMetrics(
                    name=topic_name,
                    partition_count=partition_count,
                    total_messages=total_messages,
                    messages_per_sec=0.0,  # Would need time-series data
                    consumer_lag=lag,
                    oldest_unconsumed_age_seconds=0,  # Would need timestamp tracking
                    last_message_timestamp=None,
                    status=status,
                    consumer_groups=consumer_groups,
                    retention_bytes=retention_info.get('retention_bytes'),
                    retention_ms=retention_info.get('retention_ms'),
                )

            return topics_dict
        except Exception as e:
            logger.error(f"Failed to list topics: {e}")
            return {}

    def get_topic_detail(self, topic_name: str) -> Optional[TopicMetrics]:
        """Get detailed metrics for a specific topic.

        Args:
            topic_name: Name of the topic

        Returns:
            TopicMetrics or None if topic not found
        """
        if self.admin_client is None:
            return None

        try:
            topics = self.list_topics()
            return topics.get(topic_name)
        except Exception as e:
            logger.error(f"Failed to get topic detail for {topic_name}: {e}")
            return None

    def get_partition_metrics(self, topic_name: str) -> List[PartitionMetrics]:
        """Get metrics for each partition in a topic.

        Args:
            topic_name: Name of the topic

        Returns:
            List of PartitionMetrics
        """
        if self.admin_client is None:
            return []

        try:
            metadata = self.admin_client.list_topics(timeout=5)
            partitions_list = []

            if topic_name not in metadata.topics:
                logger.warning(f"Topic {topic_name} not found")
                return []

            for partition_id in metadata.topics[topic_name].partitions:
                # Get partition leader and offsets
                partition_metadata = metadata.topics[topic_name].partitions[partition_id]

                # This is simplified — in production, use kafka.TopicPartition
                # to query low_water_mark and high_water_mark per partition
                partitions_list.append(PartitionMetrics(
                    partition=partition_id,
                    leader=partition_metadata.leader,
                    log_end_offset=0,  # Would query via Consumer
                    committed_offset=0,  # Would query via consumer group
                    lag=0,
                ))

            return partitions_list
        except Exception as e:
            logger.error(f"Failed to get partition metrics for {topic_name}: {e}")
            return []

    def _get_topic_message_count(self, topic_name: str) -> int:
        """Estimate total messages in topic (simplified).

        In production, use KafkaConsumer to query high water mark per partition.
        """
        try:
            consumer = Consumer({
                'bootstrap.servers': self.bootstrap_servers,
                'group.id': f'monitoring-{topic_name}',
                'auto.offset.reset': 'earliest',
            })
            partitions = consumer.list_topics(topic_name, timeout=2).topics[topic_name].partitions

            total = 0
            for partition_id in partitions:
                low, high = consumer.get_watermark_offsets(
                    (topic_name, partition_id), timeout=2
                )
                total += high

            consumer.close()
            return total
        except Exception as e:
            logger.debug(f"Could not get message count for {topic_name}: {e}")
            return 0

    def _get_consumer_lag(self, topic_name: str) -> int:
        """Get total consumer lag for a topic (simplified).

        In production, query each consumer group's committed offsets.
        """
        # Placeholder — would iterate consumer groups and sum lag
        return 0

    def _get_consumer_groups_for_topic(self, topic_name: str) -> List[str]:
        """Get consumer groups subscribed to this topic."""
        # Placeholder — would query admin API for group memberships
        return []

    def _get_topic_retention(self, topic_name: str) -> Dict:
        """Get retention policy for a topic."""
        if self.admin_client is None:
            return {}

        try:
            configs = self.admin_client.describe_configs(
                [ConfigResource(ConfigResource.TOPIC, topic_name)],
                timeout=5
            )

            result = {}
            for resource, config in configs.items():
                for config_name, config_value in config.items():
                    if config_name.name == 'retention.bytes':
                        result['retention_bytes'] = int(config_value.value) if config_value.value else None
                    elif config_name.name == 'retention.ms':
                        result['retention_ms'] = int(config_value.value) if config_value.value else None

            return result
        except Exception as e:
            logger.debug(f"Could not get retention for {topic_name}: {e}")
            return {}

    def _determine_topic_status(self, lag: int, total_messages: int) -> str:
        """Determine topic health status."""
        if lag > 1000:
            return 'lagging'
        elif lag > 5000:
            return 'stalled'
        return 'healthy'

    def close(self):
        """Close admin client connection."""
        if self.admin_client:
            self.admin_client.close()


# Singleton instance
_kafka_admin: Optional[KafkaAdminClient] = None


def get_kafka_admin() -> KafkaAdminClient:
    """Get or create the singleton Kafka admin client."""
    global _kafka_admin
    if _kafka_admin is None:
        _kafka_admin = KafkaAdminClient()
    return _kafka_admin
