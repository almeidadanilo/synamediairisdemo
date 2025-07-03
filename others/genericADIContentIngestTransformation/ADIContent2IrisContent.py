import json
import datetime
import os
import requests
import argparse
import boto3
import time
import logging
import re
import xml.etree.ElementTree as ET
from datetime import timezone
from cryptography.fernet import Fernet

######################################################################################################
# Global variables
######################################################################################################
input_file = ''
output_file = "./output.ini.json"
output_f_extension = '.cnt.jsonl'
outURL = ''
outCID = ''
outCSC = ''
outAUT = ''
outGTP = ''
outMetadata = []
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
# Check regular expression for alphanumeric + "_"
######################################################################################################
def is_alnum_full(s):
    return bool(re.match(r'^[A-Za-z0-9_]+$', s))

######################################################################################################
# Get Output Credentials
######################################################################################################
def getOutputItems(iristenant):
    global outURL, outCID, outCSC, outAUT, outGTP, irisTN, outBucket, outKVP, outMetadata

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

        if irisTK == '':
            return

        response = requests.get(getURL, headers=headers)
        logger.debug(f"KVP API Status Code: {response.status_code}")
        data = response.json()
        if response.status_code == 404:
            # KVP does not exist, needs to be created
            addURL = outKVP
            logger.debug(f"Adding KVP {key}")
            addResponse = requests.post(addURL, headers=headers, json=body)
            if addResponse.status_code != 201:
                logger.debug(f"Failed to add the KVP {key}: {addResponse.status_code}")
                logger.debug(f"Body: {addResponse.json()}")
        elif response.status_code == 200:
            # KVP exists, update the value list
            add = False
            vals = sorted(data.get("values"))
            for vl in values:
                # add to the complete values list only the new items received from "values"
                if vl not in vals:
                    vals.append(vl)
                    add = True
            body = {
                "key": key,
                "values": sorted(vals)
            }            
            updateURL = outKVP + '/' + key
            logger.debug(f"Updating KVP {key}, with {body}")
            if add:
                updateResponse = requests.put(updateURL, headers=headers, json=body)
                if updateResponse.status_code != 204:
                    logger.debug(f"Failed to update the KVP {key}: {updateResponse.status_code}")
                    logger.debug(f"Body: {updateResponse.json()}")
        else:
            logger.debug(f"Unexpected API return: {response.status_code}")
            return
        logger.debug("Exit processKVP")
    except Exception as e:
            logger.info("Error Process KVP")
            logger.debug(f"Error Process KVP: {e}")

######################################################################################################
# Format the person name for Iris format and invert last with first name
######################################################################################################
def format_person_name(name):
    if ',' in name:
        last, first = [part.strip() for part in name.split(',', 1)]
        return f"{first}_{last}".replace(' ', '_')
    return name.replace(' ', '_')

