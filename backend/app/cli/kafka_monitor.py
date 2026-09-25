#!/usr/bin/env python3
"""
Kafka Topic Monitor - Subscribe to and view messages from Kafka topics in real-time.

Usage:
    python -m app.cli.kafka_monitor                    # All topics
    python -m app.cli.kafka_monitor --topic suqafuran-signup  # Single topic
    python -m app.cli.kafka_monitor --topics signup,signin    # Multiple topics
"""

import json
import sys
from datetime import datetime
from typing import List, Optional
import click
from confluent_kafka import Consumer, KafkaError
from app.core.config import settings

# Color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def create_consumer(group_id: str = "monitoring-group") -> Consumer:
    """Create a Kafka consumer."""
    config = {
        'bootstrap.servers': settings.KAFKA_BOOTSTRAP_SERVERS,
        'group.id': group_id,
        'auto.offset.reset': 'earliest',  # Start from beginning if no committed offset
        'enable.auto.commit': True,
        'session.timeout.ms': 6000,
    }
    return Consumer(config)


def format_message(topic: str, partition: int, offset: int, key: Optional[bytes], value: bytes, timestamp: int) -> str:
    """Format a Kafka message for display."""
    ts = datetime.fromtimestamp(timestamp / 1000).strftime('%H:%M:%S.%f')[:-3]

    try:
        payload = json.loads(value.decode('utf-8'))
        value_str = json.dumps(payload, indent=2)
    except:
        value_str = value.decode('utf-8', errors='replace')

    key_str = key.decode('utf-8') if key else "None"

    header = f"{Colors.BOLD}{Colors.CYAN}[{ts}]{Colors.RESET} {Colors.GREEN}{topic}{Colors.RESET} ({partition}:{offset})"
    key_line = f"{Colors.YELLOW}Key:{Colors.RESET} {key_str}"
    value_line = f"{Colors.YELLOW}Value:{Colors.RESET}\n{value_str}"

    return f"\n{header}\n{key_line}\n{value_line}\n{'─' * 80}"


def subscribe_to_topics(topics: List[str], group_id: str = "monitoring-group", max_messages: Optional[int] = None):
    """Subscribe to Kafka topics and print messages."""
    consumer = create_consumer(group_id)

    print(f"\n{Colors.BOLD}{Colors.HEADER}Kafka Topic Monitor{Colors.RESET}")
    print(f"Broker: {settings.KAFKA_BOOTSTRAP_SERVERS}")
    print(f"Topics: {', '.join(topics)}")
    print(f"Group ID: {group_id}")
    print(f"{'=' * 80}\n")

    try:
        consumer.subscribe(topics)
        print(f"{Colors.GREEN}✓ Subscribed to {len(topics)} topic(s){Colors.RESET}\n")

        message_count = 0
        while True:
            msg = consumer.poll(timeout=1.0)

            if msg is None:
                continue

            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    print(f"{Colors.RED}Error: {msg.error()}{Colors.RESET}")
                    break

            # Display the message
            formatted = format_message(
                msg.topic(),
                msg.partition(),
                msg.offset(),
                msg.key(),
                msg.value(),
                msg.timestamp()[1]
            )
            print(formatted)

            message_count += 1
            if max_messages and message_count >= max_messages:
                print(f"\n{Colors.YELLOW}Received {message_count} messages. Exiting.{Colors.RESET}")
                break

    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}Shutting down...{Colors.RESET}")
    finally:
        consumer.close()


def normalize_topic_name(topic: str) -> str:
    """Add suqafuran- prefix if not present."""
    if not topic.startswith('suqafuran-'):
        return f'suqafuran-{topic}'
    return topic


@click.command()
@click.option('--topic', default=None, help='Single topic to monitor (auto-prefixes with suqafuran-)')
@click.option('--topics', default=None, help='Comma-separated topics (e.g., signup,signin,tracking)')
@click.option('--group-id', default='monitoring-group', help='Consumer group ID')
@click.option('--max-messages', type=int, default=None, help='Stop after N messages')
def main(topic: Optional[str], topics: Optional[str], group_id: str, max_messages: Optional[int]):
    """Monitor Kafka topics in real-time."""

    # Determine which topics to subscribe to
    if topic:
        # Single topic specified
        topics_list = [normalize_topic_name(topic)]
    elif topics:
        # Multiple topics specified
        topics_list = [normalize_topic_name(t.strip()) for t in topics.split(',')]
    else:
        # Subscribe to all monitoring topics by default
        topics_list = [
            'suqafuran-signup',
            'suqafuran-signin',
            'suqafuran-tracking',
            'suqafuran-checkout',
            'suqafuran-upload-failures',
        ]

    subscribe_to_topics(topics_list, group_id, max_messages)


if __name__ == '__main__':
    main()
