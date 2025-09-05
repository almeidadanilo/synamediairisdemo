import random
import json
import datetime
import requests
import cv2
import os
import pygame
import pyautogui
import tkinter as tk
import paho.mqtt.client as mqtt
from tkinter import ttk
from PIL import Image, ImageTk


# Load transparent wheel image
#wheel_image_file = "iris_15_5.png"
#wheel_segments = ["15", "30", "60", "SPECIAL", "75", "45"]
#wheel_segments = ["30", "60", "SPECIAL", "75", "45", "15"]
wheel_segments_15 = ["30", "60", "SPECIAL", "75", "45", "15"]
#wheel_segments_30 = ["30", "60", "90", "120", "SPECIAL", "SPECIAL"]
wheel_segments_30 = ["60", "120", "SPECIAL", "90", "SPECIAL", "30"]
#original_wheel = Image.open(wheel_image_file).resize((400, 400))
image_30 = Image.open("iris_30.png").resize((400, 400))
image_15 = Image.open("iris_15_5.png").resize((400, 400))
current_angle = 0
#num_segments = len(wheel_segments)
num_segments = 1
segment_angle = 360 / num_segments
# Offset angle to adjust for visual alignment
offset_angle = 0  # Fine-tune this experimentally
btQuickset = 0

# UI Setup
root = tk.Tk()
### Loads Synamedia Iris Icon --- try/except for cross platform safety
try:
    root.iconbitmap("iris.ico")
except:
    # Fallback for platforms that don’t support .ico
    icon_img = tk.PhotoImage(file="iris_logo_icon.png")
    root.iconphoto(True, icon_img)
###
root.title("The Wonderful Iris BLUEBUTTON Experience")
root.geometry("650x700")
root.resizable(False, False)

# create the tabs
notebook = ttk.Notebook(root)
notebook.pack(fill="both", expand=True)
# Create frames for each tab
tab_wheel = tk.Frame(notebook)
tab_manual = tk.Frame(notebook)
tab_mqtt = tk.Frame(notebook)
notebook.add(tab_wheel, text="Wheel of Fortune")
notebook.add(tab_manual, text="Manual Select")
notebook.add(tab_mqtt, text="MQTT Signal")

#
is_spinning = False

# Frame for ComboBox + Toggle Button (side by side)
top_controls_frame = tk.Frame(tab_wheel)
top_controls_frame.pack(pady=10)

# Combo Box Options
combo_options = ["Swimming Race", "Destination Earth", "Keshet", "FujairahTV", "MEG", "vDCM"]
selected_option = tk.StringVar()
selected_option.set(combo_options[0])  # default selection

# Combo Box widget
combo_box = ttk.Combobox(top_controls_frame, textvariable=selected_option, values=combo_options, state="readonly", font=("Helvetica", 12), width=20)
combo_box.pack(side="left", padx=5)

# Toggle for demo mode
demo_mode = tk.BooleanVar(value=True)  # True = Live, False = Remote
toggle_button = tk.Checkbutton(top_controls_frame, text="Live Demo", variable=demo_mode, onvalue=True, offvalue=False, font=("Helvetica", 10))
toggle_button.pack(side="left", padx=5)

# Image Canvas
canvas = tk.Canvas(tab_wheel, width=400, height=400, bg="white", highlightthickness=0)
canvas.pack(pady=10)

# Add initial wheel image
#tk_wheel = ImageTk.PhotoImage(original_wheel)
tk_wheel = ImageTk.PhotoImage(image_30)
wheel_item = canvas.create_image(200, 200, image=tk_wheel)
# Add a fixed pointer (triangle at top)
pointer = canvas.create_polygon(195, 10, 205, 10, 200, 30, fill="red", outline="black")

# Draw the result label
result_label = tk.Label(tab_wheel, text="Press SPIN!", font=("Helvetica", 18))
result_label.pack(pady=10)

# Draw the picture countdown label
countdown_label = tk.Label(tab_wheel, text="", font=("Helvetica", 18), fg="blue")
countdown_label.pack(pady=5)

# init the pygame for the sound effects
pygame.mixer.init()
spin_sound = pygame.mixer.Sound("spin_sound.wav")
special_sound = pygame.mixer.Sound("special_sound.wav")
normal_sound = pygame.mixer.Sound("normal_sound.wav")

