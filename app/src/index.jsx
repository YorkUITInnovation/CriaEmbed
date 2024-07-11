import React from 'react';
import ReactDOM from 'react-dom/client';
import "./index.scss";

import CriaConfig from "./config.js";

window.Cria = new CriaConfig(window.location.href);

import Home from "./home/Home.jsx";
import {BrowserRouter, Route, Routes} from "react-router-dom";

const root = ReactDOM.createRoot(document.getElementById('root'));

console.log('yikes', import.meta.env.VITE_APP_BASE)
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path={import.meta.env.VITE_APP_BASE || "/"} element={<Home/>}/>
        <Route path={"*"} element={<div>404</div>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

