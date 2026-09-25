"""
Kafka Monitoring Consumer - Background service that subscribes to all monitoring
topics and logs events in real-time. Runs automatically on application startup.
"""

import json
import logging
import threading
from typing import List, Optional
from confluent_kafka import Consumer, KafkaError
from app.core.config import settings

logger = logging.getLogger("kafka_monitoring")


class KafkaMonitoringConsumer:
    """Background consumer for monitoring topics."""

    def __init__(self):
        self.consumer: Optional[Consumer] = None
        self.thread: Optional[threading.Thread] = None
        self.running = False
        self.monitoring_topics = [
            settings.KAFKA_TOPIC_SIGNUP,
            settings.KAFKA_TOPIC_SIGNIN,
            settings.KAFKA_TOPIC_TRACKING,
            settings.KAFKA_TOPIC_CHECKOUT,
            settings.KAFKA_TOPIC_UPLOAD_FAILURES,
        ]

    def start(self):
        """Start the monitoring consumer in a background thread."""
        if self.running:
            logger.warning("Monitoring consumer already running")
            return

        self.running = True
        self.thread = threading.Thread(target=self._consume_loop, daemon=True)
        self.thread.start()
        logger.info(f"✓ Kafka Monitoring Consumer started (topics: {', '.join(self.monitoring_topics)})")

    def stop(self):
        """Stop the monitoring consumer."""
        self.running = False
        if self.consumer:
            self.consumer.close()
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("✓ Kafka Monitoring Consumer stopped")

    def _consume_loop(self):
        """Main consumer loop - runs in background thread."""
        try:
            config = {
                'bootstrap.servers': settings.KAFKA_BOOTSTRAP_SERVERS,
                'group.id': 'suqafuran-monitoring-consumer',
                'auto.offset.reset': 'latest',  # Start from latest (don't replay history)
                'enable.auto.commit': True,
                'session.timeout.ms': 6000,
            }

            self.consumer = Consumer(config)
            logger.info(f"🔌 Kafka monitoring consumer connecting to {settings.KAFKA_BOOTSTRAP_SERVERS}...")
            self.consumer.subscribe(self.monitoring_topics)
            logger.info(f"📡 Subscribed to monitoring topics: {self.monitoring_topics}")
            logger.info(f"⏳ Waiting for messages (offset=latest)...")

            while self.running:
                msg = self.consumer.poll(timeout=1.0)

                if msg is None:
                    continue

                if msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        continue
                    else:
                        logger.error(f"Kafka error: {msg.error()}")
                        continue

                # Parse and log the event
                self._log_event(msg)

        except Exception as e:
            logger.error(f"Monitoring consumer error: {e}", exc_info=True)
        finally:
            if self.consumer:
                self.consumer.close()

    def _log_event(self, msg):
        """Log a Kafka event in a readable format."""
        try:
            topic = msg.topic()
            partition = msg.partition()
            offset = msg.offset()
            key = msg.key().decode('utf-8') if msg.key() else "none"

            # Try to parse value as JSON
            try:
                value = json.loads(msg.value().decode('utf-8'))
                value_str = json.dumps(value, indent=2)
            except:
                value_str = msg.value().decode('utf-8', errors='replace')

            # Extract event type and user ID for better logging
            event_type = "unknown"
            user_id = None

            try:
                payload = json.loads(msg.value().decode('utf-8'))
                event_type = payload.get('event_type', 'unknown')
                user_id = payload.get('user_id', payload.get('payload', {}).get('user_id'))
            except:
                pass

            # Log with structured format
            logger.info(
                f"📊 Event received",
                extra={
                    "topic": topic,
                    "partition": partition,
                    "offset": offset,
                    "key": key,
                    "event_type": event_type,
                    "user_id": user_id,
                    "payload": value_str,
                }
            )

        except Exception as e:
            logger.error(f"Failed to log event: {e}")


# Global monitoring consumer instance
monitoring_consumer = KafkaMonitoringConsumer()