# Manual tab elements
frame = tk.Frame(tab_manual)
frame.pack(pady=5, padx=20, anchor="w")
# ESAMIP
manual_inputs = {}
fields = [
    ("ESAM IP:", "inESAMIP"),
    ("ESAM Port:", "inESAMPORT"),
    ("ESAM AP:", "inESAMAP"),
    ("DURATION:", "inDURATION")
]
for label_text, name in fields:
    row = tk.Frame(tab_manual)
    row.pack(fill="x", pady=5, padx=20)
    label = tk.Label(row, text=label_text, width=15, anchor="w")
    label.pack(side="left")
    entry = tk.Entry(row, width=30, name=name)
    entry.pack(side="left")
    manual_inputs[name] = entry

# Draw the result label
result_label_manual = tk.Label(tab_manual, text="Press SEND!", font=("Helvetica", 18))
result_label_manual.pack(pady=10)

# Globals for MQ-TT
mqtt_client = None
mqtt_connected = False

######################################################################################################
# Connectto MQ-TT
######################################################################################################
def mqtt_connect():
    try:
        client = ensure_mqtt_client()
        host = mqtt_host_var.get().strip()
        port = int(mqtt_port_var.get())
        keepalive = 60
        # Optional: TLS if you want to use wss with public brokers that require TLS certs.
        # For test.mosquitto.org: websockets on 8081 is usually without TLS in many setups.
        mqtt_log(f"[MQTT] Connecting to {host}:{port} ({mqtt_transport_var.get()}) ...")
        client.connect(host, port, keepalive)
        client.loop_start()
    except Exception as e:
        mqtt_log(f"[MQTT] Connect error: {e}")

######################################################################################################
# Disconnect from MQTT
######################################################################################################
def mqtt_disconnect():
    global mqtt_client
    try:
        if mqtt_client:
            mqtt_log("[MQTT] Disconnecting ...")
            mqtt_client.loop_stop()
            mqtt_client.disconnect()
            mqtt_client = None
    except Exception as e:
        mqtt_log(f"[MQTT] Disconnect error: {e}")

# ============================
# MQTT Tab UI
# ============================
# Defaults
mqtt_host_var = tk.StringVar(value="test.mosquitto.org")
mqtt_port_var = tk.StringVar(value="1883")                  # 1883 (TCP) or 8081 (websockets)
mqtt_transport_var = tk.StringVar(value="tcp")              # "tcp" or "websockets"
mqtt_topic_var = tk.StringVar(value="linearcc/triggerDAI")  # same topic your React app listens to
mqtt_status_var = tk.StringVar(value="Disconnected")

# Container for the connection controls
row_conn = tk.Frame(tab_mqtt)
row_conn.pack(fill="x", pady=8, padx=16)

# Let the Host entry expand, and keep a trailing stretch column for right-aligning the status
row_conn.grid_columnconfigure(1, weight=1)   # Host entry grows
row_conn.grid_columnconfigure(5, weight=1)   # trailing spacer

# ---------------- Row 1: Host + Port ----------------
tk.Label(row_conn, text="Host:", width=8, anchor="w").grid(row=0, column=0, padx=(0,6), pady=2, sticky="w")
tk.Entry(row_conn, textvariable=mqtt_host_var).grid(row=0, column=1, padx=(0,12), pady=2, sticky="we")

tk.Label(row_conn, text="Port:", width=6, anchor="w").grid(row=0, column=2, padx=(0,6), pady=2, sticky="w")
tk.Entry(row_conn, textvariable=mqtt_port_var, width=8).grid(row=0, column=3, padx=(0,0), pady=2, sticky="w")

# ---------------- Row 2: Transport ----------------
tk.Label(row_conn, text="Transport:", width=10, anchor="w").grid(row=1, column=0, padx=(0,6), pady=2, sticky="w")
ttk.Combobox(row_conn, textvariable=mqtt_transport_var,values=["tcp", "websockets"], width=12, state="readonly").grid(row=1, column=1, padx=(0,12), pady=2, sticky="w")

# ---------------- Row 3: Buttons + Status ----------------
tk.Button(row_conn, text="Connect", command=mqtt_connect, width=10).grid(row=2, column=0, padx=(0,6), pady=(6,0), sticky="w")
tk.Button(row_conn, text="Disconnect", command=mqtt_disconnect, width=12).grid(row=2, column=1, padx=(0,12), pady=(6,0), sticky="w")

