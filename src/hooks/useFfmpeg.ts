import { useRef, useState } from "react";
import { logger } from "../logger";
import { Rect } from "../types/Geometry";

const outputFilename = (src: string, suffix: string) => {
  const m = src.match(/(.+)[.]([^.]+)$/);
  if (!m) return undefined;
  return m[1] + suffix + "." + m[2];
};

export type Status = "wait" | "processing" | "completed";

export type InputFile = {
  name: string;
  type: string;
};

export type OutputFile = {
  name: string;
  url: string;
  type: string;
};

export const useFfmpeg = () => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status>("wait");

  const [inputFile, setInputFile] = useState<InputFile | null>(null);
  const [outputFile, setOutputFile] = useState<OutputFile | null>(null);

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

    setInputFile({ name: file.name, type: file.type });

    ffmpeg.current.FS(
      "writeFile",
      file.name,
      await window.FFmpeg.fetchFile(file)
    );
  };

  const execCrop = async (rect: Rect) => {
    if (!inputFile) return;
    setProgress(0);
    setStatus("processing");

    const outputName = outputFilename(inputFile.name, "_cropped") || "output";

    await ffmpeg.current.run(
      "-i",
      inputFile.name,
      "-vf",
      `crop=x=${rect.x}:y=${rect.y}:w=${rect.width}:h=${rect.height}`,
      outputName
    );

    setStatus("completed");

    const data = ffmpeg.current.FS("readFile", outputName);
    const u = URL.createObjectURL(
      new Blob([data.buffer], { type: "video/mp4" })
    );
    setOutputFile({
      name: outputName,
      url: u,
      type: inputFile.type,
    });
  };

  const exitProcess = () => {
    setStatus("wait");
    setOutputFile(null);
    setProgress(0);

    try {
      ffmpeg.current.exit();
    } catch (e) {
      logger.error(e);
    }
  };

  return {
    progress,
    status,
    openInput,
    outputFile,
    execCrop,
    exitProcess,
  };
};
