import React from 'react';
import ReactDOM from 'react-dom/client';
import "./index.scss";

import CriaConfig from "./config.js";

window.Cria = new CriaConfig(window.location.href);

import Home from "./home/Home.jsx";
import {BrowserRouter, Route, Routes} from "react-router-dom";

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path={"/"} element={<Home/>}/>
        <Route path={"*"} element={<div>404</div>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