tk.Label(row_conn, textvariable=mqtt_status_var, fg="green", width=12, anchor="e").grid(row=2, column=5, padx=0, pady=(6,0), sticky="e")

# Topic row
row_topic = tk.Frame(tab_mqtt)
row_topic.pack(fill="x", pady=4, padx=16)
tk.Label(row_topic, text="Topic:", width=8, anchor="w").pack(side="left")
tk.Entry(row_topic, textvariable=mqtt_topic_var, width=40).pack(side="left")

# Separator
ttk.Separator(tab_mqtt, orient="horizontal").pack(fill="x", pady=8, padx=16)

# Quick Actions
actions_frame = tk.LabelFrame(tab_mqtt, text="Advertisement!")
actions_frame.pack(fill="x", pady=4, padx=16)

# Trigger DAI
row_cc = tk.Frame(actions_frame)
row_cc.pack(fill="x", pady=6)

tk.Label(row_cc, text="DAI:", width=6, anchor="w").pack(side="left")
cc_side_var = tk.StringVar(value="1")  # "left" | "right" | "both"
ttk.Combobox(row_cc, textvariable=cc_side_var, values=["1","2"], width=8, state="readonly").pack(side="left", padx=(0,10))

def do_DAI():
    payload = {
        "type": cc_side_var.get()
    }
    mqtt_publish(mqtt_topic_var.get().strip(), payload)

tk.Button(row_cc, text="Trigger DAI", command=do_DAI).pack(side="left")

# Separator
ttk.Separator(tab_mqtt, orient="horizontal").pack(fill="x", pady=8, padx=16)

# Log Console
log_frame = tk.LabelFrame(tab_mqtt, text="MQTT Log")
log_frame.pack(fill="both", expand=True, padx=16, pady=8)

mqtt_log_text = tk.Text(log_frame, height=12, state="disabled", wrap="word")
mqtt_log_text.pack(fill="both", expand=True, padx=6, pady=6)

######################################################################################################
# MQ-TT Logging
######################################################################################################
def mqtt_log(msg):
    try:
        mqtt_log_text.configure(state="normal")
        mqtt_log_text.insert("end", f"{msg}\n")
        mqtt_log_text.see("end")
        mqtt_log_text.configure(state="disabled")
    except Exception:
        pass

######################################################################################################
# On connect
######################################################################################################
def on_mqtt_connect(client, userdata, flags, rc, properties=None):
    global mqtt_connected
    mqtt_connected = (rc == 0)
    mqtt_log(f"[MQTT] Connected (rc={rc})" if mqtt_connected else f"[MQTT] Failed to connect (rc={rc})")
    if mqtt_connected:
        mqtt_status_var.set("Connected")
    else:
        mqtt_status_var.set("Disconnected")

######################################################################################################
# On disconnect
######################################################################################################
def on_mqtt_disconnect(client, userdata, rc, properties=None):
    global mqtt_connected
    mqtt_connected = False
    mqtt_status_var.set("Disconnected")
    mqtt_log(f"[MQTT] Disconnected (rc={rc})")

######################################################################################################
# Ensure
######################################################################################################
def ensure_mqtt_client():
    global mqtt_client
    if mqtt_client is None:
        mqtt_client = mqtt.Client(transport=("websockets" if mqtt_transport_var.get() == "websockets" else "tcp"))
        mqtt_client.on_connect = on_mqtt_connect
        mqtt_client.on_disconnect = on_mqtt_disconnect
    return mqtt_client

######################################################################################################
# Publishing on MQ Topic
######################################################################################################
def mqtt_publish(topic, payload_dict):
    if not mqtt_connected:
        mqtt_log("[MQTT] Not connected. Please connect first.")
        return
    try:
        j = json.dumps(payload_dict)
        mqtt_log(f"[PUB] {topic} :: {j}")
        mqtt_client.publish(topic, j, qos=0, retain=False)
    except Exception as e:
        mqtt_log(f"[MQTT] Publish error: {e}")

