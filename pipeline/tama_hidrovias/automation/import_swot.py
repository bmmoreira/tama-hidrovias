# =====================================================================
# IMPORTING LIBRARIES
# In Python, we bring in external tools (called libraries or modules)
# to help us perform specific tasks without writing everything from scratch.
# =====================================================================
import logging           # Used to print messages (logs) about what the script is doing (e.g., success, errors)
import os                # Used to interact with the operating system, like reading environment variables
import pandas as pd      # A powerful tool for reading and working with tabular data (like CSV files)
from pathlib import Path # Used to check if files and folders actually exist on the computer

# We also import our own custom code to talk to the Strapi CMS Database.
from tama_hidrovias.database.strapi_client import StrapiClient

# Set up a "logger" so we can write messages to the screen while the script runs.
logger = logging.getLogger(__name__)

# =====================================================================
# MAIN FUNCTION DEFINITION
# A function is a block of reusable code. Here, we define the steps
# needed to read the SWOT data from a CSV file and send it to Strapi.
# =====================================================================
def run_swot_import(csv_path: str = "data/processed/swot_nodes_gauges_5km_series.csv"):
    # Log a message that we are starting the process and show the file path.
    logger.info(f"Starting SWOT data import from {csv_path}")
    
    # -----------------------------------------------------------------
    # STEP 1: Connect to the Strapi Database
    # We need the web address (URL) and a secret password (TOKEN) to connect.
    # We grab these securely from the environment variables.
    # -----------------------------------------------------------------
    strapi_url = os.environ.get("STRAPI_URL", "")
    strapi_token = os.environ.get("STRAPI_TOKEN", "") or os.environ.get("STRAPI_API_TOKEN", "")
    
    # If we couldn't find the URL or Token, we stop the script and report an error.
    if not strapi_url or not strapi_token:
        logger.error("STRAPI_URL or STRAPI_TOKEN is missing. We cannot connect to the database.")
        return
        
    # Create our connection "client" using the URL and Token.
    client = StrapiClient(strapi_url, strapi_token)
    
    # -----------------------------------------------------------------
    # STEP 2: (Removed) We no longer need to fetch stations from Strapi
    # because swot-measurement uses a string station_id instead of a relation.
    # -----------------------------------------------------------------
    
    # -----------------------------------------------------------------
    # STEP 3: Verify the CSV file exists
    # -----------------------------------------------------------------
    if not Path(csv_path).exists():
        logger.error(f"CSV file not found: {csv_path}. Please check if the file is in the correct folder.")
        return
        
    # -----------------------------------------------------------------
    # STEP 4: Read the data from the CSV file
    # We use 'pandas' to read the file into a table format (called a DataFrame).
    # -----------------------------------------------------------------
    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        # If something goes wrong (e.g. file is corrupt), log the error and stop.
        logger.error(f"Failed to read CSV file: {e}")
        return
        
    logger.info(f"Read {len(df)} rows from CSV")
    
    # -----------------------------------------------------------------
    # STEP 5: Process the data line by line
    # We will create a list of valid 'records' to send to the database.
    # -----------------------------------------------------------------
    records = [] # Start with an empty list
    
    for _, row in df.iterrows(): # Go through the table one row at a time
        
        # 5a. Clean up the station code
        # Get the station code from the column named 'station_id' and remove extra spaces
        station_code = str(row['station_id']).strip()
        
        # Sometimes reading numbers from a CSV accidentally adds a ".0" at the end.
        # This removes the ".0" so the code matches what's in our database.
        if station_code.endswith('.0'):
            station_code = station_code[:-2]
            
        # 5b. (Removed) We no longer filter by existing stations since swot-measurement 
        # uses a raw string station_id rather than a relation.
            
        # 5c. Format the Date and Time
        try:
            # Convert the text date from the CSV into a standard computer date format
            dt = pd.to_datetime(row['date'])
            # Convert it to the specific format (ISO-8601) that Strapi requires
            iso_date = dt.isoformat() + "Z"
        except Exception as e:
            # If the date is invalid or unreadable, warn us and skip to the next row.
            logger.warning(f"Failed to parse date {row.get('date')}: {e}")
            continue
            
        # 5d. Read the measurement values
        try:
            mean_val = float(row['mean']) if not pd.isna(row['mean']) else None
            count_val = int(row['count']) if not pd.isna(row['count']) else None
            std_val = float(row['std']) if not pd.isna(row['std']) else None
            min_val = float(row['min']) if not pd.isna(row['min']) else None
            max_val = float(row['max']) if not pd.isna(row['max']) else None
            median_val = float(row['median']) if not pd.isna(row['median']) else None
            mean_dist_m_val = float(row['mean_dist_m']) if not pd.isna(row['mean_dist_m']) else None
            median_dist_m_val = float(row['median_dist_m']) if not pd.isna(row['median_dist_m']) else None
            min_dist_m_val = float(row['min_dist_m']) if not pd.isna(row['min_dist_m']) else None
            max_dist_m_val = float(row['max_dist_m']) if not pd.isna(row['max_dist_m']) else None
        except Exception as e:
            logger.warning(f"Failed to parse values for station {station_code} at {iso_date}: {e}")
            continue
            
        # If the mean value is missing, skip this row
        if mean_val is None:
            continue
            
        # 5e. Add the clean, verified data to our list of records
        records.append({
            "station_id": station_code,                  # The string code of the station
            "datetime": iso_date,                        # The formatted date/time
            "mean": mean_val,
            "count": count_val,
            "std": std_val,
            "min": min_val,
            "max": max_val,
            "median": median_val,
            "mean_dist_m": mean_dist_m_val,
            "median_dist_m": median_dist_m_val,
            "min_dist_m": min_dist_m_val,
            "max_dist_m": max_dist_m_val
        })
        
    # -----------------------------------------------------------------
    # STEP 6: Send the records to the database
    # -----------------------------------------------------------------
    if not records:
        # If our list is empty (maybe all rows were invalid or skipped), let us know and stop.
        logger.warning("No records to insert. The file might be empty or formatting is incorrect.")
        return
        
    # Finally, send the entire list of verified records to Strapi to be saved!
    client.batch_insert_swot_measurements(records)
    logger.info(f"Inserted {len(records)} SWOT records into Strapi")


# =====================================================================
# SCRIPT EXECUTION POINT
# This block tells Python what to do if we run this script directly
# from the command line (instead of importing it as a tool elsewhere).
# =====================================================================
if __name__ == "__main__":
    # Tell our logger to show standard "INFO" messages to the screen
    logging.basicConfig(level=logging.INFO)
    
    # Load our environment variables (passwords and URLs) from a hidden .env file
    from dotenv import load_dotenv
    load_dotenv()
    
    # Start the import process!
    run_swot_import()
