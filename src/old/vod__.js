// Full-featured VOD component with lifecycle and teardown logic aligned with linear.js
import React, { useEffect, useRef, useState } from 'react';
import dashjs from 'dashjs';
import axios from 'axios';
import dt from '../data.json';

const Vod = ({ input_index }) => {
  const leftVideoRef = useRef(null);
  const rightVideoRef = useRef(null);
  const intervalRef = useRef(null);
  const [leftPlayer, setLeftPlayer] = useState(null);
  const [rightPlayer, setRightPlayer] = useState(null);
  const [leftCurrentTime, setLeftCurrentTime] = useState(0);
  const [rightCurrentTime, setRightCurrentTime] = useState(0);
  const [leftUrl, setLeftUrl] = useState(dt.vod[input_index].left_playback_url);
  const [rightUrl, setRightUrl] = useState(dt.vod[input_index].right_playback_url);
  const [isPlaying, setIsPlaying] = useState(false);
  const defaultLabels = () => ({
    impression: '', adstart: '', firstQuartile: '',
    secondQuartile: '', thirdQuartile: '', completion: ''
  });
  const [leftTrackingLabels, setLeftTrackingLabels] = useState(defaultLabels());
  const [rightTrackingLabels, setRightTrackingLabels] = useState(defaultLabels());

  const resetTrackingLabels = () => {
    setLeftTrackingLabels(defaultLabels());
    setRightTrackingLabels(defaultLabels());
  };

  const buildURL = (url) => `${url}&sessionId=SYNAIRISDEMO_${input_index}_${Math.floor(Date.now() / 1000)}`;

  const getManifestID = (manifests, currentStream) => {
    for (let i = 0; i < manifests.length; i++) {
      if (manifests[i].index === currentStream) return manifests[i].id;
    }
    return '';
  };

  const decodeBase64 = (str) => {
    try { return atob(str); } catch (e) {
      console.error('Invalid Base64 string', e);
      return '';
    }
  };

  const getData = async (url) => {
    try {
      const response = await axios.get(url, { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
      console.log(response.data);
    } catch (error) {
      console.error('Error posting data:', error);
    }
  };

  const checkTrackingEvents = (player, adStreams, currentStream, trackingEvents, setTrackingLabels, manifestid) => {
    if (!adStreams.includes(currentStream)) return;
    for (let q = 0; q < trackingEvents.length; q++) {
      if (
        trackingEvents[q].stream === currentStream &&
        (player.time(manifestid) * 1000) >= trackingEvents[q].pt &&
        !trackingEvents[q].reported
      ) {
        getData(trackingEvents[q].url);
        trackingEvents[q].reported = true;
        setTrackingLabels((prev) => ({
          ...prev,
          [trackingEvents[q].type.toLowerCase().replace(/\s/g, '')]: '✔'
        }));
      }
    }
  };

  const initializePlayers = () => {
    if (leftPlayer) leftPlayer.reset();
    if (rightPlayer) rightPlayer.reset();

    const left = dashjs.MediaPlayer().create();
    const right = dashjs.MediaPlayer().create();
    left.initialize(leftVideoRef.current, buildURL(leftUrl), false);
    right.initialize(rightVideoRef.current, buildURL(rightUrl), false);
    setLeftPlayer(left);
    setRightPlayer(right);

    const updateCurrentTime = () => {
      let leftId = getManifestID(left.getStreamsFromManifest(), 0);
      let rightId = getManifestID(right.getStreamsFromManifest(), 0);
      setLeftCurrentTime(left.time(leftId));
      setRightCurrentTime(right.time(rightId));
    };

    intervalRef.current = setInterval(updateCurrentTime, 250);

    const resetInterval = () => {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(updateCurrentTime, 250);
    };

    left.on(dashjs.MediaPlayer.events.PERIOD_SWITCH_COMPLETED, resetInterval);
    right.on(dashjs.MediaPlayer.events.PERIOD_SWITCH_COMPLETED, resetInterval);
  };

  useEffect(() => {
    initializePlayers();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (leftPlayer) leftPlayer.reset();
      if (rightPlayer) rightPlayer.reset();
      setIsPlaying(false);
      resetTrackingLabels();
    };
  }, [leftUrl, rightUrl]);

  const handleTogglePlayPause = () => {
    if (isPlaying) {
      leftVideoRef.current.pause();
      rightVideoRef.current.pause();
    } else {
      leftVideoRef.current.play();
      rightVideoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    leftVideoRef.current.pause();
    rightVideoRef.current.pause();
    leftVideoRef.current.currentTime = 0;
    rightVideoRef.current.currentTime = 0;
    setIsPlaying(false);
    resetTrackingLabels();
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}.${milliseconds}`;
  };

  return (
    <div>
      <h1>{dt.vod[input_index].great_title}</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2>{dt.vod[input_index].left_title}</h2>
          <video ref={leftVideoRef} controls style={{ width: '750px' }} />
          <p>Current Time: {formatTime(leftCurrentTime)}</p>
          <p>Impression: {leftTrackingLabels.impression}</p>
        </div>
        <div>
          <h2>{dt.vod[input_index].right_title}</h2>
          <video ref={rightVideoRef} controls style={{ width: '750px' }} />
          <p>Current Time: {formatTime(rightCurrentTime)}</p>
          <p>Impression: {rightTrackingLabels.impression}</p>
        </div>
      </div>
      <div style={{ marginTop: '20px' }}>
        <button onClick={handleTogglePlayPause}>{isPlaying ? 'Pause' : 'Play'}</button>
        <button onClick={handleStop}>Stop</button>
      </div>
    </div>
  );
};

export default Vod;
