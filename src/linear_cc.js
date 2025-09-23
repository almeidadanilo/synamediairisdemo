import React, { useEffect, useRef, useState } from 'react';
import dashjs from 'dashjs';
import axios from 'axios';
import dt from './data.json';
import mqtt from 'mqtt';

const FULL_PLAYER_WIDTH = 750;          // in pixels
const SHRUNK_PLAYER_WIDTH = 350;        // in pixels

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <circle cx="12" cy="12" r="9" fill="none" stroke="#1976d2" strokeWidth="2" />
    <polyline points="8,12 11,15 16,9" fill="none" stroke="#1976d2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const InfoPanel = ({
                    title,
                    segment,
                    flag,
                    isAd,
                    advertName
                }) => (
    <div className="bg-white/80 backdrop-blur rounded-lg shadow-md ring-1 ring-black/5 px-4 py-3 text-center font-poppins">
        {/* Title + Segment + Optional Flag */}
        <div className="flex flex-col items-center space-y-2">
            <div className="flex items-center space-x-3">
                <h2 className="text-lg font-semibold text-gray-800">
                    {title} &amp; {segment}
                </h2>
                {flag && flag !== '' && (
                    <img
                        src={flag}
                        alt="Flag"
                        className="w-[50px] h-[25px] object-contain"
                    />
                )}
            </div>
            {/* Stream Type */}
            <label className="text-gray-700">
                Stream Type:{' '}
                <b className="text-gray-900">
                    {isAd ? `:: AD :: ${advertName}` : 'Content'}
                </b>
            </label>
        </div>
    </div>
);

