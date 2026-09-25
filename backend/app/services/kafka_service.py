import json
import logging
import threading
import time
import asyncio
from typing import Any, Dict, List, Optional
from datetime import datetime
from fastapi import WebSocket
from app.core.config import settings

logger = logging.getLogger("kafka_service")

# Dynamic import of confluent_kafka
try:
    from confluent_kafka import Producer as ConfluentProducer, Consumer as ConfluentConsumer, KafkaError
    KAFKA_AVAILABLE = True
    logger.info("confluent_kafka library loaded successfully")
except ImportError:
    KAFKA_AVAILABLE = False
    logger.warning("⚠️ confluent_kafka not available, using Mock Kafka")



class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}  # business_id -> websockets
        self.user_connections: Dict[int, List[WebSocket]] = {}  # user_id -> websockets (personal channel)
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop

    async def connect(self, business_id: str, websocket: WebSocket):
        await websocket.accept()
        if business_id not in self.active_connections:
            self.active_connections[business_id] = []
        self.active_connections[business_id].append(websocket)
        logger.info(f"WebSocket connected for business {business_id}. Active: {len(self.active_connections[business_id])}")

    def disconnect(self, business_id: str, websocket: WebSocket):
        if business_id in self.active_connections:
            if websocket in self.active_connections[business_id]:
                self.active_connections[business_id].remove(websocket)
            if not self.active_connections[business_id]:
                del self.active_connections[business_id]
        logger.info(f"WebSocket disconnected for business {business_id}")

    async def broadcast_to_business(self, business_id: str, message: dict):
        if business_id in self.active_connections:
            for connection in self.active_connections[business_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending socket message: {e}")

    def broadcast_from_thread(self, business_id: str, message: dict):
        if self.loop and self.loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self.broadcast_to_business(business_id, message),
                self.loop
            )
        else:
            logger.warning("Event loop is not running. Cannot broadcast WebSocket message from consumer thread.")

    # --- Personal (per-user) channel — supports multiple tabs/devices per user ---
    async def connect_user(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.user_connections.setdefault(user_id, []).append(websocket)
        logger.info(f"WebSocket connected for user {user_id}. Active: {len(self.user_connections[user_id])}")

    def disconnect_user(self, user_id: int, websocket: WebSocket):
        if user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        logger.info(f"WebSocket disconnected for user {user_id}")

    async def broadcast_to_user(self, user_id: int, message: dict):
        for connection in self.user_connections.get(user_id, []):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending socket message to user {user_id}: {e}")

    def broadcast_to_user_from_thread(self, user_id: int, message: dict):
        if self.loop and self.loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self.broadcast_to_user(user_id, message),
                self.loop
            )
        else:
            logger.warning("Event loop is not running. Cannot broadcast user WebSocket message from consumer thread.")


ws_manager = ConnectionManager()


class MockProducer:
    def __init__(self, config):
        logger.info("Initialized Mock Kafka Producer.")

    def produce(self, topic, value, key=None, callback=None):
        val_str = value.decode('utf-8') if isinstance(value, bytes) else str(value)
        logger.info(f"[MOCK KAFKA PRODUCER] Topic: {topic}, Key: {key}, Value: {val_str[:150]}")
        if callback:
            class MockMessage:
                def error(self): return None
                def topic(self): return topic
                def partition(self): return 0
                def offset(self): return 0
            callback(None, MockMessage())

    def flush(self, timeout=None):
        return 0

    def poll(self, timeout=None):
        return 0


class MockConsumer:
    def __init__(self, config):
        logger.info("Initialized Mock Kafka Consumer.")
        self.subscribed = []
        self._queue = []

    def subscribe(self, topics):
        self.subscribed = topics
        logger.info(f"Mock Consumer subscribed to: {topics}")

    def poll(self, timeout=1.0):
        time.sleep(timeout)
        if self._queue:
            return self._queue.pop(0)
        return None

    def queue_mock_message(self, topic, value, key=None):
        class MockMessage:
            def __init__(self, t, v, k):
                self._topic = t
                self._value = v if isinstance(v, bytes) else json.dumps(v).encode('utf-8')
                self._key = k.encode('utf-8') if k else None
            def value(self): return self._value
            def key(self): return self._key
            def topic(self): return self._topic
            def error(self): return None
        self._queue.append(MockMessage(topic, value, key))

    def close(self):
        logger.info("Mock Consumer closed.")


