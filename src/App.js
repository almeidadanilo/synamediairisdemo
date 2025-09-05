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

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 text-gray-900">
        <Header />
        <Menu />
        <div className="border-none border-0">
          <Routes>
            <Route path="/" exact element={<Home/>} />
            <Route path="/playback1" element={<Vod input_index = {0} key ={'k0'}/>} />
            <Route path="/playback2" element={<Vod input_index = {1} key ={'k1'}/>} />
            <Route path="/playback3" element={<Linear input_index = {2} key ={'k2'}/>} />
            <Route path="/playback4" element={<Linear input_index = {3} key ={'k3'}/>} />
            <Route path="/playback5" element={<Vod input_index = {4} key ={'k4'}/>} />
            <Route path="/playback6" element={<Linear input_index = {5} key ={'k5'}/>} />
            <Route path="/playback7" element={<Vod input_index = {6} key ={'k6'}/>} />
            <Route path="/playback8" element={<Vod input_index = {7} key ={'k7'}/>} />
            <Route path="/playback9" element={<Linear input_index = {8} key ={'k8'}/>} />
            <Route path="/playback10" element={<Linear input_index = {9} key ={'k9'}/>} />
            <Route path="/playback11" element={<Vod input_index = {10} key ={'k10'}/>} />
            <Route path="/playback14" element={<Linear input_index = {13} key ={'k11'}/>} />
            <Route path="/specials10" element={<Specials input_index = {11} inAdPause = {true} inSequence = {'seq1'} inAdOverlay = {false} />} />
            <Route path="/specials11" element={<Specials input_index = {12} inAdPause = {false} inSequence = {''} inAdOverlay = {true} />} />
            <Route path="/specials13" element={<Specials input_index = {14} inAdPause = {false} inSequence = {''} inAdOverlay = {false} inAdPauseVideo = {true} />} />
            <Route path='/linearcc16' element={<LinearCC input_index = {15} key ={'k15'}/>} />
            <Route path="/playback17" element={<Vod input_index = {16} key ={'k16'}/>} />
            <Route path="/playback18" element={<Linear input_index = {17} key ={'k17'}/>} />
            <Route path="/playback19" element={<Linear input_index = {18} key ={'k18'}/>} />
            <Route path='/playback20' element={<Vod input_index = {19} key ={'k19'}/>} />
            <Route path='/playback21' element={<Linear input_index = {20} key ={'k20'}/>} />
            <Route path='/playback22' element={<Linear input_index = {21} key ={'k21'}/>} />
            <Route path="/landing" element={<LandingPage key ={'kk'}/>} />
            <Route path="/specials21" element={<Specials input_index = {22} inAdPause = {true} inSequence = {'seq1'} inAdOverlay = {false} />} />
            <Route path="/specials22" element={<Specials input_index = {23} inAdPause = {false} inSequence = {''} inAdOverlay = {true} />} />
            <Route path="/specials23" element={<Specials input_index = {24} inAdPause = {false} inSequence = {''} inAdOverlay = {false} inAdPauseVideo = {true} />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
