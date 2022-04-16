import React, { FC, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useToasts } from "@geist-ui/react";
import {
  FileFunction as FileFunctionIcon,
  XCircle as KillIcon,
} from "@geist-ui/react-icons";
import { FileSelect } from "./components/FileSelect";
import { Video as _Video, VideoMetadata } from "./components/Video";
import { Canvas as _Canvas, Rect } from "./components/Canvas";
import { useMeasure } from "react-use";
import { useDropzone } from "react-dropzone";
import { VideoSeekSlider } from "./components/VideoSeekSlider";
import { IconButton } from "./components/IconButton";
import type { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

declare global {
  interface File {
    path: string;
  }

  interface Window {
    FFmpeg: {
      createFFmpeg: typeof createFFmpeg;
      fetchFile: typeof fetchFile;
    };
  }
}

const calcClipPos = (
  boardWidth: number | undefined,
  boardHeight: number | undefined,
  videoWidth: number | undefined,
  videoHeight: number | undefined
) => {
  if (!boardWidth || !boardHeight) {
    return undefined;
  }
  if (!videoWidth || !videoHeight)
    return {
      left: 0,
      top: 0,
      width: boardWidth,
      height: boardHeight,
    };
  // boardの方が横長
  if (boardWidth / boardHeight > videoWidth / videoHeight) {
    const width = Math.floor((videoWidth * boardHeight) / videoHeight);
    return {
      left: Math.floor((boardWidth - width) / 2),
      top: 0,
      height: boardHeight,
      width,
    };
    // boardの方が縦長
  } else {
    const height = Math.floor((videoHeight * boardWidth) / videoWidth);
    return {
      left: 0,
      top: Math.floor((boardHeight - height) / 2),
      width: boardWidth,
      height,
    };
  }
};

const outputFilename = (src: string, suffix: string) => {
  const m = src.match(/(.+)[.]([^.]+)$/);
  if (!m) return undefined;
  return m[1] + suffix + "." + m[2];
};

export const Crop: FC = () => {
  const [progress, setProgress] = useState(0);

  const ffmpeg = useRef(
    window.FFmpeg.createFFmpeg({
      progress: ({ ratio }) => {
        setProgress(ratio);
      },
    })
  );

  const [videoSrc, setVideoSrc] = useState<string>();
  const [videoWidth, setVideoWidth] = useState<number>();
  const [videoHeight, setVideoHeight] = useState<number>();
  const [duration, setDuration] = useState<number>();
  const handleLoadedMetadata = (d: VideoMetadata) => {
    setVideoWidth(d.width);
    setVideoHeight(d.height);
    console.log("duration", d.duration);
    setDuration(d.duration);
  };

  const [currentTime, setCurrentTime] = useState<number>(0);
  const handleChangeCurrentTime = (val: number) => {
    setCurrentTime(val);
  };

  const [filename, setFilename] = useState("");
  const handleOpenFile = async (file: File) => {
    // reset
    setVideoWidth(undefined);
    setVideoHeight(undefined);
    setRect(undefined);

    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setFilename(file.name);

    if (!ffmpeg.current.isLoaded()) {
      await ffmpeg.current.load();
    }

    ffmpeg.current.FS(
      "writeFile",
      file.name,
      await window.FFmpeg.fetchFile(file)
    );
  };

  const handleDropFile = (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) {
      setToast({ type: "error", text: "Bad file" });
      return;
    }
    const file = acceptedFiles[0];
    handleOpenFile(file);
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: "video/*",
    noClick: true,
    onDrop: handleDropFile,
  });

  const [boardRef, { width: boardWidth, height: boardHeight }] =
    useMeasure<HTMLDivElement>();

  const clipPos = useMemo(
    () => calcClipPos(boardWidth, boardHeight, videoWidth, videoHeight),
    [boardHeight, boardWidth, videoHeight, videoWidth]
  );

  const viewBox = useMemo(() => {
    if (!videoWidth || !videoHeight) return undefined;
    return `0, 0, ${videoWidth}, ${videoHeight}`;
  }, [videoHeight, videoWidth]);

  const [rect, setRect] = useState<Rect>();
  const handleRectFixed = (r: Rect) => {
    setRect(r);
  };

  const ffmpegCmd = useMemo(() => {
    if (!rect) return;
    const output = outputFilename(filename, "_cropped") || "output";
    return `ffmpeg -y -i ${filename || "input"} -vf crop=x=${rect.x}:y=${
      rect.y
    }:w=${rect.width}:h=${rect.height} ${output}`;
  }, [filename, rect]);

  const [, setToast] = useToasts();
  const handleCopyCmd = () => {
    if (ffmpegCmd) {
      navigator.clipboard.writeText(ffmpegCmd);
      setToast({ text: "Copied!", type: "success" });
    }
  };

  const [processing, setProcessing] = useState(false);

  // useEffect(() => {
  //   window.api.on("ffmpegOut", (out: string) => {
  //     const out_ = out.replace("\r", "\n");
  //     setProcessOut((prev) => prev + out_);
  //   });
  // }, []);

  const handleExecCmd = async () => {
    if (!rect) return;

    setProgress(0);
    setProcessing(true);

    const output = outputFilename(filename, "_cropped") || "output";

    await ffmpeg.current.run(
      "-i",
      filename,
      "-vf",
      `crop=x=${rect.x}:y=${rect.y}:w=${rect.width}:h=${rect.height}`,
      output
    );

    setProcessing(false);
  };

  const handleKillProcess = () => {
    setProgress(0);
    setProcessing(false);
    try {
      ffmpeg.current.exit();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Container>
      <div {...getRootProps()}>
        <input {...getInputProps()} />
        <Board ref={boardRef}>
          {!isDragActive && !videoSrc && (
            <DropTxt>
              <p>Drop one video file</p>
            </DropTxt>
          )}
          {isDragActive && (
            <DropTxt>
              <p>Continue dropping ...</p>
            </DropTxt>
          )}
          {!isDragActive && videoSrc && clipPos && (
            <>
              <Video
                left={clipPos.left}
                top={clipPos.top}
                width={clipPos.width}
                height={clipPos.height}
                currentTime={currentTime}
                src={videoSrc}
                onLoadedMetadata={handleLoadedMetadata}
              />
              <Canvas
                left={clipPos.left}
                top={clipPos.top}
                width={clipPos.width}
                height={clipPos.height}
                viewBox={viewBox}
                onRectFixed={handleRectFixed}
              />
            </>
          )}
        </Board>
      </div>

      <Panel>
        <Controls>
          <Buttons>
            <FileSelect onOpen={handleOpenFile} />
          </Buttons>
          <VideoControl>
            {duration && (
              <VideoSeekSlider
                duration={duration}
                currentTime={currentTime}
                onChange={handleChangeCurrentTime}
              />
            )}
          </VideoControl>
        </Controls>
        <IconButton
          iconRight={<FileFunctionIcon />}
          onClick={handleExecCmd}
          disabled={processing}
        />

        <p>{progress}</p>

        <ProcessKillButton
          iconRight={<KillIcon />}
          onClick={handleKillProcess}
          disabled={!processing}
        />
      </Panel>
    </Container>
  );
};

