import React, { useEffect, useRef, useState } from 'react';
import dashjs from 'dashjs';
import axios from 'axios';
import dt from '../data.json';
import moment from 'moment';

const Linear = ({input_index}) => {
    const [, forceUpdate] = useState(0);
    const leftVideoRef = useRef(null);
    const rightVideoRef = useRef(null);
    const intervalLeftRef = useRef(null);
    const intervalRightRef = useRef(null);
    const leftPlayer = useRef(null);
    const rightPlayer = useRef(null);
    const leftPrevPeriodWasAd = useRef(false);
    const rightPrevPeriodWasAd = useRef(false);
    const [leftUrl, setLeftUrl] = useState((dt.vod[input_index].left_playback_url));
    const [rightUrl, setRightUrl] = useState((dt.vod[input_index].right_playback_url));
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
            }

            if (rightPlayer.current) {
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
        leftPlayer.current.initialize(leftVideoRef.current, buildURL(leftUrl), true, 0);
        leftVideoRef.current.muted = true;
        console.log('(LIN) initialize LP');

        rightPlayer.current = dashjs.MediaPlayer().create();
        rightPlayer.current.updateSettings({
            debug: {
              logLevel: dashjs.Debug.LOG_LEVEL_NONE
            }
        });
        rightPlayer.current.initialize(rightVideoRef.current, buildURL(rightUrl), true, 0);
        rightVideoRef.current.muted = true;
        console.log('(LIN) initialize RP');

        // Set the intervals
        intervalLeftRef.current = setInterval(updateCurrentTimeLeft, _INTERVAL_);
        console.log('setIntervalLeft() ' + intervalLeftRef.current);
        intervalRightRef.current = setInterval(updateCurrentTimeRight, _INTERVAL_);
        console.log('setIntervalRight() ' + intervalRightRef.current);
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
                } else {
                  setLeftTrackingEvents([]);
                  setleftStreamIsAd(false);
                  resetTrackingLabels('l');
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
                } else {
                    setRightTrackingEvents([]);
                    setrightStreamIsAd(false);
                    resetTrackingLabels('r');
                }                
            });            
        });
    }

    useEffect(() => {
        
        initializePlayers();

    }, [leftUrl,rightUrl]);

    const decodeBase64 = (str) => {
        try {
          return atob(str);
        } catch (e) {
          console.error('Invalid Base64 string', e);
          return '';
        }
    }
  
    const buildTrackingEvents = (es, tevs, ind) => {

        let te = '';
        let myURL = '';
        let teType = '';
        let adv = '';
        let params = [];
        
        //console.log(es);

        for (let i = 0; i < es.Event_asArray.length; i++){
            // set tracking events        
            myURL = decodeBase64(es.Event_asArray[i].Binary_asArray[0].__text);
            //console.log(myURL);
            params = new URLSearchParams(myURL);
            adv = params.get("creativeId");
            if (myURL.includes('impression')) {
                teType = 'Impression';
            } else if (myURL.includes('tracking=0')){
                teType = 'Ad Start';
            } else if (myURL.includes('tracking=25')) {
                teType = 'First Quartile';
            } else if (myURL.includes('tracking=50')) {
                teType = 'Second Quartile';
            } else if (myURL.includes('tracking=75')) {
                teType = 'Third Quartile';
            } else if (myURL.includes('tracking=100')) {
                teType = 'Fourth Quartile';
            } else {
                teType = 'Unkknown';
            }                      
            te = {stream:i, id:ind, pt: es.Event_asArray[i].presentationTime, type: teType, url: myURL, reported: false, advert: adv};
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
        const eventStream = currentPeriod.EventStream_asArray?.[0];
        if (eventStream?.value === "com.synamedia.dai.tracking") {
            ret = true;
            buildTrackingEvents(eventStream, events, currentPeriod.id);
        }
      
        return { isAd: ret, events };        
    }

    /*
    const checkIfAd = (mpd, pl) => {
        let ret = false;
        let events = [];
        let periods = mpd.manifest.Period_asArray.length;
        
        if (periods === 1) return { isAd: false, events };
        
        let eventStream = null;//mpd.manifest.Period_asArray[1].EventStream_asArray?.[0];

        for (let u = 1; u < periods; u++) {
            eventStream = mpd.manifest.Period_asArray[u].EventStream_asArray?.[0]
            //console.log('eventStream ' + pl + ' - ', eventStream);
            if (eventStream?.value === "com.synamedia.dai.tracking") {
                //console.log(mpd.manifest.Period_asArray);
                //console.log(mpd.manifest.getActiveStream());
                ret = true;
                buildTrackingEvents(eventStream, events, mpd.manifest.Period_asArray[u].id);
            }
        }
        return { isAd: ret, events };
    };
    */
    

    const buildURL = (url) => {
        let str = '';
        str = url + '&sessionId=SYNAIRISDEMO_'+ input_index.toString() + '_' + (Math.floor(new Date().getTime() / 1000).toString());
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
  
          url = buildURL(leftUrl);
          leftPlayer.current.initialize(leftVideoRef.current, url, false, 0);
          url = buildURL(rightUrl);
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
            //console.log(response.data);
            return response.status;
        } catch (error) {
            console.error('Error posting data:', error);
            return -1;
        }
      };    

    // Handle ESAM request (converted from Python)
    const sendESAMRequest = async (ip, port, duration, scte35type, adcount, esamid) => {
        const now = moment.utc();
        console.log('Current time: ' + now.toISOString());
        
        let spliceTime = now.clone().add(5, 'seconds');
        let adduration = parseFloat(duration);

        while (adcount > 0) {
            const time = 'utcPoint="' + spliceTime.toISOString() + '"';

            let xml = '';
            if (scte35type === '5') {
                xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <ns3:SignalProcessingNotification acquisitionPointIdentity="${esamid}" 
                        xmlns:sig="urn:cablelabs:md:xsd:signaling:3.0" 
                        xmlns:ns5="urn:cablelabs:iptvservices:esam:xsd:common:1" 
                        xmlns:ns2="urn:cablelabs:md:xsd:core:3.0" 
                        xmlns:ns4="urn:cablelabs:md:xsd:content:3.0" 
                        xmlns:ns3="urn:cablelabs:iptvservices:esam:xsd:signal:1">
                        <ns5:StatusCode classCode="0"/>
                        <ns3:ResponseSignal action="create" signalPointID="OvZbrzQYQw6RhaCrNTSYU1" acquisitionTime="2016-10-13T09:08:00Z" acquisitionSignalID="01c51d7c-9820-4e48-82b9-12920b9749b6" acquisitionPointIdentity="${esamid}">
                            <sig:UTCPoint ${time}/>
                            <sig:SCTE35PointDescriptor spliceCommandType="5">
                            <sig:SpliceInsert spliceEventID="2001" outOfNetworkIndicator="true" uniqueProgramID="1" duration="PT${duration}S"></sig:SpliceInsert>
                            </sig:SCTE35PointDescriptor>
                        </ns3:ResponseSignal>
                        <ns3:ConditioningInfo acquisitionSignalIDRef="01c51d7c-9820-4e48-82b9-12920b9749b6" duration="PT${duration}S"/>
                    </ns3:SignalProcessingNotification>`;
            }

            if (scte35type === '6') {
                xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <ns3:SignalProcessingNotification acquisitionPointIdentity="${esamid}"
                        xmlns:sig="urn:cablelabs:md:xsd:signaling:3.0"
                        xmlns:ns5="urn:cablelabs:iptvservices:esam:xsd:common:1"
                        xmlns:ns2="urn:cablelabs:md:xsd:core:3.0"
                        xmlns:ns4="urn:cablelabs:md:xsd:content:3.0"
                        xmlns:ns3="urn:cablelabs:iptvservices:esam:xsd:signal:1">
                        <ns5:StatusCode classCode="0"/>
                        <ns3:ResponseSignal action="create" signalPointID="OvZbrzQYQw6RhaCrNTSYU1" acquisitionTime="2016-10-13T09:08:00Z" acquisitionSignalID="01c51d7c-9820-4e48-82b9-12920b9749b6" acquisitionPointIdentity="${esamid}">
                            <sig:UTCPoint ${time}/>
                            <sig:SCTE35PointDescriptor spliceCommandType="6">
                                <sig:SegmentationDescriptorInfo segmentEventID="99790150" upidType="9"
                                upid="5349474e414c3a67466b525a5a6f62536d2b4e64376635636357316c413d3d" segmentTypeID="50"
                                segmentNum="2" segmentsExpected="3" duration="PT${duration}S"/>
                            </sig:SCTE35PointDescriptor>
                        </ns3:ResponseSignal>
                        <ns3:ConditioningInfo acquisitionSignalIDRef="01c51d7c-9820-4e48-82b9-12920b9749b6" duration="PT${duration}S"/>
                    </ns3:SignalProcessingNotification>`;
            }

            console.log('Splice scheduled for: ' + spliceTime.toISOString());
            console.log('Send ESAM request');
            const headers = {'Content-Type': 'application/xml'}; 
            const url = `http://${ip}:${port}/esam/signal`;
            console.log(url);
            try {
                const response = await axios.post(url, xml, {headers});
                console.log('Status Code:', response.status);
            } catch (error) {
                console.error('Error sending ESAM request:', error);
            }

            adcount -= 1;    
            spliceTime = spliceTime.add(adduration, 'seconds');
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
                    <label>Stream Type: <b>{leftStreamIsAd ? ' :: AD :: ' + leftCurrentAdvert : 'Content'}</b></label><br/>
                    <div>
                      <label>Tracking Event Impression ..:: {leftTrackingLabels.impression}</label><br/>
                      <label>Tracking Event Ad Start   ..:: {leftTrackingLabels.adstart}</label><br />
                      <label>Tracking Event First Qrl  ..:: {leftTrackingLabels.firstQuartile}</label><br/>
                      <label>Tracking Event Second Qrl ..:: {leftTrackingLabels.secondQuartile}</label><br/>
                      <label>Tracking Event Third Qrl  ..:: {leftTrackingLabels.thirdQuartile}</label><br/>
                      <label>Tracking Event Completion ..:: {leftTrackingLabels.completion}</label><br/>
                    </div>                     
                    <div> 
                      <video ref={leftVideoRef} controls style={{ width: '750px' }} />
                    </div>
                </div>
                <div>
                    <h2>{dt.vod[input_index].right_title} & {dt.vod[input_index].right_segment} </h2>
                    <label>Stream Type: <b>{rightStreamIsAd ? ' :: AD :: ' + rightCurrentAdvert : 'Content'}</b></label><br/>
                    <div>
                      <label>Tracking Event Impression ..:: {rightTrackingLabels.impression}</label><br/>
                      <label>Tracking Event Ad Start   ..:: {rightTrackingLabels.adstart}</label><br />
                      <label>Tracking Event First Qrl  ..:: {rightTrackingLabels.firstQuartile}</label><br/>
                      <label>Tracking Event Second Qrl ..:: {rightTrackingLabels.secondQuartile}</label><br/>
                      <label>Tracking Event Third Qrl  ..:: {rightTrackingLabels.thirdQuartile}</label><br/>
                      <label>Tracking Event Completion ..:: {rightTrackingLabels.completion}</label><br/>
                    </div>                    
                    <div>
                      <video ref={rightVideoRef} controls style={{ width: '750px' }} />
                    </div>
                </div>
            </div>
            <div>
                <button onClick={handleReinitialize}>Load/Reload</button>
                <button onClick={handleTogglePlayPause}>{isPlaying ? 'Pause':'Play'}</button>
                <button onClick={handleStop}>Stop</button>
            </div>
        </div>
    );
};
export default Linear;
