import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Header from './header';
import Home from './Home';
import Menu from './Menu';
import Vod from './vod';
import Linear from './linear';
import LinearCC from './linear_cc';
import LandingPage from './LandingPage';
import Specials from './Specials';
import data from './data.json';

const isActive = (item) => item.active !== false;

const pathFor = (item) => {
  const n = item.demo_scene;
  switch (item.type) {
    case 'SPECIALS': return `/specials${n}`;
    case 'LINEARCC': return `/linearcc${n}`;
    case 'VOD':
    case 'LINEAR':
    default:         return `/playback${n}`;
  }
};

const elementFor = (item, index) => {
  const common = { input_index: index };

  // Optional pass-throughs for Specials if you later add them in JSON
  const specialsProps = {
    inAdPause:      Boolean(item.inAdPause),
    inSequence:     item.inSequence || '',
    inAdOverlay:    Boolean(item.inAdOverlay),
    inAdPauseVideo: Boolean(item.inAdPauseVideo),
  };

  switch (item.type) {
    case 'VOD':      return <Vod      key={`vod-${index}`} {...common} />;
    case 'LINEAR':   return <Linear   key={`lin-${index}`} {...common} />;
    case 'LINEARCC': return <LinearCC key={`lcc-${index}`} {...common} />;
    case 'SPECIALS': return <Specials key={`spc-${index}`} {...common} {...specialsProps} />;
    default:         return null;
  }
};

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 text-gray-900">
        <Header />
        <Menu />
        <div className="border-none border-0">
          <Routes>
            <Route path="/" element={<Home />} />

            {data.vod.map((item, idx) => {
              if (item.active === false) return null;
              const path = pathFor(item);
              const element = elementFor(item, idx);
              /*console.log('ROUTE:', {
                path,
                idx,
                type: item.type,
                element: element && {
                  key: element.key,
                  type: element.type?.name || element.type,
                  props: Object.keys(element.props || {}),
                  input_index: element?.props?.input_index
                }
              });*/
              return element ? <Route key={path} path={path} element={element} /> : null;
            })}
            
            <Route path="/landing" element={<LandingPage />} />
              {/* */}
          </Routes>
        </div>
      </div>
    </Router>
  );
}
