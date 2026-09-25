-- Create tables for system monitoring and alerting

-- Notification delivery log (for funnel tracking)
CREATE TABLE IF NOT EXISTS notification_log (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    correlation_id VARCHAR(255) NOT NULL,
    trace_id VARCHAR(255),
    event_type VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL, -- 'email', 'sms', 'push'
    provider VARCHAR(50) NOT NULL, -- 'resend', 'africas_talking', 'firebase'
    user_id BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL, -- 'dispatched', 'sent', 'failed', 'pending'
    error_message TEXT,
    dispatched_at TIMESTAMP WITH TIME ZONE NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_log_event_type ON notification_log(event_type);
CREATE INDEX idx_notification_log_channel ON notification_log(channel);
CREATE INDEX idx_notification_log_status ON notification_log(status);
CREATE INDEX idx_notification_log_user_id ON notification_log(user_id);
CREATE INDEX idx_notification_log_correlation_id ON notification_log(correlation_id);
CREATE INDEX idx_notification_log_created_at ON notification_log(created_at DESC);
CREATE INDEX idx_notification_log_provider ON notification_log(provider);

-- Alert rules (configured thresholds for monitoring)
CREATE TABLE IF NOT EXISTS alert_rules (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metric VARCHAR(255) NOT NULL, -- 'kafka_lag', 'notification_failure_rate', 'payment_failure_rate', etc.
    threshold NUMERIC NOT NULL,
    comparison_operator VARCHAR(10) NOT NULL, -- '>', '<', '>=', '<=', '=='
    evaluation_window_minutes INTEGER NOT NULL DEFAULT 5,
    aggregation_function VARCHAR(50) DEFAULT 'avg', -- 'avg', 'max', 'sum', 'count'
    metric_filter JSONB, -- filter criteria, e.g. {"topic": "orders.events", "domain": "payments"}
    notification_channel VARCHAR(255), -- 'email', 'slack', 'sms'
    notification_target VARCHAR(255), -- email address, Slack webhook URL, phone number
    enabled BOOLEAN DEFAULT true,
    severity VARCHAR(50) NOT NULL DEFAULT 'warning', -- 'warning', 'critical'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT REFERENCES "user"(id) ON DELETE SET NULL
);

CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX idx_alert_rules_metric ON alert_rules(metric);

-- Alert history (fired alerts with resolution time)
CREATE TABLE IF NOT EXISTS alert_history (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT REFERENCES alert_rules(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL, -- 'firing', 'resolved'
    fired_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    value NUMERIC, -- the actual metric value that triggered the alert
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alert_history_rule_id ON alert_history(rule_id);
CREATE INDEX idx_alert_history_status ON alert_history(status);
CREATE INDEX idx_alert_history_fired_at ON alert_history(fired_at DESC);

-- Monitoring metrics cache (for fast dashboard loads)
CREATE TABLE IF NOT EXISTS monitoring_metrics_cache (
    id BIGSERIAL PRIMARY KEY,
    metric_type VARCHAR(255) NOT NULL, -- 'kafka_topic', 'notification_rate', 'celery_queue', etc.
    metric_key VARCHAR(255) NOT NULL, -- topic name, event type, etc.
    value NUMERIC NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    ttl_minutes INTEGER DEFAULT 15,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric_type, metric_key, timestamp)
);

CREATE INDEX idx_monitoring_metrics_cache_type ON monitoring_metrics_cache(metric_type);
CREATE INDEX idx_monitoring_metrics_cache_key ON monitoring_metrics_cache(metric_key);
CREATE INDEX idx_monitoring_metrics_cache_timestamp ON monitoring_metrics_cache(timestamp DESC);