const AdEventPanel = ({ labels }) => {
  // labels is your leftTrackingLabels / rightTrackingLabels object
  const items = [
    { key: "impression", label: "Impression" },
    { key: "adstart", label: "ADSTART" },
    { key: "firstQuartile", label: "25%" },
    { key: "secondQuartile", label: "50%" },
    { key: "thirdQuartile", label: "75%" },
    { key: "completion", label: "ADCOMPL" },
  ];

  return (
    <div className="bg-gray-100/90 rounded-xl shadow-md ring-1 ring-black/5 px-4 py-3 md:px-5 md:py-4">
      <div className="flex divide-x divide-gray-300">
        {items.map((it, idx) => {
          const val = labels?.[it.key];
          const hit = Boolean(val);
          return (
            <div key={it.key} className="flex-1 px-3 text-center">
              <div className="text-gray-700 font-medium">{it.label}</div>
              <div className="mt-2 flex justify-center">
                {hit ? (
                  <CheckIcon className="w-6 h-6" />
                ) : (
                  <span className="text-blue-600 text-xl leading-none">–</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


// LinearCC - Component for Channel Change and POI (DAI) CSAI Demo Use Cases

const LinearCC = ({input_index}) => {
    const [, forceUpdate] = useState(0);
    const leftVideoRef = useRef(null);
    const rightVideoRef = useRef(null);
    const intervalLeftRef = useRef(null);
    const intervalRightRef = useRef(null);
    const leftPlayer = useRef(null);
    const rightPlayer = useRef(null);
    const leftCTEnabledRef = useRef(false);
    const rightCTEnabledRef = useRef(false);
    const channelID = useRef(1);
    const advertisementPeriod = useRef(false);
    const leftCCTrackingEvents = useRef([]);
    const rightCCTrackingEvents = useRef([]);
    const leftCCAdvertiser = useRef('');
    const rightCCAdvertiser = useRef('');
    const leftCCPlaybackURL = useRef('');
    const rightCCPlaybackURL = useRef('');
    const leftStreamActivatedIsFirstTime = useRef(true);
    const rightStreamActivatedIsFirstTime = useRef(true);
    const toggleModeRef = useRef("display");
    const [leftUrl, setLeftUrl] = useState('');
    const [rightUrl, setRightUrl] = useState('');
    const [leftVolumeLabel, setLeftVolumeLabel] = useState("5%");
    const [rightVolumeLabel, setRightVolumeLabel] = useState("5%");
    const leftCurrentStream = useRef("");
    const rightCurrentStream = useRef(""); 
    const leftDisplayImage = useRef("");
    const rightDisplayImage = useRef("");
    const leftDisplayImpression = useRef("");
    const rightDisplayImpression = useRef("");
    const leftStreamIsAdRef = useRef(false);
    const rightStreamIsAdRef = useRef(false);
    const leftDisplayAdURL = useRef("");
    const rightDisplayAdURL = useRef("");
    const [showLeftDisplayImage, setShowLeftDisplayImage] = useState(false);
    const [showRightDisplayImage, setShowRightDisplayImage] = useState(false);
    const [leftStreamIsAd, setleftStreamIsAd] = useState(false);  
    const [rightStreamIsAd, setrightStreamIsAd] = useState(false);
    const [leftTrackingEvents, setLeftTrackingEvents] = useState([]);
    const leftTrackingEventsRef = useRef([]);
    const [rightTrackingEvents, setRightTrackingEvents] = useState([]);
    const rightTrackingEventsRef = useRef([]);
    const [advertiser, setAdvertiser] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [leftCurrentAdvert, setLeftCurrentAdvert] = useState('');
    const [rightCurrentAdvert, setRightCurrentAdvert] = useState('');
    const [shrinkPlayersLeft, setShrinkPlayersLeft] = useState(false);
    const [shrinkPlayersRight, setShrinkPlayersRight] = useState(false);
    const [isDisplaySelected, setIsDisplaySelected] = useState(true);
    const [displayShape, setDisplayShape] = useState(0);                    // 0: side-by-side | 1: L-Shape | 2: Inverted L-Shape | 3: O-Shape
    const displayShapeRef = useRef(0);
    const [leftTrackingLabels, setLeftTrackingLabels] = useState({
      impression: '',
      adstart: '',
      firstQuartile: '',
      secondQuartile: '',
      thirdQuartile: '',
      completion: ''
    });
    const [rightTrackingLabels, setRightTrackingLabels] = useState({
      impression: '',
      adstart: '',
      firstQuartile: '',
      secondQuartile: '',
      thirdQuartile: '',
      completion: ''
    });
    const _INTERVAL_ = 1000;
    const holdThreshold = 1000;                 // milliseconds
    const __SHRINK_ANNIMATION__= 10000;         // miliseconds
    let leftClickStartTime = null;
    let rightClickStartTime = null;

    useEffect(() => {
        // Start left timer
        intervalLeftRef.current = setInterval(updateCurrentTimeLeft, _INTERVAL_);
        
        // Start right timer
        intervalRightRef.current = setInterval(updateCurrentTimeRight, _INTERVAL_);
      
        return () => {
            console.log('[Linear_cc] Component unmounting — tearing down players');
            // Cleanup on unmount or page change
            if (intervalLeftRef.current) {
                clearInterval(intervalLeftRef.current);
                intervalLeftRef.current = null;
            }
            
            if (intervalRightRef.current) {
                clearInterval(intervalRightRef.current);
                intervalRightRef.current = null;
            }

            if (leftVideoRef.current) {
                leftVideoRef.current.pause();
                leftVideoRef.current.removeAttribute('src');
                leftVideoRef.current.load();
            }
          
            if (rightVideoRef.current) {
                rightVideoRef.current.pause();
                rightVideoRef.current.removeAttribute('src');
                rightVideoRef.current.load();
            }                 
            if (leftPlayer.current) {
                leftPlayer.current.off(dashjs.MediaPlayer.events.ERROR);
                leftPlayer.current.reset();
            }

            if (rightPlayer.current) {
                rightPlayer.current.off(dashjs.MediaPlayer.events.ERROR);
                rightPlayer.current.reset();
            }

        };
    }, []); // <-- run once on mount

    useEffect(() => {
        leftTrackingEventsRef.current = leftTrackingEvents;
    }, [leftTrackingEvents]);

    useEffect(() => {
        rightTrackingEventsRef.current = rightTrackingEvents;
    }, [rightTrackingEvents]);

    useEffect(() => {
        leftStreamIsAdRef.current = leftStreamIsAd;
    }, [leftStreamIsAd])

    useEffect(() => {
        rightStreamIsAdRef.current = rightStreamIsAd;
    }, [rightStreamIsAd])

    useEffect(() => {
        if (leftStreamIsAdRef.current && leftCurrentStream.current && leftTrackingEventsRef.current.length > 0) {
          const match = leftTrackingEventsRef.current.find(ev => ev.id === leftCurrentStream.current);
          setLeftCurrentAdvert(match?.advert || '');
        } else {
          setLeftCurrentAdvert('');
        }
    }, [leftTrackingEvents, leftStreamIsAd, leftCurrentStream.current]); // Include deps

    useEffect(() => {
        if (rightStreamIsAdRef.current && rightCurrentStream.current && rightTrackingEventsRef.current.length > 0) {
          const match = rightTrackingEventsRef.current.find(ev => ev.id === rightCurrentStream.current);
          setRightCurrentAdvert(match?.advert || '');
        } else {
          setRightCurrentAdvert('');
        }
    }, [rightTrackingEvents, rightStreamIsAd, rightCurrentStream.current]);


    // UseEffect to control the MQ-TT topic signaling
    useEffect(() => {
        const client = mqtt.connect('wss://test.mosquitto.org:8081/mqtt');

        client.on('connect', () => {
            console.log('[MQTT] Connected');
            client.subscribe('linearcc/triggerDAI', (err) => {
                if (err) {
                    console.error('[MQTT] Subscription error:', err);
                }
            });
        });

        client.on('message', (topic, message) => {
            const payload = message.toString();
            console.log(`[MQTT] ${topic}: ${payload}`);

            if (topic === 'linearcc/triggerDAI') {
                let tp = JSON.parse(payload);
                if (tp['type'] === '1') {
                    handleLeftDisplayAdRequest();
                    handleRightDisplayAdRequest();
                }
                else if (tp['type'] === '2') {
                    let lURL = leftDisplayAdURL.current.replaceAll('p1', 'p3');
                    let rURL = rightDisplayAdURL.current.replaceAll('p2', 'p4');
                    handleLeftDisplayAdRequest(lURL);
                    handleRightDisplayAdRequest(rURL);
                }
            }
        });

        return () => {
            // Clean disconnect
            client.end(true); 
            console.log('[MQTT] Disconnected');
        };
    }, []);

    const updateCurrentTimeLeft = () => {
        
        let pl = leftPlayer.current;

        // If it is under an advertisement period
        if (Array.isArray(leftTrackingEventsRef.current) && leftTrackingEventsRef.current.length !== 0) {

            const activeStream = pl.getActiveStream?.();
            const manifestId = activeStream?.getId?.();
        
            if (!manifestId) {
                console.log('[updateCurrentTime] Could not retrieve manifestId');
                return;
            }
        
            const currentTime = pl.time(manifestId) * 1000; // convert to ms

            checkTrackingEvents(leftTrackingEventsRef.current, setLeftTrackingLabels, currentTime, 'l', manifestId);
        }
    };

    const updateCurrentTimeRight = () => {
        
        let pl = rightPlayer.current;

        // If it is under an advertisement period
        if (Array.isArray(rightTrackingEventsRef.current) && rightTrackingEventsRef.current.length !== 0) {
            
            const activeStream = pl.getActiveStream?.();
            const manifestId = activeStream?.getId?.();
            
            if (!manifestId) {
                console.log('[updateCurrentTime] Could not retrieve manifestId');
                return;
            }
            
            const currentTime = pl.time(manifestId) * 1000; // convert to ms
            
            checkTrackingEvents(rightTrackingEventsRef.current, setRightTrackingLabels, currentTime, 'r', manifestId);
        }
    };

    const initializePlayers = () => {

        console.log('(LIN) initializePlayers() called.');

        leftPlayer.current = dashjs.MediaPlayer().create();
        leftPlayer.current.updateSettings({
            /*streaming: {
                delay: {
                    liveDelay: 5
                },
                abr: {
                    initialBitrate: {
                        video: 500
                    }
                }
            },*/            
            /*
            dashjs.Debug.LOG_LEVEL_NONE       // No logs
            dashjs.Debug.LOG_LEVEL_FATAL      // Only fatal errors
            dashjs.Debug.LOG_LEVEL_ERROR      // Errors only
            dashjs.Debug.LOG_LEVEL_WARNING    // Warnings and above
            dashjs.Debug.LOG_LEVEL_INFO       // Includes playback info
            dashjs.Debug.LOG_LEVEL_DEBUG      // Very verbose
            */
            debug: {
              logLevel: dashjs.Debug.LOG_LEVEL_NONE // or LOG_LEVEL_ERROR to keep only serious errors
            }
        });
        leftPlayer.current.initialize(leftVideoRef.current, buildURL(dt.vod[input_index][[`left_playback_url_${channelID.current}`]], 'l'), true, 0);
        leftVideoRef.current.muted = true;
        console.log('(LIN) initialize LP');

        rightPlayer.current = dashjs.MediaPlayer().create();
        rightPlayer.current.updateSettings({       
            streaming: {
                delay: {
                    liveDelay: 5
                },
                abr: {
                    initialBitrate: {
                        video: 500
                    }
                }
            },                   
            debug: {
              logLevel: dashjs.Debug.LOG_LEVEL_NONE
            }
        });
        rightPlayer.current.initialize(rightVideoRef.current, buildURL(dt.vod[input_index][[`right_playback_url_${channelID.current}`]], 'r'), true, 0);
        rightVideoRef.current.muted = true;
        console.log('(LIN) initialize RP');

        // Set the intervals
        intervalLeftRef.current = setInterval(updateCurrentTimeLeft, _INTERVAL_);
        console.log('setIntervalLeft() ' + intervalLeftRef.current);
        intervalRightRef.current = setInterval(updateCurrentTimeRight, _INTERVAL_);
        console.log('setIntervalRight() ' + intervalRightRef.current);
        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////
        // Handle HTTP errors
        const handleDashError = (e) => {
            const httpStatus = e?.event?.response?.status;
            console.warn('[Dash Error]', httpStatus, e);
            if ([401, 403, 404].includes(httpStatus)) {
                console.warn(`[Dash Error] Triggering reinitialization due to HTTP ${httpStatus}`);
                handleReinitialize();
            }
        };

        leftPlayer.current.on(dashjs.MediaPlayer.events.ERROR, handleDashError);
        rightPlayer.current.on(dashjs.MediaPlayer.events.ERROR, handleDashError);
        ///////////////////////////////////////////////////////////////////////////
        // Wait until manifest is fully loaded before setting tracking logic
        leftPlayer.current.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, () => {
            //console.log('(LIN) Left manifest loaded — safe to proceed');
            leftPlayer.current.on(dashjs.MediaPlayer.events.PERIOD_SWITCH_STARTED, (e) => {

            });
            leftPlayer.current.on(dashjs.MediaPlayer.events.STREAM_ACTIVATED, (e) => {
                ////////////////////////////////////////////////////////////////////////////
                const newId = e.streamInfo?.id;
                if (!newId) return;
            
                const previousId = leftCurrentStream.current;
            
                if (previousId && previousId !== newId && leftStreamIsAdRef.current) {
                    resetTrackingLabels('l');
                }

                leftCurrentStream.current = newId;
                ////////////////////////////////////////////////////////////////////////////
                const mpd = leftPlayer.current.getDashAdapter()?.getMpd();
                if (!mpd) return;
              
                const result = checkIfAd(mpd, newId);
              
                if (result.isAd) {
                    setLeftTrackingEvents(result.events);
                    setleftStreamIsAd(true);
                    forceUpdate(n => n + 1);
                    const hasCT = result.events.some(ev => ev.type === 'clicktrough' && ev.ct);
                    //console.log("Left Player HasCT: ", hasCT);
                    leftCTEnabledRef.current = hasCT;
                    forceUpdate(n => n + 1);
                } else {
                    setLeftTrackingEvents([]);
                    setleftStreamIsAd(false);
                    resetTrackingLabels('l');
                    leftCTEnabledRef.current = false;
                }
                ///////////////////////////////////////////////////////////////////////////
                if (!leftStreamActivatedIsFirstTime.current) {
                    setShrinkPlayersLeft(true);
                    setTimeout(() => setShrinkPlayersLeft(false), __SHRINK_ANNIMATION__);
                }
                else {
                    leftStreamActivatedIsFirstTime.current = false;
                }                    
            });
        });

        rightPlayer.current.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, () => {
            //console.log('(LIN) Right manifest loaded — safe to proceed');
            rightPlayer.current.on(dashjs.MediaPlayer.events.PERIOD_SWITCH_STARTED, (e) => {

            });
            rightPlayer.current.on(dashjs.MediaPlayer.events.STREAM_ACTIVATED, (e) => {
                //////////////////////////////////////////////////////////////////////////////
                const newId = e.streamInfo?.id;
                if (!newId) return;
            
                const previousId = rightCurrentStream.current;
            
                if (previousId && previousId !== newId && rightStreamIsAdRef.current) {
                    resetTrackingLabels('r');
                }

                rightCurrentStream.current = newId;
                //////////////////////////////////////////////////////////////////////////////
                // Safely access the current, fully loaded manifest
                const mpd = rightPlayer.current.getDashAdapter()?.getMpd();
                if (!mpd) return;

                // Run ad check on the active stream
                const result = checkIfAd(mpd, newId); 

                if (result.isAd) {
                    setRightTrackingEvents(result.events);
                    setrightStreamIsAd(true);
                    forceUpdate(n => n + 1);
                    const hasCT = result.events.some(ev => ev.type === 'clicktrough' && ev.ct);
                    rightCTEnabledRef.current = hasCT;
                    forceUpdate(n => n + 1);
                } else {
                    setRightTrackingEvents([]);
                    setrightStreamIsAd(false);
                    resetTrackingLabels('r');
                    rightCTEnabledRef.current = false;
                }
                ///////////////////////////////////////////////////////////////////////////
                if (!rightStreamActivatedIsFirstTime.current) {
                    setShrinkPlayersRight(true);
                    setTimeout(() => setShrinkPlayersRight(false), __SHRINK_ANNIMATION__);
                }
                else{
                    rightStreamActivatedIsFirstTime.current = false;
                }
            });            
        });
    }

    useEffect(() => {
        
        initializePlayers();

    }, [leftUrl,rightUrl]);

    useEffect(() => {

    });
  
    const buildTrackingEvents = (es, tevs, ind, eventStreamTk, eventStreamCt) => {

        let te = '';
        let myURL = '';
        let teType = '';
        let adv = '';
        let ctURL = ''
        let params = [];
        let event = '';
        
        //console.log(es);
        for (let i = 0; i < eventStreamTk.Event_asArray.length; i++){
            // set tracking events        
            //myURL = decodeBase64(es.Event_asArray[i].Binary_asArray[0].__text);
            myURL = eventStreamTk.Event_asArray[i].Tracking_asArray[0].__cdata;
            event = eventStreamTk.Event_asArray[i].Tracking_asArray[0].event;
            //console.log(myURL);
            params = new URLSearchParams(myURL);
            adv = params.get("creativeId");
            if (event.includes('impression')) {
                teType = 'Impression';
            } else if (event.includes('start')){
                teType = 'Ad Start';
            } else if (event.includes('firstQuartile')) {
                teType = 'First Quartile';
            } else if (event.includes('midpoint')) {
                teType = 'Second Quartile';
            } else if (event.includes('thirdQuartile')) {
                teType = 'Third Quartile';
            } else if (event.includes('complete')) {
                teType = 'Fourth Quartile';
            } else {
                teType = 'Unkknown';
            }                      
            te = {stream:i, id:ind, pt: eventStreamTk.Event_asArray[i].presentationTime, type: teType, url: myURL, reported: false, advert: adv, ct: ''};
            //console.log(te);
            tevs.push(te);
        }

        // Get the EventStream for click-through
        if (!eventStreamCt) { return; }
        //console.log("eventStreamCt", eventStreamCt);
        for (let u = 0; u < eventStreamCt.Event_asArray.length; u++) {
            myURL = eventStreamCt.Event_asArray[u].VideoClicks_asArray[0].ClickTracking_asArray[0];
            //console.log("myURL: ", myURL);
            ctURL = eventStreamCt.Event_asArray[u].VideoClicks_asArray[0].ClickThrough_asArray[0];
            te = {stream:ind, id:ind, pt: 0, type: 'clicktrough', url: myURL, reported: false, advert: adv, ct: ctURL};
            //console.log(te);
            tevs.push(te);
        }        
    }


    const checkIfAd = (mpd, activeStreamId) => {
        let ret = false;
        let events = [];
      
        const manifest = mpd?.manifest;
        const periods = manifest?.Period_asArray || [];

        // Find the current period by ID
        const currentPeriod = periods.find(p => p?.id === activeStreamId);
        if (!currentPeriod) return { isAd: false, events };

        // Check if it has a tracking EventStream
        //const eventStream = currentPeriod.EventStream_asArray?.[0];
        if (!currentPeriod.EventStream_asArray) return { isAd: false, events };

        const eventStreamTk = currentPeriod.EventStream_asArray.find(e => e?.value === "com.synamedia.dai.tracking.v2");
        const eventStreamCT = currentPeriod.EventStream_asArray.find(e => e?.value === "com.synamedia.dai.videoclick.v2");

        if (eventStreamTk) {
            ret = true;
            //console.log("buildTrackingEvents", eventStreamTk, events, currentPeriod.id);
            buildTrackingEvents(null, events, currentPeriod.id, eventStreamTk, eventStreamCT);
        }
      
        return { isAd: ret, events };        
    }
    
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    const buildURL = (url, pl) => {
        let str = '';
        //let did = crypto.randomUUID();
        //let did = window.crypto?.randomUUID?.() || Math.random().toString(36).substring(2);
        let did = generateUUID();

        //console.log("did=", did);        
        str = url + '&sessionId=SYNAIRISDEMO_' + pl + '_' + input_index.toString() + '_' + (Math.floor(new Date().getTime() / 1000).toString());
        str = str + '&deviceId=' + did
        str = str + '&transactionId=' + (Math.floor(new Date().getTime() / 1000).toString());

        console.log("buildURL: ", str);

        return str;
    };
  
    const checkTrackingEvents = (trackingEvents, setTrackingLabels, tm, pl, id) => {

        for (let q = 0; q < trackingEvents.length; q++) {
            if (trackingEvents[q]?.id === id) {
                if ((tm >= trackingEvents[q]?.pt) && (!trackingEvents[q]?.reported)) {
                    console.log('HTTP GET: ' + pl + ' - ' + trackingEvents[q].advert + ' - ' + trackingEvents[q].type + ' - ', trackingEvents[q].url);
                    getData(trackingEvents[q].url);
                    trackingEvents[q].reported = true;
                    // Update the corresponding label
                    setTrackingLabels((prevLabels) => {
                    const newLabels = { ...prevLabels };
                    switch (trackingEvents[q].type) {
                        case 'Impression':
                            newLabels.impression = '✔';
                            break;
                        case 'Ad Start':
                            newLabels.adstart = '✔';
                            break;
                        case 'First Quartile':
                            newLabels.firstQuartile = '✔';
                            break;
                        case 'Second Quartile':
                            newLabels.secondQuartile = '✔';
                            break;
                        case 'Third Quartile':
                            newLabels.thirdQuartile = '✔';
                            break;
                        case 'Fourth Quartile':
                            newLabels.completion = '✔';
                            break;
                            default:
                        break;
                    }
                    return newLabels;
                });
                }
            }
        }
    };
  
    const resetTrackingLabels = (tracker) => {

        if (tracker === 'l') {
            setLeftTrackingLabels({
                impression: '',
                adstart: '',
                firstQuartile: '',
                secondQuartile: '',
                thirdQuartile: '',
                completion: ''
            });
        }
        
        if (tracker === 'r') {
            setRightTrackingLabels({
                impression: '',
                adstart: '',
                firstQuartile: '',
                secondQuartile: '',
                thirdQuartile: '',
                completion: ''
            });
        }

        if (tracker === 'rl') {
            setLeftTrackingLabels({
                impression: '',
                adstart: '',
                firstQuartile: '',
                secondQuartile: '',
                thirdQuartile: '',
                completion: ''
            });
            setRightTrackingLabels({
                impression: '',
                adstart: '',
                firstQuartile: '',
                secondQuartile: '',
                thirdQuartile: '',
                completion: ''
            });                        
        }

        forceUpdate(n => n + 1);

    };
  
    const handleTogglePlayPause = () => {
        if (isPlaying) {
            leftVideoRef.current.pause();
            rightVideoRef.current.pause();
            setIsPlaying(false);
            if (intervalLeftRef.current) {
                clearInterval(intervalLeftRef.current);
                intervalLeftRef.current = null;
            }
            if (intervalRightRef.current){
                clearInterval(intervalRightRef.current);
                intervalRightRef.current = null;
            }
        } else {
            leftVideoRef.current.play();
            rightVideoRef.current.play();
            setIsPlaying(true);
            if (!intervalLeftRef.current) {
                intervalLeftRef.current = setInterval(updateCurrentTimeLeft, _INTERVAL_);
            }
            if (!intervalRightRef.current) {
                intervalRightRef.current = setInterval(updateCurrentTimeRight, _INTERVAL_);
            }
        }
    };

    const handleReinitialize = () => {
        if (leftPlayer && rightPlayer) {
  
          let url = '';
  
          leftPlayer.current.reset();
          rightPlayer.current.reset();
  
          url = buildURL(leftUrl, 'l');
          leftPlayer.current.initialize(leftVideoRef.current, url, false, 0);
          url = buildURL(rightUrl, 'r');
          rightPlayer.current.initialize(rightVideoRef.current, url, false, 0);
        }
        setIsPlaying(false);
        resetTrackingLabels();
      };
  
      const handleStop = () => {

        if (intervalLeftRef.current) {
            clearInterval(intervalLeftRef.current);
            intervalLeftRef.current = null;
        }
        if (intervalRightRef.current) {
            clearInterval(intervalRightRef.current);
            intervalRightRef.current = null;
        }

        if (leftPlayer && rightPlayer) {
            // Stop and reset Dash.js players
            leftPlayer.current.reset();
            rightPlayer.current.reset();
        }
    
        if (leftVideoRef.current && rightVideoRef.current) {
            // Pause and clear video sources
            leftVideoRef.current.pause();
            leftVideoRef.current.removeAttribute('src'); // Remove the source
            leftVideoRef.current.load(); // Force reload (to fully clear)
            
            rightVideoRef.current.pause();
            rightVideoRef.current.removeAttribute('src');
            rightVideoRef.current.load();
        }
    
        // Reset any tracking states and variables
        setIsPlaying(false);
        resetTrackingLabels();        
      };

      // Handle the HTTPS GET for the ad beacons
      const getData = async (url) => {
        try {
            /*const response = await axios.get(url, {headers:{
                'Access-Control-Allow-Origin': '*',
                'Content-Type':'application/json'
            }});*/
            const response = await axios.get(url);
            //console.log(response.data);
            return response.status;
        } catch (error) {
            console.error('Error posting data:', error);
            return -1;
        }
      };    

    const handleLeftMouseDown = () => {
        leftClickStartTime = new Date().getTime();
    };

    const handleRightMouseDown = () => {
        rightClickStartTime = new Date().getTime();
    };    

    const handleLeftMouseUp = () => {
        const heldDuration = new Date().getTime() - leftClickStartTime;
        if (heldDuration < holdThreshold) {
            handleLeftClick();      
        } else {
            handleLeftClickHold();
        }
    };

    const handleRightMouseUp = () => {
        const heldDuration = new Date().getTime() - rightClickStartTime;
        if (heldDuration < holdThreshold) {
            handleRightClick();      
        } else {
            handleRightClickHold();
        }
    };

    const handleLeftClick = () => {
        console.log("Normal click behavior triggered (left)");

        const eventList = leftTrackingEventsRef.current;
        const currentStream = leftCurrentStream.current;

        const ctEvent = eventList.find(ev => ev.id === currentStream && ev.type === 'clicktrough' && ev.ct) || eventList.find(ev => ev.type === 'clicktrough' && ev.ct);

        if (ctEvent) {
            // Action the Ad Click
            window.open(ctEvent.ct, '_blank');
            // Report the Ad Click
            console.log('HTTP GET: L - ' + ctEvent.advert + ' - ' + ctEvent.type + ' - ', ctEvent.url);
            getData(ctEvent.url);                
        } 
        else {
            console.log('No clickthrough URL found for L');
        }        
    };

    const handleRightClick = () => {
        console.log("Normal click behavior triggered (right)");
        const eventList = rightTrackingEventsRef.current;
        const currentStream = rightCurrentStream.current;

        const ctEvent = eventList.find(ev => ev.id === currentStream && ev.type === 'clicktrough' && ev.ct) || eventList.find(ev => ev.type === 'clicktrough' && ev.ct);

        if (ctEvent) {
            // Action the Ad Click
            window.open(ctEvent.ct, '_blank');
            // Report the Ad Click
            console.log('HTTP GET: R - ' + ctEvent.advert + ' - ' + ctEvent.type + ' - ', ctEvent.url);
            getData(ctEvent.url);                
        } 
        else {
            console.log('No clickthrough URL found for R');
        }        
    };    

    const handleLeftClickHold = () => {
        console.log("Click-and-hold behavior triggered (left)");

        const eventList = leftTrackingEventsRef.current;
        const currentStream = leftCurrentStream.current;
        let url = '';

        const ctEvent = eventList.find(ev => ev.id === currentStream && ev.type === 'clicktrough' && ev.ct) || eventList.find(ev => ev.type === 'clicktrough' && ev.ct);

        if (ctEvent) {
            // Action the Ad Click
            url = 'http://localhost:3000/landing?assetId=' + ctEvent.advert
            window.open(url, '_blank');
            // Report the Ad Click
            console.log('HTTP GET: L - ' + ctEvent.advert + ' - ' + ctEvent.type + ' - ', url);
            getData(ctEvent.url);                
        } 
        else {
            console.log('No clickthrough URL found for L');
        }         
    };

    const handleRightClickHold = () => {
        console.log("Click-and-hold behavior triggered (right)");

        const eventList = rightTrackingEventsRef.current;
        const currentStream = rightCurrentStream.current;
        let url = '';

        const ctEvent = eventList.find(ev => ev.id === currentStream && ev.type === 'clicktrough' && ev.ct) || eventList.find(ev => ev.type === 'clicktrough' && ev.ct);

        if (ctEvent) {
            // Action the Ad Click
            url = 'http://localhost:3000/landing?assetId=' + ctEvent.advert
            window.open(url, '_blank');
            // Report the Ad Click
            console.log('HTTP GET: R - ' + ctEvent.advert + ' - ' + ctEvent.type + ' - ', url);
            getData(ctEvent.url);                
        } 
        else {
            console.log('No clickthrough URL found for R');
        }           
    };

    const handleToggleLeftVolume = () => {
        if (leftVideoRef.current) {
            if (leftVolumeLabel === "5%") {
                leftVideoRef.current.volume = 0.05;
                leftVideoRef.current.muted = false;
                setLeftVolumeLabel("0%");
            } else {
                leftVideoRef.current.volume = 0;
                setLeftVolumeLabel("5%");
            }
        }
    };

    const handleToggleRightVolume = () => {
        if (rightVideoRef.current) {
            if (rightVolumeLabel === "5%") {
                rightVideoRef.current.volume = 0.05;
                rightVideoRef.current.muted = false;
                setRightVolumeLabel("0%");
            } else {
                rightVideoRef.current.volume = 0;
                setRightVolumeLabel("5%");
            }
        }
    };

    function timeStringToMilliseconds(timeStr) {
        const [hms, ms = "0"] = timeStr.split('.');
        const [hours, minutes, seconds] = hms.split(':').map(Number);
        const milliseconds = Number(ms.padEnd(3, '0')); // ensures "2" becomes "200", "25" → "250"
        return ((hours * 3600 + minutes * 60 + seconds) * 1000) + milliseconds;
    }    

    const processDisplayVast = (vast, pos) => {
        try {
            // Check the API response
            if (vast.status !== 200) {return false;}
            // --------------------------------------
            const xml = vast.data;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xml, "application/xml");
            const ads = xmlDoc.getElementsByTagName("Ad");
            // Check if the response is an empty VAST
            if (ads.length <= 0) {
                console.error("Empty Display VAST");
                return false;
            }
            // --------------------------------------
            const impressions = xmlDoc.getElementsByTagName("Impression");
            const advertisers = xmlDoc.getElementsByTagName("Advertiser");
            let myURL = '';
            // Get the image from the impression --------------------------------------
            for (let i=0; i < impressions.length; i++) {
                const impUrl = impressions[i].textContent.trim();
                if (impUrl.includes('.jpeg') || impUrl.includes('.jpg') || impUrl.includes('.png')) {
                    switch (displayShapeRef.current){
                        case 0:         // Side-by-Side
                            if (impUrl.includes('format=S')) {
                                myURL = impUrl;
                            }
                            break;
                        case 1:         // L-Shape
                            if (impUrl.includes('format=L')) {
                                myURL = impUrl;
                            }
                            break;
                        case 2:         // Inverted L-Shape
                            if (impUrl.includes('format=IL')) {
                                myURL = impUrl;
                            }
                            break;
                        case 3:         // O-Shape
                            if (impUrl.includes('format=O')) {
                                myURL = impUrl;
                            }
                            break;
                    }
                } 
                else if (impUrl.includes('/vod/impression?')) {
                    if (pos === 'l'){
                        leftDisplayImpression.current = impUrl;
                    }
                    else {
                        rightDisplayImpression.current = impUrl;
                    }
                }
            } // endfor
            console.log(`displayShape: ${displayShapeRef.current}, myURL: ${myURL}`);
            if (pos === 'l') {
                leftDisplayImage.current = myURL;
            }
            else {
                rightDisplayImage.current = myURL;
            }  
            // Get advertiser
            const advElements = xmlDoc.getElementsByTagName("Advertiser");
            if (advElements.length > 0) {
                setAdvertiser(advElements[0].textContent.trim());
            } else {
                setAdvertiser('Synamedia Iris'); // fallback if missing
            }
            return true;
        }
        catch (error) {
            console.error("Error processing the display VAST: ", pos, error);
            return false;
        }            
    };

    const processVast = (vast, pos) => {
        try {
            // Check the API response
            if (vast.status !== 200) {return false;}
            // --------------------------------------
            const xml = vast.data;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xml, "application/xml");
            const ads = xmlDoc.getElementsByTagName("Ad");
            // Check if the response is an empty VAST
            if (ads.length <= 0) {
                console.error("Empty Video VAST");
                return false;
            }
            // --------------------------------------
            const mediaFiles = xmlDoc.getElementsByTagName("MediaFile");
            const impressions = xmlDoc.getElementsByTagName("Impression");
            const trackers = xmlDoc.getElementsByTagName("Tracking");
            const durations = xmlDoc.getElementsByTagName("Duration");
            const advertisers = xmlDoc.getElementsByTagName("Advertiser");
            let e = {};
            let ev = "";
            let pts_ = 0;         
            let durationText = "";   
            // --------------------------------------
            for (let i=0; i < impressions.length; i++) {
                e = {pts: 0, url: impressions[i].textContent.trim(), reported: false}
                if (pos === 'l') {leftCCTrackingEvents.current.push(e);} else {rightCCTrackingEvents.current.push(e);}
            }
            // --------------------------------------
            durationText = durations[0].textContent.trim();
            // --------------------------------------
            for (let i=0; i < trackers.length; i++) {
                ev = trackers[i].getAttribute("event");
                switch (ev) {
                    case "start":
                        pts_ = 0;
                        break;
                    case "firstQuartile":
                        pts_ = timeStringToMilliseconds(durationText) * 0.25;
                        break;
                    case "midpoint":
                        pts_ = timeStringToMilliseconds(durationText) * 0.50;
                        break;
                    case "thirdQuartile":
                        pts_ = timeStringToMilliseconds(durationText) * 0.75;
                        break;
                    case "complete":
                        pts_ = timeStringToMilliseconds(durationText);
                        break;
                }
                e = {event: ev, pts: pts_, url: trackers[i].textContent.trim(), reported: false}
                if (pos === 'l') {leftCCTrackingEvents.current.push(e);} else {rightCCTrackingEvents.current.push(e);}      
            }
            // --------------------------------------
            if (pos === 'l') {
                leftCCAdvertiser.current = advertisers[0].textContent.trim();
            }
            else {
                rightCCAdvertiser.current = advertisers[0].textContent.trim();
            }
            // --------------------------------------
            for (let i = 0; i < mediaFiles.length; i++){
                const typeAttr = mediaFiles[i].getAttribute("type");
                if (typeAttr === 'application/dash+xml') {
                    if (pos === 'l') {
                        leftCCPlaybackURL.current = mediaFiles[i].textContent.trim();
                    }
                    else {
                        rightCCPlaybackURL.current = mediaFiles[i].textContent.trim();
                    }
                }
            }
            
            return true;
        }
        catch (error) {
            console.error("Error processing the VAST: ", pos, error);
            return false;
        }
    };

    // Handle the HTTPS GET request to Iris ADS
    const getVast = async (url) => {
        try {
            /*
            const response = await axios.get(url, {headers:{
                'Access-Control-Allow-Origin': '*',
                'Content-Type':'application/json'
            }});*/
            const response = await axios.get(url);
            //console.log(response);
            return response;
        } catch (error) {
            console.error('Error posting data:', error);
            return  -1;
        }
    };

    // Will handle the ad request and pre-processing during the channel change
    const handleAdRequest = async () => {
        try {
            let l_url = buildURL(dt.vod[input_index].left_ads_url, 'l');
            let r_url = buildURL(dt.vod[input_index].right_ads_url, 'r');
            let l_vast = await getVast(l_url);
            let r_vast = await getVast(r_url);
            let p_l_vast = processVast(l_vast, 'l');
            let p_r_vast = processVast(r_vast, 'r');

            // If all processing is fine, process the playback of the left device
            if (p_l_vast){

            }

            // If all processing is fine, process the playback of the right device
            if (p_r_vast){

            }

            advertisementPeriod.current = false;
        }
        catch (error) {
            console.error('Error handling channel change:', error);
        }
    };

    // Will handle the channel change basic mechanism 
    const handleChannelChange = (option) => {
        //console.log("handleChannelChange");
        try {
            //if (!advertisementPeriod.current) {
                let ch = channelID.current;
                if (option === 'up') {
                    channelID.current = ch >= dt.vod[input_index].max_channels ? 1 : ch + 1;
                }
                else {
                    channelID.current = ch <= 1 ? dt.vod[input_index].max_channels : ch - 1;
                }
                setLeftUrl(dt.vod[input_index][`left_playback_url_${channelID.current}`]);
                setRightUrl(dt.vod[input_index][`right_playback_url_${channelID.current}`]);

                if (isDisplaySelected) {
                    handleLeftDisplayAdRequest();
                    handleRightDisplayAdRequest();
                }
                //advertisementPeriod.current = true;
                //handleAdRequest();
            //}
            //handleReinitialize();
            //console.log("channelID.current: ", channelID.current);
        }
        catch (error) {
            console.error('Error handling channel change:', error);
        }
    };
    
    const handleLeftDisplayAdRequest = async (overwriteURL='') => {
        try {
            if (leftDisplayAdURL.current === ''){
                leftDisplayAdURL.current = buildURL(dt.vod[input_index].left_display_ads_url, 'l');
            }
            let url = overwriteURL === '' ? leftDisplayAdURL.current : overwriteURL;
            //let url = buildURL(dt.vod[input_index].left_display_ads_url, 'l');
            console.log(`AdDecision: ${url}`);
            let vast = await getVast(url);

            if (processDisplayVast(vast, 'l')){
                setShowLeftDisplayImage(true);
                setShrinkPlayersLeft(true);
                setTimeout(() => {
                    setShowLeftDisplayImage(false);
                    setShrinkPlayersLeft(false);
                }, __SHRINK_ANNIMATION__);
                getData(leftDisplayImpression.current);
            }
        }
        catch (error) {
            console.error('Error handling display ad request [l]:', error);
        }            
    };

    const handleRightDisplayAdRequest = async (overwriteURL='') => {
        try {
            if (rightDisplayAdURL.current === ''){
                rightDisplayAdURL.current = buildURL(dt.vod[input_index].right_display_ads_url, 'r');
            }
            //let url = buildURL(dt.vod[input_index].right_display_ads_url, 'r');
            let url = overwriteURL === '' ? rightDisplayAdURL.current : overwriteURL;
            let vast = await getVast(url);

            if (processDisplayVast(vast, 'r')){
                setShowRightDisplayImage(true);
                setShrinkPlayersRight(true);
                setTimeout(() => {
                    setShowRightDisplayImage(false);
                    setShrinkPlayersRight(false);
                }, __SHRINK_ANNIMATION__);
                getData(rightDisplayImpression.current);
            }            
        }
        catch (error) {
            console.error('Error handling display ad request [r]:', error);
        }            
    };

    return (
        <div
            className="relative min-h-screen bg-cover bg-center font-poppins"
            style={{ backgroundImage: "url('/SplashScreenBG.png')" }}        
        >
            {/* semi-transparent overlay */}
            <div className="absolute inset-0 bg-white/35"></div>

            {/* All VOD content stays above overlay */}
            <div className="relative z-10 text-white">        
                <div>
                    <h1 className="font-poppins font-bold text-center text-3xl">{dt.vod[input_index].great_title}</h1>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                        <InfoPanel
                            title={dt.vod[input_index].left_title}
                            segment={dt.vod[input_index].left_segment}
                            flag={dt.vod[input_index].left_flag}
                            isAd={leftStreamIsAd}
                            advertName={leftCurrentAdvert}
                        />
                        <div>
                            <AdEventPanel labels={leftTrackingLabels} />
                        </div>     
                        <div className={
                                (displayShapeRef.current === 1 && shrinkPlayersLeft)
                                ? "w-[750px] h-[420px] relative flex items-start justify-start bg-black overflow-hidden"
                                : "w-[750px] h-[420px] relative flex items-center justify-start bg-black overflow-hidden"
                        }>
                            {/* Left video */}
                            <div
                                className={
                                    (displayShapeRef.current === 1 && shrinkPlayersLeft)
                                        ? "h-full flex items-start justify-start"
                                        : "h-full flex items-center justify-center"
                                }
                                style={{
                                    width: (displayShapeRef.current && shrinkPlayersLeft) === 1
                                        ? `${Math.round(FULL_PLAYER_WIDTH * 0.75)}px`
                                        : (shrinkPlayersLeft ? `${SHRUNK_PLAYER_WIDTH}px` : `${FULL_PLAYER_WIDTH}px`),
                                    transition: 'width 0.5s ease-in-out'
                                }}
                            >
                                <video
                                    ref={leftVideoRef}
                                    controls
                                    className="h-full object-contain"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* Display Ad - only during shrink */}
                            {shrinkPlayersLeft && showLeftDisplayImage && (
                                (displayShapeRef.current === 1)
                                    ? (
                                        <img
                                            src={leftDisplayImage.current}
                                            alt="Display Ad"
                                            className="absolute inset-0 w-full h-full object-fill"
                                            style={{ zIndex: 1 }}
                                        />
                                    ) : (
                                        <div
                                            className="h-full flex items-center justify-center ml-2"
                                            style={{ width: `${SHRUNK_PLAYER_WIDTH}px`, height: '203px' }} // 8px = approx. Tailwind ml-2
                                        >
                                            <img
                                                src={leftDisplayImage.current}
                                                alt="Display Ad"
                                                className="w-full h-full object-fill" 
                                            />
                                        </div>
                                    )
                            )}
                        </div>
                    </div>
                    <div>
                        <InfoPanel
                            title={dt.vod[input_index].right_title}
                            segment={dt.vod[input_index].right_segment}
                            flag={dt.vod[input_index].right_flag}
                            isAd={rightStreamIsAd}
                            advertName={rightCurrentAdvert}
                        />
                        <div>
                            <AdEventPanel labels={rightTrackingLabels} />
                        </div>                    
                        <div className={
                            (displayShapeRef.current === 1 && shrinkPlayersRight)
                                ? "w-[750px] h-[420px] relative flex items-start justify-start bg-black overflow-hidden"
                                : "w-[750px] h-[420px] relative flex items-center justify-start bg-black overflow-hidden"
                        }>
                            {/* Right video */}
                            <div
                                className={
                                    (displayShapeRef.current === 1 && shrinkPlayersRight)
                                        ? "h-full flex items-start justify-start"
                                        : "h-full flex items-center justify-center"
                                }
                                style={{
                                    width: (displayShapeRef.current && shrinkPlayersRight) === 1
                                        ? `${Math.round(FULL_PLAYER_WIDTH * 0.75)}px`
                                        : (shrinkPlayersRight ? `${SHRUNK_PLAYER_WIDTH}px` : `${FULL_PLAYER_WIDTH}px`),
                                    transition: 'width 0.5s ease-in-out'
                                }}
                            >
                                <video
                                    ref={rightVideoRef}
                                    controls
                                    className="h-full object-contain"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* Display Ad - only during shrink */}
                            {shrinkPlayersRight && showRightDisplayImage && (
                                (displayShapeRef.current === 1)
                                    ? (
                                        <img
                                            src={rightDisplayImage.current}
                                            alt="Display Ad"
                                            className="absolute inset-0 w-full h-full object-fill"
                                            style={{ zIndex: 1 }}
                                        />
                                    ) : (
                                        <div
                                            className="h-full flex items-center justify-center ml-2"
                                            style={{ width: `${SHRUNK_PLAYER_WIDTH}px`, height: '203px' }} // 8px = approx. Tailwind ml-2
                                        >
                                            <img                            
                                                src={rightDisplayImage.current}
                                                alt="Display Ad"
                                                className="w-full h-full object-fill" 
                                            />
                                        </div>
                                    )
                            )}
                        </div>
                    </div>
                </div>
                <div>
                    <button onClick={handleReinitialize} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                        Load/Reload
                    </button>
                    <button onClick={handleTogglePlayPause} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                        {isPlaying ? 'Pause':'Play'}
                    </button>
                    <button onClick={handleStop} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                        Stop
                    </button>
                    <button onMouseDown={handleLeftMouseDown} onMouseUp={handleLeftMouseUp} disabled={!leftCTEnabledRef.current} className="bg-blue-600 text-white px-4 py-2 rounded transition hover:bg-blue-700 disabled:bg-gray-400 disabled:text-gray-100 disabled:cursor-not-allowed">
                        Left player clickthrough
                    </button>
                    <button onMouseDown={handleRightMouseDown} onMouseUp={handleRightMouseUp} disabled={!rightCTEnabledRef.current} className="bg-blue-600 text-white px-4 py-2 rounded transition hover:bg-blue-700 disabled:bg-gray-400 disabled:text-gray-100 disabled:cursor-not-allowed">
                        Right player clickthrough
                    </button>
                    <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition" onClick={handleToggleLeftVolume}>
                        L: {leftVolumeLabel}
                    </button>
                    <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition" onClick={handleToggleRightVolume}>
                        R: {rightVolumeLabel}
                    </button>
                </div>
                <br />
                <div>
                    <label>Current Channel: <b>{channelID.current}</b></label><br/>
                    <button onClick={() => handleChannelChange('up')} disabled={advertisementPeriod.current} className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 transition">
                        Ch. Up
                    </button>
                    <br />
                    <button onClick={() => handleChannelChange('down')} disabled={advertisementPeriod.current} className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 transition">
                        Ch. Down
                    </button>
                    <br />
                    <button
                        onClick={() => {
                            setIsDisplaySelected(true);
                            toggleModeRef.current = "display";
                        }}
                        className={`px-4 py-2 rounded-full text-white ${isDisplaySelected ? 'bg-green-600' : 'bg-gray-400'}`}
                    >
                        Display
                    </button>
                    <button
                        onClick={() => {
                            setIsDisplaySelected(false);
                            toggleModeRef.current = "video";
                        }}
                        className={`px-4 py-2 rounded-full text-white ${!isDisplaySelected ? 'bg-green-600' : 'bg-gray-400'}`}
                    >
                        Video
                    </button>
                    <br />
                    <button
                        onClick={() => {
                            setDisplayShape(0);
                            displayShapeRef.current = 0;
                        }}
                        className={`px-4 py-2 rounded-full text-white ${displayShape === 0 ? 'bg-green-600' : 'bg-gray-400'}`}
                    >
                        Side-by-Side
                    </button>
                    <button
                        onClick={() => {
                            setDisplayShape(1);
                            displayShapeRef.current = 1;
                        }}
                        className={`px-4 py-2 rounded-full text-white ${displayShape === 1 ? 'bg-green-600' : 'bg-gray-400'}`}
                    >
                        L-Shape
                    </button>
                    <button
                        onClick={() => {
                            setDisplayShape(2);
                            displayShapeRef.current = 2;
                        }}
                        className={`px-4 py-2 rounded-full text-white ${displayShape === 2 ? 'bg-green-600' : 'bg-gray-400'}`}
                    >
                        Inv. L-Shape
                    </button>
                    <button
                        onClick={() => {
                            setDisplayShape(3);
                            displayShapeRef.current = 3;
                        }}
                        className={`px-4 py-2 rounded-full text-white ${displayShape === 3 ? 'bg-green-600' : 'bg-gray-400'}`}
                    >
                        O-Shape
                    </button>                    
                </div>
            </div>
        </div>
    );
};
export default LinearCC;