######################################################################################################
# Manual Tab quickset
######################################################################################################
def quickset():
    
    current = btQuickset["text"]

    if current == '..':
        btQuickset["text"] = '1'
        manual_inputs["inESAMAP"].delete(0, tk.END)
        manual_inputs["inESAMAP"].insert(0, "APSR")
        manual_inputs["inESAMIP"].delete(0, tk.END)
        manual_inputs["inESAMIP"].insert(0, "23.129.240.38")
        manual_inputs["inESAMPORT"].delete(0, tk.END)
        manual_inputs["inESAMPORT"].insert(0, "8105")
    elif current == '1':
        btQuickset["text"] = '2'
        manual_inputs["inESAMAP"].delete(0, tk.END)
        manual_inputs["inESAMAP"].insert(0, "APDE")
        manual_inputs["inESAMIP"].delete(0, tk.END)
        manual_inputs["inESAMIP"].insert(0, "23.129.240.38")
        manual_inputs["inESAMPORT"].delete(0, tk.END)
        manual_inputs["inESAMPORT"].insert(0, "8105")
    elif current == '2':
        btQuickset["text"] = '3'
        manual_inputs["inESAMAP"].delete(0, tk.END)
        manual_inputs["inESAMAP"].insert(0, "APCL1")
        manual_inputs["inESAMIP"].delete(0, tk.END)
        manual_inputs["inESAMIP"].insert(0, "192.168.50.210")
        manual_inputs["inESAMPORT"].delete(0, tk.END)
        manual_inputs["inESAMPORT"].insert(0, "9100")
    elif current == '3':
        btQuickset["text"] = '4'
        manual_inputs["inESAMAP"].delete(0, tk.END)
        manual_inputs["inESAMAP"].insert(0, "APFT")
        manual_inputs["inESAMIP"].delete(0, tk.END)
        manual_inputs["inESAMIP"].insert(0, "23.129.240.38")
        manual_inputs["inESAMPORT"].delete(0, tk.END)
        manual_inputs["inESAMPORT"].insert(0, "8105")        
    else:
        btQuickset["text"] = '..'
        manual_inputs["inESAMAP"].delete(0, tk.END)
        manual_inputs["inESAMIP"].delete(0, tk.END)
        manual_inputs["inESAMPORT"].delete(0, tk.END)
        

