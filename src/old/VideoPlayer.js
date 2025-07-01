import React from 'react';
import ShakaPlayer from 'shaka-player-react';
import 'shaka-player/dist/controls.css';

function VideoPlayer({ src }, {autoPlay}) {
  return (
    <div className="video-player">
      <ShakaPlayer src={src} autoPlay={autoPlay} />
    </div>
  );
}

export default VideoPlayer;
