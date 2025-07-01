import json
import datetime
import os
import requests
import argparse
import boto3
import time
import logging
from datetime import timezone
from cryptography.fernet import Fernet

######################################################################################################
# Global variables
######################################################################################################
input_file = "./input.ini.json"
output_file = "./output.ini.json"
output_f_extension = '.cnt.jsonl'
inURL = ''
inTK = ''
inCT = ''
inQS = ''
inURL1 = ''
inQS1 = ''
outURL = ''
outCID = ''
outCSC = ''
outAUT = ''
outGTP = ''
out_headers = ''
outBucket = ''
outKVP = ''
irisTK = ''
irisTN = ''
irisTKExpire = 0
jsonlFile = ''
exportObject = []
c_key = ''
logger = logging.getLogger("vod_logger")

######################################################################################################
# Setup the logging mechanics
######################################################################################################
def setup_logger(mode, level='info'):

    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    
    if mode == 'file':
        handler = logging.FileHandler('vod_ingest.log')
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
# Get Input Credentials
######################################################################################################
def getInputItems(gotenant):
    global inURL, inTK, inCT, inQS, inURL1, inQS1

    logger.debug("Enter getInputItems")

    if gotenant == "":
        logger.info("Go Tenant not informed")
        return False
    
    if os.path.exists(input_file):
        try:
            with open(input_file, "r") as read_input:
                json_data = json.load(read_input)
                for item in json_data["items"]:
                    logger.debug(f"Go Tenant: {gotenant}")
                    if gotenant == item["gotenant"]:
                        logger.debug(f"GoTenant: {item["gotenant"]}")
                        inURL = decrypt(item["URL"])
                        logger.debug(f"Go Bulk Content API: {inURL}")
                        inTK = item["TK"]
                        logger.debug(f"Go access token: {inTK}")
                        inCT = decrypt(item["CT"])
                        logger.debug(f"Go Categories API: {inCT}")
                        inQS = decrypt(item["QS"])
                        logger.debug(f"Go Bulk Content QS: {inQS}")
                        inURL1 = decrypt(item["URL1"])
                        logger.debug(f"Go Asset Detail API: {inURL1}")
                        inQS1 = decrypt(item["QS1"])
                        logger.debug(f"Go Asset Detail QS: {inQS1}")
                        return True

        except Exception as e:
            logger.info("Error reading input file")
            logger.debug(f"Error reading input file: {e}")
            return False
    else:
        logger.debug(f"{input_file} does not exist in the script directory.")

    logger.debug("Exit getInputItems")

######################################################################################################
# Get Output Credentials
######################################################################################################
def getOutputItems(iristenant):
    global outURL, outCID, outCSC, outAUT, outGTP, irisTN, outBucket, outKVP

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
                        outKVP = decrypt(item["KVP"])
                        logger.debug(f"Iris KVP API: {outKVP}")
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
    global irisTK, irisTKExpire

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
# Check whether the KVP already exists in Iris, if not, then create it
######################################################################################################
def processKVP(key, values):
    global irisTK, outKVP

    try:
        logger.debug("Enter processKVP")
        ordered_values = sorted(values)  # Sorts alphabetically or numerically
        body = {
            "key": key,
            "values": ordered_values
        }
        getURL = outKVP + '/' + key
        headers = {"content-Type": "application/json", "Authorization": irisTK}
        logger.debug(f"KVP API URL: {getURL}")
        logger.debug(f"KVP API Body: {body}")
        response = requests.get(getURL, headers=headers)
        logger.debug(f"KVP API Status Code: {response.status_code}")
        if response.status_code == 404:
            # KVP does not exist, needs to be created
            addURL = outKVP
            logger.debug(f"Adding KVP {key}")
            addResponse = requests.post(addURL, headers=headers, json=body)
            if addResponse.status_code != 201:
                logger.debug(f"Failed to add the KVP {key}: ", addResponse.status_code)
        elif response.status_code == 200:
            # KVP exists, update the value list
            updateURL = outKVP + '/' + key
            logger.debug(f"Updating KVP {key}")
            updateResponse = requests.put(updateURL, headers=headers, json=body)
            if updateResponse.status_code != 204:
                logger.debug(f"Failed to update the KVP {key}: ", updateResponse.status_code)
        else:
            logger.debug(f"Unexpected API return: {response.status_code}")
            return
        logger.debug("Exit processKVP")
    except Exception as e:
            logger.info("Error Process KVP")
            logger.debug(f"Error Process KVP: {e}")

