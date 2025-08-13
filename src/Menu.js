import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import data from './data.json';

function Menu() {
  // 'vod' | 'linear' | 'specials' | null
  const [open, setOpen] = useState(null);

  const vodItems = data.vod
    .filter(item => item.type === 'VOD')
    .map(item => ({ label: item.menu_title, path: `/playback${item.demo_scene}` }));

  const linearItems = data.vod
    .filter(item => item.type === 'LINEAR')
    .map(item => ({ label: item.menu_title, path: `/playback${item.demo_scene}` }));

  const specialsItems = [
    { label: data.vod[11].menu_title, path: '/specials1' },
    { label: data.vod[12].menu_title, path: '/specials2' },
    { label: data.vod[14].menu_title, path: '/specials3' },
    { label: data.vod[15].menu_title, path: '/linearcc1' },
  ];

  const openMenu = name => setOpen(name);
  const closeAll = () => setOpen(null);

  const topBtn =
    'px-4 py-2 block transition hover:text-yellow-300';

  const dropdown =
    'bg-gray-700 rounded shadow-lg min-w-[220px] whitespace-nowrap overflow-hidden';

  return (
    <nav className="bg-gray-800 text-white px-6 h-10 shadow-md font-poppins flex items-center">
      <ul className="mx-auto flex items-center justify-center gap-8">
        {/* Home */}
        <li>
          <Link to="/" className={topBtn} onClick={closeAll}>Home</Link>
        </li>

        {/* VOD */}
        <li
          className="relative"
          onMouseEnter={() => openMenu('vod')}
          onMouseLeave={closeAll}
        >
          <button
            type="button"
            className={topBtn}
            aria-haspopup="true"
            aria-expanded={open === 'vod'}
            onClick={() => (open === 'vod' ? closeAll() : openMenu('vod'))}
          >
            SSAI‑VOD
          </button>

          {open === 'vod' && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full z-50">
              {/* no padding/margin on top to avoid gaps under h-10 bar */}
              <ul className={dropdown}>
                {vodItems.map((item, idx) => (
                  <li key={idx}>
                    <Link
                      to={item.path}
                      className="block px-5 py-2 hover:bg-gray-600"
                      onClick={closeAll}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>

        {/* LINEAR */}
        <li
          className="relative"
          onMouseEnter={() => openMenu('linear')}
          onMouseLeave={closeAll}
        >
          <button
            type="button"
            className={topBtn}
            aria-haspopup="true"
            aria-expanded={open === 'linear'}
            onClick={() => (open === 'linear' ? closeAll() : openMenu('linear'))}
          >
            SSAI‑Linear
          </button>

          {open === 'linear' && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full z-50">
              <ul className={dropdown}>
                {linearItems.map((item, idx) => (
                  <li key={idx}>
                    <Link
                      to={item.path}
                      className="block px-5 py-2 hover:bg-gray-600"
                      onClick={closeAll}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>

        {/* SPECIALS */}
        <li
          className="relative"
          onMouseEnter={() => openMenu('specials')}
          onMouseLeave={closeAll}
        >
          <button
            type="button"
            className={topBtn}
            aria-haspopup="true"
            aria-expanded={open === 'specials'}
            onClick={() => (open === 'specials' ? closeAll() : openMenu('specials'))}
          >
            Special‑Cases
          </button>

          {open === 'specials' && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full z-50">
              <ul className={dropdown}>
                {specialsItems.map((item, idx) => (
                  <li key={idx}>
                    <Link
                      to={item.path}
                      className="block px-5 py-2 hover:bg-gray-600"
                      onClick={closeAll}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      </ul>
    </nav>
  );
}

export default Menu;
