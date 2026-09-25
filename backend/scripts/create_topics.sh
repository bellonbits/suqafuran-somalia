#!/bin/bash
# Simple script to create Kafka topics directly

KAFKA_BROKER="${KAFKA_BROKER:-kafka:9092}"

echo "Creating Kafka topics on $KAFKA_BROKER..."
echo ""

# Array of topics: name:partitions:replication_factor
declare -a TOPICS=(
    "suqafuran-orders:3:1"
    "suqafuran-payments:3:1"
    "suqafuran-deliveries:2:1"
    "suqafuran-alerts:1:1"
    "suqafuran-notifications:2:1"
    "suqafuran-events:3:1"
)

for topic_config in "${TOPICS[@]}"; do
    IFS=':' read -r topic partitions replication <<< "$topic_config"

    echo "Creating topic: $topic (partitions: $partitions, replication: $replication)"

    kafka-topics --bootstrap-server "$KAFKA_BROKER" \
        --create \
        --topic "$topic" \
        --partitions "$partitions" \
        --replication-factor "$replication" \
        --if-not-exists 2>&1 | grep -v "^Created topic\|^Topic.*already exists"
done

echo ""
echo "Listing all topics:"
kafka-topics --bootstrap-server "$KAFKA_BROKER" --list
