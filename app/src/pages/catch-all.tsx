import {YORK_AI_PAGE} from "@/constants.ts";
import {useEffect} from "react";

export default function CatchAll() {

  useEffect(() => {
    setTimeout(() => {
      window.location.href = YORK_AI_PAGE;
    }, 2000)
  }, []);

  return (
      <div>
        <nav className={"bg-york-red fg-york-red h-24 shadow-xl flex flex-col justify-center items-center"}>
          <h1 className={"text-3xl font-bold"}>Page Not Found</h1>
          <h2>Redirecting to {YORK_AI_PAGE}</h2>
        </nav>
      </div>
  );

}