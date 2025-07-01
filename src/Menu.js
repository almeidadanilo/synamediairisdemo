import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import data from './data.json';

function Menu() {
  const [vodOpen, setVodOpen] = useState(false);
  const [linearOpen, setLinearOpen] = useState(false);
  const [specialsOpen, setSpecialsOpen] = useState(false);

  const vodItems = data.vod
    .filter(item => item.type === "VOD")
    .map((item, index) => ({
      label: item.menu_title,
      path: `/playback${item.demo_scene}`
    }));

  const linearItems = data.vod
    .filter(item => item.type === "LINEAR")
    .map((item, index) => {
      const linearIndex = data.vod.filter(d => d.type === "VOD").length + index;
      return {
        label: item.menu_title,
        path: `/playback${item.demo_scene}`
      };
    });

  const toggleVod = () => {
    setVodOpen(prev => !prev);
    setLinearOpen(false);
    setSpecialsOpen(false);
  };

  const toggleLinear = () => {
    setLinearOpen(prev => !prev);
    setVodOpen(false);
    setSpecialsOpen(false);
  };
  
  const toggleSpecials = () => {
    setSpecialsOpen(prev => !prev);
    setVodOpen(false);
    setLinearOpen(false);
  };

  const closeMenus = () => {
    setVodOpen(false);
    setLinearOpen(false);
    setSpecialsOpen(false);
  };

  return (
    <nav className="bg-gray-800 text-white px-6 py-4 shadow-md" onMouseLeave={closeMenus}>
      <ul className="flex space-x-6 justify-center relative z-50">
        {/* Static */}
        <li><Link to="/" className="hover:text-yellow-300 block px-4 py-2">Home</Link></li>
        <li><Link to="/about" className="hover:text-yellow-300 block px-4 py-2">About</Link></li>

        {/* VOD Toggle */}
        <li className="relative">
          <button onClick={toggleVod} className="block px-4 py-2 hover:text-yellow-300">
            SSAI-VOD
          </button>
          {vodOpen && (
            <ul className="absolute bg-gray-700 mt-2 rounded shadow-lg min-w-[200px] whitespace-nowrap z-50">
              {vodItems.map((item, idx) => (
                <li key={idx}>
                  <Link to={item.path} className="block px-4 py-2 hover:bg-gray-600" onClick={closeMenus}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>

        {/* LINEAR Toggle */}
        <li className="relative">
          <button onClick={toggleLinear} className="block px-4 py-2 hover:text-yellow-300">
            SSAI-Linear
          </button>
          {linearOpen && (
            <ul className="absolute bg-gray-700 mt-2 rounded shadow-lg min-w-[200px] whitespace-nowrap z-50">
              {linearItems.map((item, idx) => (
                <li key={idx}>
                  <Link to={item.path} className="block px-4 py-2 hover:bg-gray-600" onClick={closeMenus}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>

        {/* Special Toggle */}
        <li className="relative">
          <button onClick={toggleSpecials} className="block px-4 py-2 hover:text-yellow-300">
            Special-Cases
          </button>
          {specialsOpen && (
            <ul className="absolute bg-gray-700 mt-2 rounded shadow-lg min-w-[200px] whitespace-nowrap z-50">
              <li key="1">
                <Link to="/specials1" className="block px-4 py-2 hover:bg-gray-600" onClick={closeMenus}>
                  VOD Pause Ads
                </Link>
              </li>
              <li key="2">
                <Link to="/specials2" className="block px-4 py-2 hover:bg-gray-600" onClick={closeMenus}>
                  VOD Ad Video + Overlay
                </Link>
              </li>              
            </ul>
          )}
        </li>
      </ul>
    </nav>
  );
}

export default Menu;