######################################################################################################
# Build json response from Go
######################################################################################################
def fetchAndPrepareGoData(type):
    global inCT, inTK, inURL, inQS, inURL1, inQS1, exportObject

    try:
        headers = {"content-Type": "application/json","Authorization":f"{inTK}"}
        response = requests.get(inCT, headers=headers)

        if response.status_code != 200:
            logger.debug(f"Unexpected API return: {response.status_code}")
            return
        
        data = response.json()
        
        now = datetime.datetime.now(timezone.utc)
        expirationDate = now + datetime.timedelta(days=365)

        vod_ids = [category["id"] for category in data.get("categories", []) if category.get("source") == type]

        fullGenres = []
        fullParentalRating = []
        fullContentAdvisory = []
        fullContentFlags = []
        fullSubtitles = []
        fullAudios = []
        fullExternalStars = []
        fullProductionYears = []
        fullContentTypes = []

        for item in vod_ids:
            # Query the list of VOD Assets per each category
            requestURL = inURL + item + inQS
            response = requests.get(requestURL, headers=headers)
            if response.status_code == 200:
                logger.debug(f"Processsing VOD Item: {item}")
                data1 = response.json()
                objTmp = []
                currentCategory = 0
                # get categories obj
                for category in data1.get("categories", []):
                    # get contents on the category
                    for content in category.get("content", []):
                        objGenres = []
                        objParentalRating = []
                        objContentAdvisory = []
                        objContentFlags = []
                        objSubtitles = []
                        objAudios = []
                        objExternalFlags = []
                        txtExternalStar = ''
                        objExternalViewingOptions = []
                        txtProductionYear = ''
                        txtContentName = ''
                        txtContentType = ''
                        # get content details
                        myURL = inURL1 + content.get("id", "") + inQS1
                        contentResponse = requests.get(myURL, headers=headers)
                        if contentResponse.status_code == 200:
                            contentDetails = contentResponse.json()
                            a = False
                            objExternalViewingOptions = contentDetails.get("externalViewingOptions", [])
                            if objExternalViewingOptions:
                                a = objExternalViewingOptions.get("externalViewingOnly", False)

                            # Export only the assets which are not external
                            if a == False:
                                # get and parse the genres
                                for genre in contentDetails.get("genres", []):
                                    genre_id = genre.get('genreId', '').replace(' ','_').upper()
                                    if genre_id.replace(' ', '_').isalnum():
                                        objGenres.append(genre_id)
                                        # Adding the unique item in the the full*** structures for KVP validation afterwards
                                        if genre_id not in fullGenres:
                                            fullGenres.append(genre_id)
                                # get and parse the parental ratings
                                parental_data = contentDetails.get("parentalRating", {})
                                if isinstance(parental_data, dict):
                                    parental_id = str(parental_data.get("value", ""))
                                    objParentalRating.append(parental_id)
                                    if (parental_id not in fullParentalRating) and (parental_id != ""):
                                        fullParentalRating.append(str(parental_id))
                                elif isinstance(parental_data, list):
                                    for parental in parental_data:
                                        parental_id = str(parental.get("value", ""))
                                        objParentalRating.append(parental_id)
                                        if (parental_id not in fullParentalRating) and (parental_id != ""):
                                            fullParentalRating.append(str(parental_id))
                                # get and parse the content advisories
                                for advisory in contentDetails.get("contentAdvisories", []):
                                    advisory_id = advisory.get('advisoryFlag', '').replace(' ','_').upper()
                                    if advisory_id != "":
                                        objContentAdvisory.append(advisory_id)
                                        if advisory_id not in fullContentAdvisory:
                                            fullContentAdvisory.append(advisory_id)
                                # get and parse the offer keys
                                for flag in contentDetails.get("contentFlags", []):
                                    flag_id = str(flag).replace(' ','_').upper()
                                    if flag_id != "":
                                        objContentFlags.append(flag_id)
                                        if flag_id not in fullContentFlags:
                                            fullContentFlags.append(flag_id)
                                # get and parse the subtitles languages
                                for subtitle in contentDetails.get("subtitleLanguages", []):
                                    subtitle_id = str(subtitle).replace(' ','_').upper()
                                    if subtitle_id != "":
                                        objSubtitles.append(subtitle_id)
                                        if subtitle_id not in fullSubtitles:
                                            fullSubtitles.append(subtitle_id)
                                # get and parse the audiod languages
                                for audio in contentDetails.get("audioLanguages", []):
                                    audio_id = str(audio).replace(' ','_').upper()
                                    if audio_id != "":
                                        objAudios.append(audio_id)
                                        if audio_id not in fullAudios:
                                            fullAudios.append(audio_id)
                                # get and parse the external flags
                                for ext in contentDetails.get("externalStarRatings", []):
                                    if ext.get("provider", "") != "":
                                        txtExternalStar = ext.get("provider", "").replace(' ','_').upper() + '_' + str(ext.get("score", ""))
                                        objExternalFlags.append(txtExternalStar)
                                        if txtExternalStar not in fullExternalStars:
                                            fullExternalStars.append(txtExternalStar)
                                # get and parse production year
                                if int(str(contentDetails.get("productionYear","0"))) > 0:
                                    txtProductionYear = str(contentDetails.get("productionYear",""))
                                    if txtProductionYear not in fullProductionYears:
                                        fullProductionYears.append(txtProductionYear)
                                else: 
                                    txtProductionYear = ''
                                # get and parse the content types
                                txtContentType = str(contentDetails.get("contentType", "")).upper()
                                if txtContentType not in fullContentTypes:
                                    fullContentTypes.append(txtContentType)
                                # get and parse the content name
                                txtContentName = contentDetails.get("title","").strip()

                                objTmp = {
                                    "contentId": contentDetails.get("externalPackageId", ""),
                                    "contentName": txtContentName,
                                    "contentType": [str(type).upper() ],
                                    "expirationDate": str(expirationDate.isoformat()),
                                    "control": {"allowAdInsertion":True},
                                    "metadata": {
                                        "ContentType": [txtContentType],
                                        "ProductionYear": [txtProductionYear],
                                        "SubtitleLanguages": objSubtitles,
                                        "AudioLanguages": objAudios,
                                        "Genres": objGenres,
                                        "ParentalRating": objParentalRating,
                                        "ContentAdvisories": objContentAdvisory,
                                        "ExternalStarRatings": objExternalFlags,
                                        "ContentFlags": objContentFlags
                                    }
                                }

                                # Avoiding duplications in the exportObject
                                content_id = contentDetails.get("externalPackageId", "")
                                if not any(item.get("contentId", "") == content_id for item in exportObject):
                                    exportObject.append(objTmp)
                                objTmp = {}
                            else:
                                logger.debug(f"Content Details: {content.get("id", "")} jumped")
                        else:
                            logger.debug(f"Content Details: {content.get("id", "")} returned: {contentResponse.status_code}")

                    currentCategory = currentCategory + 1
            else:
                logger.info("Categories API empty")
                logger.debug(f"Error: API({requestURL}) returned ({response.status_code})")
        
        # Process the unique collected KVPs
        logger.info("Starting to process the KVPs")
        if len(fullContentTypes) > 0:
            processKVP("ContentType", fullContentTypes)
        if len(fullProductionYears) > 0:
            processKVP("ProductionYear", fullProductionYears)
        if len(fullSubtitles) > 0:
            processKVP("SubtitleLanguages", fullSubtitles)
        if len(fullAudios) > 0:
            processKVP("AudioLanguages", fullAudios)
        if len(fullGenres) > 0:
            processKVP("Genres", fullGenres)
        if len(fullParentalRating) > 0:
            processKVP("ParentalRating", fullParentalRating)
        if len(fullContentAdvisory) > 0:
            processKVP("ContentAdvisories", fullContentAdvisory)
        if len(fullExternalStars) > 0:
            processKVP("ExternalRatings", fullExternalStars)
        if len(fullContentFlags) > 0:
            processKVP("ContentFlags", fullContentFlags)
        logger.info("Finished to process the KVPs")

    except TypeError as tp:
        logger.info("Serialization error")
        logger.debug("Serialization error:", tp)
        for i, item in enumerate(exportObject):
            try:
                json.dumps(item)
            except TypeError as inner_e:
                logger.debug(f"⚠️  exportObject[{i}] failed: {inner_e}")
                logger.debug(json.dumps(item, indent=2, default=str))
                break
    except Exception as e:
        logger.info("Error fetchAndPrepareGoData")
        logger.debug(f"Error fetchAndPrepareGoData: {e}")

