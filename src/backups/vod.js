import React, { useState, useEffect, useRef } from 'react';
import VideoPlayer from './VideoPlayer';
import "./vod.css";
import dt from './data.json';
import shaka from 'shaka-player';
import 'shaka-player/dist/controls.css';



const Vod = () => {
  const [videoData, setVideoData] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRefA = useRef(null);
  const playerRefB = useRef(null);
  const videoRefA = useRef(null);
  const videoRefB = useRef(null);
  let player_left = useRef(null);
  let player_right = useRef(null);

  useEffect(() => {
    const videoA = videoRefA.current;
    const videoB = videoRefB.current;

    player_left = new shaka.Player(videoA);
    player_right = new shaka.Player(videoB);

    playerRefA.current = player_left;
    playerRefB.current = player_right;

    player_left.addEventListener('error', onErrorEvent);
    player_right.addEventListener('error', onErrorEvent);

    return () => {
      player_left.destroy();
      player_right.destroy();
    };
  }, []);
   
  const onErrorEvent = (event) => {
    onError(event.detail);
  };

  const onError = (error) => {
    console.error('Error code', error.code, 'object', error);
  };

  const handlePlay = () => {

    player_left.load(dt.vod.left_playback_url).then(() => {
      console.log('The video has now been loaded!');
    }).catch(onError);

    player_right.load(dt.vod.right_playback_url).then(() => {
      console.log('The video has now been loaded!');
    }).catch(onError);

    videoRefA.current.play();
    videoRefB.current.play();
  };

  const handlePause = () => {
    videoRefA.current.pause();
    videoRefB.current.pause();
  };

  const getManifest = () => {
    const manifestUri = playerRefA.current.getManifestUri();
    console.log('Manifest URI:', manifestUri);
  };

//  const handleStartPlayback = () => {
//    setIsPlaying(true);
//    if (playerRef.current) {
//      const { player } = playerRef.current;
//      player.load(videoData.playbackUrl).then(() => {
//        playerRef.current.videoElement.play();
//      }).catch(error => console.error('Error loading video:', error));
//    }
//  };

  return (
    <div>
        <h1>VOD Demo</h1>
        <div>
          <table>
              <tr>
                <td>
                  <h2>Demo Scenario: {dt.vod.great_title}</h2>
                </td>
              </tr>
              <tr>
              <td></td>
              </tr>
              <tr>
                <td>
                  <button onClick={handlePlay}>Start Playback</button>
                </td>
                <td>
                  <button onClick={handlePause}>Pause</button>
                </td>
              </tr>
            </table>
        </div>
        <div className="container">
            <div className="left">
              <table>
                <thead>
                  <h3>:: {dt.vod.left_title} ::</h3>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <p>Segment: {dt.vod.left_segment}</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="right">
              <table>
                  <thead>
                    <h3>:: {dt.vod.right_title} ::</h3>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <p>Segment: {dt.vod.right_segment}</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
            </div>
        </div>
        <div className="container">
            <div className="left">
                {/* <VideoPlayer src={dt.vod.left_playback_url} autoPlay={false} /> */}
                <video ref={videoRefA} width="500" controls></video>
            </div>
            <div className="right">
                {/* <VideoPlayer src={dt.vod.right_playback_url} autoPlay={false} /> */}
                <video ref={videoRefB} width="500" controls></video>
            </div>
        </div>
    </div>        
  );
}

export default Vod;