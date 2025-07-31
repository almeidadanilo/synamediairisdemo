import sys
import pyperclip
from cryptography.fernet import Fernet

######################################################################################################
# Generate and save a crypto key
######################################################################################################
def generateCryptoKey():
    key = Fernet.generate_key()
    with open("secret.key", "wb") as key_file:
        key_file.write(key)

######################################################################################################
# Load de latest generated crypto key
######################################################################################################
def getCryptoKey():
    return open("secret.key", "rb").read()

######################################################################################################
# Main Loop
######################################################################################################

method = sys.argv[1]

if method == 'gen':
    
    generateCryptoKey()

elif method == 'enc':
    
    c_key = getCryptoKey()
    fer = Fernet(c_key)
    text = sys.argv[2]
    enc_text = ''

    enc_text = fer.encrypt(text.encode()).decode()

    # Copy to clipboard
    pyperclip.copy(enc_text)   

    print("#######################################")
    print(f'# Encrypted text: {enc_text}')
    print("# (Encrypted text also copied to clipboard)")
    print("#######################################")

elif method == 'dec':

    c_key = getCryptoKey()
    fer = Fernet(c_key)
    enc_text = sys.argv[2]
    dec_text = ''

    dec_text = fer.decrypt(enc_text.encode()).decode()

    # Copy to clipboard
    pyperclip.copy(dec_text)   

    print("#######################################")
    print(f'# Decrypted text: {dec_text}')
    print("# (Decrypted text also copied to clipboard)")
    print("#######################################")
