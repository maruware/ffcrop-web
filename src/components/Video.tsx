import React, { useEffect, useRef } from "react";
import { useThrottle } from "react-use";
import styled from "styled-components";
import { logger } from "../logger";
import { VideoMetadata } from "../types/VideoMetadata";

export type VideoProps = {
  className?: string;
  currentTime: number;
  src: string;
  onLoadedMetadata: (d: VideoMetadata) => void;
};

export const Video: React.FC<VideoProps> = ({
  className,
  currentTime,
  src,
  onLoadedMetadata,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const throttledCurrentTime = useThrottle(currentTime, 100);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }
    videoRef.current.currentTime = throttledCurrentTime;
  }, [throttledCurrentTime]);

  const handleLoadedMetadata: React.ReactEventHandler<
    HTMLVideoElement
  > = () => {
    if (!videoRef.current) return;

    logger.log("handleLoadedMetadata");
    onLoadedMetadata({
      width: videoRef.current.videoWidth,
      height: videoRef.current.videoHeight,
      duration: videoRef.current.duration,
    });
  };

  return (
    <VideoElem
      ref={videoRef}
      src={src}
      className={className}
      onLoadedMetadata={handleLoadedMetadata}
    />
  );
};

const VideoElem = styled.video`
  background-color: black;
`;
