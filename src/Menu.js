import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import data from './data.json';

const isActive = (item) => item.active !== false;

const pathFor = (item) => {
  const n = item.demo_scene;
  switch (item.type) {
    case 'SPECIALS':
      return `/specials${n}`;
    case 'LINEARCC':
      return `/linearcc${n}`;
    case 'VOD':
    case 'LINEAR':
    default:
      return `/playback${n}`;
  }
};

function Menu() {
  // 'vod' | 'linear' | 'specials' | null
  const [open, setOpen] = useState(null);
  const openMenu = (name) => setOpen(name);
  const closeAll = () => setOpen(null);

  const items = [...data.vod /*.sort((a,b)=>Number(a.demo_scene)-Number(b.demo_scene))*/];

  const vodItems = items
    .filter((i) => i.type === 'VOD' && isActive(i))
    .map((i) => ({ label: i.menu_title, path: pathFor(i), key: i.demo_scene }));

  const linearItems = items
    .filter((i) => i.type === 'LINEAR' && isActive(i))
    .map((i) => ({ label: i.menu_title, path: pathFor(i), key: i.demo_scene }));

  // Specials includes SPECIALS e LINEARCC
  const specialsItems = items
    .filter(i => (i.type === 'SPECIALS' || i.type === 'LINEARCC') && isActive(i))
    .map(i => ({
      label: (i.menu_title ?? '').trim() || `Item ${i.demo_scene}`,
      path: pathFor(i),
      key: `${i.type}-${i.demo_scene}`,
    }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true })
  );

  const topBtn   = 'px-4 py-2 block transition hover:text-yellow-300';
  const dropdown = 'bg-gray-700 rounded shadow-lg min-w-[220px] whitespace-nowrap overflow-hidden';
  
  return (
    <nav className="bg-gray-800 text-white px-6 h-10 shadow-md font-poppins flex items-center">
      <ul className="mx-auto flex items-center justify-center gap-8">
        {/* Home */}
        <li>
          <Link to="/" className={topBtn} onClick={closeAll}>Home</Link>
        </li>

        {/* VOD */}
        {vodItems.length > 0 && (
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
              SSAI-VOD
            </button>

            {open === 'vod' && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full z-50">
                <ul className={dropdown}>
                  {vodItems.map((item) => (
                    <li key={item.key}>
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
        )}

        {/* LINEAR */}
        {linearItems.length > 0 && (
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
              SSAI-Linear
            </button>

            {open === 'linear' && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full z-50">
                <ul className={dropdown}>
                  {linearItems.map((item) => (
                    <li key={item.key}>
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
        )}

        {/* SPECIALS (SPECIALS + LINEARCC) */}
        {specialsItems.length > 0 && (
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
              CSAI-New Inventories
            </button>

            {open === 'specials' && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full z-50">
                <ul className={dropdown}>
                  {specialsItems.map((item) => (
                    <li key={item.key}>
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
        )}
      </ul>
    </nav>
  );
}

export default Menu;
