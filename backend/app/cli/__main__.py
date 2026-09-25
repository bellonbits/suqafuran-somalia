"""CLI entry point for monitoring and admin utilities."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.cli.kafka_monitor import main

if __name__ == '__main__':
    main()
