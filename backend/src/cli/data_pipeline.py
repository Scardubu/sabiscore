"""
Phase 2 Data Ingestion CLI

Commands:
- load-historical: Load historical data from football-data.co.uk
- scrape-xg: Scrape xG data from Understat
- enrich-features: Generate 220-feature vectors
- poll-live: Start live data polling
"""

import asyncio
import click
from datetime import datetime

from ..core.database import session_scope, init_database_schema
from ..data.loaders import FootballDataLoader, UnderstatLoader
from ..data.enrichment import FeatureEngineer
from ..data.connectors import ESPNConnector

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@click.group()
def cli():
    """Sabiscore Phase 2 Data Ingestion CLI"""
    pass


@cli.command()
@click.option("--leagues", "-l", multiple=True, default=["E0", "SP1", "D1", "I1", "F1"], help="League codes to load")
@click.option("--seasons", "-s", multiple=True, default=["2324", "2425"], help="Seasons to load (e.g., 2324)")
def load_historical(leagues, seasons):
    """Load historical match and odds data from football-data.co.uk"""
    
    click.echo("🚀 Starting historical data load...")
    click.echo(f"Leagues: {', '.join(leagues)}")
    click.echo(f"Seasons: {', '.join(seasons)}")
    
    # Initialize database
    init_database_schema()
    
    async def run_load():
        loader = FootballDataLoader()
        results = await loader.load_all_historical(
            leagues=list(leagues),
            seasons=list(seasons),
        )
        
        total = sum(results.values())
        click.echo(f"\n✅ Loaded {total} matches:")
        for key, count in results.items():
            click.echo(f"   {key}: {count} matches")
    
    asyncio.run(run_load())


@cli.command()
@click.option("--days", "-d", default=7, help="Number of days to look back")
def scrape_xg(days):
    """Scrape xG data from Understat for recent matches"""
    
    click.echo(f"🎯 Scraping xG data for last {days} days...")
    
    async def run_scrape():
        async with UnderstatLoader() as loader:
            count = await loader.load_recent_matches(days=days)
            click.echo(f"✅ Updated {count} matches with xG data")
    
    asyncio.run(run_scrape())


@cli.command()
@click.option("--match-id", "-m", help="Specific match ID to enrich")
@click.option("--limit", "-l", default=100, help="Number of matches to enrich")
def enrich_features(match_id, limit):
    """Generate 220-feature vectors for matches"""
    
    click.echo("🔬 Generating feature vectors...")
    
    with session_scope() as db_session:
        from ..core.database import Match
        
        if match_id:
            matches = [db_session.query(Match).filter_by(id=match_id).first()]
            if not matches[0]:
                click.echo(f"❌ Match {match_id} not found")
                return
        else:
            # Find matches without features
            matches = (
                db_session.query(Match)
                .filter(Match.status == "finished")
                .limit(limit)
                .all()
            )
        
        click.echo(f"Found {len(matches)} matches to enrich")
        
        engineer = FeatureEngineer(db_session)
        success = 0
        
        for match in matches:
            try:
                features = engineer.generate_features(match.id)
                engineer.save_features(match.id, features)
                success += 1
                
                if success % 10 == 0:
                    click.echo(f"Enriched {success}/{len(matches)} matches...")
                    
            except Exception as e:
                logger.error(f"Error enriching match {match.id}: {e}")
                continue
        
        click.echo(f"✅ Successfully enriched {success} matches")


@cli.command()
@click.option("--league", "-l", default="EPL", help="League to poll")
@click.option("--interval", "-i", default=8, help="Poll interval in seconds")
def poll_live(league, interval):
    """Start live match polling from ESPN"""
    
    click.echo(f"📡 Starting live polling for {league} (interval: {interval}s)")
    click.echo("Press Ctrl+C to stop\n")
    
    async def handle_update(match_data):
        click.echo(f"[{datetime.now().strftime('%H:%M:%S')}] {match_data['home_team']} {match_data['home_score']}-{match_data['away_score']} {match_data['away_team']} ({match_data['minute']})")
    
    async def run_poll():
        async with ESPNConnector(poll_interval=interval) as connector:
            try:
                await connector.poll_live_matches(league, callback=handle_update)
            except KeyboardInterrupt:
                click.echo("\n✅ Stopped polling")
                connector.stop_polling()
    
    try:
        asyncio.run(run_poll())
    except KeyboardInterrupt:
        click.echo("\n✅ Stopped polling")


@cli.command()
def init_db():
    """Initialize database schema"""
    
    click.echo("🗄️  Initializing database schema...")
    init_database_schema()
    click.echo("✅ Database schema initialized")


@cli.command()
def pipeline_status():
    """Show data pipeline status"""
    
    click.echo("📊 Data Pipeline Status\n")
    
    with session_scope() as db_session:
        from ..core.database import Match, MatchStats, FeatureVector, OddsHistory, ScrapingLog
        
        # Count records
        total_matches = db_session.query(Match).count()
        finished_matches = db_session.query(Match).filter_by(status="finished").count()
        matches_with_xg = db_session.query(MatchStats).filter(MatchStats.expected_goals.isnot(None)).count()
        matches_with_features = db_session.query(FeatureVector).count()
        total_odds = db_session.query(OddsHistory).count()
        
        click.echo(f"Matches:")
        click.echo(f"  Total: {total_matches}")
        click.echo(f"  Finished: {finished_matches}")
        click.echo(f"  With xG: {matches_with_xg}")
        click.echo(f"  With features: {matches_with_features}")
        click.echo(f"\nOdds records: {total_odds}")
        
        # Recent scraping jobs
        recent_logs = (
            db_session.query(ScrapingLog)
            .order_by(ScrapingLog.timestamp.desc())
            .limit(5)
            .all()
        )
        
        if recent_logs:
            click.echo(f"\nRecent scraping jobs:")
            for log in recent_logs:
                status_emoji = "✅" if log.status == "success" else "❌"
                click.echo(f"  {status_emoji} {log.source} - {log.job_type} ({log.records_processed} records) - {log.timestamp.strftime('%Y-%m-%d %H:%M')}")


if __name__ == "__main__":
    cli()
