#!/usr/bin/env python3
"""
Standalone script to create Kafka topics.
Run this manually if topics don't get created automatically.

Usage:
    python scripts/create_kafka_topics.py --bootstrap-servers kafka:9092
"""

import sys
import argparse
import logging
from confluent_kafka.admin import AdminClient, NewTopic

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Define topics
DEFAULT_TOPICS = {
    'suqafuran-orders': (3, 1),
    'suqafuran-payments': (3, 1),
    'suqafuran-deliveries': (2, 1),
    'suqafuran-alerts': (1, 1),
    'suqafuran-notifications': (2, 1),
    'suqafuran-events': (3, 1),
}


def create_topics(bootstrap_servers: str):
    """Create Kafka topics."""
    logger.info(f"Connecting to Kafka at {bootstrap_servers}...")

    try:
        admin_client = AdminClient({
            'bootstrap.servers': bootstrap_servers,
            'client.id': 'topic-creator',
        })
        logger.info("✓ Connected to Kafka")
    except Exception as e:
        logger.error(f"✗ Failed to connect to Kafka: {e}")
        return False

    # Get existing topics
    try:
        logger.info("Fetching existing topics...")
        metadata = admin_client.list_topics(timeout=5)
        existing_topics = set(metadata.topics.keys())
        logger.info(f"✓ Found {len(existing_topics)} existing topics: {existing_topics}")
    except Exception as e:
        logger.error(f"✗ Failed to fetch topics: {e}")
        return False

    # Build topics to create
    topics_to_create = []
    for topic_name, (partitions, replication) in DEFAULT_TOPICS.items():
        if topic_name not in existing_topics:
            logger.info(f"  → Will create: {topic_name} ({partitions} partitions, RF={replication})")
            topics_to_create.append(
                NewTopic(topic_name, num_partitions=partitions, replication_factor=replication)
            )
        else:
            logger.info(f"  ✓ Already exists: {topic_name}")

    if not topics_to_create:
        logger.info("✓ All topics already exist!")
        return True

    # Create topics
    logger.info(f"\n📝 Creating {len(topics_to_create)} topics...")
    try:
        fs = admin_client.create_topics(topics_to_create, validate_only=False, timeout=60)

        for topic, future in fs.items():
            try:
                future.result(timeout=30)
                logger.info(f"✅ Created: {topic}")
            except Exception as e:
                if 'already exists' in str(e).lower():
                    logger.info(f"✓ Already exists: {topic}")
                else:
                    logger.error(f"✗ Failed: {topic} - {e}")

        logger.info("\n✅ Topic creation completed!")
        return True
    except Exception as e:
        logger.error(f"✗ Error creating topics: {e}")
        return False


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Create Kafka topics')
    parser.add_argument(
        '--bootstrap-servers',
        default='kafka:9092',
        help='Kafka bootstrap servers (default: kafka:9092)'
    )
    args = parser.parse_args()

    success = create_topics(args.bootstrap_servers)
    sys.exit(0 if success else 1)
