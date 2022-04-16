import React, { FC, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { Modal, Progress, useToasts } from "@geist-ui/react";
import { FileFunction as FileFunctionIcon } from "@geist-ui/react-icons";
import { FileSelect } from "./components/FileSelect";
import { Video as _Video } from "./components/Video";
import { Canvas as _Canvas } from "./components/Canvas";
import { useMeasure } from "react-use";
import { useDropzone } from "react-dropzone";
import { VideoSeekSlider } from "./components/VideoSeekSlider";
import { IconButton } from "./components/IconButton";
import type { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import { useVideoFile } from "./hooks/useVideoFile";
import { logger } from "./logger";
import { useFfmpeg } from "./hooks/useFfmpeg";
import { Rect } from "./types/Geometry";
import { If, Else, Then } from "react-if";
import { saveAs } from "file-saver";

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

export const Crop: FC = () => {
  const {
    videoSrc,
    videoWidth,
    videoHeight,
    duration,
    filename,
    onOpen: handleVideoFileOpen,
    onLoadedMetadata: handleLoadedMetadata,
  } = useVideoFile();

  const {
    progress,
    status,
    outputFile,
    openInput: handleInputFfmpeg,
    execCrop,
    exitProcess: exitFfmpeg,
  } = useFfmpeg();

  const [currentTime, setCurrentTime] = useState<number>(0);
  const handleChangeCurrentTime = (val: number) => {
    setCurrentTime(val);
  };

  const handleOpenFile = async (file: File) => {
    handleVideoFileOpen(file);
    await handleInputFfmpeg(file);
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

  const [, setToast] = useToasts();

  const handleExecCmd = async () => {
    if (!rect) return;

    await execCrop(rect);
  };

  const handleDownload = async () => {
    if (!outputFile) return;
    saveAs(outputFile.url, outputFile.name);
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
          disabled={status !== "wait"}
        />
      </Panel>

      <Modal visible={status !== "wait"} disableBackdropClick>
        <Modal.Title>
          <If condition={status === "processing"}>
            <Then>Processing</Then>
            <Else>Completed</Else>
          </If>
        </Modal.Title>
        <Modal.Content>
          <Progress type="success" value={progress * 100} />
          {outputFile && <OutputVideo src={outputFile.url} controls />}
        </Modal.Content>
        <Modal.Action passive onClick={exitFfmpeg}>
          <If condition={status === "processing"}>
            <Then>Cancel</Then>
            <Else>Close</Else>
          </If>
        </Modal.Action>
        <Modal.Action loading={outputFile === null} onClick={handleDownload}>
          Download
        </Modal.Action>
      </Modal>
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

const OutputVideo = styled.video`
  margin-top: 8px;
  width: 100%;
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

const ProcessKillButton = styled(IconButton).attrs({
  type: "error",
})``;
