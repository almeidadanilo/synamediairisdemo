import React, { useEffect, useRef, useState } from 'react';
import dashjs from 'dashjs';
import axios from 'axios';
import dt from './data.json';

// Vod - Component for Video on Demand pre/mid/post roll Demo Use Cases

const Vod = ({input_index}) => {
    const [, forceUpdate] = useState(0);
    const leftVideoRef = useRef(null);
    const rightVideoRef = useRef(null);
    const intervalLeftRef = useRef(null);
    const intervalRightRef = useRef(null);
    const leftPlayer = useRef(null);
    const rightPlayer = useRef(null);
    //const playersInitialized = useRef(false);
    const leftCTEnabledRef = useRef(false);
    const rightCTEnabledRef = useRef(false);
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
                leftPlayer.current.reset();
                leftPlayer.current = null;
            }

            if (rightPlayer.current) {
                rightPlayer.current.reset();
                rightPlayer.current = null;
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

        console.log('(VOD) initializePlayers() called.');

        leftPlayer.current = dashjs.MediaPlayer().create();
        leftPlayer.current.updateSettings({
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
        //leftPlayer.current.initialize(leftVideoRef.current, buildURL(leftUrl, 'l'), false, 0);
        leftPlayer.current.initialize(leftVideoRef.current, '', false, 0);
        leftVideoRef.current.muted = true;
        console.log('(VOD) initialize LP');

        rightPlayer.current = dashjs.MediaPlayer().create();
        rightPlayer.current.updateSettings({           
            debug: {
              logLevel: dashjs.Debug.LOG_LEVEL_NONE
            }
        });
        //rightPlayer.current.initialize(rightVideoRef.current, buildURL(rightUrl, 'r'), false, 0);
        rightPlayer.current.initialize(rightVideoRef.current, '', false, 0);
        rightVideoRef.current.muted = true;
        console.log('(VOD) initialize RP');

        // Set the intervals
        intervalLeftRef.current = setInterval(updateCurrentTimeLeft, _INTERVAL_);
        //console.log('setIntervalLeft() ' + intervalLeftRef.current);
        intervalRightRef.current = setInterval(updateCurrentTimeRight, _INTERVAL_);
        //console.log('setIntervalRight() ' + intervalRightRef.current);
        ///////////////////////////////////////////////////////////////////////////

        // Wait until manifest is fully loaded before setting tracking logic
        leftPlayer.current.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, () => {
            //console.log('(VOD) Left manifest loaded — safe to proceed');
            leftPlayer.current.on(dashjs.MediaPlayer.events.PERIOD_SWITCH_STARTED, (e) => {
                //console.log("LP >> Period Switch Started: ", e);
            });

            leftPlayer.current.on(dashjs.MediaPlayer.events.STREAM_ACTIVATED, (e) => {
                //console.log("LP >> Stream Activated: ", e);
                ////////////////////////////////////////////////////////////////////////////
                const newId = e.streamInfo?.id;
                if (!newId) return;
            
                const previousId = leftCurrentStream.current;
            
                if (previousId && previousId !== newId && leftStreamIsAdRef.current) {
                    resetTrackingLabels('l');
                }

                leftCurrentStream.current = newId;
                //console.log("leftCurrentStream.current: ", leftCurrentStream.current);
                ////////////////////////////////////////////////////////////////////////////
                const mpd = leftPlayer.current.getDashAdapter()?.getMpd();
                if (!mpd) return;
                
                const result = checkIfAd(mpd, newId);
                
                if (result.isAd) {
                    setLeftTrackingEvents(result.events);
                    setleftStreamIsAd(true);

                    forceUpdate(n => n + 1);

                    const hasCT = result.events.some(ev => ev.type === 'clicktrough' && ev.ct);
                    
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
                    resetTrackingLabels('l');
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
        
        console.log("enter cleaning");

        // Cleanup
        if (leftPlayer.current) {
            leftPlayer.current.reset();
            leftPlayer.current = null;
        }
        if (rightPlayer.current) {
            rightPlayer.current.reset();
            rightPlayer.current = null;
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

        clearInterval(intervalLeftRef.current);
        clearInterval(intervalRightRef.current);
        intervalLeftRef.current = null;
        intervalRightRef.current = null;

        // Now reinitialize
        initializePlayers();

    }, [input_index]);
  
    const buildTrackingEvents = (es, tevs, ind) => {

        let te = '';
        let myURL = '';
        let teType = '';
        let adv = '';
        let params = [];
        let event = '';
        let eventStreamTk;
        let eventStreamCt;
        
        // Get the EvenStream for the Trackers 
        eventStreamTk = es.find((stream) => stream.value === 'com.synamedia.dai.tracking.v2');
        if (!eventStreamTk) {
            eventStreamTk = es.find((stream) => stream.value === 'com.synamedia.dai.tracking');
            if (!eventStreamTk) {
                return;
            }
        }
        //console.log("eventStreamTk: ", eventStreamTk);
        for (let i = 0; i < eventStreamTk.Event_asArray.length; i++){
            // set tracking events
            myURL = eventStreamTk.Event_asArray[i].Tracking_asArray[0].__cdata;
            //console.log(myURL);
            event = eventStreamTk.Event_asArray[i].Tracking_asArray[0].event;
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
                console.log("event: ", event);
                teType = 'Unkknown';
            }                      
            te = {stream:i, id:ind, pt: eventStreamTk.Event_asArray[i].presentationTime, type: teType, url: myURL, reported: false, advert: adv, ct: ''};
            //console.log(te);
            tevs.push(te);
        }

        // Get the EventStream for click-through
        eventStreamCt = es.find((stream) => stream.value === 'com.synamedia.dai.videoclick.v2');
        if (!eventStreamCt) {
            return;
        }
        //console.log("eventStreamCt", eventStreamCt);
        for (let u = 0; u < eventStreamCt.Event_asArray.length; u++) {
            myURL = eventStreamCt.Event_asArray[u].VideoClicks_asArray[0].ClickTracking_asArray[0];
            //console.log("myURL: ", myURL);
            adv = eventStreamCt.Event_asArray[u].VideoClicks_asArray[0].ClickThrough_asArray[0];
            te = {stream:ind, id:ind, pt: 0, type: 'clicktrough', url: myURL, reported: false, advert: '', ct: adv};
            tevs.push(te);
        }
    }


    const checkIfAd = (mpd, activeStreamId) => {

        //console.log("mpd: ", mpd);
        
        let ret = false;
        let events = [];
        
        const manifest = mpd?.manifest;
        const periods = manifest?.Period_asArray || [];
        const number = parseInt(activeStreamId.split('_')[1], 10);

        // Find the current period by ID
        const currentPeriod = periods[number];
        //console.log ("currentPeriod: ", currentPeriod, number);
        if (!currentPeriod) return { isAd: false, events };
        
        //console.log("Periods: ", periods);
        //console.log ("activeStreamId: ", activeStreamId);

        // Check if it has a tracking EventStream
        if (currentPeriod && currentPeriod['dai:adPeriod']) {
            const eventStream = currentPeriod.EventStream_asArray;
            ret = true;
            //console.log("EventStream: ", eventStream);
            buildTrackingEvents(eventStream, events, activeStreamId);

            //console.log("events: ", events);
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
                    if (trackingEvents[q].type !== 'clicktrough') {
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
            /*
            console.log("A");
            console.log(leftPlayer.current);
            if (!leftPlayer.current?.getSource()) {
                console.log("B");
                leftPlayer.current.initialize(leftVideoRef.current, buildURL(leftUrl, 'l'), true);
                console.log("C");
            }
            if (!rightPlayer.current?.getSource()) {
                rightPlayer.current.initialize(leftVideoRef.current, buildURL(rightUrl, 'l'), false);
            }*/

            const playLeft = leftVideoRef.current?.play();
            const playRight = rightVideoRef.current?.play();

            // Catch abort errors
            if (playLeft?.catch) {
                playLeft.catch((e) => {
                    if (e.name !== 'AbortError') {
                        console.error('leftVideo play error:', e);
                    }
                });
            }

            if (playRight?.catch) {
                playRight.catch((e) => {
                    if (e.name !== 'AbortError') {
                        console.error('rightVideo play error:', e);
                    }
                });
            }

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
                /*const requestModifier = new dashjs.RequestModifier();
                for (const key in headers) {
                    requestModifier.addCustomRequestHeader(key, headers[key]);
                }
                leftPlayer.current.setRequestModifier(requestModifier);
                rightPlayer.current.setRequestModifier(requestModifier);
                */               
            }
            //
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
            leftPlayer.current.reset();
        }
        if (rightPlayer.current) {
            rightPlayer.current.reset();
        }

        setIsPlaying(false);
        resetTrackingLabels('rl');
        
        leftCTEnabledRef.current = false;
        rightCTEnabledRef.current = false;

      };
  
      const handleCT = (pl) => {

            console.log("ClickThrough: ", pl);

            const eventList = pl === 'l' ? leftTrackingEventsRef.current : rightTrackingEventsRef.current;
            const currentStream = pl === 'l' ? leftCurrentStream.current : rightCurrentStream.current;

            const ctEvent = eventList.find(ev => ev.id === currentStream && ev.type === 'clicktrough' && ev.ct) || eventList.find(ev => ev.type === 'clicktrough' && ev.ct);

            if (ctEvent) {
                // Action the Ad Click
                window.open(ctEvent.ct, '_blank');
                // Report the Ad Click
                console.log('HTTP GET: ' + pl + ' - ' + ctEvent.advert + ' - ' + ctEvent.type + ' - ', ctEvent.url);
                getData(ctEvent.url);                
            } 
            else {
                console.log('No clickthrough URL found for', pl);
            }
      }

      const getData = async (url) => {
        try {
            const response = await axios.get(url, {headers:{
                'Access-Control-Allow-Origin': '*',
                'Content-Type':'application/json'
            }});
            //console.log(response.data);
            return response.status;
        } catch (error) {
            console.error('Error posting data:', error);
            return  -1;
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

    const handleSkipToPostroll = () => {
        try {
            const offset = parseFloat(dt.vod[input_index].postroll_offset);
            if (isNaN(offset) || offset === 0) {
                console.warn("Invalid postroll offset");
                return;
            }

            if (leftPlayer.current) {
                leftPlayer.current.seek(offset);
            }

            if (rightPlayer.current) {
                rightPlayer.current.seek(offset);
            }

            console.log(`Skipped both players to ${offset} seconds`);
        } catch (error) {
            console.error("Failed to skip to postroll:", error);
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
                      <video ref={leftVideoRef} controls preload="none" style={{ width: '750px' }} />
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
                      <video ref={rightVideoRef} controls preload="none" style={{ width: '750px' }} />
                    </div>
                </div>
            </div>
            <div>
                <button onClick={handleReinitialize} className="bg-blue-600 text-white px-4 py-2 rounded transition hover:bg-blue-700 disabled:bg-gray-400 disabled:text-gray-100 disabled:cursor-not-allowed">
                    Load/Reload
                </button>
                <button onClick={handleTogglePlayPause} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                    {isPlaying ? 'Pause':'Play'}
                </button>
                <button onClick={handleStop} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                    Stop
                </button>
                <button onClick={() => handleCT('l')} disabled={!leftCTEnabledRef.current} className="bg-blue-600 text-white px-4 py-2 rounded transition hover:bg-blue-700 disabled:bg-gray-400 disabled:text-gray-100 disabled:cursor-not-allowed">
                    Left player clicktrough
                </button>
                <button onClick={() => handleCT('r')} disabled={!rightCTEnabledRef.current} className="bg-blue-600 text-white px-4 py-2 rounded transition hover:bg-blue-700 disabled:bg-gray-400 disabled:text-gray-100 disabled:cursor-not-allowed">
                    Right player clickthrough
                </button>
                <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition" onClick={handleToggleLeftVolume}>
                    L: {leftVolumeLabel}
                </button>
                <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition" onClick={handleToggleRightVolume}>
                    R: {rightVolumeLabel}
                </button>
                <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition" onClick={handleSkipToPostroll}>
                    Skip
                </button>
            </div>
        </div>
    );
};
export default Vod;
