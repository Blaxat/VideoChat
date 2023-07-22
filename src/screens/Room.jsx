import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import peer from "../service/peer";
import { useSocketContext } from "../context/socketprovider";
import { useNavigate } from 'react-router-dom';

const RoomPage = () => {
  const socket = useSocketContext();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [disconnectButton, setHangUp] = useState(false);
  const [remoteMail, setRemoteMail] = useState("");
  const [isLocalAudioMuted, setLocalAudioMuted] = useState(false);
  const [isRemoteAudioMuted, setRemoteAudioMuted] = useState(false);
  const navigate = useNavigate();

  const handleToggleLocalAudio = () => {
    setLocalAudioMuted((prevMuted) => !prevMuted);
    if (myStream) {
      myStream.getAudioTracks().forEach((track) => {
        track.enabled = !isLocalAudioMuted;
      });
    }
  };

  const handleToggleRemoteAudio = () => {
    setRemoteAudioMuted((prevMuted) => !prevMuted);
    if (remoteStream) {
      remoteStream.getAudioTracks().forEach((track) => {
        track.enabled = !isRemoteAudioMuted;
      });
    }
  };

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
    setRemoteMail(email);
  }, []);

  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
    setHangUp(true);
    setMyStream(stream);
  }, [remoteSocketId, socket]);

  const handleHangUp = useCallback(() => {
    peer.peer.close();
    if (myStream) {
      myStream.getTracks().forEach((track) => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
    }
    navigate('/');
  }, [myStream, remoteStream, navigate]);

  const handleIncommingCall = useCallback(
    async ({ from, offer, mail }) => {
      setRemoteSocketId(from);
      setRemoteMail(mail);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      console.log(`Incoming Call`, from, offer);
      const ans = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    if (myStream) {
      const existingSenders = peer.peer.getSenders();
      const audioSender = existingSenders.find(sender => sender.track && sender.track.kind === 'audio');
      const videoSender = existingSenders.find(sender => sender.track && sender.track.kind === 'video');
  
      if (!audioSender && myStream.getAudioTracks().length > 0) {
        peer.peer.addTrack(myStream.getAudioTracks()[0], myStream);
      }
  
      if (!videoSender && myStream.getVideoTracks().length > 0) {
        peer.peer.addTrack(myStream.getVideoTracks()[0], myStream);
      }
    }
  }, [myStream]);
  

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      console.log("Call Accepted!");
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);

  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams;
      console.log("GOT TRACKS!!");
      setRemoteStream(remoteStream[0]);
    });
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
  ]);

  return (
    <div className="room-container">
      <h4>{remoteSocketId ? "" : "Waiting...."}</h4>
      {remoteSocketId && (
        disconnectButton ? <button onClick={handleHangUp}>HANG UP</button> : 
        <button onClick={handleCallUser}>CONNECT</button>
      )}
      <div className="video-container">
        <div className="video">
          <h2>You</h2>
          {myStream && (
            <>
              <ReactPlayer
                className="react-player"
                playing
                muted={isRemoteAudioMuted}
                height="80%"
                width="100%"
                url={myStream}
              />
              <button onClick={handleToggleLocalAudio} className="button-container">
                {isLocalAudioMuted ? "UNMUTE" : "MUTE"}
              </button>
            </>
          )}
        </div>
        <div className="video">
          <h2>{remoteMail}</h2>
          {remoteStream && (
            <>
              <ReactPlayer
                className="react-player"
                playing
                muted={isRemoteAudioMuted}
                height="80%"
                width="100%"
                url={remoteStream}
              />
              <button onClick={handleToggleRemoteAudio} className="button-container">
                {isRemoteAudioMuted ? "UNMUTE" : "MUTE"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomPage;