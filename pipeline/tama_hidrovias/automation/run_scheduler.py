import logging
import os
from dotenv import load_dotenv

from tama_hidrovias.automation.scheduler import PipelineScheduler
from tama_hidrovias.automation.pipeline import DataPipeline
from tama_hidrovias.automation.import_swot import run_swot_import

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    load_dotenv()
    
    scheduler = PipelineScheduler()
    
    # 1. Add ANA/HydroWeb/SNIRH DataPipeline daily job (runs at 01:00)
    config = {
        "output_dir": "/data/processed",
        "strapi_url": os.environ.get("STRAPI_URL", ""),
        "strapi_token": os.environ.get("STRAPI_TOKEN", ""),
    }
    pipeline = DataPipeline(config)
    scheduler.add_daily_job(pipeline.run_scheduled, hour=1, minute=0, job_id="pipeline_daily")
    
    # 2. Add SWOT daily job (runs at 02:00)
    scheduler.add_daily_job(run_swot_import, hour=2, minute=0, job_id="swot_daily")
    
    logger.info("Scheduler configured. Starting...")
    scheduler.start()

if __name__ == "__main__":
    main()
