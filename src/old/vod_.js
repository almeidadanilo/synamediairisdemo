import React, { useEffect, useRef, useState } from 'react';
import dashjs from 'dashjs';
import axios from 'axios';
import dt from '../data.json';

const Vod = ({input_index}) => {
    const leftVideoRef = useRef(null);
    const rightVideoRef = useRef(null);
    const [leftPlayer, setLeftPlayer] = useState(null);
    const [rightPlayer, setRightPlayer] = useState(null);
    const [leftCurrentTime, setLeftCurrentTime] = useState(0);
    const [rightCurrentTime, setRightCurrentTime] = useState(0);
    const [leftUrl, setLeftUrl] = useState((dt.vod[input_index].left_playback_url));
    const [rightUrl, setRightUrl] = useState((dt.vod[input_index].right_playback_url));  
    const [leftPeriods, setLeftPeriods] = useState([]);
    const [rightPeriods, setRightPeriods] = useState([]);
    const [leftPeriodColors, setLeftPeriodColors] = useState([]);
    const [rightPeriodColors, setRightPeriodColors] = useState([]);
    //const leftCurrentStream = useRef("");
    //const rightCurrentStream = useRef("");     
    const leftStreamIsAdRef = useRef(false);
    const rightStreamIsAdRef = useRef(false);
    const [leftStreamIsAd, setleftStreamIsAd] = useState(false);  
    const [rightStreamIsAd, setrightStreamIsAd] = useState(false);  
    const [leftAdStreams, setLeftAdStreams] = useState([]);
    const [rightAdStreams, setRightAdStreams] = useState([]);
    const leftTrackingEventsRef = useRef([]);
    const rightTrackingEventsRef = useRef([]);
    const [leftTrackingEvents, setLeftTrackingEvents] = useState([]);
    const [rightTrackingEvents, setRightTrackingEvents] = useState([]);
    const [leftCurrentAdvert, setLeftCurrentAdvert] = useState('');
    const [rightCurrentAdvert, setRightCurrentAdvert] = useState('');        
    const [isPlaying, setIsPlaying] = useState(false);
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
    
    let leftCurrentStream = 0;
    let rightCurrentStream = 0;
    let isRightManifestLoaded = false;
    let isLeftManifestLoaded = false;


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
        if (leftStreamIsAdRef.current && leftCurrentStream && leftTrackingEventsRef.current.length > 0) {
          const match = leftTrackingEventsRef.current.find(ev => ev.id === leftCurrentStream);
          setLeftCurrentAdvert(match?.advert || '');
        } else {
          setLeftCurrentAdvert('');
        }
    }, [leftTrackingEvents, leftStreamIsAd, leftCurrentStream]); // Include deps

    useEffect(() => {
        if (rightStreamIsAdRef.current && rightCurrentStream && rightTrackingEventsRef.current.length > 0) {
          const match = rightTrackingEventsRef.current.find(ev => ev.id === rightCurrentStream);
          setRightCurrentAdvert(match?.advert || '');
        } else {
          setRightCurrentAdvert('');
        }
    }, [rightTrackingEvents, rightStreamIsAd, rightCurrentStream]);

    useEffect(() => {

        const initializePlayers = () => {

          if (leftPlayer) {console.log(leftPlayer);leftPlayer.reset();}
          if (rightPlayer) {console.log(leftPlayer);rightPlayer.reset();}

          const leftDashPlayer = dashjs.MediaPlayer().create();
          leftDashPlayer.initialize(leftVideoRef.current, buildURL(leftUrl), false, 0);
          setLeftPlayer(leftDashPlayer);

          const rightDashPlayer = dashjs.MediaPlayer().create();
          rightDashPlayer.initialize(rightVideoRef.current, buildURL(rightUrl), false, 0);
          setRightPlayer(rightDashPlayer);

          const updateCurrentTime = () => {
            
            let id = '';

            if (leftDashPlayer) {
              id = getManifestID(leftDashPlayer.getStreamsFromManifest(),leftCurrentStream);
              setLeftCurrentTime(leftDashPlayer.time(id));
              if (!leftDashPlayer.isPaused()){
                checkTrackingEvents(leftDashPlayer,leftAdStreams,leftCurrentStream,leftTrackingEvents,setLeftTrackingLabels,id,'l');
              }
            }
            if (rightDashPlayer) {
              id = getManifestID(rightDashPlayer.getStreamsFromManifest(),rightCurrentStream);
              setRightCurrentTime(rightDashPlayer.time(id));
              if (!rightDashPlayer.isPaused()) {
                checkTrackingEvents(rightDashPlayer,rightAdStreams,rightCurrentStream,rightTrackingEvents,setRightTrackingLabels,id, 'r');
              }
            }
          };
          
          let interval = setInterval(updateCurrentTime, 1000);

          const resetInterval = () => {
            console.log('period reset');
            clearInterval(interval);
            interval = setInterval(updateCurrentTime, 1000);
          };

          leftDashPlayer.on(dashjs.MediaPlayer.events.PERIOD_SWITCH_COMPLETED, resetInterval);
          rightDashPlayer.on(dashjs.MediaPlayer.events.PERIOD_SWITCH_COMPLETED, resetInterval);

          leftDashPlayer.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, (e) => {
            console.log('Left -> MANIFEST_LOADED');
            const periods = e.data.Period_asArray;
            //console.log(periods);
            if (!isLeftManifestLoaded) {
              isLeftManifestLoaded = true;
              
              setLeftPeriods(periods);
              setLeftPeriodColors(new Array(periods.length).fill('blue'));

              let te = '';
              let myURL = '';
              let teType = '';
              let adv = '';
              let params = [];              

              for (let i = 0; i < periods.length; i++){
                if (checkIfAd(periods[i])) {
                  leftAdStreams.push(i);
                  // set tracking events        
                  if (periods && periods[i].EventStream_asArray[0]) {
                    for (let u = 0; u < periods[i].EventStream_asArray[0].Event_asArray.length; u++) {
                      myURL = decodeBase64(periods[i].EventStream_asArray[0].Event_asArray[u].Binary_asArray[0].__text);
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
                      te = {stream:i, id:u, pt: periods[i].EventStream_asArray[0].Event_asArray[u].presentationTime, type: teType, url: myURL, reported: false, advert: adv};
                      leftTrackingEvents.push(te);
                    }
                  }
                }
              }
            }
          });

          leftDashPlayer.on(dashjs.MediaPlayer.events.STREAM_ACTIVATED, (e) => {
              ////////////////////////////////////////////////////////////////////////////
              const newId = e.streamInfo?.id;
              if (!newId) return;
          
              const previousId = leftCurrentStream;
          
              if (previousId && previousId !== newId && leftStreamIsAdRef.current) {
                  resetTrackingLabels('l');
              }

              leftCurrentStream = newId;
              ////////////////////////////////////////////////////////////////////////////
          });

          rightDashPlayer.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, (e) => {
            console.log('Right -> MANIFEST_LOADED');
            if (!isRightManifestLoaded) {
              isRightManifestLoaded = true;            
              const periods = e.data.Period_asArray;
              setRightPeriods(periods);
              setRightPeriodColors(new Array(periods.length).fill('blue'));

              let te = '';
              let myURL = '';
              let teType = '';

              for (let i = 0; i < periods.length; i++){
                if (checkIfAd(periods[i])) {
                  rightAdStreams.push(i);
                  // set tracking events        
                  if (periods && periods[i].EventStream_asArray[0]) {
                    for (let u = 0; u < periods[i].EventStream_asArray[0].Event_asArray.length; u++) {
                      myURL = decodeBase64(periods[i].EventStream_asArray[0].Event_asArray[u].Binary_asArray[0].__text);
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
                      te = {stream:i, id:u, pt: periods[i].EventStream_asArray[0].Event_asArray[u].presentationTime, type:teType ,url: myURL, reported:false};
                      rightTrackingEvents.push(te);
                    }
                  }
                }
              }
            }
          });

          rightDashPlayer.on(dashjs.MediaPlayer.events.STREAM_ACTIVATED, (e) => {
              ////////////////////////////////////////////////////////////////////////////
              const newId = e.streamInfo?.id;
              if (!newId) return;
          
              const previousId = rightCurrentStream;
          
              if (previousId && previousId !== newId && rightStreamIsAdRef.current) {
                  resetTrackingLabels('r');
              }

              rightCurrentStream = newId;
              ////////////////////////////////////////////////////////////////////////////
          });

          leftDashPlayer.on(dashjs.MediaPlayer.events.PERIOD_SWITCH_STARTED, (e) => {
            console.log('Left -> PERIOD_SWITCH_STARTED');
            const periodIndex = e.toStreamInfo.index;
            leftCurrentStream = e.toStreamInfo.index;
            //console.log('b', leftCurrentStream);
            if (leftAdStreams.includes(leftCurrentStream)) {
              setleftStreamIsAd(true);
            } else {
              setleftStreamIsAd(false);
            }
            setLeftPeriodColors((colors) => {
                const newColors = [...colors];
                newColors[periodIndex] = 'yellow';
                return newColors;
            });
            
          });

          leftDashPlayer.on(dashjs.MediaPlayer.events.PERIOD_SWITCH_COMPLETED, (e) => {
            console.log('Left -> PERIOD_SWITCH_COMPLETED');
            if (e.toStreamInfo.index > 0) {
              const periodIndex = (e.toStreamInfo.index - 1);
              setLeftPeriodColors((colors) => {
                  const newColors = [...colors];
                  newColors[periodIndex] = 'green';
                  return newColors;
              });
            }
            else if (e.toStreamInfo.isLast) {
              const periodIndex = e.toStreamInfo.index;
              setLeftPeriodColors((colors) => {
                  const newColors = [...colors];
                  newColors[periodIndex] = 'green';
                  return newColors;
              });
            }
            resetTrackingLabels('l');
          });

          rightDashPlayer.on(dashjs.MediaPlayer.events.PERIOD_SWITCH_STARTED, (e) => {
            console.log('Right -> PERIOD_SWITCH_STARTED');
              const periodIndex = e.toStreamInfo.index;
              rightCurrentStream = e.toStreamInfo.index;
              //
              if (rightAdStreams.includes(rightCurrentStream)) {
                setrightStreamIsAd(true);
              } else {
                setrightStreamIsAd(false);
              }
              setRightPeriodColors((colors) => {
                  const newColors = [...colors];
                  newColors[periodIndex] = 'yellow';
                  return newColors;
              });
          });

          rightDashPlayer.on(dashjs.MediaPlayer.events.PERIOD_SWITCH_COMPLETED, (e) => {
            console.log('Right -> PERIOD_SWITCH_COMPLETED');
            if (e.toStreamInfo.index > 0) {
                const periodIndex = (e.toStreamInfo.index - 1);
                setRightPeriodColors((colors) => {
                    const newColors = [...colors];
                    newColors[periodIndex] = 'green';
                    return newColors;
                });
            }
            else if (e.toStreamInfo.isLast) {
              const periodIndex = e.toStreamInfo.index;
              setLeftPeriodColors((colors) => {
                  const newColors = [...colors];
                  newColors[periodIndex] = 'green';
                  return newColors;
              });
            }
            resetTrackingLabels('r');            
          });

          return () => {
            leftDashPlayer.off(dashjs.MediaPlayer.events.PERIOD_SWITCH_COMPLETED, resetInterval);
            rightDashPlayer.off(dashjs.MediaPlayer.events.PERIOD_SWITCH_COMPLETED, resetInterval);
            leftDashPlayer.reset();
            rightDashPlayer.reset();
            clearInterval(interval);
          };

        };

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

    const getManifestID = (manifests, currentStream) => {
      for (let i = 0; i < manifests.length; i++) {
        if (manifests[i].index === currentStream){
          return manifests[i].id;
        }
      }
      return '';
    }

    const checkIfAd = (period) => {

      let ret = false;

      if (period && period['dai:adPeriod']) {
        ret = true;
      }

      return ret;
    };

    const buildURL = (url) => {
      let str = '';
      str = url + '&sessionId=SYNAIRISDEMO_'+ input_index.toString() + '_' + (Math.floor(new Date().getTime() / 1000).toString());
      return str;
    };

    const checkTrackingEvents = (player, adStreams, currentStream, trackingEvents, setTrackingLabels, manifestid, pl) => {
      if (adStreams.includes(currentStream)) {
        //console.log('current stream is an ad');
        for (let q = 0; q < trackingEvents.length; q++) {
          if ((trackingEvents[q].stream === currentStream) && ((player.time(manifestid)*1000) >= trackingEvents[q].pt) && (!trackingEvents[q].reported)) {
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
      else {
        //console.log('current stream is not an ad');
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

    };

    const formatTime = (time) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      const milliseconds = Math.floor((time % 1) * 1000);
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}.${milliseconds}`;
    };

    const handleTogglePlayPause = () => {
      if (isPlaying) {
          leftVideoRef.current.pause();
          rightVideoRef.current.pause();
          setIsPlaying(false);
      } else {
          leftVideoRef.current.play();
          rightVideoRef.current.play();
          setIsPlaying(true);
      }
      //console.log('IsPlaying: ', isPlaying);
    };
    
    const handleReinitialize = () => {
      if (leftPlayer && rightPlayer) {

        let url = '';

        leftPlayer.reset();
        rightPlayer.reset();

        url = buildURL(leftUrl);

        leftPlayer.initialize(leftVideoRef.current, url, false, 0);

        url = buildURL(rightUrl);

        rightPlayer.initialize(rightVideoRef.current, url, false, 0);

      }
      setIsPlaying(false);
      resetTrackingLabels('rl');
    };

    const handleStop = () => {
        leftVideoRef.current.pause();
        leftVideoRef.current.currentTime = 0;
        rightVideoRef.current.pause();
        rightVideoRef.current.currentTime = 0;
        leftCurrentStream = 0;
        rightCurrentStream = 0;
        setIsPlaying(false);
        resetTrackingLabels('rl');
    };

    const getData = async (url) => {
      try {
        const response = await axios.get(url, {headers:{
          'Access-Control-Allow-Origin': '*',
          'Content-Type':'application/json'
        }});
        console.log(response.data);
      } catch (error) {
        console.error('Error posting data:', error);
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
export default Vod;