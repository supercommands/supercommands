import type * as React from 'react';
import { useState, useEffect } from 'react';

interface LoginGuideProps {
  websiteUrl: string;
}

const LoginGuide: React.FC<LoginGuideProps> = ({ websiteUrl }) => {
  const iconUrl = chrome.runtime.getURL('popup/cmdOS_logo.png');
  const startWritingUrl = chrome.runtime.getURL('popup/start_writing.png');

  const handleLogin = () => {
    chrome.tabs.create({ url: websiteUrl });
  };

  return (
    <div className="w-[300px] h-full min-h-[200px] flex flex-col items-center justify-between bg-neutral-900 px-4 py-4">
      <div className="flex flex-col items-center justify-between w-full max-w-md h-[200px] ">
        {/* Logo - smaller in new tab context */}
        <div className="w-full h-[50px] flex items-center">
          <img src={iconUrl} alt="cmdOS Logo" className="h-10 w-10 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2 text-center">cmdOS</h2>
        </div>

        {/* Illustration */}
        {/* <div className="mb-6 w-full max-w-[180px]">
          <img src={startWritingUrl} alt="Start Writing" className="w-full h-auto object-contain" />
        </div> */}

        {/* <p className="text-sm text-neutral-400 mb-6 text-center">
          Please log in to access your notes and start writing
        </p> */}

        <button
          onClick={handleLogin}
          className="w-full py-2.5 px-4 bg-neutral-600 hover:bg-neutral-500 text-white rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 font-medium">
          Go to Login Page
        </button>

        <p className="text-xs text-neutral-500 mt-4 text-center">
          Think of cmdOS as your digital brain for managing daily browser workflows — all in one place. Search, connect,
          and automate — all from one intelligent interface. Our users save 4+ hours every week
        </p>
      </div>
    </div>
  );
};

export default LoginGuide;
