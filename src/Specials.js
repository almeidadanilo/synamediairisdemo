import React, { useEffect, useRef, useState } from 'react';
import dashjs from 'dashjs';
import axios from 'axios';
import dt from './data.json';
import moment from 'moment';
import userEvent from '@testing-library/user-event';
import { useAsyncError } from 'react-router-dom';


const Specials = ({input_index, inAdPause, inSequence, inAdOverlay}) => {
    const [, forceUpdate] = useState(0);
    const leftVideoRef = useRef(null);
    const intervalLeftRef = useRef(null);
    const leftPlayer = useRef(null);
    const leftCTEnabledRef = useRef(false);
    const displayAdIntervalRef = useRef(null);
    const adOnPauseSequence = useRef(1);
    const [overlayVisible, setOverlayVisible] = useState(false);
    const [prevOverlayImg, setPrevOverlayImg] = useState('');
    const [advertiser, setAdvertiser] = useState('');
    const [liveOverlayUrl, setLiveOverlayUrl] = useState('');
    const [showBlackCover, setShowBlackCover] = useState(false);
    const [streamTypeMsg, setStreamTypeMsg] = useState('Content');
    const [leftUrl, setLeftUrl] = useState((dt.vod[input_index].left_playback_url));
    const [leftVolumeLabel, setLeftVolumeLabel] = useState("5%");
    const leftCurrentStream = useRef("");
    const leftStreamIsAdRef = useRef(false);
    const [leftStreamIsAd, setleftStreamIsAd] = useState(false);  
    const [leftTrackingEvents, setLeftTrackingEvents] = useState([]);
    const leftTrackingEventsRef = useRef([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const hasDisplay = useRef(false);
    const hasAdOnPause = useRef(false);
    const sequence = useRef("");
    const displayAdURL = useRef("");
    const [leftOverlayImg, setLeftOverlayImg] = useState('');
    const [leftCurrentAdvert, setLeftCurrentAdvert] = useState('');
    const [leftTrackingLabels, setLeftTrackingLabels] = useState({
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
      
        return () => {
            console.log('[Special] Component unmounting — tearing down players');
            // Cleanup on unmount or page change
            if (intervalLeftRef.current) {
                clearInterval(intervalLeftRef.current);
                intervalLeftRef.current = null;
            }
            if (leftVideoRef.current) {
                leftVideoRef.current.pause();
                leftVideoRef.current.removeAttribute('src');
                leftVideoRef.current.load();
            }   
            if (leftPlayer.current) {
                leftPlayer.current.reset();
                leftPlayer.current = null;
            }
            if (displayAdIntervalRef.current) {
                clearInterval(displayAdIntervalRef.current);
                displayAdIntervalRef.current = null;
            }
        };
    }, []); // <-- run once on mount

    useEffect(() => {
        leftTrackingEventsRef.current = leftTrackingEvents;
    }, [leftTrackingEvents]);

    useEffect(() => {
        leftStreamIsAdRef.current = leftStreamIsAd;
    }, [leftStreamIsAd])

    useEffect(() => {
        if (leftStreamIsAdRef.current && leftCurrentStream.current && leftTrackingEventsRef.current.length > 0) {
          const match = leftTrackingEventsRef.current.find(ev => ev.id === leftCurrentStream.current);
          setLeftCurrentAdvert(match?.advert || '');
        } else {
          setLeftCurrentAdvert('');
        }
    }, [leftTrackingEvents, leftStreamIsAd, leftCurrentStream.current]); // Include deps


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

    const handleOverlay = (ev) => {
        try {
            const overlayEvent = ev.find(e => e.type === 'overlay' && e.url);
            if (overlayEvent) {
                setLiveOverlayUrl(overlayEvent.url);
                console.log('[Overlay] Showing:', overlayEvent.url);
            } 
            else {
                setLiveOverlayUrl('');
            }
        }
        catch (error){
            console.log("handleOverlay failed: ", error);
        }
    };

    const initializePlayers = () => {

        console.log('(Special) initializePlayers() called.');

        leftPlayer.current = dashjs.MediaPlayer().create();
        leftPlayer.current.updateSettings({
            debug: {
              logLevel: dashjs.Debug.LOG_LEVEL_NONE // or LOG_LEVEL_ERROR to keep only serious errors
            }
        });
        //leftPlayer.current.initialize(leftVideoRef.current, buildURL(leftUrl, 'l'), false, 0);
        leftPlayer.current.initialize(leftVideoRef.current, '', false, 0);
        leftVideoRef.current.muted = true;
        console.log('(Special) initialize LP');

        // Set the intervals
        intervalLeftRef.current = setInterval(updateCurrentTimeLeft, _INTERVAL_);
        //console.log('setIntervalLeft() ' + intervalLeftRef.current);

        // Bind the adPause and Sequence
        hasAdOnPause.current = inAdPause;
        sequence.current = inSequence;
        ///////////////////////////////////////////////////////////////////////////

        // Wait until manifest is fully loaded before setting tracking logic
        leftPlayer.current.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, () => {
            //console.log('(Special) Left manifest loaded — safe to proceed');
            leftPlayer.current.on(dashjs.MediaPlayer.events.PERIOD_SWITCH_STARTED, (e) => {
                //console.log("Special >> Period Switch Started: ", e);
            });

            leftPlayer.current.on(dashjs.MediaPlayer.events.STREAM_ACTIVATED, (e) => {
                //console.log("Special >> Stream Activated: ", e);
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
                    //
                    forceUpdate(n => n + 1);
                    // Check ClickThrough
                    const hasCT = result.events.some(ev => ev.type === 'clicktrough' && ev.ct);
                    leftCTEnabledRef.current = hasCT;
                    //
                    forceUpdate(n => n + 1);
                    // Check Overlays
                    const hasOverlay = (result.events.some(ev => ev.type === 'overlay') && inAdOverlay);
                    if (hasOverlay) {
                        handleOverlay(result.events);
                        forceUpdate(n => n + 1);
                    }
                } 
                else {
                    setLeftTrackingEvents([]);
                    setleftStreamIsAd(false);
                    resetTrackingLabels('l');
                    setLiveOverlayUrl('');
                    leftCTEnabledRef.current = false;
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

        if (leftVideoRef.current) {
            leftVideoRef.current.pause();
            leftVideoRef.current.removeAttribute('src');
            leftVideoRef.current.load();
        }

        clearInterval(intervalLeftRef.current);
        intervalLeftRef.current = null;

        // Now reinitialize
        initializePlayers();

    }, [input_index, inAdPause, inSequence]);
  
    
    const handleDisplayAds = async (url, seq) => {
        const fetchAndRenderAd = async (url1) => {
            try {
                console.log("handleDisplayAds: ", url1);
                let impressionTck = '';
                let strSeq = '';
                let iSeq = 0;
                const ret = await getVast(url1);
                if (ret.status === 200) {
                    const xml = ret.data;
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xml, "application/xml");
                    const impressions = xmlDoc.getElementsByTagName("Impression");
                    for (let i = 0; i < impressions.length; i++) {
                        const impUrl = impressions[i].textContent.trim();
                        const params = new URLSearchParams(new URL(impUrl).search);
                        if (impUrl.includes('.jpeg') || impUrl.includes('.jpg') || impUrl.includes('.png')) {
                            // Image Fade Effect
                            setOverlayVisible(false); // fade out
                            setTimeout(() => {
                                setPrevOverlayImg(leftOverlayImg);
                                setLeftOverlayImg(impUrl);
                                setOverlayVisible(true); // fade in
                            }, 500); // short delay to allow fade-out transition
                            if (impUrl.includes('sequence=')) {
                                strSeq = params.get('sequence');
                                iSeq = parseInt(strSeq?.match(/\d+/)?.[0], 10);
                                adOnPauseSequence.current = iSeq;
                                console.log("iseq: ", iSeq);
                                console.log("adOnPauseSequence: ", adOnPauseSequence.current);
                            }
                        } else if (impUrl.includes('/vod/impression?')) {
                            impressionTck = impUrl;
                        }
                        //console.log(`[VAST] Impression[${i}]: ${impUrl}`);
                    }
                    if (impressionTck !== '') {
                        getData(impressionTck);
                        //console.log("Display Impression Sent");
                    }
                    // Get advertiser
                    const advElements = xmlDoc.getElementsByTagName("Advertiser");
                    if (advElements.length > 0) {
                        setAdvertiser(advElements[0].textContent.trim());
                    } else {
                        setAdvertiser('Synamedia Iris'); // fallback if missing
                    }               
                }
            } 
            catch (error) {
                console.log("handleDisplayAds failed: ", error);
            }
        };

        if (seq) {
            // Repeated mode: poll until video is unpaused
            let url_l = url;
            let mySeq = 1;

            if (displayAdIntervalRef.current) return; // Avoid stacking

            if (mySeq >= 0 ) {
                url_l = url + `&kvp=sequence~seq${mySeq.toString()}`;
                await fetchAndRenderAd(url_l);
                mySeq = adOnPauseSequence.current;
            } 

            displayAdIntervalRef.current = setInterval(() => {
                if (leftVideoRef.current && !leftVideoRef.current.paused) {
                    clearInterval(displayAdIntervalRef.current);
                    displayAdIntervalRef.current = null;
                    console.log('[Specials] Video resumed — stopping displayAd loop');
                } 
                else {
                    // sequence the display ad calls
                    url_l = url + `&kvp=sequence~seq${adOnPauseSequence.current.toString()}`;
                    console.log(`&kvp=sequence~seq${adOnPauseSequence.current.toString()}`);
                    (async () => {
                        await fetchAndRenderAd(url_l);
                    })();
                }
            }, 5000); // repeat every 5 seconds
        } 
        else {
            // One-time mode
            await fetchAndRenderAd(url);
        }
    };

    useEffect(() => {
        const videoEl = leftVideoRef.current;
        if (!videoEl) return;

        const handlePause = () => {
            console.log('[Specials] Player paused');
            setIsPlaying(false);
            //resetTrackingLabels('l');
            if (!inAdOverlay && inAdPause) {
                setShowBlackCover(true);
            }
            clearInterval(intervalLeftRef.current);
            intervalLeftRef.current = null;
            // ###################################################
            let did = crypto.randomUUID();
            let timestamp = Date.now();
            let displayAdDecision = ''
            if (hasAdOnPause.current) {
                displayAdDecision = `https://ott-decision-apb.ads.iris.synamedia.com/adServer/op7z4geq/vast/vod?transactionId=${timestamp}&deviceId=${did}&sessionId=${timestamp}&position=pre&kvp=language~heb&kvp=profile~p3&kvp=adForm~display`;
                if (inSequence != '') {
                    handleDisplayAds(displayAdDecision, true);
                }
                else {
                    handleDisplayAds(displayAdDecision, false);
                }
                setStreamTypeMsg('Display Ads on Pause');
            }
        };

        const handlePlay = () => {
            console.log('[Specials] Player resumed — hiding overlay');
            setOverlayVisible(false);
            setShowBlackCover(false);
            setStreamTypeMsg('Content');
        };

        videoEl.addEventListener('pause', handlePause);
        videoEl.addEventListener('play', handlePlay);

        return () => {
            videoEl.removeEventListener('pause', handlePause);
            videoEl.removeEventListener('play', handlePlay);
        };
    }, []);


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
        //console.log("es: ", es);
        hasDisplay.current = false;
        sequence.current = '';
        displayAdURL.current = '';
        //console.log("eventStreamTk: ", eventStreamTk);
        for (let i = 0; i < eventStreamTk.Event_asArray.length; i++){
            // set tracking events
            myURL = eventStreamTk.Event_asArray[i].Tracking_asArray[0].__cdata;        
            //console.log(myURL);
            event = eventStreamTk.Event_asArray[i].Tracking_asArray[0].event;
            params = new URLSearchParams(myURL);
            adv = params.get("creativeId");
            if (event.includes('impression')) {
                //console.log("event: ", event);
                //console.log("myURL: ", myURL);
                if (myURL.includes(".jpeg") || myURL.includes(".jpg") || myURL.includes(".png")) {
                    if (myURL.includes('adForm=overlay')){
                        hasDisplay.current = true;
                        teType = 'overlay';
                    } else {
                        teType = 'skip';
                    }
                } else {
                    teType = 'Impression';
                }
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
            if (teType !== 'skip') {                      
                te = {stream:i, id:ind, pt: eventStreamTk.Event_asArray[i].presentationTime, type: teType, url: myURL, reported: false, advert: adv, ct: ''};
                //console.log(te);
                tevs.push(te);
            }
        }

        // Get the EventStream for click-through
        eventStreamCt = es.find((stream) => stream.value === 'com.synamedia.dai.videoclick.v2');
        if (!eventStreamCt) {
            return;
        }
        console.log("eventStreamCt", eventStreamCt);
        for (let u = 0; u < eventStreamCt.Event_asArray.length; u++) {
            myURL = eventStreamCt.Event_asArray[u].VideoClicks_asArray[0].ClickTracking_asArray[0];
            adv = eventStreamCt.Event_asArray[u].VideoClicks_asArray[0].ClickThrough_asArray[0];
            te = {stream:ind, id:ind, pt: 0, type: 'clicktrough', url: myURL, reported: false, advert: '', ct: adv};
            tevs.push(te);
        }
    }


    const checkIfAd = (mpd, activeStreamId) => {

        let ret = false;
        let events = [];
        
        const manifest = mpd?.manifest;
        const periods = manifest?.Period_asArray || [];
        const number = parseInt(activeStreamId.split('_')[1], 10);

        // Find the current period by ID
        const currentPeriod = periods[number];
        
        if (!currentPeriod) return { isAd: false, events };

        // Check if it has a tracking EventStream
        if (currentPeriod && currentPeriod['dai:adPeriod']) {
            const eventStream = currentPeriod.EventStream_asArray;
            ret = true;
            buildTrackingEvents(eventStream, events, activeStreamId);
        }
        
        return { isAd: ret, events };        
    }

    const buildURL = (url, pl) => {
        let str = '';
        let did = crypto.randomUUID();

        str = url + '&sessionId=SYNAIRISDEMO_' + pl + '_' + input_index.toString() + '_' + (Math.floor(new Date().getTime() / 1000).toString());
        str = str + '&deviceId=' + did
        
        return str;
    };
  
    const checkTrackingEvents = (trackingEvents, setTrackingLabels, tm, pl, id) => {

        for (let q = 0; q < trackingEvents.length; q++) {
            if (trackingEvents[q]?.id === id) {
                if ((tm >= trackingEvents[q]?.pt) && (!trackingEvents[q]?.reported)) {
                    if (trackingEvents[q].type !== 'clicktrough') {
                        //console.log('HTTP GET: ' + pl + ' - ' + trackingEvents[q].advert + ' - ' + trackingEvents[q].type + ' - ', trackingEvents[q].url);
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

        if (tracker === 'rl') {
            setLeftTrackingLabels({
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
            setIsPlaying(false);
            if (intervalLeftRef.current) {
                clearInterval(intervalLeftRef.current);
                intervalLeftRef.current = null;
            }
        } else {
            const playLeft = leftVideoRef.current?.play();

            // Catch abort errors
            if (playLeft?.catch) {
                playLeft.catch((e) => {
                    if (e.name !== 'AbortError') {
                        console.error('leftVideo play error:', e);
                    }
                });
            }

            setIsPlaying(true);
            setLeftOverlayImg('');

            if (!intervalLeftRef.current) {
                intervalLeftRef.current = setInterval(updateCurrentTimeLeft, _INTERVAL_);
            }
        }
    };

    const handleReinitialize = () => {
        if (leftPlayer) {
  
          let url = '';
  
          leftPlayer.current.reset();
  
          url = buildURL(leftUrl, 'l');
          leftPlayer.current.initialize(leftVideoRef.current, url, false, 0);
        }
        setIsPlaying(false);
        resetTrackingLabels();
      };
  
      const handleStop = () => {

        if (intervalLeftRef.current) {
            clearInterval(intervalLeftRef.current);
            intervalLeftRef.current = null;
        }

        if (leftVideoRef.current) {
            leftVideoRef.current.pause();
            leftVideoRef.current.removeAttribute('src');
            leftVideoRef.current.load();
        }

        if (leftPlayer.current) {
            leftPlayer.current.reset();
        }

        setIsPlaying(false);
        resetTrackingLabels('rl');
        
        leftCTEnabledRef.current = false;

      };
  
      const handleCT = (pl) => {

            console.log("ClickThrough: ", pl);

            const eventList = leftTrackingEventsRef.current;
            const currentStream = leftCurrentStream.current;

            const ctEvent = eventList.find(ev => ev.id === currentStream && ev.type === 'clicktrough' && ev.ct) || eventList.find(ev => ev.type === 'clicktrough' && ev.ct);

            if (ctEvent) {
                // Action the Ad Click
                window.open(ctEvent.ct, '_blank');
                // Report the Ad Click
                //console.log('HTTP GET: ' + pl + ' - ' + ctEvent.advert + ' - ' + ctEvent.type + ' - ', ctEvent.url);
                getData(ctEvent.url);                
            } 
            else {
                console.log('No clickthrough URL found for', pl);
            }
      };

      const getVast = async (url) => {
        try {
            const response = await axios.get(url, {headers:{
                'Access-Control-Allow-Origin': '*',
                'Content-Type':'application/json'
            }});
            //console.log(response.data);
            return response;
        } catch (error) {
            console.error('Error posting data:', error);
            return  -1;
        }
      };

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
    

    return (
        <div>
            <div>
              <h1>{dt.vod[input_index].great_title}</h1>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                    <h2>{dt.vod[input_index].left_title} & {dt.vod[input_index].left_segment} </h2>
                    <label>Stream Type: <b>{leftStreamIsAd ? ' :: AD :: ' + leftCurrentAdvert : streamTypeMsg}</b></label><br/>
                    <div>
                      <label>Tracking Event Impression ..:: {leftTrackingLabels.impression}</label><br/>
                      <label>Tracking Event Ad Start   ..:: {leftTrackingLabels.adstart}</label><br />
                      <label>Tracking Event First Qrl  ..:: {leftTrackingLabels.firstQuartile}</label><br/>
                      <label>Tracking Event Second Qrl ..:: {leftTrackingLabels.secondQuartile}</label><br/>
                      <label>Tracking Event Third Qrl  ..:: {leftTrackingLabels.thirdQuartile}</label><br/>
                      <label>Tracking Event Completion ..:: {leftTrackingLabels.completion}</label><br/>
                    </div>                     
                    <div style={{ position: 'relative', width: '750px', height: 'auto' }}> 
                        <video ref={leftVideoRef} controls preload="none" style={{ width: '100%', display: 'block' }} />
                            {showBlackCover && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        backgroundColor: 'black',
                                        zIndex: 8,
                                        pointerEvents: 'none'
                                    }}
                                />
                            )}                        
                            {liveOverlayUrl && (
                                <img
                                    src={liveOverlayUrl}
                                        alt="Live Overlay"
                                        style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '20%',
                                        objectFit: 'fill',
                                        zIndex: 12,
                                        pointerEvents: 'none',
                                        transition: 'opacity 0.3s ease-in-out'
                                    }}
                                />
                            )}                      
                            {(leftOverlayImg || prevOverlayImg) && (
                                <>
                                {prevOverlayImg && (
                                    <img
                                        src={prevOverlayImg}
                                        alt="Previous Overlay"
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            pointerEvents: 'none',
                                            zIndex: 9,
                                            opacity: overlayVisible ? 0 : 1,
                                            transition: 'opacity 0.5s ease-in-out'
                                        }}
                                    />
                                )}
                                {leftOverlayImg && (
                                    <img
                                        src={leftOverlayImg}
                                        alt="Overlay Ad"
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            pointerEvents: 'none',
                                            zIndex: 10,
                                            opacity: overlayVisible ? 1 : 0,
                                            transition: 'opacity 0.5s ease-in-out'
                                        }}
                                    />
                                )}
                                </>
                            )}
                            {(leftOverlayImg || prevOverlayImg) && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '15%',
                                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                        zIndex: 11,
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        color: 'white',
                                        fontSize: '20px',
                                        textAlign: 'center',
                                        padding: '20px',
                                        pointerEvents: 'none' // Allows clicks to pass through to video
                                    }}
                                >
                                    <p>
                                        Enjoy this moment of pause sponsored by <strong>{advertiser}</strong>,<br />
                                        Rest assured that YES+ is taking care of your playback until you return.
                                    </p>
                                </div>
                            )}                    
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
                <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition" onClick={handleToggleLeftVolume}>
                    L: {leftVolumeLabel}
                </button>
            </div>
        </div>
    );
};
export default Specials;
