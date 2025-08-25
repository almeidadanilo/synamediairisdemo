import React from 'react';

function Home() {
  return (
    <main
      className="
        relative w-full m-0
        min-h-[calc(100svh-96px)]  /* set to your navbar height */
        bg-no-repeat bg-cover bg-center
        p-0 overflow-hidden
      "
      style={{ backgroundImage: "url('/SplashScreenBG.png')" }} // file in /public
    >
      {/* Centered, vertical overlay images */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 pointer-events-none select-none">
        <img src="/SynamediaIrisWhite.png" alt="Syna" className="w-40 md:w-56 lg:w-72 h-auto drop-shadow" />
        <img src="/Welcomeapp.png" alt="Welcome" className="w-48 md:w-72 lg:w-96 h-auto drop-shadow" />
      </div>
    </main>
  );
}

export default Home;