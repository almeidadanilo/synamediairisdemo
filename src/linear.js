import React, { useEffect, useRef, useState } from 'react';
import dashjs from 'dashjs';
import axios from 'axios';
import dt from './data.json';

// Linear - component for linear content with SCTE35 on demand Demo Use Cases

const Linear = ({input_index}) => {
    const [, forceUpdate] = useState(0);
    const leftVideoRef = useRef(null);
    const rightVideoRef = useRef(null);
    const intervalLeftRef = useRef(null);
    const intervalRightRef = useRef(null);
    const leftPlayer = useRef(null);
    const rightPlayer = useRef(null);
    const leftCTEnabledRef = useRef(false);
    const rightCTEnabledRef = useRef(false);    
    //const leftPrevPeriodWasAd = useRef(false);
    //const rightPrevPeriodWasAd = useRef(false);
    const [leftUrl, setLeftUrl] = useState((dt.vod[input_index].left_playback_url));
    const [rightUrl, setRightUrl] = useState((dt.vod[input_index].right_playback_url));
    const [leftVolumeLabel, setLeftVolumeLabel] = useState("5%");
    const [rightVolumeLabel, setRightVolumeLabel] = useState("5%");
    const leftCurrentStream = useRef("");
    const rightCurrentStream = useRef("");  
    const leftStreamIsAdRef = useRef(false);
    const rightStreamIsAdRef = useRef(false);
    const [leftStreamIsAd, setleftStreamIsAd] = useState(false);  
    const [rightStreamIsAd, setrightStreamIsAd] = useState(false);
    const [leftTrackingEvents, setLeftTrackingEvents] = useState([]);
    const leftTrackingEventsRef = useRef([]);
    const [rightTrackingEvents, setRightTrackingEvents] = useState([]);
    const rightTrackingEventsRef = useRef([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [leftCurrentAdvert, setLeftCurrentAdvert] = useState('');
    const [rightCurrentAdvert, setRightCurrentAdvert] = useState('');    
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
    const holdThreshold = 1000; // milliseconds
    //let leftClickHoldTimer = null;
    let leftClickStartTime = null;
    //let rightClickHoldTimer = null;
    let rightClickStartTime = null;

    useEffect(() => {
        // Start left timer
        intervalLeftRef.current = setInterval(updateCurrentTimeLeft, 1000);
        
        // Start right timer
        intervalRightRef.current = setInterval(updateCurrentTimeRight, 1000);
        
        return () => {
            console.log('[Linear] Component unmounting — tearing down players');
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
        leftPlayer.current.initialize(leftVideoRef.current, buildURL(leftUrl, 'l'), true, 0);
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
        rightPlayer.current.initialize(rightVideoRef.current, buildURL(rightUrl, 'r'), true, 0);
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
                //console.log(`Left Player PERIOD_SWITCH_STARTED: ${e}`)
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
    
        //console.log("manifest", manifest);

        // Find the current period by ID
        const currentPeriod = periods.find(p => p?.id === activeStreamId);
        if (!currentPeriod) return { isAd: false, events };
        
        //console.log("manifest", manifest);
        //console.log("periods", periods);
        //console.log("currentPeriod", currentPeriod);
        //console.log("activeStreamId", activeStreamId);

        // Check if it has a tracking EventStream
        //const eventStream = currentPeriod.EventStream_asArray?.[0];
        if (!currentPeriod.EventStream_asArray) return { isAd: false, events };

        const eventStreamTk = currentPeriod.EventStream_asArray.find(e => e?.value === "com.synamedia.dai.tracking.v2");
        const eventStreamCT = currentPeriod.EventStream_asArray.find(e => e?.value === "com.synamedia.dai.videoclick.v2");
        //const eventStream = null;
        //console.log("eventStreamTk", eventStreamTk);
        //if (eventStream?.value === "com.synamedia.dai.tracking.v2") {
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

        console.log("buildURL: ", str);

        return str;
    };
  
    const checkTrackingEvents = (trackingEvents, setTrackingLabels, tm, pl, id) => {

        for (let q = 0; q < trackingEvents.length; q++) {
            //console.log(trackingEvents);
            //console.log(trackingEvents[q]);
            //console.log('trackingEvents[q]?.id --> ', trackingEvents[q]?.id);
            //console.log('id --> ', id);
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
            
            // check for any special header required for the stitching request
            if (dt.vod[input_index] && dt.vod[input_index].special_header) {
                const headers = dt.vod[input_index].special_header;
                const requestModifier = {
                    modifyRequestHeader: function (xhr) {
                        for (const key in headers) {
                            if (headers[key]) {
                                xhr.setRequestHeader(key, headers[key]);
                            }
                        }
                        return xhr;
                    }
                };
                leftPlayer.current.updateSettings({
                    streaming: { xhr: requestModifier }
                });
                rightPlayer.current.updateSettings({
                    streaming: { xhr: requestModifier }
                });
            }
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
  
    const getData = async (url) => {
        try {
            const response = await axios.get(url, {headers:{
                'Access-Control-Allow-Origin': '*',
                'Content-Type':'application/json'
            }});
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

    // Straight click will action on ad-server URL set for the click-through
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

    // Straight click will action on ad-server URL set for the click-through
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

    // Click and hold will action on the "special" local landpage, loading the image captured from IrisWOF.py
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
    
    // Click and hold will action on the "special" local landpage, loading the image captured from IrisWOF.py
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

      
    return (
        <div>
            <div>
              <h1>{dt.vod[input_index].great_title}</h1>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                    <h2>{dt.vod[input_index].left_title} & {dt.vod[input_index].left_segment}
                        {dt.vod[input_index].left_flag !== '' && (
                            <img
                                src={dt.vod[input_index].left_flag}
                                alt="Left Flag"
                                style={{ width: '50px', height: '25px', objectFit: 'contain' }}
                            />
                        )}
                    </h2>
                    <label>Stream Type: <b>{leftStreamIsAd ? ' :: AD :: ' + leftCurrentAdvert : 'Content'}</b></label><br/>
                    <div>
                        <table className="w-full text-sm text-left text-gray-700 border border-gray-200">
                            <thead className="text-xs uppercase bg-gray-50 text-gray-500">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Impression</th>
                                    <th scope="col" className="px-6 py-3">AdStart</th>
                                    <th scope="col" className="px-6 py-3">25%</th>
                                    <th scope="col" className="px-6 py-3">50%</th>
                                    <th scope="col" className="px-6 py-3">75%</th>
                                    <th scope="col" className="px-6 py-3">AdCompl.</th>
                                </tr>                                
                            </thead>
                            <tbody>
                                <tr className="hover:bg-gray-100">
                                    <td className="px-6 py-4">{leftTrackingLabels.impression === '' ? '-' : leftTrackingLabels.impression}</td>
                                    <td className="px-6 py-4">{leftTrackingLabels.adstart === '' ? '-' : leftTrackingLabels.adstart}</td>
                                    <td className="px-6 py-4">{leftTrackingLabels.firstQuartile === '' ? '-' : leftTrackingLabels.firstQuartile}</td>
                                    <td className="px-6 py-4">{leftTrackingLabels.secondQuartile === '' ? '-' : leftTrackingLabels.secondQuartile}</td>
                                    <td className="px-6 py-4">{leftTrackingLabels.thirdQuartile === '' ? '-' : leftTrackingLabels.thirdQuartile}</td>
                                    <td className="px-6 py-4">{leftTrackingLabels.completion === '' ? '-' : leftTrackingLabels.completion}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>                     
                    <div> 
                      <video ref={leftVideoRef} controls style={{ width: '750px' }} />
                    </div>
                </div>
                <div>
                    <h2>{dt.vod[input_index].right_title} & {dt.vod[input_index].right_segment}
                        {dt.vod[input_index].right_flag !== '' && (
                            <img
                                src={dt.vod[input_index].right_flag}
                                alt="Right Flag"
                                style={{ width: '50px', height: '25px', objectFit: 'contain' }}
                            />
                        )}                    
                    </h2>
                    <label>Stream Type: <b>{rightStreamIsAd ? ' :: AD :: ' + rightCurrentAdvert : 'Content'}</b></label><br/>
                    <div>
                        <table className="w-full text-sm text-left text-gray-700 border border-gray-200">
                            <thead className="text-xs uppercase bg-gray-50 text-gray-500">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Impression</th>
                                    <th scope="col" className="px-6 py-3">AdStart</th>
                                    <th scope="col" className="px-6 py-3">25%</th>
                                    <th scope="col" className="px-6 py-3">50%</th>
                                    <th scope="col" className="px-6 py-3">75%</th>
                                    <th scope="col" className="px-6 py-3">AdCompl.</th>
                                </tr>                                
                            </thead>
                            <tbody>
                                <tr className="hover:bg-gray-100">
                                    <td className="px-6 py-4">{rightTrackingLabels.impression === '' ? '-' : rightTrackingLabels.impression}</td>
                                    <td className="px-6 py-4">{rightTrackingLabels.adstart === '' ? '-' : rightTrackingLabels.adstart}</td>
                                    <td className="px-6 py-4">{rightTrackingLabels.firstQuartile === '' ? '-' : rightTrackingLabels.firstQuartile}</td>
                                    <td className="px-6 py-4">{rightTrackingLabels.secondQuartile === '' ? '-' : rightTrackingLabels.secondQuartile}</td>
                                    <td className="px-6 py-4">{rightTrackingLabels.thirdQuartile === '' ? '-' : rightTrackingLabels.thirdQuartile}</td>
                                    <td className="px-6 py-4">{rightTrackingLabels.completion === '' ? '-' : rightTrackingLabels.completion}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>                    
                    <div>
                      <video ref={rightVideoRef} controls style={{ width: '750px' }} />
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
        </div>
    );
};
export default Linear;
