import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Component for "special" click-through land page with the image capture from Iris Wheel of Fortune

const LandingPage = () => {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const assetId = params.get('assetId') || 'unknown';
    const [latestImage, setLatestImage] = useState(null);

    useEffect(() => {
      fetch('./specials/index.json')
        .then(res => res.json())
        .then(files => {
          const latest = files
            .filter(f => f.endsWith('.jpg'))
            .sort()
            .reverse()[0]; // latest alphabetically
          setLatestImage(`./specials/${latest}`);
      });
      console.log('Asset ID from URL:', assetId);
    }, [assetId]);

  return (
    <div style={{ textAlign: 'center', fontFamily: 'sans-serif', marginTop: '50px' }}>
      <img src="/iris_logo.png" alt="Landing Visual" style={{maxWidth: '20%', height: 'auto' }} />
      <h1>This is the Synamedia Iris landpage for testing clickable ads.</h1>
      <h2>Congratulations! You won the SPECIAL prize on Iris Wheel of Fortune!</h2>
      <h3>Asset Clicked: <b>{assetId}</b></h3>
      {latestImage && (
        <img
          src={latestImage}
          alt="Latest Special"
          style={{
            display: 'block',
            margin: '30px auto 0 auto',
            maxWidth: '60%',
            filter: 'brightness(1.1) contrast(0.9)'
          }}
        />
      )}
      
    </div>
  );
};

export default LandingPage;
