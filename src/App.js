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
            <Route path="/playback1" element={<Vod input_index = {0}/>} />
            <Route path="/playback2" element={<Vod input_index = {1}/>} />
            <Route path="/playback3" element={<Linear input_index = {2}/>} />
            <Route path="/playback4" element={<Linear input_index = {3}/>} />
            <Route path="/playback5" element={<Vod input_index = {4}/>} />
            <Route path="/playback6" element={<Linear input_index = {5}/>} />
            <Route path="/playback7" element={<Vod input_index = {6}/>} />
            <Route path="/playback8" element={<Vod input_index = {7}/>} />
            <Route path="/playback9" element={<Linear input_index = {8}/>} />
            <Route path="/playback10" element={<Linear input_index = {9}/>} />
            <Route path="/playback11" element={<Vod input_index = {10}/>} />
            <Route path="/playback14" element={<Linear input_index = {13}/>} />
            <Route path="/specials1" element={<Specials input_index = {11} inAdPause = {true} inSequence = {'seq1'} inAdOverlay = {false} />} />
            <Route path="/specials2" element={<Specials input_index = {12} inAdPause = {false} inSequence = {''} inAdOverlay = {true} />} />
            <Route path="/specials3" element={<Specials input_index = {14} inAdPause = {false} inSequence = {''} inAdOverlay = {false} inAdPauseVideo = {true} />} />
            <Route path='/linearcc1' element={<LinearCC input_index = {15}/>} />
            <Route path="/playback17" element={<Vod input_index = {16}/>} />
            <Route path="/playback18" element={<Linear input_index = {17}/>} />
            <Route path="/playback19" element={<Linear input_index = {18}/>} />
            <Route path='/playback20' element={<Vod input_index = {19}/>} />
            <Route path='/playback21' element={<Linear input_index = {20}/>} />
            <Route path='/playback22' element={<Linear input_index = {21}/>} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/specials4" element={<Specials input_index = {22} inAdPause = {true} inSequence = {'seq1'} inAdOverlay = {false} />} />
            <Route path="/specials5" element={<Specials input_index = {23} inAdPause = {false} inSequence = {''} inAdOverlay = {true} />} />
            <Route path="/specials6" element={<Specials input_index = {24} inAdPause = {false} inSequence = {''} inAdOverlay = {false} inAdPauseVideo = {true} />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
