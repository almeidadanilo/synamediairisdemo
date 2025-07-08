import json
import datetime
import os
import requests
import argparse
import boto3
import time
import logging
import re
from datetime import timezone
from cryptography.fernet import Fernet


######################################################################################################
# Global variables
######################################################################################################
input_file = ''
jsonlFile = ''
irisTK = ''
irisTN = ''
outURL = ''
outCID = ''
outCSC = ''
outAUT = ''
outGTP = ''
outACR = ''
out_headers = ''
outBucket = ''
outKVP = ''
output_file = './output.ini.json'
firstDateTime = ''
lastDateTime = ''
exportObject = []
c_key = ''
match_string_start = 'SYNAMEDIA IN'
match_string_end = 'Termino corte Cable Operador'
match_string_program = 'Prog'
channel = ''
broadcastingDate = ''
structured_data = []
ignore_lines_with_columns_below = 70

logger = logging.getLogger("scheduleingest_logger")


######################################################################################################
# Setup the logging mechanics
######################################################################################################
def setup_logger(mode, level='info'):

    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    
    if mode == 'file':
        handler = logging.FileHandler('schedule_ingest.log')
    else:
        handler = logging.StreamHandler()

    handler.setFormatter(formatter)

    if level == 'debug':
        logger.setLevel(logging.DEBUG)
    else:
        logger.setLevel(logging.INFO)

    logger.addHandler(handler)

######################################################################################################
# Load de latest generated crypto key
######################################################################################################
def getCryptoKey():
    logger.info("Getting Crypto Key")
    return open("secret.key", "rb").read()

######################################################################################################
# Returns the decrypted data
######################################################################################################
def decrypt(enc_data):
    global c_key

    if c_key == '':
        c_key = getCryptoKey()
        logger.debug(f"Key acquired: {c_key}")
    
    fer = Fernet(c_key)

    return fer.decrypt(enc_data.encode()).decode()

######################################################################################################
# Get Output Credentials
######################################################################################################
def getOutputItems(iristenant):
    global outURL, outCID, outCSC, outAUT, outGTP, irisTN, outBucket, outMetadata, outACR

    logger.debug("Enter getOutputItems")
    if iristenant == "":
        logger.info("Iris Tenant not informed")
        return False

    if os.path.exists(output_file):
        try:
            with open(output_file, "r") as read_output:
                json_data = json.load(read_output)
                logger.debug(f"Iris Tenant: {iristenant}")
                for item in json_data["items"]:
                    if iristenant == item["iristenant"]:
                        outURL = decrypt(item["URL"])
                        logger.debug(f"Iris Authorization API: {outURL}")
                        outGTP = decrypt(item["GT"])
                        logger.debug(f"Iris Grants: {outGTP}")
                        outAUT = decrypt(item["AU"])
                        logger.debug(f"Iris Authorize Entity: {outAUT}")
                        outCID = decrypt(item["CI"])
                        logger.debug(f"Iris ClientID: {outCID}")
                        outCSC = decrypt(item["CS"])
                        logger.debug(f"Iris ClientS: {outCSC}")
                        irisTN = item["iristenant"]
                        outBucket = decrypt(item["BK"])
                        logger.debug(f"Iris Upload Bucket: {outBucket}")
                        outACR = decrypt(item["ACR"])
                        logger.debug(f"Iris AWS: {outACR}")
                        outMetadata = item["METADATA"]
                        logger.debug(f"Export ADI Metadata: {outMetadata}")
                        return True

        except Exception as e:
            logger.info("Error reading output file")
            logger.debug(f"Error reading output file: {e}")
            return False
    else:
        logger.debug(f"{output_file} does not exist in the script directory.")

    logger.debug("Exit getOutputItems")