class KafkaService:
    def __init__(self):
        self.producer = None
        self.consumer = None
        self.consumer_thread = None
        self.is_running = False


        # Setup Producer Config
        if KAFKA_AVAILABLE and settings.KAFKA_BOOTSTRAP_SERVERS:
            p_conf = {'bootstrap.servers': settings.KAFKA_BOOTSTRAP_SERVERS}
            if settings.KAFKA_SASL_USERNAME:
                p_conf.update({
                    'security.protocol': settings.KAFKA_SECURITY_PROTOCOL,
                    'sasl.mechanism': settings.KAFKA_SASL_MECHANISM,
                    'sasl.username': settings.KAFKA_SASL_USERNAME,
                    'sasl.password': settings.KAFKA_SASL_PASSWORD,
                })
            try:
                self.producer = ConfluentProducer(p_conf)
                logger.info("Successfully initialized Confluent Kafka Producer.")
            except Exception as e:
                logger.error(f"Failed to initialize Confluent Kafka Producer: {e}. Falling back to Mock.")
                self.producer = MockProducer(p_conf)
        else:
            self.producer = MockProducer({})

    def _delivery_report(self, err, msg):
        if err is not None:
            logger.error(f"Kafka message delivery failed: {err}")
        else:
            logger.info(f"Kafka message delivered to {msg.topic()} [{msg.partition()}] at offset {msg.offset()}")

    def send_event(self, event_type: str, payload: dict, key: str = None) -> bool:
        topic = settings.KAFKA_TOPIC_BUSINESS_EVENTS
        message = {
            "event_type": event_type,
            "payload": payload,
            "timestamp": datetime.utcnow().isoformat()
        }
        try:
            val_bytes = json.dumps(message).encode('utf-8')
            key_bytes = key.encode('utf-8') if key else None
            
            # Produce message
            self.producer.produce(
                topic,
                value=val_bytes,
                key=key_bytes,
                callback=self._delivery_report
            )
            self.producer.poll(0)
            
            # If we are using mock consumer, automatically queue it for processing
            if isinstance(self.consumer, MockConsumer):
                self.consumer.queue_mock_message(topic, message, key)
            
            return True
        except Exception as e:
            logger.error(f"Failed to send Kafka event {event_type}: {e}")
            return False

    def flush(self):
        if self.producer:
            self.producer.flush()

    def start_consumer(self, db_session_factory):
        if self.consumer_thread and self.consumer_thread.is_alive():
            logger.warning("Kafka Consumer thread already running.")
            return

        self.is_running = True
        
        # Setup Consumer Config
        if KAFKA_AVAILABLE and settings.KAFKA_BOOTSTRAP_SERVERS:
            c_conf = {
                'bootstrap.servers': settings.KAFKA_BOOTSTRAP_SERVERS,
                'group.id': 'suqafuran-business-hub-group',
                'auto.offset.reset': 'earliest',
                'enable.auto.commit': True
            }
            if settings.KAFKA_SASL_USERNAME:
                c_conf.update({
                    'security.protocol': settings.KAFKA_SECURITY_PROTOCOL,
                    'sasl.mechanism': settings.KAFKA_SASL_MECHANISM,
                    'sasl.username': settings.KAFKA_SASL_USERNAME,
                    'sasl.password': settings.KAFKA_SASL_PASSWORD,
                })
            try:
                self.consumer = ConfluentConsumer(c_conf)
                logger.info("Successfully initialized Confluent Kafka Consumer.")
            except Exception as e:
                logger.error(f"Failed to initialize Confluent Kafka Consumer: {e}. Falling back to Mock.")
                self.consumer = MockConsumer(c_conf)
        else:
            self.consumer = MockConsumer({})

        self.consumer_thread = threading.Thread(
            target=self._consumer_loop,
            args=(db_session_factory,),
            daemon=True,
            name="kafka-consumer-daemon"
        )
        self.consumer_thread.start()
        logger.info("Started Kafka Background Consumer Thread.")

    def stop_consumer(self):
        self.is_running = False
        if self.consumer_thread:
            self.consumer_thread.join(timeout=5)
            logger.info("Stopped Kafka Background Consumer Thread.")

    def _consumer_loop(self, db_session_factory):
        # Subscribe with retry logic to handle topics not yet created
        max_retries = 10
        for attempt in range(max_retries):
            try:
                self.consumer.subscribe([settings.KAFKA_TOPIC_BUSINESS_EVENTS])
                logger.info(f"Subscribed to topic: {settings.KAFKA_TOPIC_BUSINESS_EVENTS}")
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"[Attempt {attempt+1}/{max_retries}] Failed to subscribe: {e}. Retrying in 2s...")
                    time.sleep(2)
                else:
                    logger.error(f"Failed to subscribe after {max_retries} attempts: {e}")
                    return

        while self.is_running:
            try:
                msg = self.consumer.poll(1.0)
                if msg is None:
                    continue
                if KAFKA_AVAILABLE and not isinstance(self.consumer, MockConsumer) and msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        continue
                    else:
                        logger.error(f"Kafka consumer error: {msg.error()}")
                        continue

                # Process event
                payload_str = msg.value().decode('utf-8')
                event_data = json.loads(payload_str)
                event_type = event_data.get("event_type")
                payload = event_data.get("payload", {})
                
                logger.info(f"Processing Kafka event: {event_type}")
                self._dispatch_event(event_type, payload, db_session_factory)

            except Exception as e:
                logger.error(f"Error in Kafka consumer loop: {e}")
                time.sleep(2)  # Avoid fast tight loop crash

        try:
            self.consumer.close()
        except Exception:
            pass

    def _dispatch_event(self, event_type: str, payload: dict, db_session_factory):
        business_id_str = payload.get("business_id")
        if not business_id_str:
            return

        # 1. Real-time WebSocket Broadcast (if active connections exist)
        socket_message = {
            "type": event_type,
            "payload": payload,
            "timestamp": datetime.utcnow().isoformat()
        }
        ws_manager.broadcast_from_thread(business_id_str, socket_message)

        # 1b. Personal push — if this event names a customer, also deliver it
        # straight to that buyer's own WebSocket channel (not just the
        # business's internal room), so their UI updates with no refresh.
        customer_id = payload.get("customer_id")
        if customer_id:
            ws_manager.broadcast_to_user_from_thread(int(customer_id), socket_message)

        # 2. Database actions (requires DB session)
        with db_session_factory() as db:
            try:
                if event_type == "ORDER_PLACED":
                    self._handle_db_order_placed(db, payload)
                elif event_type == "STOCK_LOW":
                    self._handle_db_stock_low(db, payload)
                elif event_type == "EMPLOYEE_ADDED":
                    self._handle_db_employee_added(db, payload)
                elif event_type == "ORDER_STATUS_UPDATED":
                    self._handle_db_order_status_updated(db, payload)
            except Exception as e:
                logger.error(f"Error executing DB actions for event {event_type}: {e}")
                db.rollback()

    def _handle_db_order_placed(self, db, payload):
        from app.models.business import BusinessProduct, BusinessCustomer
        from app.models.notification import Notification
        from sqlmodel import select

        business_id = payload.get("business_id")
        items = payload.get("items", [])
        customer_id = payload.get("customer_id")
        total_amount = payload.get("total_amount", 0.0)

        for item in items:
            p_id = item.get("product_id")
            qty = item.get("qty", 1)
            product = db.get(BusinessProduct, p_id)
            if product:
                product.stock_level = max(0, product.stock_level - qty)
                product.sales += qty
                db.add(product)
                
                # Check if stock goes low
                if product.stock_level <= product.low_stock_threshold:
                    self.send_event("STOCK_LOW", {
                        "business_id": business_id,
                        "product_id": product.id,
                        "product_name": product.name_en,
                        "stock_level": product.stock_level
                    }, key=str(business_id))

        # Update CRM profile
        stmt = select(BusinessCustomer).where(
            BusinessCustomer.business_id == business_id,
            BusinessCustomer.user_id == customer_id
        )
        cust = db.exec(stmt).first()
        if cust:
            cust.total_orders += 1
            cust.total_spent += total_amount
            cust.loyalty_score += int(total_amount // 10)
            cust.last_purchase_at = datetime.utcnow()
            if cust.total_orders >= 5:
                cust.segmentation = "VIP"
            elif cust.total_orders >= 2:
                cust.segmentation = "regular"
            db.add(cust)
        db.commit()

    def _handle_db_stock_low(self, db, payload):
        from app.models.notification import Notification
        from app.models.business import Employee
        from sqlmodel import select

        business_id = payload.get("business_id")
        product_name = payload.get("product_name")
        stock_level = payload.get("stock_level")

        # Find all active employees of this business
        stmt = select(Employee).where(
            Employee.business_id == business_id,
            Employee.is_active == True
        )
        employees = db.exec(stmt).all()
        for emp in employees:
            if emp.user_id:
                notif = Notification(
                    user_id=emp.user_id,
                    type="low_stock",
                    data={
                        "business_id": business_id,
                        "message": f"Alert: Product '{product_name}' has low stock ({stock_level} left)."
                    }
                )
                db.add(notif)
        db.commit()

    def _handle_db_employee_added(self, db, payload):
        pass

    def _handle_db_order_status_updated(self, db, payload):
        from app.models.notification import Notification

        customer_id = payload.get("customer_id")
        if not customer_id:
            return

        order_id = payload.get("order_id")
        status = payload.get("status")
        business_name = payload.get("business_name") or "Your seller"

        notif = Notification(
            user_id=int(customer_id),
            type="order_status",
            data={
                "business_id": payload.get("business_id"),
                "order_id": order_id,
                "status": status,
                "message": f"{business_name} updated order #{order_id} to '{status}'."
            }
        )
        db.add(notif)
        db.commit()


kafka_service = KafkaService()
