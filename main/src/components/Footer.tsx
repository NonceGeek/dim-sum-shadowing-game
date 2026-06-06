"use client";
import { useState, useRef, useEffect } from "react";
import { BsSoundwave } from "react-icons/bs";
import classNames from "classnames";
import { BsFileEarmarkMusic } from "react-icons/bs";
import { useRouter } from "next/navigation";

export default function Footer({ params }: any) {
  const router = useRouter();
  const [currentPath, setCurrentPath] = useState("");

  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, [currentPath]);

  return (
    <div
      className={classNames({
        flex: 1,
        "footer-wrapper": 1,
        "fixed bottom-0": 1,
        "justify-center": 1,
        "items-center": 1,
        "w-full": 1,
        "py-3": 1,
      })}
    >
      {/* <div
        className={classNames("w-1/2 text-center", {
          "text-green-200":currentPath.includes("follow"),
        })}
        onClick={() => {
          setCurrentPath("follow");
          router.push("/follow");
        }}
      >
        <BsSoundwave className="inline-block mr-2 text-2xl my-2" />
        <p>跟读练习</p>
      </div> 
      <div
        className={classNames("w-1/2 text-center", {
          "text-green-200": currentPath.includes("game"),
        })}
        onClick={() => {
          setCurrentPath("game");
          router.push("/game");
        }}
      >
        <BsFileEarmarkMusic className="inline-block mr-2 text-2xl my-2" />
        <p>游戏模式</p>
      </div>
      */}
    </div>
  );
}