######################################################################################################
# Save the metadata structure into the export json file
######################################################################################################
def saveMetadataFile():
    global exportObject, output_f_extension, jsonlFile

    try:
        timestamp = datetime.datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f'./{timestamp}' + output_f_extension
        filenameA = f'./{timestamp}' + '_noindent' + output_f_extension

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

######################################################################################################
# Create BOTO client for AWS access
######################################################################################################
def create_boto3_client():
    global irisTK, out_headers, irisTN

    myURL = 'https://backoffice-apb.ads.iris.synamedia.com/credentials/aws'
    headers = {"Authorization": irisTK}
    response = requests.post(myURL, headers=headers)
    responseJSON = response.json()

    #logger.debug(f"Boto Authorization: {responseJSON}")

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

    return client

######################################################################################################
# Push the jsonl file to AWS through BOTO
######################################################################################################
def send_jsonl(client, method):
    global jsonlFile, outBucket, irisTN

    if method == "add":
        s3_bucket_file_path = irisTN + "/content/input/" + jsonlFile.replace('./', '')
    elif method == "delete":
        s3_bucket_file_path = irisTN + "/content/deleted/" + jsonlFile.replace('./', '')
    
    logger.debug("jsonlFile: ", jsonlFile)
    logger.debug("outBucket: ", outBucket)
    logger.debug("s3_bucket_file_path: ", s3_bucket_file_path)
    logger.debug("irisTN: ", irisTN)

    response_put = client.upload_file(jsonlFile.replace('./', ''), outBucket, s3_bucket_file_path)

    logger.debug(f"Response: {response_put}")