######################################################################################################
# Send Manual SCTE35
######################################################################################################
def send_scte():
    # Collect all inputs
    dur = manual_inputs["inDURATION"].get()
    ap = manual_inputs["inESAMAP"].get()
    ip = manual_inputs["inESAMIP"].get()
    port = manual_inputs["inESAMPORT"].get()
    ####
    now1 = datetime.datetime.now(datetime.UTC)
    print('Current time: ' + now1.isoformat())
    # Add 5s to the current time to get the splice time
    spliceTime1 = now1 + datetime.timedelta(seconds=5)
    time1 = 'utcPoint="' + str(spliceTime1.isoformat()) +'"'
    # Build Command 
    xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <ns3:SignalProcessingNotification acquisitionPointIdentity="{}" 
            xmlns:sig="urn:cablelabs:md:xsd:signaling:3.0" 
            xmlns:ns5="urn:cablelabs:iptvservices:esam:xsd:common:1" 
            xmlns:ns2="urn:cablelabs:md:xsd:core:3.0" 
            xmlns:ns4="urn:cablelabs:md:xsd:content:3.0" 
            xmlns:ns3="urn:cablelabs:iptvservices:esam:xsd:signal:1">
            <ns5:StatusCode classCode="0"/>
            <ns3:ResponseSignal action="create" signalPointID="OvZbrzQYQw6RhaCrNTSYU1" acquisitionTime="2016-10-13T09:08:00Z" acquisitionSignalID="01c51d7c-9820-4e48-82b9-12920b9749b6" acquisitionPointIdentity="{}">
                <sig:UTCPoint {}/>
                <sig:SCTE35PointDescriptor spliceCommandType="5">
                   <sig:SpliceInsert spliceEventID="2001" outOfNetworkIndicator="true" uniqueProgramID="1" duration="PT{}S"></sig:SpliceInsert>
                   </sig:SCTE35PointDescriptor>
            </ns3:ResponseSignal>
            <ns3:ConditioningInfo acquisitionSignalIDRef="01c51d7c-9820-4e48-82b9-12920b9749b6" duration="PT{}S"/>
        </ns3:SignalProcessingNotification>""".format(ap,ap,time1,dur,dur)
    
    print('Splice sheduled for: ' + spliceTime1.isoformat())
    print('Send ESAM request')
    print('vDCM Server: ' + ip)
    print('ESAM Port: ' + port)
    print('Avail Duration (s): ' + str(dur))
    print('SCTE35 Type: 5')
    print('Ad Count: 1')
    print('Acquisition Point ID: ' + ap)    
    headers = {'Content-Type': 'application/xml'} 
    url = 'http://{}:{}/esam/signal'.format(ip,port)
    print(url)
    ESAM = requests.post(url, data=xml, headers=headers)
    print('Status Code:', ESAM.status_code)

    result_label_manual.config(text="SCTE35 Sent!")

######################################################################################################
# Select the correct wheel logical segment
######################################################################################################
def get_segments_for_option(option):
    if option in ["Swimming Race", "Destination Earth", "Keshet", "FujairahTV"]:
        return wheel_segments_30
    else:
        return wheel_segments_15

######################################################################################################
# Select the correct wheel image
######################################################################################################
def get_wheel_image_for_option(option):
    if option in ["Swimming Race", "Destination Earth", "Keshet", "FujairahTV"]:
        return image_30
    elif option in ["MEG", "vDCM"]:
        return image_15
    else:
        return image_15  # default fallback

######################################################################################################
# Update image on canvas according dropbox
######################################################################################################
def update_wheel_image(event=None):
    global tk_wheel, wheel_item, current_angle

    current_angle = 0
    selected_img = get_wheel_image_for_option(selected_option.get())
    tk_wheel = ImageTk.PhotoImage(selected_img)
    canvas.itemconfig(wheel_item, image=tk_wheel)
    canvas.image = tk_wheel  # prevent garbage collection

######################################################################################################
# Updates the specials json file for the landpage rendering
######################################################################################################
def update_specials_json (filename, build):

    if build:
        # Load existing index.json or create a new list
        if os.path.exists('../build/specials/index.json'):
            with open('../build/specials/index.json', "r", encoding="utf-8") as f:
                try:
                    index_list = json.load(f)
                except json.JSONDecodeError:
                    index_list = []
        else:
            index_list = []

        # Append new filename if it's not already there
        if os.path.basename(filename) not in index_list:
            index_list.append(os.path.basename(filename))

        # Save updated index.json
        with open('../build/specials/index.json', "w", encoding="utf-8") as f:
            json.dump(index_list, f, indent=4)
    else:
        # Load existing index.json or create a new list
        if os.path.exists('../public/specials/index.json'):
            with open('../public/specials/index.json', "r", encoding="utf-8") as f:
                try:
                    index_list = json.load(f)
                except json.JSONDecodeError:
                    index_list = []
        else:
            index_list = []

        # Append new filename if it's not already there
        if os.path.basename(filename) not in index_list:
            index_list.append(os.path.basename(filename))

        # Save updated index.json
        with open('../public/specials/index.json', "w", encoding="utf-8") as f:
            json.dump(index_list, f, indent=4)

######################################################################################################
# Take the photo Function
######################################################################################################
def capture_special_photo():
    if not os.path.exists('../public/specials'):
        os.makedirs('../public/specials')

    if not os.path.exists('../build/specials'):
        os.makedirs('../public/specials')

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f'../public/specials/{timestamp}.jpg'
    filenameB = f'../build/specials/{timestamp}.jpg'

    # 0 - built in
    # 1 - USB
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Cannot open webcam")
        return

    ret, frame = cap.read()
    if ret:
        # Increase brightness by converting to HSV and boosting the V channel
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        v = cv2.add(v, 50)  # Increase brightness value 
        final_hsv = cv2.merge((h, s, v))
        bright_frame = cv2.cvtColor(final_hsv, cv2.COLOR_HSV2BGR)
        cv2.imwrite(filename, bright_frame)
        cv2.imwrite(filenameB, bright_frame)
        print(f"📸 Special moment captured: {filename} and {filenameB}")
    else:
        print("Failed to capture image.")

    cap.release()

    update_specials_json(filename, False)
    update_specials_json(filenameB, True)

######################################################################################################
# Take the screenshot Function
######################################################################################################
def capture_screenshot_special():
    if not os.path.exists('../public/specials'):
        os.makedirs('../public/specials')

    if not os.path.exists('../build/specials'):
        os.makedirs('../public/specials')        

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f'../public/specials/{timestamp}.jpg'
    filenameB = f'../build/specials/{timestamp}.jpg'

    image = pyautogui.screenshot()
    image.save(filename)
    image.save(filenameB)
    print(f"🖼️ Screenshot saved to: {filename} and {filenameB}")

    update_specials_json(filename, False)
    update_specials_json(filenameB, True)

######################################################################################################
# Countdown to the picture function
######################################################################################################
def start_countdown_and_capture():
    countdown = [3, 2, 1, 'SHOT!']
    
    def update_count(i):
        if i < len(countdown):
            countdown_label.config(text=str(countdown[i]))
            root.after(1000, update_count, i+1)
        else:
            countdown_label.config(text="")  # Clear after
            # check the demo environment
            if demo_mode.get():
                capture_special_photo()
            else:
                capture_screenshot_special()
    
    update_count(0)

######################################################################################################
# Spin the wheel Function
######################################################################################################
def spin_wheel():
    global current_angle, tk_wheel, is_spinning 
    selected_img = get_wheel_image_for_option(selected_option.get())
    #########################################
    spin_sound.play(-1)  # -1 = loop indefinitely
    #########################################
    total_spin = random.randint(720, 1440)
    steps = 50
    delay = 20
    #########################################
    if is_spinning:
        return          # preventing double spins
    #########################################
    is_spinning= True
    reset_button.config(state="disabled")
    #########################################
    for step in range(steps):
        current_angle = (current_angle + total_spin // steps) % 360
        #rotated = original_wheel.rotate(current_angle)
        selected_img = get_wheel_image_for_option(selected_option.get())
        rotated = selected_img.rotate(current_angle)
        tk_wheel = ImageTk.PhotoImage(rotated)
        canvas.itemconfig(wheel_item, image=tk_wheel)
        canvas.tag_raise(pointer)
        canvas.image = tk_wheel
        canvas.update()
        canvas.after(delay)
        delay += 2
    #########################################
    segments = get_segments_for_option(selected_option.get())
    num_segments = len(segments)
    segment_angle = 360 / num_segments
    corrected_angle = (current_angle + offset_angle) % 360
    index = int((corrected_angle) // segment_angle) % num_segments
    #result = wheel_segments[index]
    result = segments[index]
    result_label.config(text=f"🎯 Result: {result}", fg="green" if result != "Special" else "purple")
    
    #result = "SPECIAL"
    if result in ["75", "90", "120"]:
        result = "SPECIAL"

    if result == "SPECIAL":
        start_countdown_and_capture()
        special_sound.play()
    else:
        normal_sound.play()

    #########################################
    send_ESAM(result, selected_option.get())
    #########################################
    is_spinning = False
    spin_button.config(state="normal")
    reset_button.config(state="normal")
    #########################################
    spin_sound.stop()

######################################################################################################
# Reset the wheel picture function
######################################################################################################
def reset_wheel():
    global current_angle, tk_wheel

    if is_spinning:
        return  # prevent reset while spinning

    current_angle = 0
    #tk_wheel = ImageTk.PhotoImage(original_wheel)
    selected_img = get_wheel_image_for_option(selected_option.get())
    tk_wheel = ImageTk.PhotoImage(selected_img)
    canvas.itemconfig(wheel_item, image=tk_wheel)
    canvas.image = tk_wheel
    result_label.config(text="Wheel Reset!", fg="black")

######################################################################################################
# Signal the ESAM to the MEG/vDCM function
######################################################################################################
def send_ESAM(res, opt):

    ip = ''
    port = ''
    esamid = ''
    duration = 0.0
    scte35type = 5
    adcount = 1

    now = datetime.datetime.now(datetime.UTC)
    print('Current time: ' + now.isoformat())
    # Add 5s to the current time to get the splice time
    spliceTime = now + datetime.timedelta(seconds=5)
    #time = 'utcPoint="' + str(spliceTime.isoformat()) +'Z"'
    time = 'utcPoint="' + str(spliceTime.isoformat()) +'"'

    if res == "SPECIAL":
        duration = float(30.0)
    else:
        duration = float(res)

    if opt == "Swimming Race":
        esamid = 'APSR'
        ip = '23.129.240.38'
        port = '8105'
    elif opt == "Destination Earth":
        esamid = 'APDE'
        ip = '23.129.240.38'
        port = '8105'
    elif opt == "Keshet":
        esamid = 'APKE'
        ip = '23.129.240.38'
        port = '8105'
    elif opt == "FujairahTV":
        esamid = 'APFT'
        ip = '23.129.240.38'
        port = '8105'
    elif opt == "MEG":
        esamid = 'APCL1'
        ip = '192.168.50.210'
        port = '9100'
    elif opt == "vDCM":
        esamid = 'APVDCM'
        ip = '192.168.0.10'
        port = '9100'

    xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <ns3:SignalProcessingNotification acquisitionPointIdentity="{}" 
            xmlns:sig="urn:cablelabs:md:xsd:signaling:3.0" 
            xmlns:ns5="urn:cablelabs:iptvservices:esam:xsd:common:1" 
            xmlns:ns2="urn:cablelabs:md:xsd:core:3.0" 
            xmlns:ns4="urn:cablelabs:md:xsd:content:3.0" 
            xmlns:ns3="urn:cablelabs:iptvservices:esam:xsd:signal:1">
            <ns5:StatusCode classCode="0"/>
            <ns3:ResponseSignal action="create" signalPointID="OvZbrzQYQw6RhaCrNTSYU1" acquisitionTime="2016-10-13T09:08:00Z" acquisitionSignalID="01c51d7c-9820-4e48-82b9-12920b9749b6" acquisitionPointIdentity="{}">
                <sig:UTCPoint {}/>
                <sig:SCTE35PointDescriptor spliceCommandType="5">
                   <sig:SpliceInsert spliceEventID="2001" outOfNetworkIndicator="true" uniqueProgramID="1" duration="PT{}S"></sig:SpliceInsert>
                   </sig:SCTE35PointDescriptor>
            </ns3:ResponseSignal>
            <ns3:ConditioningInfo acquisitionSignalIDRef="01c51d7c-9820-4e48-82b9-12920b9749b6" duration="PT{}S"/>
        </ns3:SignalProcessingNotification>""".format(esamid,esamid,time,duration,duration)
    
    print('Splice sheduled for: ' + spliceTime.isoformat())
    print('Send ESAM request')
    print('vDCM Server: ' + ip)
    print('ESAM Port: ' + port)
    print('Avail Duration (s): ' + str(duration))
    print('SCTE35 Type: ' + str(scte35type))
    print('Ad Count: ' + str(adcount))
    print('Acquisition Point ID: ' + esamid)    
    headers = {'Content-Type': 'application/xml'} 
    url = 'http://{}:{}/esam/signal'.format(ip,port)
    print(url)
    ESAM = requests.post(url, data=xml, headers=headers)
    print('Status Code:', ESAM.status_code)

