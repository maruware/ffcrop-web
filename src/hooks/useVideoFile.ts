import { useCallback, useState } from "react";
import { VideoMetadata } from "../types/VideoMetadata";

export const useVideoFile = () => {
  const [videoSrc, setVideoSrc] = useState<string>();
  const [videoWidth, setVideoWidth] = useState<number>();
  const [videoHeight, setVideoHeight] = useState<number>();

  const [duration, setDuration] = useState<number>();

  const [filename, setFilename] = useState("");

  const onLoadedMetadata = useCallback((d: VideoMetadata) => {
    setVideoWidth(d.width);
    setVideoHeight(d.height);
    setDuration(d.duration);
  }, []);

  const onOpen = useCallback((file: File) => {
    // reset
    setVideoWidth(undefined);
    setVideoHeight(undefined);

    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setFilename(file.name);
  }, []);

  return {
    videoSrc,
    videoWidth,
    videoHeight,
    duration,
    filename,
    onOpen,
    onLoadedMetadata,
  };
};
