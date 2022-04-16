import { useRef, useState } from "react";
import { logger } from "../logger";
import { Rect } from "../types/Geometry";

const outputFilename = (src: string, suffix: string) => {
  const m = src.match(/(.+)[.]([^.]+)$/);
  if (!m) return undefined;
  return m[1] + suffix + "." + m[2];
};

export const useFfmpeg = () => {
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);

  const [inputFilename, setInputFilename] = useState("");

  const ffmpeg = useRef(
    window.FFmpeg.createFFmpeg({
      progress: ({ ratio }) => {
        setProgress(ratio);
      },
    })
  );

  const openInput = async (file: File) => {
    if (!ffmpeg.current.isLoaded()) {
      await ffmpeg.current.load();
    }

    setInputFilename(file.name);

    ffmpeg.current.FS(
      "writeFile",
      file.name,
      await window.FFmpeg.fetchFile(file)
    );
  };

  const execCrop = async (rect: Rect) => {
    setProgress(0);
    setProcessing(true);

    const output = outputFilename(inputFilename, "_cropped") || "output";

    await ffmpeg.current.run(
      "-i",
      inputFilename,
      "-vf",
      `crop=x=${rect.x}:y=${rect.y}:w=${rect.width}:h=${rect.height}`,
      output
    );

    setProcessing(false);
  };

  const killProcess = () => {
    setProgress(0);
    setProcessing(false);
    try {
      ffmpeg.current.exit();
    } catch (e) {
      logger.error(e);
    }
  };

  return {
    progress,
    processing,
    openInput,
    execCrop,
    killProcess,
  };
};
