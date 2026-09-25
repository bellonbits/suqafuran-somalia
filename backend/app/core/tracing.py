from app.core.config import settings
import os

def setup_tracing(app):
    """
    Set up OpenTelemetry tracing with Jaeger v2 (OTLP protocol)

    Jaeger v2 is built on OpenTelemetry, so we use OTLP exporter
    instead of the legacy Jaeger exporter.
    """
    endpoint = settings.OTEL_EXPORTER_OTLP_ENDPOINT or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if not endpoint:
        return

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import SERVICE_NAME, Resource
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
        from opentelemetry.instrumentation.redis import RedisInstrumentor
        from opentelemetry.sdk.trace.export import SimpleSpanProcessor

        # Create resource with service metadata
        resource = Resource(attributes={
            SERVICE_NAME: os.getenv("OTEL_SERVICE_NAME", "suqafuran-backend"),
            "service.version": "1.0.0",
            "deployment.environment": settings.ENVIRONMENT,
        })

        # Set up trace exporter with gRPC protocol (recommended for Jaeger v2)
        trace_exporter = OTLPSpanExporter(
            endpoint=endpoint,
            insecure=True,  # Use insecure for local development; enable TLS for production
            timeout=30
        )

        # Create tracer provider with resource
        tracer_provider = TracerProvider(resource=resource)

        # Add span processor (BatchSpanProcessor recommended for production)
        tracer_provider.add_span_processor(BatchSpanProcessor(trace_exporter))

        # Set global tracer provider
        trace.set_tracer_provider(tracer_provider)

        # Instrument libraries
        FastAPIInstrumentor.instrument_app(app)

        try:
            SQLAlchemyInstrumentor().instrument(engine_only=False)
        except Exception as e:
            pass

        try:
            RedisInstrumentor().instrument()
        except Exception as e:
            pass

    except ImportError as e:
        print(f"Warning: OpenTelemetry packages not installed: {e}")
    except Exception as e:
        print(f"Error setting up tracing: {e}")