######################################################################################################
# Get Iris Access Token
######################################################################################################
def getIrisAccessToken():
    global irisTK, irisTKExpire, outCID, outCSC, outAUT, outGTP

    try:

        headers = {"content-Type": "application/json"}

        payload = {
            "client_id": f"{outCID}",
            "client_secret": f"{outCSC}",
            "audience": f"{outAUT}",
            "grant_type": f"{outGTP}"
        }

        response = requests.post(outURL, headers=headers, json=payload)

        if response.status_code == 200:
            token_data = response.json()
            irisTK = token_data.get("access_token")
            exp = token_data.get("expires_in")
            now = datetime.datetime.now(timezone.utc)
            irisTKExpire = now + datetime.timedelta(seconds=exp)
            logger.debug(f"Iris Access Token Acquired, exiring in: {irisTKExpire}")
        else:
            logger.debug("Iris Acces Token Not Accepted")
            logger.debug(response.status_code, response)
            irisTK = ''

    except Exception as e:
        logger.info("Error getting Iris access token")
        logger.debug(f"Error getting Iris access token: {e}")

######################################################################################################
# Convert text HH:MM:SS into straight seconds
######################################################################################################
def hhmmss_to_seconds(duration_str):
    try:
        h, m, s = map(int, duration_str.split(":"))
        return h * 3600 + m * 60 + s
    except Exception as e:
        logger.error(f"Error converting duration '{duration_str}' to seconds: {str(e)}")
        return 0

######################################################################################################
# Prepare the structure for Iris API ingest file
######################################################################################################
def prepare_iris_ingest_file():
    logger.debug("Entering prepare_iris_ingest_file")
    global structured_data, exportObject, channel, broadcastingDate, match_string_start, match_string_end, match_string_program, firstDateTime, lastDateTime

    if len(structured_data) == 0:
        return

    objTmp = []
    breakCount = False
    breakDuration = 0
    breakStartTime = ''
    breakEndTime = ''
    breakEventId = ''
    progStartTime = ''
    progEndTime = ''
    progDuration = 0
    progPreviousID = ''

    for line in structured_data:
        ## Find Breaks Marked for Iris
        if str(line['DESC']).strip() == match_string_start:
            breakCount = True
            try:
                time_part = line['TIMEPRG'].strip()
                if len(time_part) == 5:
                    time_part += ":00"
                datetime_combined = datetime.datetime.combine(broadcastingDate, datetime.datetime.strptime(time_part, "%H:%M:%S").time())
                breakStartTime = datetime_combined.isoformat() + 'Z'
                breakEventId = line['ID'] + '_' + line['TIMEPRG']
            except Exception as e:
                logger.error(f"Error parsing break startTime from {line['TIMEPRG']}, line {line}: {str(e)}")
                continue                
        elif str(line['DESC']).strip() == match_string_end:
            try:
                time_part = line['TIMEPRG'].strip()
                if len(time_part) == 5:
                    time_part += ":00"
                datetime_combined = datetime.datetime.combine(broadcastingDate, datetime.datetime.strptime(time_part, "%H:%M:%S").time())
                breakEndTime = datetime_combined.isoformat() + 'Z'
            except Exception as e:
                logger.error(f"Error parsing break endTime from {line['TIMEPRG']}, line {line}: {str(e)}")
                continue
            objTmp = {
                "channelId": channel,
                "startDateTime": breakStartTime,
                "endDateTime": breakEndTime,
                "eventType": 'Break',
                "eventId": breakEventId,
                "availId": ''
            }
            exportObject.append(objTmp)
            # Reset Iris break counters
            breakDuration = 0
            breakCount = False
        
        ## In case of Iris break, update the break duration with spot durations
        if breakCount == True:
            breakDuration += hhmmss_to_seconds(str(line['DURATION']))

        ## Find content (program) to add in the schedule ingestion
        if str(line['TYPE']).strip() == match_string_program:
            # For the first program matching
            if progPreviousID == '':
                progPreviousID = line['ID']
                progDuration += hhmmss_to_seconds(str(line['DURATION']))
                try:
                    time_part = line['TIMEPRG'].strip()
                    if len(time_part) == 5:
                        time_part += ":00"
                    datetime_combined = datetime.datetime.combine(broadcastingDate, datetime.datetime.strptime(time_part, "%H:%M:%S").time())
                    progStartTime = datetime_combined.isoformat() + 'Z'
                except Exception as e:
                    logger.error(f"Error parsing program startTime from {line['TIMEPRG']}, {line['ID']}: {str(e)}")
                    continue
            else:
                # If is still the same program, update the end time and duration
                if progPreviousID == line['ID']:
                    progDuration += hhmmss_to_seconds(str(line['DURATION']))
                    try:
                        time_part = line['TIMEPRG'].strip()
                        if len(time_part) == 5:
                            time_part += ":00"
                        datetime_combined = datetime.datetime.combine(broadcastingDate, datetime.datetime.strptime(time_part, "%H:%M:%S").time())
                        progEndTime = datetime_combined.isoformat() + 'Z'
                    except Exception as e:
                        logger.error(f"Error parsing program endTime from {line['TIMEPRG']}, {line['ID']}: {str(e)}")
                        continue
                # If is already a different program, close the previous one and open a new one.
                else:
                    # Closing the previous program 
                    objTmp = {
                        "channelId": channel,
                        "startDateTime": progStartTime,
                        "endDateTime": progEndTime,
                        "eventType": 'Content',
                        "eventId": progPreviousID
                    }
                    exportObject.append(objTmp)
                    # Starting a new one
                    progPreviousID = line['ID']
                    progDuration = 0
                    progDuration += hhmmss_to_seconds(str(line['DURATION']))
                    try:
                        time_part = line['TIMEPRG'].strip()
                        if len(time_part) == 5:
                            time_part += ":00"
                        datetime_combined = datetime.datetime.combine(broadcastingDate, datetime.datetime.strptime(time_part, "%H:%M:%S").time())
                        progStartTime = datetime_combined.isoformat() + 'Z'
                    except Exception as e:
                        logger.error(f"Error parsing program startTime from {line['TIMEPRG']}, {line['ID']}: {str(e)}")
                        continue
        # endif line["TYPE"] == match_string_program

    logger.debug("Exiting prepare_iris_ingest_file")