######################################################################################################
# Build json response from Go
######################################################################################################
def fetchAndPrepareADIData():
    global exportObject

    now = datetime.datetime.now(timezone.utc)
    expirationDate = now + datetime.timedelta(days=365)
    txtContentID = ''
    txtContentName = ''
    txtContentType = 'VOD'
    objSubtitles = []
    objAudios = []
    objGenres = []
    objParentalRating = []
    objContentAdvisory = []
    objContentCategories = []
    objContentAudiences = []
    objProductionYear = []
    objActors = []
    objDirectors = []
    objProducers = []
    objStudios = []
    objCountryOfOrigin = []
    objAwards = []
    objResolutions = []
    objProviders = []
    objProducts = []
    #############################################################
    fullGenres = []
    fullParentalRating = []
    fullContentAdvisory = []
    fullSubtitles = []
    fullAudios = []
    fullProductionYears = []
    fullContentCategories = []
    fullContentAudiences = []
    fullActors = []
    fullDirectors = []
    fullProducers = []
    fullStudios = []
    fullCountryofOrigin = []
    fullAwards = []
    fullResolutions = []
    fullProviders = []
    fullProducts = []

    try:
        # Load the XML file
        tree = ET.parse('Armageddon 2.xml')
        root = tree.getroot()
        # Get the main metadata (package-level)
        package_metadata = root.find('./Metadata')
        package_ams = package_metadata.find('AMS')
        logger.debug(f"Package Asset_Name: {str(package_ams.attrib.get('Asset_Name'))}")
        logger.debug(f"Package Asset_ID: {str(package_ams.attrib.get('Asset_ID'))}")
        txtContentName = package_ams.attrib.get('Asset_Name', '')
        txtContentID = package_ams.attrib.get('Asset_ID', '')
        if txtContentID == '':
            logger.debug("Error getting the content ID.")
            return

        provider_id = package_ams.attrib.get('Provider_ID', '').upper()
        if provider_id != "":
            objProviders.append(provider_id)
            if provider_id not in fullProviders:
                fullProviders.append(provider_id)
        product_id = package_ams.attrib.get('Product', '').upper()
        if product_id != "":
            objProducts.append(product_id)
            if product_id not in fullProducts:
                fullProducts.append(product_id)
        # Iterate through assets
        for asset in root.findall('./Asset'):
            asset_metadata = asset.find('Metadata')
            ###################################################################
            # Process the Title ADI section
            ###################################################################
            for app_data in asset_metadata.findall('App_Data'):
                name = str(app_data.attrib.get('Name'))
                value = str(app_data.attrib.get('Value'))
                #if name in ['Resolution','Languages','Subtitle_Languages','X_DAI_Enabled']:
                #print(name)
                # get and parse the content advisories
                if name == 'Advisories':
                    advisory_id = value.replace(' ','_').upper()
                    if advisory_id != "":
                        objContentAdvisory.append(advisory_id)
                        if advisory_id not in fullContentAdvisory:
                            fullContentAdvisory.append(advisory_id)
                # get and parse content categories
                if name == 'Category':
                    category_id = value.replace(' ','_').upper()
                    if category_id != "":
                        objContentCategories.append(category_id)
                        if category_id not in fullContentCategories:
                            fullContentCategories.append(category_id)
                # get and parse content genres
                if name == 'Genre':
                    genre_id = value.replace(' ','_').upper()
                    if genre_id != "" and is_alnum_full(genre_id):
                        objGenres.append(genre_id)
                        if genre_id not in fullGenres:
                            fullGenres.append(genre_id)
                # get and parse content audiences
                if name == 'Audience':
                    audience_id = value.replace(' ','_').upper()
                    if audience_id != "":
                        objContentAudiences.append(audience_id)
                        if audience_id not in fullContentAudiences:
                            fullContentAudiences.append(audience_id)                
                # get and parse production year
                if name == 'Year':
                    production_id = str(value)
                    if production_id != "":
                        objProductionYear.append(production_id)
                        if production_id not in fullProductionYears:
                            fullProductionYears.append(production_id)
                # get and parse actors
                if name == 'Actors':
                    actor_id = format_person_name(value).upper()
                    if actor_id != "":
                        objActors.append(actor_id)
                        if actor_id not in fullActors:
                            fullActors.append(actor_id)         
                # get and parse directors
                if name == 'Director':
                    director_id = format_person_name(value).upper()
                    if director_id != "":
                        objDirectors.append(director_id)
                        if director_id not in fullDirectors:
                            fullDirectors.append(director_id)
                # get and parse Producers
                if name == 'Producers':
                    producer_id = format_person_name(value).upper()
                    if producer_id != "":
                        objProducers.append(producer_id)
                        if producer_id not in fullProducers:
                            fullProducers.append(producer_id)                    
                # get and parse Studio
                if name == 'Studio':
                    studio_id = value.replace(' ','_').upper()
                    if studio_id != "":
                        objStudios.append(studio_id)
                        if studio_id not in fullStudios:
                            fullStudios.append(studio_id)
                # get and parse Country of Origin
                if name == 'Country_of_Origin':
                    country_id = value.replace(' ','_').upper()
                    if country_id != "":
                        objCountryOfOrigin.append(country_id)
                        if country_id not in fullCountryofOrigin:
                            fullCountryofOrigin.append(country_id)         
                # get and parse Parental Control
                if name == 'Rating':
                    parental_id = value.replace(' ','_').upper()
                    if parental_id != "":
                        objParentalRating.append(parental_id)
                        if parental_id not in fullParentalRating:
                            fullParentalRating.append(parental_id)          
                # get and parse the X_Award
                if name == 'X_Award':
                    award_id = value.replace(' ','_').upper()
                    if award_id != "":
                        objAwards.append(award_id)
                        if award_id not in fullAwards:
                            fullAwards.append(award_id)
            ###################################################################
            # Process the Movie ADI section
            ###################################################################
            for sub_asset in asset.findall('./Asset'):
                sub_metadata = sub_asset.find('./Metadata')
                if sub_metadata is None:
                    continue
                ams = sub_metadata.find('AMS')
                if ams is None:
                    continue
                ams = sub_metadata.find('AMS')
                cls = str(ams.attrib.get('Asset_Class'))
                #print(cls)
                logger.debug(f"SubPackage Asset_Name: {str(ams.attrib.get('Asset_Name'))}")
                logger.debug(f"SubPackage Asset_ID: {str(ams.attrib.get('Asset_ID'))}")
                logger.debug(f"SubPackage Class_ID: {cls}")
                if cls == 'movie':
                    logger.debug(f"Processing SubPackage Class_ID: {cls}")
                    for sub_app_data in sub_metadata.findall('App_Data'):
                        name = str(sub_app_data.attrib.get('Name'))
                        value = str(sub_app_data.attrib.get('Value'))
                        # get and parse Audio Languages
                        if name == 'Languages':
                            audio_id = value.replace(' ','_').upper()
                            if audio_id != "":
                                objAudios.append(audio_id)
                                if audio_id not in fullAudios:
                                    fullAudios.append(audio_id)
                        # get and parse Resolution
                        if name == 'Resolution':
                            resolution_id = value.replace(' ','_').upper()
                            if resolution_id != "":
                                objResolutions.append(resolution_id)
                                if resolution_id not in fullResolutions:
                                    fullResolutions.append(resolution_id)
                        # get and parse Subtitles
                        if name == 'Subtitle_Languages':
                            subtitle_id = value.replace(' ','_').upper()
                            if subtitle_id != "":
                                objSubtitles.append(subtitle_id)
                                if subtitle_id not in fullSubtitles:
                                    fullSubtitles.append(subtitle_id)
        #################################################################################################
        #################################################################################################
        metadata_block = {}     
        # Mapping all variable names to the intended JSON keys
        all_metadata_fields = {
            "CntProviders": objProviders,
            "CntProducts": objProducts,
            "CntAdvisories": objContentAdvisory,
            "CntCategories": objContentCategories,
            "CntGenres": objGenres,
            "CntAudiences": objContentAudiences,
            "CntProductionYear": objProductionYear,
            "CntActors": objActors,
            "CntDirectors": objDirectors,
            "CntProducers": objProducers,
            "CntStudios": objStudios,
            "CntCountryOfOrigin": fullCountryofOrigin,
            "CntarentalRating": objParentalRating,
            "CntAwards": objAwards,
            "CntResolutions": objResolutions,
            "AudioLanguages": objAudios,
            "SubtitleLanguages": objSubtitles
        }
        # Add to the objTmp only the items listed in outMetadata
        for key, value in all_metadata_fields.items():
            if key in outMetadata:
                metadata_block[key] = value
        #################################################################################################
        objTmp = {
            "contentId": txtContentID,
            "contentName": txtContentName,
            "contentType": [txtContentType],
            "expirationDate": str(expirationDate.isoformat()),
            "control": {"allowAdInsertion": True},
            "metadata": metadata_block
        }

        # Avoiding duplications in the exportObject
        content_id = txtContentID
        if not any(item.get("contentId", "") == content_id for item in exportObject):
            exportObject.append(objTmp)
        objTmp = {}
        
        # Process the unique collected KVPs
        logger.info("Starting to process the KVPs")
        if (len(fullProviders) > 0 and "CntProviders" in outMetadata):
            processKVP("CntProviders", fullProviders)
        if (len(fullProducts) > 0 and "CntProducts" in outMetadata):
            processKVP("CntProducts", fullProducts)
        if (len(fullContentAdvisory) > 0 and "CntAdvisories" in outMetadata):
            processKVP("CntAdvisories", fullContentAdvisory)
        if (len(fullContentCategories) > 0 and "CntCategories" in outMetadata):
            processKVP("CntCategories", fullContentCategories)
        if (len(fullGenres) > 0 and "CntGenres" in outMetadata):
            processKVP("CntGenres", fullGenres)
        if (len(fullContentAudiences) > 0 and "CntAudiences" in outMetadata):
            processKVP("CntAudiences", fullContentAudiences)
        if (len(fullProductionYears) > 0 and "CntProductionYear" in outMetadata):
            processKVP("CntProductionYear", fullProductionYears)
        if (len(fullActors) > 0 and "CntActors" in outMetadata):
            processKVP("CntActors", fullActors)    
        if (len(fullDirectors) > 0 and "CntDirectors" in outMetadata):
            processKVP("CntDirectors", fullDirectors)               
        if (len(fullProducers) > 0 and "CntProducers" in outMetadata):
            processKVP("CntProducers", fullProducers)
        if (len(fullStudios) > 0 and "CntStudios" in outMetadata):
            processKVP("CntStudios", fullStudios)
        if (len(fullCountryofOrigin) > 0 and "CntCountryOfOrigin" in outMetadata):
            processKVP("CntCountryOfOrigin", fullCountryofOrigin)
        if (len(fullParentalRating) > 0 and "CntParentalRating" in outMetadata):
            processKVP("CntParentalRating", fullParentalRating)
        if (len(fullAwards) > 0 and "CntAwards" in outMetadata):
            processKVP("CntAwards", fullAwards)
        if (len(fullResolutions) > 0 and "CntResolutions" in outMetadata):
            processKVP("CntResolutions", fullResolutions)
        if (len(fullAudios) > 0 and "AudioLanguages" in outMetadata):
            processKVP("AudioLanguages", fullAudios)
        if (len(fullSubtitles) > 0 and "SubtitleLanguages" in outMetadata):
            processKVP("SubtitleLanguages", fullSubtitles)         
        logger.info("Finished to process the KVPs")

    except TypeError as tp:
        logger.info("Serialization error")
        logger.debug(f"Serialization error: {tp}")
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
    logger.debug("Entering send_jsonl")
    global jsonlFile, outBucket, irisTN

    if method == "add":
        s3_bucket_file_path = irisTN + "/content/input/" + jsonlFile.replace('./', '')
    elif method == "delete":
        s3_bucket_file_path = irisTN + "/content/deleted/" + jsonlFile.replace('./', '')
    
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
        #logger.debug(f"S3 Bucket Files: {fKey}")
        if file_name in fKey:
            logger.debug(f"S3 Bucket Files: {fKey}")
            if 'ingested' in fKey:
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
parser.add_argument('-input', type=str, default='Armageddon 2.xml',help='Go Tenant ID')
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
    irisTK = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlhzYTZEYlBfUnVELVB1eGNGV1hrTCJ9.eyJodHRwczovL2FjY291bnQuc3luYW1lZGlhLmNvbS9pZCI6Ijc1OTUwODY4MjgiLCJodHRwczovL3VzZXIuc3luYW1lZGlhLmNvbS9pZCI6ImlyaXMtbWFya3RpbmctYXBwLWMyNzkwN2JkLTRkYzgtNDgxNC1iZWFkLTU3MzUwMGI0YTUwMSIsImh0dHBzOi8vcHJvamVjdC5zeW5hbWVkaWEuY29tL2lkIjoic2pkZzN4emQiLCJodHRwczovL2NsYXJpc3NhLnN5bmFtZWRpYS5jb20vaWQiOiJiMTNqYmI4byIsImh0dHBzOi8vaXJpcy5zeW5hbWVkaWEuY29tL2lkIjoib3A3ejRnZXEiLCJodHRwczovL3ZpdmlkLnN5bmFtZWRpYS5jb20vaWQiOiJ4ZjdzNXY4eCIsImh0dHBzOi8vY3NmZXllLnN5bmFtZWRpYS5jb20vaWQiOiJ6azA4ajVzMSIsImh0dHBzOi8vZXZlcmd1YXJkLnN5bmFtZWRpYS5jb20vaWQiOiJ0aTdsbHdocyIsImh0dHBzOi8vZ28uc3luYW1lZGlhLmNvbS9pZCI6Ind6bGJ5bnl1IiwiaHR0cHM6Ly9jbGllbnQtaWRlbnRpdHkuc3luYW1lZGlhLmNvbS9pZCI6InptajN2dmp6IiwiaXNzIjoiaHR0cHM6Ly9hdXRoLnN5bmFtZWRpYS5jb20vIiwic3ViIjoieXdldTV2aURzWEFJcWZGcjlvQmNNVGgzbUlSS1hWM2RAY2xpZW50cyIsImF1ZCI6Imh0dHBzOi8vcHJvamVjdHMuc3luYW1lZGlhLmNvbSIsImlhdCI6MTc1MTU0NjYwMiwiZXhwIjoxNzUxNTY4MjAyLCJzY29wZSI6ImlyaXM6cHJvZHVjdC1yYXRpbmc6ZGVsZXRlIGlyaXM6cHJvZHVjdC1zdWJzY3JpYmVyczpkZWxldGUgaXJpczpwcm9kdWN0LWNyZWF0aXZlczpkZWxldGUgaXJpczpwcm9kdWN0LXJhdGluZzpyZWFkIGlyaXM6cHJvZHVjdC1jcmVhdGl2ZXM6cmVhZCBpcmlzOnByb2R1Y3QtcmVwb3J0czpyZWFkIGlyaXM6cHJvZHVjdC1zdWJzY3JpYmVyczpyZWFkIGlyaXM6cHJvZHVjdC1yYXRpbmc6d3JpdGUgaXJpczpwcm9kdWN0LXN1YnNjcmliZXJzOndyaXRlIGlyaXM6cHJvZHVjdC1jcmVhdGl2ZXM6d3JpdGUgaXJpczpwcm9kdWN0LW1hbmFnZW1lbnQtYXBpOnJlYWQgaXJpczpwcm9kdWN0LW1hbmFnZW1lbnQtYXBpOndyaXRlIGlyaXM6YWxsOmFsbCIsImd0eSI6ImNsaWVudC1jcmVkZW50aWFscyIsImF6cCI6Inl3ZXU1dmlEc1hBSXFmRnI5b0JjTVRoM21JUktYVjNkIn0.ff-ks_ZfKypvlq4YU7k1gRWuDnSShPo424bkeCpmmlEZvCHY6v1BQUetLP1eQN7cROTHZDLzr1NMbd0SkdU4CjYxQ0NaW651Ai3geqN5GVVxZ7ZF_XdD8mc4tZNPHD_OEPI-z7Nt76k6rgRa281MacCbE-bDHkOua0vc-FIiD_kIZcrzinW6jZz2ilMBx8RYOOpoZtbdVclO1ozbN7-fta58W1PtsE1RBbEjNK5cvHMuZAcC3Svl74G-Y30D_Ib0rVa_Yy-BGhtkPfyoMyRdOW2V2F5ghhlzQww1-t-PCriVCUDbaohtRJWqujqjLC3Z_NpyTUwFu2PAPFy6H2iFqQ'
    #getIrisAccessToken()

# Get Go VOD data export 
logger.debug("Fetching Go Catalog")
fetchAndPrepareADIData()
logger.debug(f"len(exportObject): {str(len(exportObject))}")
logger.debug(f"ExportObject: {exportObject}")
# Save the jsonl file
logger.debug("Saving the jsonl file")
saveMetadataFile()
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
wait(1)
# Check if the file was properly processed
logger.debug("Checking S3")
check_bucket(bot)

logger.debug("#######################################")
logger.debug('# END PROCESSING ')
logger.debug("#######################################")