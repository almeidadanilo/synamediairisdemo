import React, { useEffect, useRef, useState } from 'react';
import dashjs from 'dashjs';
import axios from 'axios';
import dt from './data.json';

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

// Specials - Component for VOD ad on pause and ad overlay Demo Use Cases

const Specials = ({input_index, inAdPause, inSequence, inAdOverlay, inAdPauseVideo}) => {
    const [, forceUpdate] = useState(0);
    const leftVideoRef = useRef(null);
    const intervalLeftRef = useRef(null);
    const intervalSecondaryRef = useRef(null);
    const leftPlayer = useRef(null);
    const leftCTEnabledRef = useRef(false);
    const displayAdIntervalRef = useRef(null);
    const adOnPauseSequence = useRef(1);
    const [showAdVideo, setShowAdVideo] = useState(false);
    const overlayAdRef = useRef(null);
    const overlayDashRef = useRef(null);
    const resumeTime = 0;
    const secondaryVideoImpressions = useRef([])
    const secondaryVideoTrackers = useRef([])
    const [adVideoSRC, setAdVideoSRC] = useState('');
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
    const [isStartSelected, setIsStartSelected] = useState(true);
    const toggleModeRef = useRef("start");
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
            if (intervalSecondaryRef.current) {
                clearInterval(intervalSecondaryRef.current);
                intervalSecondaryRef.current = null;
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

    // Cleaning on Exit
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
  
    // Handling the end of the secondary video playback
    const handleAdVideoEnd = () => {
        try {
            console.log("handleAdVideoEnd");
            setShowAdVideo(false);
            if (overlayDashRef.current) {
                overlayDashRef.current.reset();
                overlayDashRef.current = null;
            }
            if (intervalSecondaryRef.current) {
                clearInterval(intervalSecondaryRef.current);
                intervalSecondaryRef.current = null;
            }
            console.log("showAdVideo: ", showAdVideo);
        }
        catch (error) {
            console.log("handleAdVideoEnd: ", error);
        }
    };

    // Handling the display ads on pause (full screen)
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

    function timeStringToMilliseconds(timeStr) {
        const [hms, ms = "0"] = timeStr.split('.');
        const [hours, minutes, seconds] = hms.split(':').map(Number);
        const milliseconds = Number(ms.padEnd(3, '0')); // ensures "2" becomes "200", "25" → "250"
        return ((hours * 3600 + minutes * 60 + seconds) * 1000) + milliseconds;
    }

    // Handle the secondary video ad on pause
    const handleVideoAds = async (url, pos) => {
        try {
            const ret = await getVast(url);
            let elements = [];
            let e = {};
            let ev = "";
            let pts_ = 0;
            let durationText = "";
            if (ret.status === 200) {
                const xml = ret.data;
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xml, "application/xml");
                const mediaFiles = xmlDoc.getElementsByTagName("MediaFile");
                const impressions = xmlDoc.getElementsByTagName("Impression");
                const trackers = xmlDoc.getElementsByTagName("Tracking");
                const durations = xmlDoc.getElementsByTagName("Duration");

                // Process Ad Server duration
                durationText = durations[0].textContent.trim();
                console.log("durationText: ", durationText);
                // Process Ad Server DASH media file response
                for (let i = 0; i < mediaFiles.length; i++){
                    const typeAttr = mediaFiles[i].getAttribute("type");
                    if (typeAttr === 'application/dash+xml') {
                        setAdVideoSRC(mediaFiles[i].textContent.trim());
                        forceUpdate(n => n + 1);
                    }
                }
                // Process Ad Server Impressions URLs
                for (let i = 0; i < impressions.length; i++) {
                    e = {pts: 0, url: impressions[i].textContent.trim(), reported: false}
                    elements.push(e);
                }
                secondaryVideoImpressions.current = elements;
                elements = [];
                // Process Ad Server Tracker URLs
                for (let i = 0; i < trackers.length; i++) {
                    ev = trackers[i].getAttribute("event");
                    switch (ev) {
                        case "start":
                            pts_ = 0;
                        case "firstQuartile":
                            pts_ = timeStringToMilliseconds(durationText) * 0.25;
                        case "midpoint":
                            pts_ = timeStringToMilliseconds(durationText) * 0.50;
                        case "thirdQuartile":
                            pts_ = timeStringToMilliseconds(durationText) * 0.75;
                        case "complete":
                            pts_ = timeStringToMilliseconds(durationText);
                    }
                    e = {event: ev, pts: pts_, url: trackers[i].textContent.trim(), reported: false}
                    elements.push(e);
                }
                secondaryVideoTrackers.current = elements;
                elements = [];
                setShowAdVideo(true);
                forceUpdate(n => n + 1);
            }
            else {
                console.log("Problem on video ad decision: ", ret.status);
            }
        }
        catch (error) {
            console.log("handleVideoAds failed: ", error);
        }        
    }

    // Will handle the main player pause/play
    useEffect(() => {
        const videoEl = leftVideoRef.current;
        if (!videoEl) return;

        const handlePause = () => {
            console.log('[Specials] Player paused');
            setIsPlaying(false);
            //resetTrackingLabels('l');
            //let did = crypto.randomUUID();
            let did = window.crypto?.randomUUID?.() || Math.random().toString(36).substring(2);
            console.log("did=", did);            
            let timestamp = Date.now();
            let displayAdDecision = ''    
            // If the use case is display ads on pause or display overlays
            if (inAdOverlay || inAdPause) {
                if (!inAdOverlay && inAdPause) {
                    setShowBlackCover(true);
                }
                clearInterval(intervalLeftRef.current);
                intervalLeftRef.current = null;
                // ###################################################
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
            }
            // If the use case is playing a video during the pause 
            else if (inAdPauseVideo && toggleModeRef.current === 'start') {
                displayAdDecision = `https://ott-decision-apb.ads.iris.synamedia.com/adServer/op7z4geq/vast/vod?transactionId=${timestamp}&deviceId=${did}&sessionId=${timestamp}&position=pre&kvp=language~heb&kvp=adForm~adPause`;
                handleVideoAds(displayAdDecision, 'onPause');
            }

        };

        const handlePlay = () => {
            let displayAdDecision = ''
            let did = window.crypto?.randomUUID?.() || Math.random().toString(36).substring(2);     
            let timestamp = Date.now();
            
            console.log('[Specials] Player resumed — hiding overlay');
            setOverlayVisible(false);
            setShowBlackCover(false);

            // If the use case is playing a video during the resume of a pause 
            if (inAdPauseVideo && toggleModeRef.current === 'resume') {
                displayAdDecision = `https://ott-decision-apb.ads.iris.synamedia.com/adServer/op7z4geq/vast/vod?transactionId=${timestamp}&deviceId=${did}&sessionId=${timestamp}&position=pre&kvp=language~heb&kvp=adForm~adPausePreRoll`;
                handleVideoAds(displayAdDecision, 'onResume');
            }
            else {
                setStreamTypeMsg('Content');
            }
        };

        videoEl.addEventListener('pause', handlePause);
        videoEl.addEventListener('play', handlePlay);

        return () => {
            videoEl.removeEventListener('pause', handlePause);
            videoEl.removeEventListener('play', handlePlay);
        };
    }, []);

    // To handle the secondary video timing for impressions and tracking events
    const updateCurrentTimeSecondaryVideo = ()=> {
        try {
            let i = 0;
            let tms = overlayDashRef.current?.time() * 1000;
            //console.log("tms: ", tms);
            if (secondaryVideoImpressions.current) {
                //console.log("secondaryVideoImpressions.current.length", secondaryVideoImpressions.current.length);
                for (i=0; i < secondaryVideoImpressions.current.length; i++) {
                    //console.log("secondaryVideoImpressions.current[i]", secondaryVideoImpressions.current[i]);
                    if (secondaryVideoImpressions.current[i].pts <= tms && !secondaryVideoImpressions.current[i].reported) {
                        getData(secondaryVideoImpressions.current[i].url);
                        //console.log("reported impression: ", secondaryVideoImpressions.current[i]?.url);
                        secondaryVideoImpressions.current[i].reported = true;
                    }
                }
            }
            if (secondaryVideoTrackers.current) {
                for (i=0; i < secondaryVideoTrackers.current.length; i++) {
                    if (secondaryVideoTrackers.current[i].pts <= tms && !secondaryVideoTrackers.current[i].reported) {
                        getData(secondaryVideoTrackers.current[i].url);
                        //console.log("reported event: ", secondaryVideoTrackers.current[i]?.event, secondaryVideoTrackers.current[i]?.url);
                        secondaryVideoTrackers.current[i].reported = true;
                    }
                }
            }
        }
        catch (error) {
            console.error('Error updateCurrentTimeSecondaryVideo:', error);
        }
    }

    // To handle the secondary video playback
    useEffect(() => {
        if (showAdVideo && adVideoSRC && overlayAdRef.current) {
            const player = dashjs.MediaPlayer().create();
            player.updateSettings({
                debug: { logLevel: dashjs.Debug.LOG_LEVEL_WARNING }
            });

            player.initialize(overlayAdRef.current, adVideoSRC, true);
            overlayDashRef.current = player;
            overlayAdRef.current.muted = true;

            intervalSecondaryRef.current = setInterval(updateCurrentTimeSecondaryVideo, (_INTERVAL_ / 2));
        }
    }, [showAdVideo, adVideoSRC]);

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
        hasDisplay.current = false;
        sequence.current = '';
        displayAdURL.current = '';
        for (let i = 0; i < eventStreamTk.Event_asArray.length; i++){
            // set tracking events
            myURL = eventStreamTk.Event_asArray[i].Tracking_asArray[0].__cdata;        
            event = eventStreamTk.Event_asArray[i].Tracking_asArray[0].event;
            params = new URLSearchParams(myURL);
            adv = params.get("creativeId");
            if (event.includes('impression')) {
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

        console.log("did=", did);
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
            if (inAdPauseVideo) {
                console.log("leftVideoRef.current.currentTime: ", leftVideoRef.current.currentTime);
                //resumeTime.current = leftVideoRef.current.currentTime;
                //console.log("resumeTime.current: ", resumeTime.current);
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

            ///console.log("ClickThrough: ", pl);
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

      // Handle the HTTPS GET request to Iris ADS
      const getVast = async (url) => {
        try {
            /*const response = await axios.get(url, {headers:{
                'Access-Control-Allow-Origin': '*',
                'Content-Type':'application/json'
            }});*/
            const response = await axios.get(url);
            return response;
        } catch (error) {
            console.error('Error posting data:', error);
            return  -1;
        }
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
        if (overlayAdRef.current) {
            if (leftVolumeLabel === "5%") {
                overlayAdRef.current.volume = 0.05;
                overlayAdRef.current.muted = false;
            } else {
                overlayAdRef.current.volume = 0;
            }            
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
                            <div className="flex items-center space-x-4 mt-4">
                                <button
                                    onClick={() => {
                                        setIsStartSelected(true);
                                        toggleModeRef.current = "start";
                                    }}
                                    className={`px-4 py-2 rounded-full text-white ${isStartSelected ? 'bg-green-600' : 'bg-gray-400'}`}
                                >
                                    Start
                                </button>
                                <button
                                    onClick={() => {
                                        setIsStartSelected(false);
                                        toggleModeRef.current = "resume";
                                    }}
                                    className={`px-4 py-2 rounded-full text-white ${!isStartSelected ? 'bg-green-600' : 'bg-gray-400'}`}
                                >
                                    Resume
                                </button>
                            </div>
                            <br />
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
                                {showAdVideo && (
                                    <video
                                        ref={overlayAdRef}
                                        src={''}
                                        autoPlay = {false}
                                        onEnded={handleAdVideoEnd}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            zIndex: 7,
                                            backgroundColor: 'black'
                                        }}
                                    />
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
        </div>
    );
};
export default Specials;