######################################################################################################
# Returns the Landmark Input File
######################################################################################################
def parse_schedule_txt(filepath):
    logger.debug("Entering parse_schedule_txt")
    global structured_data, channel, broadcastingDate, firstDateTime, lastDateTime, ignore_lines_with_columns_below

    data_lines = []
    header_found = False
    times = []

    logger.debug(f"Reading file: {filepath}")
    with open(filepath, encoding='latin-1') as file:
        lines = file.readlines()

    # Skip header and metadata
    logger.debug(f"File read: {len(lines)} lines")
    for line in lines:
        if re.match(r'\s*HORATX\s+HORAPRG\s+AUT', line):
            header_found = True
            continue
        ## Only process after the header line
        if header_found and line.strip():  
            data_lines.append(line.rstrip('\n'))

    # Define the fixed column widths
    colspecs = [
        (0, 10),    # HORATX
        (10, 21),   # HORAPRG
        (21, 26),   # AUT
        (26, 36),   # TIPO
        (36, 48),   # DURACIÓN
        (48, 70),   # ID NUMBER
        (70, 120),  # DESCRIPCIÓN
        (120, 170), # VERSIÓN
        (170, None) # OBSERVACIONES
    ]

    logger.debug("Procesing file header")
    ## Channel
    channel = ''
    tmp_line = str(lines[1]).strip()
    match = re.search(r'Pauta del Canal:\s*(.*)', tmp_line)
    if match:
        channel = match.group(1)
    logger.debug(f"Procesing file header, channel: {channel}")
    ## Broadcasting Date
    broadcastingDate = datetime.datetime.strptime('01/01/1970', '%d/%m/%Y').date()
    tmp_line = str(lines[2]).strip()
    match = re.search(r'Fecha de Transmisión:\s*(.*)', tmp_line)
    if match:
        date_string = match.group(1)
        broadcastingDate = datetime.datetime.strptime(date_string, '%d/%m/%Y').date()
    logger.debug(f"Procesing file header, broadcastdate: {broadcastingDate}")

    logger.debug("Processing file lines")
    # Convert each line into a dictionary
    for line in data_lines:
        # Ignore the intermediate program lines
        if len(line) >= ignore_lines_with_columns_below:
            # Collect wall times (TIMETX) for the schedule events
            time_str = line[colspecs[0][0]:colspecs[0][1]].strip()
            if time_str and len(time_str) == 5:
                time_str += ":00"  # convert HH:MM to HH:MM:SS
            # Remove apparent wrong time entries higher than 23:59:59 time range
            if time_str and time_str[:2].isdigit() and int(time_str[:2]) <= 23:
                times.append(datetime.datetime.strptime(time_str, "%H:%M:%S").time())
            
            # Build the iterable structure from the text data file       
            entry = {
                'TIMETX': line[colspecs[0][0]:colspecs[0][1]].strip(),
                'TIMEPRG': line[colspecs[1][0]:colspecs[1][1]].strip(),
                'AUT': line[colspecs[2][0]:colspecs[2][1]].strip(),
                'TYPE': line[colspecs[3][0]:colspecs[3][1]].strip(),
                'DURATION': line[colspecs[4][0]:colspecs[4][1]].strip(),
                'ID': line[colspecs[5][0]:colspecs[5][1]].strip(),
                'DESC': line[colspecs[6][0]:colspecs[6][1]].strip(),
                'VERSION': line[colspecs[7][0]:colspecs[7][1]].strip(),
                'EXTRA': line[colspecs[8][0]:].strip()
            }
            structured_data.append(entry)

    logger.debug(f"Processed {len(structured_data)} lines")
    
    if times:
        min_time = min(times)
        max_time = max(times)
        firstDateTime = datetime.datetime.combine(broadcastingDate, min_time).astimezone(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')
        lastDateTime = datetime.datetime.combine(broadcastingDate, max_time).astimezone(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')

    logger.debug(f"firstDateTime: {firstDateTime}")
    logger.debug(f"lastDateTime: {lastDateTime}")
    
    logger.debug("Exiting parse_schedule_txt")
    return

######################################################################################################
# Save the schedule structure into the export json and jsonl file
######################################################################################################
def saveScheduleFile():
    logger.debug("Entering saveScheduleFile")
    global exportObject, firstDateTime, lastDateTime, jsonlFile

    # Group the multiple eventTypes together for the exporting
    exportObject.sort(key=lambda x: x.get("eventType", ""))

    try:
        timestamp = datetime.datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

        filename = f'./{channel}-{firstDateTime}-{lastDateTime}-{timestamp}' + '.json'
        filenameA = f'./{channel}-{firstDateTime}-{lastDateTime}-{timestamp}' + '.jsonl'

        logger.debug(f"Files: {filename} and {filenameA}")

        with open(filename, "w", encoding="utf-8") as f:
            json.dump(exportObject, f, indent=4)
        
        with open(filenameA, "w", encoding="utf-8") as f1:
            for item in exportObject:
                json.dump(item, f1)
                f1.write("\n")

        jsonlFile = filenameA

    except Exception as e:
        logger.info("Error saveMetadataFile")
        logger.debug(f"Error saveMetadataFile: {e}")

    logger.debug("Exiting saveScheduleFile")


######################################################################################################
# Create BOTO client for AWS access
######################################################################################################
def create_boto3_client():
    logger.debug("Entering create_boto3_client")
    global irisTK, out_headers, irisTN, outACR

    myURL = outACR
    headers = {"Authorization": irisTK}
    response = requests.post(myURL, headers=headers)
    responseJSON = response.json()

    AccessKeyId = responseJSON['AccessKeyId']
    SecretAccessKey = responseJSON['SecretAccessKey']
    SessionToken = responseJSON['SessionToken']

    client = boto3.client(
        's3',
        aws_access_key_id = AccessKeyId,
        aws_secret_access_key = SecretAccessKey,
        aws_session_token = SessionToken
    )
    out_headers = {"content-Type": "application/json", "X-iris-tenantId": irisTN,"Authorization": irisTK}
    logger.debug("Exiting create_boto3_client")
    return client

######################################################################################################
# Push the jsonl file to AWS through BOTO
######################################################################################################
def send_jsonl(client, method):
    logger.debug("Entering send_jsonl")
    global jsonlFile, outBucket, irisTN

    if method == "add":
        s3_bucket_file_path = irisTN + "/input/" + jsonlFile.replace('./', '')
    #elif method == "delete":
    #    s3_bucket_file_path = irisTN + "/content/deleted/" + jsonlFile.replace('./', '')
    
    logger.debug(f"jsonlFile: {jsonlFile}")
    logger.debug(f"outBucket: {outBucket}")
    logger.debug(f"s3_bucket_file_path: {s3_bucket_file_path}")
    logger.debug(f"irisTN: {irisTN}")

    response_put = client.upload_file(jsonlFile.replace('./', ''), outBucket, s3_bucket_file_path)

    logger.debug(f"Response: {response_put}")
    logger.debug("Exiting send_jsonl")

######################################################################################################
# Check if the file is processed in the S3 bucket
######################################################################################################
def check_bucket(client):
    logger.debug("Entering check_bucket")

    global outBucket, jsonlFile

    file_name = jsonlFile.replace('./', '')
    fKey = ''

    response = client.list_objects(Bucket=outBucket)
    contents = response['Contents']

    logger.debug(f"Bucket: {outBucket}")
    logger.debug(f"FileName: {file_name}")
    
    for i in range(len(contents)):
        fKey = contents[i]['Key']
        logger.debug(f"S3 Bucket Files: {fKey}")
        if file_name in fKey:
            logger.debug(f"S3 Bucket Files: {fKey}")
            if 'processed' in fKey:
                logger.debug(f"{file_name} File Uploaded Successfully.")
            elif 'errinfo' in fKey:
                failed_result = client.get_object(Bucket=outBucket, Key=irisTN + "/content/failed/" + fKey)
                logger.debug(f"ERROR processing {file_name}")
                logger.debug(failed_result)
                logger.debug(failed_result["Body"].read())
            else:
                logger.debug(f"{file_name} File not uploaded or not processed.")
    
    logger.debug("Exiting check_bucket")

######################################################################################################
# Wait function
######################################################################################################
def wait(seconds):
    for i in range(seconds, 0, -1):
        time.sleep(1)

######################################################################################################
# Main Loop
######################################################################################################

parser = argparse.ArgumentParser()
parser.add_argument('-input', type=str, default='',help='Landmark Export File (.txt)')
parser.add_argument('-output', type=str, default='op7z4geq',help='Iris Tenant ID')
parser.add_argument('-log', type=str, default='file', choices=['console', 'file'], help='Log output destination')
parser.add_argument('-level', type=str, default='debug', choices=['info', 'debug'], help='Log verbosity level')
args = parser.parse_args()
input_file = args.input
iristenant = args.output

setup_logger(args.log, args.level)

logger.debug("#######################################")
logger.debug('# BEGIN PROCESSING ')
logger.debug("#######################################")

if (not(getOutputItems(iristenant))):
    logger.debug ('Error getting output items')
    exit (-1)

# Build Iris Access Token
if irisTK == '':
    logger.debug("Calling getIrisAccessToken")
    getIrisAccessToken()

parse_schedule_txt(input_file)
prepare_iris_ingest_file()
saveScheduleFile()
logger.debug(f"Objects added to the output data: {len(exportObject)}")

# Create BOTO client
logger.debug("Creating BOTO client")
bot = create_boto3_client()
# Push the jsonl file to AWS Folder
logger.debug("Sending the jsonl to S3 bucket")
send_jsonl(bot, "add")
# Wait for 1 minute
logger.debug("Waiting: 60s")
wait(60)
# Check if the file was properly processed
logger.debug("Checking S3")
check_bucket(bot)

logger.debug("#######################################")
logger.debug('# END PROCESSING ')
logger.debug("#######################################")