######################################################################################################
# Dispatch 'i' depending on the selected tab.
######################################################################################################
def handle_key_i(event=None):
    # don't trigger while the user is typing in Entry/Text fields
    f = root.focus_get()
    try:
        if f and f.winfo_class() in ("Entry", "TEntry", "Text"):
            return
    except Exception:
        pass
    
    idx = notebook.index(notebook.select())
    # 0: Wheel, 1: Manual, 2: MQTT
    if idx == 0:
        spin_wheel()
    elif idx == 1:
        send_scte()
    elif idx == 2:
        do_DAI()

######################################################################################################
# Bind the 'i' key to trigger spin_wheel
######################################################################################################
#root.bind('i', lambda event: spin_wheel())
root.bind('<KeyPress-i>', handle_key_i)

######################################################################################################
# Main Loop
######################################################################################################

buttons_frame = tk.Frame(tab_wheel)
buttons_frame.pack(pady=10)
# Spin the Wheel Button
spin_button = tk.Button(buttons_frame, text="SPIN", font=("Helvetica", 16), command=spin_wheel)
spin_button.pack(side="left", padx=10)
# Reset the Wheel Button
reset_button = tk.Button(buttons_frame, text="RESET", font=("Helvetica", 16), command=reset_wheel)
reset_button.pack(side="left", padx=10)
# Manual tab: send SCTE button
tk.Button(tab_manual, text="Send SCTE", command=send_scte, font=("Helvetica", 12)).pack(pady=15)
# Manual tab: Quickset button
btQuickset = tk.Button(tab_manual, text="..", command=quickset, font=("Helvetica", 12))
btQuickset.pack(side="left", padx=15)

combo_box.bind("<<ComboboxSelected>>", update_wheel_image)

def on_app_close():
    try:
        mqtt_disconnect()
    except:
        pass
    root.destroy()

root.protocol("WM_DELETE_WINDOW", on_app_close)

root.mainloop()