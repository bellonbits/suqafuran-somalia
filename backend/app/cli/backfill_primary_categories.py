"""Management command to backfill primary categories for shops."""

import click
from sqlmodel import Session
from app.core.config import settings
from app.db import engine
from app.services.shop_category_service import backfill_primary_categories


@click.command()
@click.option('--limit', type=int, default=None, help='Maximum number of shops to process (default: all)')
@click.option('--dry-run', is_flag=True, help='Show what would be updated without making changes')
def backfill_command(limit: int, dry_run: bool):
    """Backfill primary_category_id for all shops based on their listing distribution."""
    click.echo("Starting primary category backfill...")

    with Session(engine) as db:
        try:
            if dry_run:
                click.echo("[DRY RUN MODE] Would update the following shops:")

            updated = backfill_primary_categories(db, limit=limit)

            if dry_run:
                click.echo(f"[DRY RUN] Would update {updated} shops")
            else:
                click.echo(f"✓ Successfully updated {updated} shops")

        except Exception as e:
            click.echo(f"✗ Error during backfill: {str(e)}", err=True)
            raise


if __name__ == '__main__':
    backfill_command()