######################################################################################################
# Check if the file is processed in the S3 bucket
######################################################################################################
def check_bucket(client):
    global outBucket, jsonlFile

    list_with_same_name = []
    last_modified_file = ""

    response = client.list_objects(Bucket=outBucket)
    contents = response['Contents']
    for i in range(len(contents)):
        if jsonlFile in contents[i]['Key']:
            same_name_full_path = contents[i]['Key']
            same_name = same_name_full_path[same_name_full_path.rindex("/")+1:]
            list_with_same_name.append(same_name)
    
    list_with_same_name.sort()

    if (len(list_with_same_name) > 0) :
        last_modified_file = list_with_same_name[-1]
        logger.debug(last_modified_file)
        if last_modified_file.endswith(".processed"):
            logger.debug("CSV File Uploaded Successfully.")
        else:
            failed_result = client.get_object(Bucket=outBucket, Key=irisTN + "/content/failed/" + last_modified_file)
            logger.debug(failed_result)
            logger.debug(failed_result["Body"].read())
            
            logger.debug("ERROR")
    else:
        logger.debug("CSV File not uploaded.")

######################################################################################################
# Wait function
######################################################################################################
def wait(seconds):
    for i in range(seconds, 0, -1):
        time.sleep(1)

######################################################################################################
# Main Loop
######################################################################################################

logger.debug("#######################################")
logger.debug('# BEGIN PROCESSING ')
logger.debug("#######################################")

parser = argparse.ArgumentParser()
parser.add_argument('-input', type=str, default='wzlbynyu',help='Go Tenant ID')
parser.add_argument('-output', type=str, default='op7z4geq',help='Iris Tenant ID')
parser.add_argument('-log', type=str, default='file', choices=['console', 'file'], help='Log output destination')
parser.add_argument('-level', type=str, default='debug', choices=['info', 'debug'], help='Log verbosity level')
args = parser.parse_args()
gotenant = args.input
iristenant = args.output
setup_logger(args.log, args.level)

if (not(getInputItems(gotenant))):
    logger.debug ('Error getting input items')
    exit (-1)

if (not(getOutputItems(iristenant))):
    logger.debug ('Error getting output items')
    exit (-1)

# Build Iris Access Token
if irisTK == '':
    getIrisAccessToken()

# Get Go VOD data export 
logger.debug("Fetching Go Catalog")
fetchAndPrepareGoData("vod")
logger.debug("len(exportObject): ", len(exportObject))
# Save the jsonl file
logger.debug("Saving the jsonl file")
saveMetadataFile()
#jsonlFile = '20250618_164659_noindent.cnt.jsonl'
if len(exportObject) == 0:
    logger.debug ('Error fetching the VOD metadata')
    exit(-1)
# Create BOTO client
logger.debug("Creating BOTO client")
bot = create_boto3_client()
# Push the jsonl file to AWS Folder
logger.debug("Sending the jsonl to S3 bucket")
send_jsonl(bot, "add")
# Wait for 2 minutes
logger.debug("Waiting: 120s")
wait(120)
# Check if the file was properly processed
logger.debug("Checking S3")
check_bucket(bot)

logger.debug("#######################################")
logger.debug('# END PROCESSING ')
logger.debug("#######################################")