const Container = styled.div`
  width: 100%;
`;

type ClipPos = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const Video = styled(_Video)<ClipPos>`
  position: absolute;
  left: ${(props) => `${props.left}px`};
  top: ${(props) => `${props.top}px`};
  width: ${(props) => `${props.width}px`};
  height: ${(props) => `${props.height}px`};
`;

const Canvas = styled(_Canvas)<ClipPos>`
  position: absolute;
  left: ${(props) => `${props.left}px`};
  top: ${(props) => `${props.top}px`};
  width: ${(props) => `${props.width}px`};
  height: ${(props) => `${props.height}px`};
`;

const DropTxt = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  text-align: center;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  p {
    color: white;
    font-size: 36px;
    font-weight: 800;
  }
`;

const Panel = styled.div`
  padding: 8px 16px;
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  justify-content: stretch;
`;

const VideoControl = styled.div`
  width: 100%;
`;

const Board = styled.div`
  position: relative;
  width: 100%;
  height: 440px;
  background-color: black;
`;

const Buttons = styled.div`
  margin-right: 8px;
`;

const FfmpegCmdArea = styled.div`
  margin-top: 16px;
  border-radius: 4px;
  padding: 8px;
  border-style: solid;
  border-color: #eaeaea;
  border-width: 1px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  display: flex;
`;

const ProcessKillButton = styled(IconButton).attrs({
  type: "error",
})``;
